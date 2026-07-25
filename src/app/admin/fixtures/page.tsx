"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import Modal from "@/components/admin/Modal";
import { generateRoundRobin, scheduleMatchdays, type ScheduledMatch } from "@/lib/round-robin";

type Division = { id: string; name: string };
type Season = { id: string; label: string; competitions: { name: string; division_id: string; sponsor_name: string } | null };
type Team = { id: string; name: string; division_id: string };
type Gameweek = { id: string; number: number };
type Match = {
  id: string;
  season_id: string;
  gameweek_id: string | null;
  home_team_id: string;
  away_team_id: string;
  kickoff_at: string | null;
  venue: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
};

const ALLOWED_STATUS = ["scheduled", "live", "completed", "postponed", "cancelled"];
const DIVISION_LABELS: Record<string, string> = {
  gofiber: "gofiber KSIJ PL",
  "Care & Cure": "Care & Cure KSIJ PL",
};

export default function FixturesAdmin() {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [gwIndex, setGwIndex] = useState(0);
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [kickoff, setKickoff] = useState("");

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ added: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Fixture generator state ---
  const [genOpen, setGenOpen] = useState(false);
  const [genStep, setGenStep] = useState<"form" | "preview">("form");
  const [genPitch1, setGenPitch1] = useState(true);
  const [genPitch2, setGenPitch2] = useState(true);
  const [genPitch1Name, setGenPitch1Name] = useState("Pitch 1");
  const [genPitch2Name, setGenPitch2Name] = useState("Pitch 02");
  const [gamesPerDay, setGamesPerDay] = useState("4");
  const [duration, setDuration] = useState("60");
  const [gap, setGap] = useState("15");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("16:00");
  const [allowedDows, setAllowedDows] = useState<Set<number>>(new Set([0, 6])); // Sun, Sat by default
  const [genError, setGenError] = useState("");
  const [genPreview, setGenPreview] = useState<{
    scheduled: ScheduledMatch[];
    roundsCount: number;
    matchdaysCount: number;
    homeCount: Record<string, number>;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [genResult, setGenResult] = useState<{ added: number } | null>(null);

  const DOW_OPTIONS = [
    { value: 1, label: "Mon" },
    { value: 2, label: "Tue" },
    { value: 3, label: "Wed" },
    { value: 4, label: "Thu" },
    { value: 5, label: "Fri" },
    { value: 6, label: "Sat" },
    { value: 0, label: "Sun" },
  ];

  async function loadDivisions() {
    const { data } = await supabase.from("divisions").select("id,name").order("name");
    setDivisions(data ?? []);
  }

  async function loadSeasons() {
    const { data } = await supabase
      .from("seasons")
      .select("id,label,competitions(name,division_id,sponsor_name)")
      .order("label");
    const ordered = [...((data as any) ?? [])].sort(
      (a: any, b: any) =>
        ["gofiber", "Care & Cure"].indexOf(a.competitions?.sponsor_name) -
        ["gofiber", "Care & Cure"].indexOf(b.competitions?.sponsor_name)
    );
    setSeasons(ordered);
    if (ordered.length && !selectedSeason) setSelectedSeason(ordered[0].id);
  }

  async function loadTeams() {
    const { data } = await supabase.from("teams").select("id,name,division_id").order("name");
    setTeams(data ?? []);
  }

  async function loadGameweeks(seasonId: string) {
    const { data } = await supabase.from("gameweeks").select("id,number").eq("season_id", seasonId).order("number");
    setGameweeks(data ?? []);
    setGwIndex(0);
  }

  async function loadMatches(seasonId: string) {
    const { data } = await supabase
      .from("matches")
      .select("id,season_id,gameweek_id,home_team_id,away_team_id,kickoff_at,venue,status,home_score,away_score")
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
    if (selectedSeason) {
      loadMatches(selectedSeason);
      loadGameweeks(selectedSeason);
    }
  }, [selectedSeason]);

  function teamName(id: string) {
    return teams.find((t) => t.id === id)?.name ?? "—";
  }

  const hasUnassigned = matches.some((m) => !m.gameweek_id);
  const gwList: { id: string | null; number: number | null }[] = [
    ...gameweeks.map((g) => ({ id: g.id, number: g.number })),
    ...(hasUnassigned ? [{ id: null, number: null }] : []),
  ];
  const currentGw = gwList[gwIndex] ?? null;
  const gwMatches = currentGw
    ? matches.filter((m) => (currentGw.id === null ? !m.gameweek_id : m.gameweek_id === currentGw.id))
    : [];
  const gwDates = gwMatches
    .map((m) => (m.kickoff_at ? new Date(m.kickoff_at) : null))
    .filter((d): d is Date => !!d)
    .sort((a, b) => a.getTime() - b.getTime());
  const gwDateRange =
    gwDates.length === 0
      ? null
      : gwDates[0].toDateString() === gwDates[gwDates.length - 1].toDateString()
      ? gwDates[0].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
      : `${gwDates[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${gwDates[gwDates.length - 1].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

  async function addFixture(e: React.FormEvent) {
    e.preventDefault();
    if (!homeTeam || !awayTeam || homeTeam === awayTeam) {
      alert("Pick two different teams");
      return;
    }
    const { error } = await supabase.from("matches").insert({
      season_id: selectedSeason,
      gameweek_id: currentGw?.id ?? null,
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
    if (selectedSeason) {
      loadMatches(selectedSeason);
      loadGameweeks(selectedSeason);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // --- Fixture generator -----------------------------------------------

  function openGenerator() {
    setGenStep("form");
    setGenPreview(null);
    setGenResult(null);
    setGenError("");
    setGenOpen(true);
  }

  function currentSeasonTeams(): Team[] {
    const season = seasons.find((s) => s.id === selectedSeason);
    if (!season?.competitions?.division_id) return [];
    return teams.filter((t) => t.division_id === season.competitions!.division_id);
  }

  function handlePreview() {
    setGenError("");
    const divisionTeams = currentSeasonTeams();
    if (divisionTeams.length < 2) {
      setGenError("This season's division needs at least 2 teams to generate fixtures.");
      return;
    }
    const gpd = Number(gamesPerDay);
    const dur = Number(duration);
    const gapMin = Number(gap);
    if (!Number.isInteger(gpd) || gpd < 1) {
      setGenError("Games per match day must be a positive whole number.");
      return;
    }
    if (!Number.isFinite(dur) || dur <= 0 || !Number.isFinite(gapMin) || gapMin < 0) {
      setGenError("Match duration and break must be valid numbers.");
      return;
    }
    if (!startDate) {
      setGenError("Pick a start date.");
      return;
    }
    if (allowedDows.size === 0) {
      setGenError("Select at least one match day of the week.");
      return;
    }
    const pitches: string[] = [];
    if (genPitch1) pitches.push(genPitch1Name.trim() || "Pitch 1");
    if (genPitch2) pitches.push(genPitch2Name.trim() || "Pitch 02");
    if (pitches.length === 0) {
      setGenError("Select at least one pitch.");
      return;
    }

    const [h, m] = startTime.split(":").map(Number);
    const startTimeMinutes = h * 60 + m;

    const { rounds, homeCount } = generateRoundRobin(divisionTeams.map((t) => t.id));
    const scheduled = scheduleMatchdays(rounds, {
      startDate: new Date(`${startDate}T00:00:00`),
      allowedDows,
      gamesPerMatchday: gpd,
      startTimeMinutes,
      durationMinutes: dur,
      gapMinutes: gapMin,
      pitches,
    });

    const matchdaysCount = new Set(scheduled.map((s) => s.kickoffAt.toDateString())).size;

    setGenPreview({ scheduled, roundsCount: rounds.length, matchdaysCount, homeCount });
    setGenStep("preview");
  }

  async function handleConfirmGenerate() {
    if (!genPreview) return;
    setConfirming(true);
    setGenError("");

    // Ensure gameweek rows exist for round numbers 1..roundsCount
    const gameweekIdByRound = new Map<number, string>();
    for (let roundNum = 1; roundNum <= genPreview.roundsCount; roundNum++) {
      const { data: existing } = await supabase
        .from("gameweeks")
        .select("id")
        .eq("season_id", selectedSeason)
        .eq("number", roundNum)
        .maybeSingle();
      if (existing) {
        gameweekIdByRound.set(roundNum, existing.id);
      } else {
        const { data: created, error } = await supabase
          .from("gameweeks")
          .insert({ season_id: selectedSeason, number: roundNum })
          .select("id")
          .single();
        if (error || !created) {
          setGenError(`Could not create gameweek ${roundNum}: ${error?.message ?? "unknown error"}`);
          setConfirming(false);
          return;
        }
        gameweekIdByRound.set(roundNum, created.id);
      }
    }

    const rows = genPreview.scheduled.map((s) => ({
      season_id: selectedSeason,
      gameweek_id: gameweekIdByRound.get(s.roundIndex + 1) ?? null,
      home_team_id: s.home,
      away_team_id: s.away,
      kickoff_at: s.kickoffAt.toISOString(),
      venue: s.venue,
      status: "scheduled",
    }));

    const { error, data } = await supabase.from("matches").insert(rows).select("id");
    setConfirming(false);
    if (error) {
      setGenError(`Insert failed: ${error.message}`);
      return;
    }
    setGenResult({ added: data?.length ?? rows.length });
    if (selectedSeason) {
      loadMatches(selectedSeason);
      loadGameweeks(selectedSeason);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="admin-page-title">Fixtures &amp; Scores</h1>
        <div className="flex gap-2">
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
          <button onClick={openGenerator} className="admin-btn admin-btn-gold">
            Generate Fixtures
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="admin-btn admin-btn-primary"
          >
            {importing ? "Importing…" : "Import CSV"}
          </button>
        </div>
      </div>

      {importResult && (
        <div className={`admin-alert mb-6 ${importResult.errors.length > 0 ? "admin-alert-warning" : "admin-alert-success"}`}>
          <div className="font-semibold mb-1">
            Imported {importResult.added} fixture{importResult.added === 1 ? "" : "s"}
            {importResult.errors.length > 0 ? `, ${importResult.errors.length} row(s) skipped` : ""}
          </div>
          {importResult.errors.length > 0 && (
            <ul className="list-disc pl-5 space-y-0.5">
              {importResult.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 mb-6">
        {seasons.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedSeason(s.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              s.id === selectedSeason ? "admin-btn-primary" : "bg-[#0B3363]/5 text-[#0B3363] hover:bg-[#0B3363]/10"
            }`}
          >
            {DIVISION_LABELS[s.competitions?.sponsor_name ?? ""] ?? s.competitions?.name} — {s.label}
          </button>
        ))}
      </div>

      {gwList.length > 0 && (
        <div className="admin-card px-5 py-3 mb-6 flex items-center justify-between max-w-lg">
          <button
            onClick={() => setGwIndex((i) => Math.max(0, i - 1))}
            disabled={gwIndex === 0}
            className="admin-icon-btn"
            aria-label="Previous match week"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div className="flex items-center gap-2.5 text-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-[#3EA0D9] flex-shrink-0">
              <rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18" /><path d="M8 3v3M16 3v3" />
            </svg>
            <div>
              <div className="font-display font-bold text-sm text-[#0B3363]">
                {currentGw?.id === null ? "Unassigned Fixtures" : `Match Week ${currentGw?.number}`}
              </div>
              {gwDateRange && <div className="text-xs text-slate-400">{gwDateRange}</div>}
            </div>
          </div>
          <button
            onClick={() => setGwIndex((i) => Math.min(gwList.length - 1, i + 1))}
            disabled={gwIndex === gwList.length - 1}
            className="admin-icon-btn"
            aria-label="Next match week"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      )}

      <form onSubmit={addFixture} className="admin-card p-5 mb-8 flex gap-3 items-end flex-wrap">
        <div>
          <label className="admin-label">Home team</label>
          <select value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} className="admin-select w-48">
            <option value="">Select…</option>
            {currentSeasonTeams().map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="admin-label">Away team</label>
          <select value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} className="admin-select w-48">
            <option value="">Select…</option>
            {currentSeasonTeams().map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="admin-label">Kickoff</label>
          <input
            type="datetime-local"
            value={kickoff}
            onChange={(e) => setKickoff(e.target.value)}
            className="admin-input"
          />
        </div>
        <button className="admin-btn admin-btn-primary">Add Fixture</button>
      </form>

      <div className="admin-card overflow-hidden">
        {gwMatches.map((m) => (
          <MatchRow key={m.id} match={m} teamName={teamName} onSave={updateScore} />
        ))}
        {gwMatches.length === 0 && (
          <div className="admin-empty">
            {gwList.length === 0 ? "No fixtures yet for this season." : "No fixtures in this match week."}
          </div>
        )}
      </div>

      <Modal
        open={genOpen}
        onClose={() => setGenOpen(false)}
        title="Generate Fixtures"
        description={
          genStep === "form"
            ? `Round-robin schedule for ${currentSeasonTeams().length} teams in the selected season.`
            : "Review the schedule before creating fixtures."
        }
        maxWidth="max-w-xl"
      >
        {genStep === "form" && (
          <div className="flex flex-col gap-4">
            {matches.length > 0 && (
              <div className="admin-alert admin-alert-warning">
                This season already has {matches.length} fixture{matches.length === 1 ? "" : "s"}. Generating won't remove
                them — new fixtures will be added on top.
              </div>
            )}

            <div>
              <label className="admin-label">Pitches in use</label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm text-[#0B3363]">
                  <input type="checkbox" checked={genPitch1} onChange={(e) => setGenPitch1(e.target.checked)} />
                  <input
                    value={genPitch1Name}
                    onChange={(e) => setGenPitch1Name(e.target.value)}
                    disabled={!genPitch1}
                    className="admin-input py-1 w-40"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-[#0B3363]">
                  <input type="checkbox" checked={genPitch2} onChange={(e) => setGenPitch2(e.target.checked)} />
                  <input
                    value={genPitch2Name}
                    onChange={(e) => setGenPitch2Name(e.target.value)}
                    disabled={!genPitch2}
                    className="admin-input py-1 w-40"
                  />
                </label>
              </div>
              <p className="text-xs text-slate-400 mt-1">Multiple pitches let games run in parallel at the same kickoff time.</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="admin-label">Games / match day</label>
                <input value={gamesPerDay} onChange={(e) => setGamesPerDay(e.target.value)} type="number" min={1} className="admin-input" />
              </div>
              <div>
                <label className="admin-label">Duration (min)</label>
                <input value={duration} onChange={(e) => setDuration(e.target.value)} type="number" min={1} className="admin-input" />
              </div>
              <div>
                <label className="admin-label">Break (min)</label>
                <input value={gap} onChange={(e) => setGap(e.target.value)} type="number" min={0} className="admin-input" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="admin-label">Start date</label>
                <input value={startDate} onChange={(e) => setStartDate(e.target.value)} type="date" className="admin-input" />
              </div>
              <div>
                <label className="admin-label">First kickoff time</label>
                <input value={startTime} onChange={(e) => setStartTime(e.target.value)} type="time" className="admin-input" />
              </div>
            </div>

            <div>
              <label className="admin-label">Match days of the week</label>
              <div className="flex flex-wrap gap-2">
                {DOW_OPTIONS.map((d) => {
                  const checked = allowedDows.has(d.value);
                  return (
                    <button
                      type="button"
                      key={d.value}
                      onClick={() => {
                        setAllowedDows((prev) => {
                          const next = new Set(prev);
                          if (next.has(d.value)) next.delete(d.value);
                          else next.add(d.value);
                          return next;
                        });
                      }}
                      className={`admin-pill ${checked ? "admin-pill-success" : "admin-pill-neutral"}`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {genError && <div className="admin-alert admin-alert-error">{genError}</div>}

            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => setGenOpen(false)} className="admin-btn admin-btn-ghost">Cancel</button>
              <button onClick={handlePreview} className="admin-btn admin-btn-primary">Preview Schedule</button>
            </div>
          </div>
        )}

        {genStep === "preview" && genPreview && !genResult && (
          <div className="flex flex-col gap-4">
            <div className="admin-alert admin-alert-success">
              {currentSeasonTeams().length} teams · {genPreview.roundsCount} rounds · {genPreview.scheduled.length} matches ·{" "}
              {genPreview.matchdaysCount} matchdays
            </div>

            <div>
              <div className="admin-label mb-1">Home / away balance</div>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-[#0B3363]/10">
                <table className="admin-table">
                  <thead>
                    <tr><th>Team</th><th className="text-right">Home</th><th className="text-right">Away</th></tr>
                  </thead>
                  <tbody>
                    {currentSeasonTeams()
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((t) => {
                        const home = genPreview.homeCount[t.id] ?? 0;
                        const total = genPreview.roundsCount;
                        return (
                          <tr key={t.id}>
                            <td>{t.name}</td>
                            <td className="text-right">{home}</td>
                            <td className="text-right">{total - home}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {genError && <div className="admin-alert admin-alert-error">{genError}</div>}

            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => setGenStep("form")} className="admin-btn admin-btn-ghost">Back</button>
              <button onClick={handleConfirmGenerate} disabled={confirming} className="admin-btn admin-btn-primary">
                {confirming ? "Creating…" : "Confirm & Create Fixtures"}
              </button>
            </div>
          </div>
        )}

        {genResult && (
          <div className="flex flex-col gap-4">
            <div className="admin-alert admin-alert-success">
              Created {genResult.added} fixture{genResult.added === 1 ? "" : "s"} across {genPreview?.matchdaysCount} matchdays.
            </div>
            <div className="flex justify-end">
              <button onClick={() => setGenOpen(false)} className="admin-btn admin-btn-primary">Done</button>
            </div>
          </div>
        )}
      </Modal>
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
    <div className="admin-row">
      <div className="w-72 text-[#0B3363]">
        {teamName(match.home_team_id)} <span className="text-slate-400">vs</span> {teamName(match.away_team_id)}
      </div>
      <div className="text-xs text-slate-400 w-40">
        {match.kickoff_at ? new Date(match.kickoff_at).toLocaleString() : "TBD"}
      </div>
      <div className="flex items-center gap-2">
        <input
          value={home}
          onChange={(e) => setHome(e.target.value)}
          className="admin-input w-12 text-center px-1"
          type="number"
        />
        <span className="text-slate-400">–</span>
        <input
          value={away}
          onChange={(e) => setAway(e.target.value)}
          className="admin-input w-12 text-center px-1"
          type="number"
        />
        <button
          onClick={() => onSave(match.id, Number(home), Number(away))}
          disabled={home === "" || away === ""}
          className="admin-btn admin-btn-primary py-1.5 px-3 text-xs"
        >
          Save
        </button>
        <span className={`admin-pill ${match.status === "completed" ? "admin-pill-success" : "admin-pill-neutral"}`}>
          {match.status}
        </span>
      </div>
    </div>
  );
}
