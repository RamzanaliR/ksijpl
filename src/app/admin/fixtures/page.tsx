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
  const [addFixOpen, setAddFixOpen] = useState(false);

  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState("");
  const [wiping, setWiping] = useState(false);
  const [wipeResult, setWipeResult] = useState("");
  const [recomputing, setRecomputing] = useState(false);
  const [recomputeMsg, setRecomputeMsg] = useState("");

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
      .select("id,label,competitions(name,division_id,sponsor_name,type)")
      .order("label");
    const ordered = [...((data as any) ?? [])]
      .filter((s: any) => s.competitions?.type === "league")
      .sort(
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
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: adminRow } = await supabase.from("admin_users").select("role").eq("id", data.user.id).maybeSingle();
      setIsSuperAdmin(adminRow?.role === "super_admin");
    });
  }, []);

  async function wipeAllData() {
    if (wipeConfirmText !== "WIPE ALL DATA") return;
    setWiping(true);
    setWipeResult("");
    try {
      // Downstream Fantasy points/standings are derived from match data, so clear those first
      await supabase.from("fantasy_player_gameweek_points").delete().not("id", "is", null);
      await supabase.from("fantasy_gameweek_points").delete().not("id", "is", null);
      await supabase.from("fantasy_gameweek_squads").delete().not("id", "is", null);
      await supabase.from("match_events").delete().not("id", "is", null);
      await supabase.from("match_attendance").delete().not("id", "is", null);
      const { error } = await supabase
        .from("matches")
        .update({
          status: "scheduled",
          home_score: null,
          away_score: null,
          home_pens: null,
          away_pens: null,
          home_motm_player_id: null,
          away_motm_player_id: null,
        })
        .not("id", "is", null);
      if (error) throw error;
      setWipeResult("Done — all match results, events, attendance, and Fantasy points have been cleared.");
      setWipeConfirmText("");
      if (selectedSeason) loadMatches(selectedSeason);
    } catch (e: any) {
      setWipeResult(`Error: ${e.message}`);
    }
    setWiping(false);
  }

  useEffect(() => {
    if (selectedSeason) {
      loadMatches(selectedSeason);
      loadGameweeks(selectedSeason);
    }
  }, [selectedSeason]);

  async function recomputeStandings() {
    if (!selectedSeason) return;
    setRecomputing(true); setRecomputeMsg("");
    try {
      const { data: ms } = await supabase.from("matches")
        .select("home_team_id,away_team_id,home_score,away_score")
        .eq("season_id", selectedSeason).not("home_score","is",null);
      const tally: Record<string, {p:number,w:number,d:number,l:number,gf:number,ga:number}> = {};
      const inc = (tid: string) => { if (!tally[tid]) tally[tid]={p:0,w:0,d:0,l:0,gf:0,ga:0}; return tally[tid]; };
      (ms ?? []).forEach((m: any) => {
        const h = inc(m.home_team_id); const a = inc(m.away_team_id);
        h.p++; a.p++; h.gf+=m.home_score; h.ga+=m.away_score; a.gf+=m.away_score; a.ga+=m.home_score;
        if (m.home_score>m.away_score){h.w++;a.l++;}else if(m.home_score<m.away_score){a.w++;h.l++;}else{h.d++;a.d++;}
      });
      const rows = Object.entries(tally).map(([team_id,s])=>({
        season_id:selectedSeason, team_id, played:s.p, won:s.w, drawn:s.d, lost:s.l,
        goals_for:s.gf, goals_against:s.ga, goal_difference:s.gf-s.ga, points:s.w*3+s.d,
      }));
      if (!rows.length) { setRecomputeMsg("No completed matches found — enter results first."); }
      else {
        await supabase.from("season_standings").upsert(rows, { onConflict: "season_id,team_id" });
        setRecomputeMsg(`✓ Standings recomputed for ${rows.length} teams.`);
      }
    } catch(e:any){ setRecomputeMsg(`Error: ${e.message}`); }
    setRecomputing(false);
  }

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
      setAddFixOpen(false);
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
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="admin-page-title">Fixtures</h1>
        <div className="flex gap-2 flex-wrap">
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
          <button onClick={recomputeStandings} disabled={recomputing} className="admin-btn text-xs sm:text-sm px-3 sm:px-4 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100">
            {recomputing ? "Recomputing…" : "↻ Recompute Standings"}
          </button>
          {recomputeMsg && <span className="text-xs font-semibold text-green-600">{recomputeMsg}</span>}
          {isSuperAdmin && (
            <button onClick={() => setWipeOpen(true)} className="admin-btn text-xs sm:text-sm px-3 sm:px-4 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">
              Danger Zone
            </button>
          )}
          <button onClick={() => setAddFixOpen(true)} className="admin-btn admin-btn-primary text-xs sm:text-sm px-3 sm:px-4">
            Add Fixture
          </button>
          <button onClick={openGenerator} className="admin-btn admin-btn-gold text-xs sm:text-sm px-3 sm:px-4">
            Generate Fixtures
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="admin-btn admin-btn-primary text-xs sm:text-sm px-3 sm:px-4"
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

      <div className="flex items-center gap-2 mb-6 flex-wrap">
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

      <Modal
        open={wipeOpen}
        onClose={() => { setWipeOpen(false); setWipeConfirmText(""); setWipeResult(""); }}
        title="Wipe all match data"
        description="This permanently resets every match to scheduled, deletes all goals/cards/attendance/MOTM, and clears all Fantasy points and standings computed from them. This cannot be undone."
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-red-700">
            Type <span className="font-mono font-bold">WIPE ALL DATA</span> below to confirm.
          </p>
          <input
            value={wipeConfirmText}
            onChange={(e) => setWipeConfirmText(e.target.value)}
            placeholder="WIPE ALL DATA"
            className="admin-input font-mono"
          />
          {wipeResult && <div className={`text-sm ${wipeResult.startsWith("Error") ? "text-red-600" : "text-green-700"}`}>{wipeResult}</div>}
          <button
            onClick={wipeAllData}
            disabled={wipeConfirmText !== "WIPE ALL DATA" || wiping}
            className="admin-btn bg-red-600 text-white hover:bg-red-700 disabled:opacity-40"
          >
            {wiping ? "Wiping…" : "Permanently wipe all data"}
          </button>
        </div>
      </Modal>

      <Modal open={addFixOpen} onClose={() => setAddFixOpen(false)} title="Add Fixture" description="Adds to the match week you're currently viewing.">
        <form onSubmit={addFixture} className="flex flex-col gap-3">
          <div>
            <label className="admin-label">Home team</label>
            <select value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} className="admin-select">
              <option value="">Select…</option>
              {currentSeasonTeams().map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="admin-label">Away team</label>
            <select value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} className="admin-select">
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
          <button className="admin-btn admin-btn-primary mt-2">Add Fixture</button>
        </form>
      </Modal>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {gwMatches.map((m) => (
          <MatchRow key={m.id} match={m} teamName={teamName} />
        ))}
        {gwMatches.length === 0 && (
          <div className="admin-empty md:col-span-2">
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                <div className="overflow-x-auto">
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
}: {
  match: Match;
  teamName: (id: string) => string;
}) {
  const played = match.status === "completed";
  return (
    <div className="admin-card p-4">
      {/* Time + venue + status */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-semibold text-[#B8860B] bg-[#F4B400]/15 px-2.5 py-1 rounded-lg">
          {match.kickoff_at
            ? new Date(match.kickoff_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
            : "Time TBD"}
          {match.venue ? ` · ${match.venue}` : ""}
        </div>
        <span className={`admin-pill ${played ? "admin-pill-success" : match.status === "live" ? "admin-pill-warning" : "admin-pill-neutral"}`}>
          {match.status}
        </span>
      </div>

      {/* Teams + score */}
      <div className="flex items-center justify-between font-semibold text-[#0B3363] mb-3 bg-[#3EA0D9]/8 rounded-lg px-3 py-2">
        <span className="truncate">{teamName(match.home_team_id)}</span>
        <span className="flex-shrink-0 px-2 font-display font-bold">
          {played ? `${match.home_score} – ${match.away_score}` : "vs"}
        </span>
        <span className="truncate text-right">{teamName(match.away_team_id)}</span>
      </div>

      <a
        href={`/admin/live/${match.id}`}
        className="admin-btn admin-btn-primary py-1.5 px-3 text-xs w-full text-center block"
      >
        Edit
      </a>
    </div>
  );
}
