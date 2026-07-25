"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Division = { id: string; name: string };
type Season = { id: string; label: string; competitions: { name: string; division_id: string } | null };
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

const ALLOWED_STATUS = ["scheduled", "live", "completed", "postponed", "cancelled"];

export default function FixturesAdmin() {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [kickoff, setKickoff] = useState("");

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ added: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadDivisions() {
    const { data } = await supabase.from("divisions").select("id,name").order("name");
    setDivisions(data ?? []);
  }

  async function loadSeasons() {
    const { data } = await supabase
      .from("seasons")
      .select("id,label,competitions(name,division_id)")
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
    loadDivisions();
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

  // --- CSV Import -----------------------------------------------------

  function parseCSV(text: string): Record<string, string>[] {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    return lines.slice(1).map((line) => {
      const cells = line.split(",").map((c) => c.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
      return row;
    });
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    setImportResult(null);
    const text = await file.text();
    const rows = parseCSV(text);

    const errors: string[] = [];
    const toInsert: any[] = [];
    // cache of gameweeks we look up / create during this import: key = `${season_id}:${number}`
    const gameweekCache = new Map<string, string>();

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // +1 for header, +1 for 1-indexing
      const row = rows[i];
      const divisionName = (row["division"] || "").trim();
      const seasonLabel = (row["season"] || "").trim();
      const homeTeamName = (row["home_team"] || "").trim();
      const awayTeamName = (row["away_team"] || "").trim();
      const status = (row["status"] || "scheduled").trim().toLowerCase() || "scheduled";
      const gameweekRaw = (row["gameweek"] || "").trim();
      const kickoffDate = (row["kickoff_date"] || "").trim();
      const kickoffTime = (row["kickoff_time"] || "").trim();
      const venue = (row["venue"] || "").trim();
      const homeScoreRaw = (row["home_score"] || "").trim();
      const awayScoreRaw = (row["away_score"] || "").trim();

      if (!divisionName || !seasonLabel || !homeTeamName || !awayTeamName) {
        errors.push(`Row ${rowNum}: missing division, season, home_team, or away_team`);
        continue;
      }

      const division = divisions.find((d) => d.name.toLowerCase() === divisionName.toLowerCase());
      if (!division) {
        errors.push(`Row ${rowNum}: unknown division "${divisionName}"`);
        continue;
      }

      const season = seasons.find(
        (s) =>
          s.competitions?.division_id === division.id &&
          s.label.toLowerCase() === seasonLabel.toLowerCase()
      );
      if (!season) {
        errors.push(`Row ${rowNum}: unknown season "${seasonLabel}" for division "${divisionName}"`);
        continue;
      }

      const home = teams.find(
        (t) => t.division_id === division.id && t.name.toLowerCase() === homeTeamName.toLowerCase()
      );
      const away = teams.find(
        (t) => t.division_id === division.id && t.name.toLowerCase() === awayTeamName.toLowerCase()
      );
      if (!home) {
        errors.push(`Row ${rowNum}: unknown home_team "${homeTeamName}" in ${divisionName}`);
        continue;
      }
      if (!away) {
        errors.push(`Row ${rowNum}: unknown away_team "${awayTeamName}" in ${divisionName}`);
        continue;
      }
      if (home.id === away.id) {
        errors.push(`Row ${rowNum}: home_team and away_team are the same ("${homeTeamName}")`);
        continue;
      }

      if (!ALLOWED_STATUS.includes(status)) {
        errors.push(`Row ${rowNum}: invalid status "${status}" (must be one of ${ALLOWED_STATUS.join(", ")})`);
        continue;
      }

      let gameweek_id: string | null = null;
      if (gameweekRaw) {
        const num = Number(gameweekRaw);
        if (!Number.isInteger(num) || num < 1) {
          errors.push(`Row ${rowNum}: invalid gameweek "${gameweekRaw}"`);
          continue;
        }
        const cacheKey = `${season.id}:${num}`;
        if (gameweekCache.has(cacheKey)) {
          gameweek_id = gameweekCache.get(cacheKey)!;
        } else {
          const { data: existingGw } = await supabase
            .from("gameweeks")
            .select("id")
            .eq("season_id", season.id)
            .eq("number", num)
            .maybeSingle();
          if (existingGw) {
            gameweek_id = existingGw.id;
          } else {
            const { data: newGw, error: gwError } = await supabase
              .from("gameweeks")
              .insert({ season_id: season.id, number: num })
              .select("id")
              .single();
            if (gwError || !newGw) {
              errors.push(`Row ${rowNum}: could not create gameweek ${num} (${gwError?.message ?? "unknown error"})`);
              continue;
            }
            gameweek_id = newGw.id;
          }
          if (gameweek_id) gameweekCache.set(cacheKey, gameweek_id);
        }
      }

      let kickoff_at: string | null = null;
      if (kickoffDate) {
        const time = kickoffTime || "00:00";
        const dt = new Date(`${kickoffDate}T${time}:00`);
        if (isNaN(dt.getTime())) {
          errors.push(`Row ${rowNum}: invalid kickoff_date/kickoff_time "${kickoffDate} ${kickoffTime}"`);
          continue;
        }
        kickoff_at = dt.toISOString();
      }

      let home_score: number | null = null;
      let away_score: number | null = null;
      if (status === "completed") {
        if (homeScoreRaw === "" || awayScoreRaw === "") {
          errors.push(`Row ${rowNum}: status is "completed" but home_score/away_score is missing`);
          continue;
        }
        home_score = Number(homeScoreRaw);
        away_score = Number(awayScoreRaw);
        if (!Number.isFinite(home_score) || !Number.isFinite(away_score)) {
          errors.push(`Row ${rowNum}: invalid home_score/away_score`);
          continue;
        }
      } else if (homeScoreRaw !== "" && awayScoreRaw !== "") {
        home_score = Number(homeScoreRaw);
        away_score = Number(awayScoreRaw);
      }

      toInsert.push({
        season_id: season.id,
        gameweek_id,
        home_team_id: home.id,
        away_team_id: away.id,
        kickoff_at,
        venue: venue || null,
        status,
        home_score,
        away_score,
      });
    }

    let added = 0;
    if (toInsert.length > 0) {
      const { error, data } = await supabase.from("matches").insert(toInsert).select("id");
      if (error) {
        errors.push(`Insert failed: ${error.message}`);
      } else {
        added = data?.length ?? toInsert.length;
      }
    }

    setImportResult({ added, errors });
    setImporting(false);
    if (selectedSeason) loadMatches(selectedSeason);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Fixtures &amp; Scores</h1>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="bg-slate-900 text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-50"
          >
            {importing ? "Importing…" : "Import CSV"}
          </button>
        </div>
      </div>

      {importResult && (
        <div
          className={`mb-6 rounded-xl border p-4 text-sm ${
            importResult.errors.length > 0
              ? "bg-amber-50 border-amber-200"
              : "bg-green-50 border-green-200"
          }`}
        >
          <div className="font-semibold mb-1">
            Imported {importResult.added} fixture{importResult.added === 1 ? "" : "s"}
            {importResult.errors.length > 0 ? `, ${importResult.errors.length} row(s) skipped` : ""}
          </div>
          {importResult.errors.length > 0 && (
            <ul className="list-disc pl-5 space-y-0.5 text-amber-800">
              {importResult.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

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
