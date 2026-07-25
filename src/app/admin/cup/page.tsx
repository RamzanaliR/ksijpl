"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { generateBracket } from "@/lib/bracket";
import { advanceCupWinner } from "@/lib/cup-advance";
import Modal from "@/components/admin/Modal";

type Competition = { id: string; name: string; division_id: string };
type Season = { id: string; label: string };
type Team = { id: string; name: string };
type Gameweek = { id: string; number: number; round_name: string | null };
type Match = {
  id: string;
  gameweek_id: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  home_pens: number | null;
  away_pens: number | null;
  status: string;
  next_match_id: string | null;
};

export default function CupAdmin() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompId, setSelectedCompId] = useState("");
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [divisionTeams, setDivisionTeams] = useState<Team[]>([]);
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  const [newSeasonOpen, setNewSeasonOpen] = useState(false);
  const [newSeasonLabel, setNewSeasonLabel] = useState("");
  const [creatingSeason, setCreatingSeason] = useState(false);

  const [selectedEntrants, setSelectedEntrants] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("competitions").select("id,name,division_id").eq("type", "cup").order("name");
      setCompetitions(data ?? []);
      if (data && data.length) setSelectedCompId(data[0].id);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selectedCompId) return;
    (async () => {
      const comp = competitions.find((c) => c.id === selectedCompId);
      const [{ data: seasonsData }, { data: teamsData }] = await Promise.all([
        supabase.from("seasons").select("id,label").eq("competition_id", selectedCompId).order("label"),
        comp ? supabase.from("teams").select("id,name").eq("division_id", comp.division_id).order("name") : Promise.resolve({ data: [] as Team[] }),
      ]);
      setSeasons(seasonsData ?? []);
      setDivisionTeams(teamsData ?? []);
      setSelectedSeasonId(seasonsData && seasonsData.length ? seasonsData[0].id : "");
      setSelectedEntrants(new Set());
    })();
  }, [selectedCompId, competitions]);

  async function loadBracket(seasonId: string) {
    const [{ data: gws }, { data: ms }] = await Promise.all([
      supabase.from("gameweeks").select("id,number,round_name").eq("season_id", seasonId).order("number"),
      supabase
        .from("matches")
        .select("id,gameweek_id,home_team_id,away_team_id,home_score,away_score,home_pens,away_pens,status,next_match_id")
        .eq("season_id", seasonId),
    ]);
    setGameweeks(gws ?? []);
    setMatches(ms ?? []);
  }

  useEffect(() => {
    if (selectedSeasonId) loadBracket(selectedSeasonId);
    else {
      setGameweeks([]);
      setMatches([]);
    }
  }, [selectedSeasonId]);

  function teamName(id: string | null) {
    if (!id) return null;
    return divisionTeams.find((t) => t.id === id)?.name ?? "—";
  }

  async function createSeason(e: React.FormEvent) {
    e.preventDefault();
    if (!newSeasonLabel.trim() || !selectedCompId) return;
    setCreatingSeason(true);
    const { data, error } = await supabase
      .from("seasons")
      .insert({ competition_id: selectedCompId, label: newSeasonLabel.trim(), is_active: true })
      .select("id,label")
      .single();
    setCreatingSeason(false);
    if (error || !data) {
      alert(error?.message ?? "Could not create season");
      return;
    }
    setSeasons((prev) => [...prev, data]);
    setSelectedSeasonId(data.id);
    setNewSeasonLabel("");
    setNewSeasonOpen(false);
  }

  async function generateAndSaveBracket() {
    if (selectedEntrants.size < 2) {
      setGenError("Pick at least 2 teams.");
      return;
    }
    setGenerating(true);
    setGenError("");

    const rounds = generateBracket([...selectedEntrants]);
    const gwIdByRound = new Map<number, string>();
    const matchIdByRoundPos = new Map<string, string>(); // key `${round}:${position}`

    // Create gameweeks (rounds)
    for (const round of rounds) {
      const roundNum = round[0].round;
      const { data: gw, error } = await supabase
        .from("gameweeks")
        .insert({ season_id: selectedSeasonId, number: roundNum, round_name: round[0].roundName })
        .select("id")
        .single();
      if (error || !gw) {
        setGenError(`Could not create round: ${error?.message ?? "unknown error"}`);
        setGenerating(false);
        return;
      }
      gwIdByRound.set(roundNum, gw.id);
    }

    // Create match rows (skip byes — they don't need a match)
    for (const round of rounds) {
      for (const spec of round) {
        if (spec.isBye) continue;
        const { data: m, error } = await supabase
          .from("matches")
          .insert({
            season_id: selectedSeasonId,
            gameweek_id: gwIdByRound.get(spec.round),
            home_team_id: spec.home,
            away_team_id: spec.away,
            status: "scheduled",
          })
          .select("id")
          .single();
        if (error || !m) {
          setGenError(`Could not create match: ${error?.message ?? "unknown error"}`);
          setGenerating(false);
          return;
        }
        matchIdByRoundPos.set(`${spec.round}:${spec.position}`, m.id);
      }
    }

    // Link next_match_id/slot, and seed byes directly into round 2
    for (const round of rounds) {
      const roundNum = round[0].round;
      const isLastRound = roundNum === rounds.length;
      if (isLastRound) continue;

      for (const spec of round) {
        const nextPos = Math.floor(spec.position / 2);
        const slot: "home" | "away" = spec.position % 2 === 0 ? "home" : "away";
        const nextMatchId = matchIdByRoundPos.get(`${roundNum + 1}:${nextPos}`);
        if (!nextMatchId) continue;

        if (spec.isBye) {
          // Bye winner goes straight into the next round's slot
          await supabase.from("matches").update({ [slot]: spec.home }).eq("id", nextMatchId);
        } else {
          const thisMatchId = matchIdByRoundPos.get(`${roundNum}:${spec.position}`);
          if (thisMatchId) {
            await supabase.from("matches").update({ next_match_id: nextMatchId, next_match_slot: slot }).eq("id", thisMatchId);
          }
        }
      }
    }

    setGenerating(false);
    setSelectedEntrants(new Set());
    loadBracket(selectedSeasonId);
  }

  async function saveScore(matchId: string, homeScore: number, awayScore: number, homePens: number | null, awayPens: number | null) {
    await supabase
      .from("matches")
      .update({ home_score: homeScore, away_score: awayScore, home_pens: homePens, away_pens: awayPens, status: "completed" })
      .eq("id", matchId);
    const { error } = await advanceCupWinner(matchId);
    if (error) alert(error);
    loadBracket(selectedSeasonId);
  }

  const hasBracket = gameweeks.length > 0;
  const finalRound = gameweeks.length ? Math.max(...gameweeks.map((g) => g.number)) : 0;
  const finalMatch = matches.find((m) => gameweeks.find((g) => g.id === m.gameweek_id)?.number === finalRound);
  const champion =
    finalMatch && finalMatch.status === "completed"
      ? finalMatch.home_score !== finalMatch.away_score
        ? teamName(finalMatch.home_score! > finalMatch.away_score! ? finalMatch.home_team_id : finalMatch.away_team_id)
        : finalMatch.home_pens !== null && finalMatch.away_pens !== null
        ? teamName(finalMatch.home_pens > finalMatch.away_pens ? finalMatch.home_team_id : finalMatch.away_team_id)
        : null
      : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="admin-page-title">Cup</h1>
        <button onClick={() => setNewSeasonOpen(true)} className="admin-btn admin-btn-primary text-xs sm:text-sm">
          New Cup Season
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {competitions.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCompId(c.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              c.id === selectedCompId ? "admin-btn-primary" : "bg-[#0B3363]/5 text-[#0B3363]"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {seasons.length > 0 ? (
        <div className="mb-6 max-w-xs">
          <label className="admin-label">Season</label>
          <select value={selectedSeasonId} onChange={(e) => setSelectedSeasonId(e.target.value)} className="admin-select">
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
      ) : (
        !loading && <div className="admin-empty mb-6">No cup seasons yet — create one to get started.</div>
      )}

      {selectedSeasonId && !hasBracket && (
        <div className="admin-card p-5 mb-6">
          <div className="admin-stat-label mb-3">Select entrants ({selectedEntrants.size} picked)</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4 max-h-72 overflow-y-auto">
            {divisionTeams.map((t) => {
              const checked = selectedEntrants.has(t.id);
              return (
                <label key={t.id} className="flex items-center gap-2 text-sm text-[#0B3363]">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setSelectedEntrants((prev) => {
                        const next = new Set(prev);
                        if (next.has(t.id)) next.delete(t.id);
                        else next.add(t.id);
                        return next;
                      });
                    }}
                  />
                  {t.name}
                </label>
              );
            })}
          </div>
          {genError && <div className="admin-alert admin-alert-error mb-3">{genError}</div>}
          <button onClick={generateAndSaveBracket} disabled={generating} className="admin-btn admin-btn-gold">
            {generating ? "Generating…" : "Generate Bracket"}
          </button>
        </div>
      )}

      {champion && (
        <div className="admin-alert admin-alert-success mb-6 flex items-center gap-2 text-base font-semibold">
          🏆 {champion} — Champions
        </div>
      )}

      {hasBracket && (
        <div className="flex gap-6 overflow-x-auto pb-2">
          {gameweeks
            .slice()
            .sort((a, b) => a.number - b.number)
            .map((gw) => (
              <div key={gw.id} className="w-64 flex-shrink-0">
                <h2 className="font-semibold text-[#0B3363] mb-3 text-sm">{gw.round_name ?? `Round ${gw.number}`}</h2>
                <div className="flex flex-col gap-4">
                  {matches
                    .filter((m) => m.gameweek_id === gw.id)
                    .map((m) => (
                      <CupMatchCard key={m.id} match={m} teamName={teamName} onSave={saveScore} />
                    ))}
                </div>
              </div>
            ))}
        </div>
      )}

      <Modal open={newSeasonOpen} onClose={() => setNewSeasonOpen(false)} title="New Cup Season" description="e.g. 2026 Cup">
        <form onSubmit={createSeason} className="flex flex-col gap-3">
          <div>
            <label className="admin-label">Label</label>
            <input value={newSeasonLabel} onChange={(e) => setNewSeasonLabel(e.target.value)} className="admin-input" placeholder="e.g. 2026 Cup" />
          </div>
          <button disabled={creatingSeason} className="admin-btn admin-btn-primary mt-2">
            {creatingSeason ? "Creating…" : "Create Season"}
          </button>
        </form>
      </Modal>
    </div>
  );
}

function CupMatchCard({
  match,
  teamName,
  onSave,
}: {
  match: Match;
  teamName: (id: string | null) => string | null;
  onSave: (matchId: string, home: number, away: number, homePens: number | null, awayPens: number | null) => void;
}) {
  const [home, setHome] = useState(match.home_score?.toString() ?? "");
  const [away, setAway] = useState(match.away_score?.toString() ?? "");
  const [homePens, setHomePens] = useState(match.home_pens?.toString() ?? "");
  const [awayPens, setAwayPens] = useState(match.away_pens?.toString() ?? "");

  const homeName = teamName(match.home_team_id);
  const awayName = teamName(match.away_team_id);
  const isDraw = home !== "" && away !== "" && Number(home) === Number(away);

  function handleSave() {
    if (home === "" || away === "") return;
    if (isDraw && (homePens === "" || awayPens === "" || Number(homePens) === Number(awayPens))) {
      alert("This is a draw — enter a decisive penalty shootout score before saving.");
      return;
    }
    onSave(
      match.id,
      Number(home),
      Number(away),
      homePens === "" ? null : Number(homePens),
      awayPens === "" ? null : Number(awayPens)
    );
  }

  return (
    <div className="admin-card p-3">
      <div className="text-sm font-medium text-[#0B3363] mb-2">
        {homeName ?? <span className="text-slate-400 italic">TBD</span>}
        <span className="text-slate-400 font-normal"> vs </span>
        {awayName ?? <span className="text-slate-400 italic">TBD</span>}
      </div>
      {homeName && awayName ? (
        <>
          <div className="flex items-center gap-2 mb-1">
            <input value={home} onChange={(e) => setHome(e.target.value)} type="number" className="admin-input w-14 text-center px-1" placeholder="-" />
            <span className="text-slate-400">–</span>
            <input value={away} onChange={(e) => setAway(e.target.value)} type="number" className="admin-input w-14 text-center px-1" placeholder="-" />
            <span className={`admin-pill ml-auto ${match.status === "completed" ? "admin-pill-success" : "admin-pill-neutral"}`}>{match.status}</span>
          </div>
          {isDraw && (
            <div className="flex items-center gap-2 mb-1">
              <input value={homePens} onChange={(e) => setHomePens(e.target.value)} type="number" className="admin-input w-14 text-center px-1" placeholder="Pens" />
              <span className="text-slate-400">–</span>
              <input value={awayPens} onChange={(e) => setAwayPens(e.target.value)} type="number" className="admin-input w-14 text-center px-1" placeholder="Pens" />
              <span className="text-xs text-slate-400">Pens</span>
            </div>
          )}
          <button onClick={handleSave} className="admin-btn admin-btn-primary text-xs py-1.5 w-full mt-1">Save</button>
        </>
      ) : (
        <div className="text-xs text-slate-400">Waiting on earlier round</div>
      )}
    </div>
  );
}
