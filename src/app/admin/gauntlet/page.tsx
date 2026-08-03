"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type GauntletMatch = {
  id: string;
  match_number: number;
  division_label: string;
  match_label: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_source_match_number: number | null;
  home_source_is_winner: boolean | null;
  away_source_match_number: number | null;
  away_source_is_winner: boolean | null;
  home_seed: number | null;
  away_seed: number | null;
  home_score: number | null;
  away_score: number | null;
  home_pen_score: number | null;
  away_pen_score: number | null;
  winner_team_id: string | null;
  loser_team_id: string | null;
  kickoff_at: string | null;
  venue: string | null;
  status: string;
};

type TeamStanding = { team_id: string; team_name: string; points: number; goal_difference: number; goals_for: number; position: number };
type Season = { id: string; label: string; has_gauntlet: boolean; gauntlet_top_n: number; competition_id: string };

const SENIORS_ID = "e0eee160-729a-4cbd-a29a-20d36115db31";

// Gauntlet bracket definition (19 matches + SF1 SF2 3rd Final)
// Format: { num, div, label, home: { seed? | { matchNum, isWinner } }, away: { seed? | { matchNum, isWinner } } }
const BRACKET_DEF = [
  // Division 1 — seeded from standings
  { num: 1,  div: "D1", label: "M1",    home: { seed: 13 }, away: { seed: 16 } },
  { num: 2,  div: "D1", label: "M2",    home: { seed: 14 }, away: { seed: 15 } },
  { num: 3,  div: "D1", label: "M3",    home: { seed: 9  }, away: { seed: 12 } },
  { num: 4,  div: "D1", label: "M4",    home: { seed: 10 }, away: { seed: 11 } },
  { num: 5,  div: "D1", label: "M5",    home: { seed: 5  }, away: { seed: 8  } },
  { num: 6,  div: "D1", label: "M6",    home: { seed: 6  }, away: { seed: 7  } },
  { num: 7,  div: "D1", label: "M7",    home: { seed: 1  }, away: { seed: 4  } },
  { num: 8,  div: "D1", label: "M8",    home: { seed: 2  }, away: { seed: 3  } },
  // Division 2
  { num: 9,  div: "D2", label: "M9",    home: { matchNum: 1, isWinner: true  }, away: { matchNum: 3, isWinner: false } },
  { num: 10, div: "D2", label: "M10",   home: { matchNum: 2, isWinner: true  }, away: { matchNum: 4, isWinner: false } },
  // Division 3
  { num: 11, div: "D3", label: "M11",   home: { matchNum: 3, isWinner: true  }, away: { matchNum: 9, isWinner: true  } },
  { num: 12, div: "D3", label: "M12",   home: { matchNum: 4, isWinner: true  }, away: { matchNum: 10, isWinner: true } },
  // Division 4
  { num: 13, div: "D4", label: "M13",   home: { matchNum: 11, isWinner: true }, away: { matchNum: 5, isWinner: false } },
  { num: 14, div: "D4", label: "M14",   home: { matchNum: 12, isWinner: true }, away: { matchNum: 6, isWinner: false } },
  // Division 5
  { num: 15, div: "D5", label: "M15",   home: { matchNum: 5, isWinner: true  }, away: { matchNum: 13, isWinner: true } },
  { num: 16, div: "D5", label: "M16",   home: { matchNum: 6, isWinner: true  }, away: { matchNum: 14, isWinner: true } },
  { num: 17, div: "D5", label: "M17",   home: { matchNum: 15, isWinner: true }, away: { matchNum: 7, isWinner: false } },
  { num: 18, div: "D5", label: "M18",   home: { matchNum: 16, isWinner: true }, away: { matchNum: 8, isWinner: false } },
  // Division 6
  { num: 19, div: "D6", label: "SF1",   home: { matchNum: 7, isWinner: true  }, away: { matchNum: 17, isWinner: false } },
  { num: 20, div: "D6", label: "SF2",   home: { matchNum: 8, isWinner: true  }, away: { matchNum: 18, isWinner: false } },
  { num: 21, div: "D6", label: "3rd",   home: { matchNum: 19, isWinner: false }, away: { matchNum: 20, isWinner: false } },
  { num: 22, div: "D6", label: "Final", home: { matchNum: 19, isWinner: true  }, away: { matchNum: 20, isWinner: true  } },
] as const;

const DIVISIONS = ["D1", "D2", "D3", "D4", "D5", "D6"] as const;

export default function GauntletAdmin() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [standings, setStandings] = useState<TeamStanding[]>([]);
  const [matches, setMatches] = useState<GauntletMatch[]>([]);
  const [teamMap, setTeamMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState("");
  const [editingMatch, setEditingMatch] = useState<GauntletMatch | null>(null);
  const [scoreHome, setScoreHome] = useState("");
  const [scoreAway, setScoreAway] = useState("");
  const [penHome, setPenHome] = useState("");
  const [penAway, setPenAway] = useState("");

  // ── Load seasons ─────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("seasons")
        .select("id,label,has_gauntlet,gauntlet_top_n,competition_id")
        .eq("competition_id", SENIORS_ID)
        .order("created_at", { ascending: false });
      setSeasons((data as Season[]) ?? []);
      if (data?.length) setSelectedSeason(data[0].id);
    })();
  }, []);

  // ── Load standings + matches ──────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!selectedSeason) return;
    setLoading(true);

    const [{ data: standData }, { data: matchData }, { data: teamsData }] = await Promise.all([
      supabase.from("season_standings")
        .select("team_id,points,goal_difference,goals_for,teams(name)")
        .eq("season_id", selectedSeason)
        .order("points", { ascending: false }),
      supabase.from("gauntlet_matches").select("*").eq("season_id", selectedSeason).order("match_number"),
      supabase.from("teams").select("id,name"),
    ]);

    const tMap: Record<string, string> = {};
    (teamsData ?? []).forEach((t: any) => { tMap[t.id] = t.name; });
    setTeamMap(tMap);

    // Rank standings
    const ranked: TeamStanding[] = ((standData ?? []) as any[]).map((r, i) => ({
      team_id: r.team_id,
      team_name: r.teams?.name ?? "—",
      points: r.points,
      goal_difference: r.goal_difference,
      goals_for: r.goals_for,
      position: i + 1,
    }));
    setStandings(ranked);
    setMatches((matchData ?? []) as GauntletMatch[]);
    setLoading(false);
  }, [selectedSeason]);

  useEffect(() => { load(); }, [load]);

  // ── Generate bracket ──────────────────────────────────────────────────────────
  async function generateBracket() {
    if (standings.length < 16) {
      setMsg("Need at least 16 teams in standings to generate the bracket.");
      return;
    }
    if (!confirm("Generate the Gauntlet bracket? This will create all 22 matches.")) return;
    setGenerating(true); setMsg("");

    // Delete existing gauntlet matches for this season
    await supabase.from("gauntlet_matches").delete().eq("season_id", selectedSeason);

    // Build rows from bracket definition
    const rows = BRACKET_DEF.map((def) => {
      const row: any = {
        season_id: selectedSeason,
        match_number: def.num,
        division_label: def.div,
        match_label: def.label,
        status: "scheduled",
      };

      // Home team
      if ("seed" in (def.home as any)) {
        const t = standings.find((s) => s.position === (def.home as any).seed);
        row.home_team_id = t?.team_id ?? null;
        row.home_seed = (def.home as any).seed;
      } else {
        row.home_source_match_number = (def.home as any).matchNum;
        row.home_source_is_winner = (def.home as any).isWinner;
      }

      // Away team
      if ("seed" in (def.away as any)) {
        const t = standings.find((s) => s.position === (def.away as any).seed);
        row.away_team_id = t?.team_id ?? null;
        row.away_seed = (def.away as any).seed;
      } else {
        row.away_source_match_number = (def.away as any).matchNum;
        row.away_source_is_winner = (def.away as any).isWinner;
      }

      return row;
    });

    const { error } = await supabase.from("gauntlet_matches").insert(rows);
    if (error) { setMsg(`Error: ${error.message}`); }
    else {
      // Enable gauntlet on season
      await supabase.from("seasons").update({ has_gauntlet: true }).eq("id", selectedSeason);
      setMsg("Bracket generated! Enter results match by match.");
      await load();
    }
    setGenerating(false);
  }

  // ── Save result ───────────────────────────────────────────────────────────────
  async function saveResult() {
    if (!editingMatch) return;
    const h = parseInt(scoreHome), a = parseInt(scoreAway);
    if (isNaN(h) || isNaN(a)) { setMsg("Enter valid scores."); return; }

    const isPenalties = h === a;
    const ph = penHome ? parseInt(penHome) : null;
    const pa = penAway ? parseInt(penAway) : null;
    if (isPenalties && (ph === null || pa === null)) { setMsg("Scores are level — enter penalty scores."); return; }

    let winnerId: string | null = null;
    let loserId: string | null = null;
    if (editingMatch.home_team_id && editingMatch.away_team_id) {
      if (!isPenalties) {
        winnerId = h > a ? editingMatch.home_team_id : editingMatch.away_team_id;
        loserId  = h > a ? editingMatch.away_team_id : editingMatch.home_team_id;
      } else if (ph !== null && pa !== null) {
        winnerId = ph > pa ? editingMatch.home_team_id : editingMatch.away_team_id;
        loserId  = ph > pa ? editingMatch.away_team_id : editingMatch.home_team_id;
      }
    }

    const { error } = await supabase.from("gauntlet_matches").update({
      home_score: h, away_score: a,
      home_pen_score: isPenalties ? ph : null,
      away_pen_score: isPenalties ? pa : null,
      winner_team_id: winnerId,
      loser_team_id: loserId,
      status: "completed",
    }).eq("id", editingMatch.id);

    if (error) { setMsg(`Error: ${error.message}`); return; }

    // Propagate winner/loser to dependent matches
    if (winnerId && loserId) {
      const deps = BRACKET_DEF.filter((d) =>
        ("matchNum" in d.home && d.home.matchNum === editingMatch.match_number) ||
        ("matchNum" in d.away && d.away.matchNum === editingMatch.match_number)
      );
      for (const dep of deps) {
        const depMatch = matches.find((m) => m.match_number === dep.num);
        if (!depMatch) continue;
        const update: any = {};
        if ("matchNum" in dep.home && dep.home.matchNum === editingMatch.match_number) {
          update.home_team_id = dep.home.isWinner ? winnerId : loserId;
        }
        if ("matchNum" in dep.away && dep.away.matchNum === editingMatch.match_number) {
          update.away_team_id = dep.away.isWinner ? winnerId : loserId;
        }
        if (Object.keys(update).length) {
          await supabase.from("gauntlet_matches").update(update).eq("id", depMatch.id);
        }
      }
    }

    setEditingMatch(null); setScoreHome(""); setScoreAway(""); setPenHome(""); setPenAway("");
    setMsg("Result saved.");
    await load();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const season = seasons.find((s) => s.id === selectedSeason);
  const byDiv = (div: string) => matches.filter((m) => m.division_label === div);
  const tName = (id: string | null) => id ? (teamMap[id] ?? id.slice(0, 8)) : "TBD";
  const final = matches.find((m) => m.match_label === "Final");
  const champion = final?.winner_team_id ? teamMap[final.winner_team_id] : null;

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div>
      <h1 className="admin-page-title mb-1">Gauntlet</h1>
      <p className="admin-subtitle mb-5">Top 16 knockout — Gauntlet winner is Season Champion regardless of league position.</p>

      {/* Season selector */}
      <div className="flex gap-2 mb-5 flex-wrap items-center">
        {seasons.map((s) => (
          <button key={s.id} onClick={() => setSelectedSeason(s.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${s.id === selectedSeason ? "admin-btn-primary" : "bg-[#0B3363]/5 text-[#0B3363]"}`}>
            {s.label}
            {s.has_gauntlet && <span className="ml-1.5 text-[10px] bg-[#F4B400] text-[#0B3363] px-1.5 py-0.5 rounded-full font-bold">GAUNTLET</span>}
          </button>
        ))}
      </div>

      {msg && <div className="admin-card px-4 py-2 mb-4 text-sm font-semibold text-green-700 bg-green-50 border-green-200">{msg}</div>}

      {loading ? (
        <div className="admin-card p-8 text-center text-sm text-[#0B3363]/30">Loading…</div>
      ) : matches.length === 0 ? (
        /* ── No bracket yet ── */
        <div className="space-y-5">
          <div className="admin-card p-5">
            <h2 className="font-display font-bold text-sm mb-3">Season standings ({standings.length} teams)</h2>
            {standings.length < 16 ? (
              <div className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                Need at least 16 teams in standings. Currently {standings.length}.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {standings.slice(0, 16).map((s) => (
                  <div key={s.team_id} className="flex items-center gap-1.5 px-2 py-1.5 bg-[#0B3363]/5 rounded-lg">
                    <span className="font-bold text-[#0B3363]/40 w-4">{s.position}</span>
                    <span className="font-semibold truncate">{s.team_name}</span>
                    <span className="text-[#0B3363]/30 ml-auto">{s.points}pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={generateBracket} disabled={generating || standings.length < 16}
            className="admin-btn admin-btn-gold text-sm">
            {generating ? "Generating…" : "🏆 Generate Gauntlet Bracket"}
          </button>
        </div>
      ) : (
        /* ── Bracket view ── */
        <div className="space-y-5">
          {champion && (
            <div className="admin-card px-5 py-4 bg-[#F4B400]/10 border-[#F4B400]/30 text-center">
              <div className="text-2xl mb-1">🏆</div>
              <div className="font-display font-bold text-lg">{champion}</div>
              <div className="text-xs text-[#0B3363]/50">Season Champion</div>
            </div>
          )}

          {(DIVISIONS as readonly string[]).map((div) => {
            const divMatches = byDiv(div);
            if (!divMatches.length) return null;
            return (
              <div key={div} className="admin-card overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[#0B3363]/8 bg-[#0B3363]/3">
                  <h3 className="font-display font-bold text-sm text-[#0B3363]">Gauntlet {div}</h3>
                </div>
                <div className="divide-y divide-[#0B3363]/5">
                  {divMatches.map((m) => (
                    <div key={m.id} className="px-4 py-3 flex items-center gap-3">
                      <span className="text-[10px] font-bold text-[#0B3363]/30 w-8 flex-shrink-0">{m.match_label}</span>
                      <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 min-w-0">
                        <span className={`text-sm font-semibold truncate ${m.winner_team_id === m.home_team_id ? "text-[#0B3363]" : m.status === "completed" ? "text-[#0B3363]/40" : ""}`}>
                          {tName(m.home_team_id)}
                          {m.home_seed ? <span className="text-[10px] text-[#0B3363]/30 ml-1">#{m.home_seed}</span> : null}
                        </span>
                        <div className="text-center flex-shrink-0">
                          {m.status === "completed" ? (
                            <span className="font-display font-bold text-sm">
                              {m.home_score}–{m.away_score}
                              {m.home_pen_score !== null && <span className="text-[10px] text-[#0B3363]/40 ml-1">({m.home_pen_score}–{m.away_pen_score} pens)</span>}
                            </span>
                          ) : (
                            <span className="text-xs text-[#0B3363]/30">vs</span>
                          )}
                        </div>
                        <span className={`text-sm font-semibold truncate text-right ${m.winner_team_id === m.away_team_id ? "text-[#0B3363]" : m.status === "completed" ? "text-[#0B3363]/40" : ""}`}>
                          {tName(m.away_team_id)}
                          {m.away_seed ? <span className="text-[10px] text-[#0B3363]/30 ml-1">#{m.away_seed}</span> : null}
                        </span>
                      </div>
                      <div className="flex-shrink-0">
                        {m.home_team_id && m.away_team_id ? (
                          <button onClick={() => { setEditingMatch(m); setScoreHome(m.home_score?.toString() ?? ""); setScoreAway(m.away_score?.toString() ?? ""); setPenHome(m.home_pen_score?.toString() ?? ""); setPenAway(m.away_pen_score?.toString() ?? ""); }}
                            className={`text-xs font-semibold ${m.status === "completed" ? "text-[#0B3363]/30 hover:text-[#3EA0D9]" : "text-[#3EA0D9] hover:underline"}`}>
                            {m.status === "completed" ? "Edit" : "Enter result"}
                          </button>
                        ) : (
                          <span className="text-[10px] text-[#0B3363]/20">Awaiting</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Reset bracket */}
          <button onClick={async () => {
            if (!confirm("Reset the entire Gauntlet bracket? All results will be lost.")) return;
            await supabase.from("gauntlet_matches").delete().eq("season_id", selectedSeason);
            await supabase.from("seasons").update({ has_gauntlet: false }).eq("id", selectedSeason);
            setMsg("Bracket reset."); await load();
          }} className="admin-btn text-xs border border-red-200 text-red-500 hover:bg-red-50">
            Reset bracket
          </button>
        </div>
      )}

      {/* Result entry modal */}
      {editingMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setEditingMatch(null)}>
          <div className="bg-white dark:bg-[#0B1220] rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-base mb-1">{editingMatch.match_label} Result</h3>
            <p className="text-sm text-[#0B3363]/50 mb-4">{tName(editingMatch.home_team_id)} vs {tName(editingMatch.away_team_id)}</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div>
                <label className="admin-label">{tName(editingMatch.home_team_id).split(" ")[0]}</label>
                <input value={scoreHome} onChange={(e) => setScoreHome(e.target.value)} type="number" min="0" className="admin-input text-center" placeholder="0" />
              </div>
              <div className="flex items-end justify-center pb-2"><span className="font-bold text-[#0B3363]/40">–</span></div>
              <div>
                <label className="admin-label">{tName(editingMatch.away_team_id).split(" ")[0]}</label>
                <input value={scoreAway} onChange={(e) => setScoreAway(e.target.value)} type="number" min="0" className="admin-input text-center" placeholder="0" />
              </div>
            </div>
            {scoreHome === scoreAway && scoreHome !== "" && (
              <div className="mb-3">
                <p className="text-xs text-[#0B3363]/50 mb-2">Level — enter penalty scores</p>
                <div className="grid grid-cols-3 gap-2">
                  <input value={penHome} onChange={(e) => setPenHome(e.target.value)} type="number" min="0" className="admin-input text-center text-xs" placeholder="Pens" />
                  <div className="flex items-center justify-center text-xs text-[#0B3363]/40">pens</div>
                  <input value={penAway} onChange={(e) => setPenAway(e.target.value)} type="number" min="0" className="admin-input text-center text-xs" placeholder="Pens" />
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setEditingMatch(null)} className="admin-btn admin-btn-secondary flex-1">Cancel</button>
              <button onClick={saveResult} className="admin-btn admin-btn-primary flex-1">Save result</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
