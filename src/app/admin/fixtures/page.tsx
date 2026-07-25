"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Season = { id: string; label: string; competitions: { name: string } | null };
type Team = { id: string; name: string; division_id: string };
type Match = {
  id: string;
  season_id: string;
  home_team_id: string;
  away_team_id: string;
  kickoff_at: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
};

export default function FixturesAdmin() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [kickoff, setKickoff] = useState("");

  async function loadSeasons() {
    const { data } = await supabase
      .from("seasons")
      .select("id,label,competitions(name)")
      .order("label");
    setSeasons((data as any) ?? []);
    if (data && data.length && !selectedSeason) setSelectedSeason(data[0].id);
  }

  async function loadTeams() {
    const { data } = await supabase.from("teams").select("id,name,division_id").order("name");
    setTeams(data ?? []);
  }

  async function loadMatches(seasonId: string) {
    const { data } = await supabase
      .from("matches")
      .select("id,season_id,home_team_id,away_team_id,kickoff_at,status,home_score,away_score")
      .eq("season_id", seasonId)
      .order("kickoff_at", { ascending: true, nullsFirst: true });
    setMatches(data ?? []);
  }

  useEffect(() => {
    loadSeasons();
    loadTeams();
  }, []);

  useEffect(() => {
    if (selectedSeason) loadMatches(selectedSeason);
  }, [selectedSeason]);

  function teamName(id: string) {
    return teams.find((t) => t.id === id)?.name ?? "—";
  }

  async function addFixture(e: React.FormEvent) {
    e.preventDefault();
    if (!homeTeam || !awayTeam || homeTeam === awayTeam) {
      alert("Pick two different teams");
      return;
    }
    const { error } = await supabase.from("matches").insert({
      season_id: selectedSeason,
      home_team_id: homeTeam,
      away_team_id: awayTeam,
      kickoff_at: kickoff || null,
      status: "scheduled",
    });
    if (!error) {
      setHomeTeam("");
      setAwayTeam("");
      setKickoff("");
      loadMatches(selectedSeason);
    } else {
      alert(error.message);
    }
  }

  async function updateScore(id: string, home: number, away: number) {
    await supabase
      .from("matches")
      .update({ home_score: home, away_score: away, status: "completed" })
      .eq("id", id);
    loadMatches(selectedSeason);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Fixtures &amp; Scores</h1>

      <div className="mb-6">
        <label className="block text-xs font-semibold text-slate-500 mb-1">Season</label>
        <select
          value={selectedSeason}
          onChange={(e) => setSelectedSeason(e.target.value)}
          className="border rounded px-3 py-2 text-sm w-80"
        >
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.competitions?.name} — {s.label}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={addFixture} className="bg-white border rounded-xl p-5 mb-8 flex gap-3 items-end flex-wrap">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Home team</label>
          <select value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} className="border rounded px-3 py-2 text-sm w-48">
            <option value="">Select…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Away team</label>
          <select value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} className="border rounded px-3 py-2 text-sm w-48">
            <option value="">Select…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Kickoff</label>
          <input
            type="datetime-local"
            value={kickoff}
            onChange={(e) => setKickoff(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
        </div>
        <button className="bg-blue-700 text-white px-4 py-2 rounded text-sm font-semibold">
          Add Fixture
        </button>
      </form>

      <div className="bg-white border rounded-xl divide-y">
        {matches.map((m) => (
          <MatchRow key={m.id} match={m} teamName={teamName} onSave={updateScore} />
        ))}
        {matches.length === 0 && (
          <div className="px-4 py-4 text-sm text-slate-400">No fixtures yet for this season.</div>
        )}
      </div>
    </div>
  );
}

function MatchRow({
  match,
  teamName,
  onSave,
}: {
  match: Match;
  teamName: (id: string) => string;
  onSave: (id: string, home: number, away: number) => void;
}) {
  const [home, setHome] = useState(match.home_score?.toString() ?? "");
  const [away, setAway] = useState(match.away_score?.toString() ?? "");

  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <div className="w-72">
        {teamName(match.home_team_id)} <span className="text-slate-400">vs</span> {teamName(match.away_team_id)}
      </div>
      <div className="text-xs text-slate-400 w-40">
        {match.kickoff_at ? new Date(match.kickoff_at).toLocaleString() : "TBD"}
      </div>
      <div className="flex items-center gap-2">
        <input
          value={home}
          onChange={(e) => setHome(e.target.value)}
          className="border rounded w-12 text-center py-1"
          type="number"
        />
        <span>–</span>
        <input
          value={away}
          onChange={(e) => setAway(e.target.value)}
          className="border rounded w-12 text-center py-1"
          type="number"
        />
        <button
          onClick={() => onSave(match.id, Number(home), Number(away))}
          disabled={home === "" || away === ""}
          className="bg-blue-900 text-white px-3 py-1.5 rounded text-xs font-semibold disabled:opacity-30"
        >
          Save
        </button>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            match.status === "completed" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          {match.status}
        </span>
      </div>
    </div>
  );
}
