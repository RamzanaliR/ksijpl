"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import FantasySubNav from "@/components/FantasySubNav";
import PitchBackground from "@/components/PitchBackground";
import PlayerJerseyCard from "@/components/PlayerJerseyCard";
import { computeDeadline, formatDeadline } from "@/lib/fantasy-deadline";

type Position = "GK" | "DEF" | "MID" | "FWD";
type Settings = { id: string; season_id: string; squad_size: number; starting_xi_size: number; starting_gk_count: number };
type Player = { id: string; full_name: string; displayName: string; position: Position; price: number; team_id: string };
type LineupEntry = { isStarting: boolean };

const POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD"];
const POSITION_ORDER: Record<Position, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
const FORMATIONS: Record<string, { DEF: number; MID: number; FWD: number }> = {
  "3-3-1": { DEF: 3, MID: 3, FWD: 1 },
  "2-3-2": { DEF: 2, MID: 3, FWD: 2 },
  "3-2-2": { DEF: 3, MID: 2, FWD: 2 },
};
const DEFAULT_FORMATION = "3-3-1";

export default function PickTeam() {
  const params = useParams();
  const router = useRouter();
  const poolId = params.poolId as string;

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [poolLabel, setPoolLabel] = useState("");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [squadPlayers, setSquadPlayers] = useState<Player[]>([]);
  const [lineup, setLineup] = useState<Record<string, LineupEntry>>({});
  const [captainId, setCaptainId] = useState("");
  const [viceCaptainId, setViceCaptainId] = useState("");
  const [formationKey, setFormationKey] = useState(DEFAULT_FORMATION);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [teamSlugs, setTeamSlugs] = useState<Record<string, string | null>>({});
  const [teamShortNames, setTeamShortNames] = useState<Record<string, string>>({});
  const [upcomingFixtures, setUpcomingFixtures] = useState<any[]>([]);
  const [upcomingGwNumber, setUpcomingGwNumber] = useState<number | null>(null);
  const [upcomingGwId, setUpcomingGwId] = useState<string | null>(null);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [usedChips, setUsedChips] = useState<Record<string, boolean>>({});
  const [activeChipThisWeek, setActiveChipThisWeek] = useState<string | null>(null);
  const [chipMessage, setChipMessage] = useState("");
  const [viewMode, setViewMode] = useState<"pitch" | "list">("pitch");
  const [subModeOutId, setSubModeOutId] = useState<string | null>(null);
  const [subModeMessage, setSubModeMessage] = useState("");

  useEffect(() => {
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.push("/fantasy/login");
        return;
      }

      const { data: settingsRow } = await supabase
        .from("fantasy_settings")
        .select("id,season_id,squad_size,starting_xi_size,starting_gk_count,seasons(label,competitions(name,division_id))")
        .eq("id", poolId)
        .maybeSingle();
      if (!settingsRow) {
        setLoading(false);
        return;
      }
      setSettings(settingsRow as any);
      setPoolLabel(`${(settingsRow as any).seasons?.competitions?.name ?? "Fantasy"} — ${(settingsRow as any).seasons?.label ?? ""}`);

      const { data: team } = await supabase
        .from("fantasy_teams")
        .select("id,team_name")
        .eq("fantasy_settings_id", poolId)
        .eq("user_id", authData.user.id)
        .maybeSingle();

      if (!team) {
        router.push(`/fantasy/team/${poolId}`);
        return;
      }
      setTeamId(team.id);
      setTeamName(team.team_name);

      const { data: squadRows } = await supabase
        .from("fantasy_team_players")
        .select("player_id,is_starting,is_captain,is_vice_captain,players(id,full_name,nickname,fpl_name,position,team_id)")
        .eq("fantasy_team_id", team.id);

      if (!squadRows || squadRows.length < (settingsRow as any).squad_size) {
        router.push(`/fantasy/team/${poolId}`);
        return;
      }

      const priceMap: Record<string, number> = {};
      const { data: prices } = await supabase.from("fantasy_player_prices").select("player_id,price").eq("fantasy_settings_id", poolId);
      (prices ?? []).forEach((p: any) => (priceMap[p.player_id] = Number(p.price)));

      const pls: Player[] = squadRows.map((r: any) => ({
        id: r.players.id,
        full_name: r.players.full_name,
        displayName: r.players.fpl_name || r.players.nickname || r.players.full_name,
        position: r.players.position,
        team_id: r.players.team_id,
        price: priceMap[r.players.id] ?? 0,
      }));
      setSquadPlayers(pls);

      const divisionId = (settingsRow as any).seasons?.competitions?.division_id;
      const { data: teamsRaw } = await supabase.from("teams").select("id,name,slug,short_name").eq("division_id", divisionId);
      const slugMap: Record<string, string | null> = {};
      const shortMap: Record<string, string> = {};
      const nameMap: Record<string, string> = {};
      (teamsRaw ?? []).forEach((t: any) => {
        slugMap[t.id] = t.slug;
        shortMap[t.id] = t.short_name || t.name.slice(0, 3).toUpperCase();
        nameMap[t.id] = t.name;
      });
      setTeamSlugs(slugMap);
      setTeamShortNames(shortMap);
      setTeamNames(nameMap);

      const seasonId = (settingsRow as any).season_id;
      const { data: gws } = await supabase.from("gameweeks").select("id,number").eq("season_id", seasonId).order("number");
      const { data: allMatches } = await supabase
        .from("matches")
        .select("id,home_team_id,away_team_id,kickoff_at,status,gameweek_id")
        .eq("season_id", seasonId)
        .in("status", ["scheduled", "live"])
        .order("kickoff_at", { ascending: true });
      const nextGw = (gws ?? []).find((g: any) => (allMatches ?? []).some((m: any) => m.gameweek_id === g.id));
      if (nextGw) {
        setUpcomingGwNumber(nextGw.number);
        setUpcomingGwId(nextGw.id);
        setUpcomingFixtures((allMatches ?? []).filter((m: any) => m.gameweek_id === nextGw.id));

        const { data: chipRows } = await supabase.from("fantasy_chip_usage").select("chip_type,gameweek_id").eq("fantasy_team_id", team.id);
        const used: Record<string, boolean> = {};
        let activeThisWeek: string | null = null;
        (chipRows ?? []).forEach((r: any) => {
          used[r.chip_type] = true;
          if (r.gameweek_id === nextGw.id) activeThisWeek = r.chip_type;
        });
        setUsedChips(used);
        setActiveChipThisWeek(activeThisWeek);
      }

      const lu: Record<string, LineupEntry> = {};
      let anyStarting = false;
      squadRows.forEach((r: any) => {
        lu[r.player_id] = { isStarting: r.is_starting };
        if (r.is_starting) anyStarting = true;
        if (r.is_captain) setCaptainId(r.player_id);
        if (r.is_vice_captain) setViceCaptainId(r.player_id);
      });

      if (!anyStarting) {
        // First time picking a team — auto-apply the default formation
        applyFormationTo(pls, lu, DEFAULT_FORMATION);
      }
      setLineup(lu);

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolId, router]);

  const nextOpponentByTeam: Record<string, { code: string; isHome: boolean }> = useMemo(() => {
    const map: Record<string, { code: string; isHome: boolean }> = {};
    upcomingFixtures.forEach((m: any) => {
      if (m.home_team_id) map[m.home_team_id] = { code: teamShortNames[m.away_team_id] ?? "—", isHome: true };
      if (m.away_team_id) map[m.away_team_id] = { code: teamShortNames[m.home_team_id] ?? "—", isHome: false };
    });
    return map;
  }, [upcomingFixtures, teamShortNames]);

  const deadline = useMemo(() => computeDeadline(upcomingFixtures), [upcomingFixtures]);
  const isLocked = !!deadline && new Date() > deadline;

  const startingCount = squadPlayers.filter((p) => lineup[p.id]?.isStarting).length;
  const startingGkCount = squadPlayers.filter((p) => p.position === "GK" && lineup[p.id]?.isStarting).length;
  // Bench always shown GK -> DEF -> MID -> FWD, by price within each group
  const benchPlayers = squadPlayers
    .filter((p) => !lineup[p.id]?.isStarting)
    .sort((a, b) => POSITION_ORDER[a.position] - POSITION_ORDER[b.position] || b.price - a.price);
  const startingPlayers = squadPlayers.filter((p) => lineup[p.id]?.isStarting);

  const lineupValid =
    settings &&
    startingCount === settings.starting_xi_size &&
    startingGkCount === settings.starting_gk_count &&
    !!captainId &&
    !!viceCaptainId &&
    captainId !== viceCaptainId &&
    startingPlayers.some((p) => p.id === captainId) &&
    startingPlayers.some((p) => p.id === viceCaptainId);

  function startSub(p: Player) {
    setSaved(false);
    setSubModeMessage("");
    setSubModeOutId((prev) => (prev === p.id ? null : p.id));
  }

  function completeSub(outPlayerId: string, inPlayer: Player) {
    const outPlayer = squadPlayers.find((p) => p.id === outPlayerId);
    if (!outPlayer) return;
    const requiredGk = settings?.starting_gk_count ?? 1;
    const wouldBeGkCount = startingGkCount - (outPlayer.position === "GK" ? 1 : 0) + (inPlayer.position === "GK" ? 1 : 0);
    if (wouldBeGkCount !== requiredGk) {
      setSubModeMessage(`That swap would leave ${wouldBeGkCount} goalkeeper${wouldBeGkCount === 1 ? "" : "s"} starting — exactly ${requiredGk} is required.`);
      return;
    }
    setSaved(false);
    setSubModeMessage("");
    setLineup((prev) => ({
      ...prev,
      [outPlayer.id]: { isStarting: false },
      [inPlayer.id]: { isStarting: true },
    }));
    if (captainId === outPlayer.id) setCaptainId("");
    if (viceCaptainId === outPlayer.id) setViceCaptainId("");
    setSubModeOutId(null);
  }

  function applyFormationTo(players: Player[], lu: Record<string, LineupEntry>, key: string) {
    const shape = FORMATIONS[key];
    if (!shape) return;

    const gks = players.filter((p) => p.position === "GK");
    const currentStartGk = gks.find((p) => lu[p.id]?.isStarting);
    const startGk = currentStartGk ?? gks[0];
    gks.forEach((p) => {
      lu[p.id] = { isStarting: p.id === startGk?.id };
    });

    (["DEF", "MID", "FWD"] as const).forEach((pos) => {
      const group = players.filter((p) => p.position === pos).sort((a, b) => b.price - a.price);
      const count = shape[pos];
      group.forEach((p, i) => {
        lu[p.id] = { isStarting: i < count };
      });
    });
  }

  function applyFormation(key: string) {
    setSaved(false);
    setSubModeOutId(null);
    setSubModeMessage("");
    setFormationKey(key);
    const next: Record<string, LineupEntry> = { ...lineup };
    applyFormationTo(squadPlayers, next, key);
    setLineup(next);
    if (captainId && !next[captainId]?.isStarting) setCaptainId("");
    if (viceCaptainId && !next[viceCaptainId]?.isStarting) setViceCaptainId("");
  }

  function setCaptain(playerId: string) {
    setSaved(false);
    setCaptainId((prev) => (prev === playerId ? "" : playerId));
    if (viceCaptainId === playerId) setViceCaptainId("");
  }
  function setVice(playerId: string) {
    setSaved(false);
    setViceCaptainId((prev) => (prev === playerId ? "" : playerId));
    if (captainId === playerId) setCaptainId("");
  }

  async function saveSquad() {
    if (!teamId || !lineupValid) return;
    setSaving(true);
    setError("");
    const benchOrderMap: Record<string, number> = {};
    benchPlayers.forEach((p, i) => (benchOrderMap[p.id] = i + 1));

    for (const p of squadPlayers) {
      const { error } = await supabase
        .from("fantasy_team_players")
        .update({
          is_starting: !!lineup[p.id]?.isStarting,
          is_captain: p.id === captainId,
          is_vice_captain: p.id === viceCaptainId,
          bench_order: lineup[p.id]?.isStarting ? null : benchOrderMap[p.id] ?? null,
        })
        .eq("fantasy_team_id", teamId)
        .eq("player_id", p.id);
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setSaved(true);
  }

  async function playChip(chip: "bench_boost" | "triple_captain" | "free_hit") {
    if (!teamId || !upcomingGwId || isLocked) return;
    if (usedChips[chip]) return;
    if (activeChipThisWeek) {
      setChipMessage("Only one chip can be active per match week.");
      return;
    }
    if (chip === "free_hit" && upcomingGwNumber === 1) {
      setChipMessage("Free Hit unlocks from Match Week 2 onward.");
      return;
    }

    if (chip === "free_hit") {
      const { data: currentSquad } = await supabase
        .from("fantasy_team_players")
        .select("player_id,is_starting,is_captain,is_vice_captain,bench_order")
        .eq("fantasy_team_id", teamId);
      await supabase.from("fantasy_free_hit_snapshots").upsert(
        { fantasy_team_id: teamId, gameweek_id: upcomingGwId, squad: currentSquad ?? [], restored: false },
        { onConflict: "fantasy_team_id" }
      );
    }

    const { error } = await supabase.from("fantasy_chip_usage").insert({ fantasy_team_id: teamId, gameweek_id: upcomingGwId, chip_type: chip });
    if (error) {
      setChipMessage(error.message);
      return;
    }
    setUsedChips((prev) => ({ ...prev, [chip]: true }));
    setActiveChipThisWeek(chip);
    setChipMessage(
      chip === "bench_boost"
        ? "Bench Boost active — your bench's points will count this match week too."
        : chip === "triple_captain"
        ? "Triple Captain active — your captain scores 3x this match week."
        : "Free Hit active — make unlimited free changes this week. Your squad reverts automatically afterwards."
    );
  }

  if (loading || !settings) {
    return (
      <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
        <SiteHeader active="fantasy" />
        <div className="flex-1 flex items-center justify-center text-sm opacity-50">Loading…</div>
        <SiteFooter />
      </div>
    );
  }

  const fixturesCard = (
    <div className="rounded-2xl bg-[#0B1220] text-white p-5">
      <h2 className="font-display font-bold text-lg mb-3">Fixtures</h2>
      <div className="text-center mb-3">
        <div className="font-bold text-sm">Match Week {upcomingGwNumber}</div>
      </div>
      <div className="divide-y divide-white/10">
        {upcomingFixtures.map((m) => (
          <div key={m.id} className="flex items-center py-2.5 text-xs">
            <span className="flex-1 text-right font-semibold truncate pr-2">{teamNames[m.home_team_id] ?? "—"}</span>
            <div className="w-5 h-5 flex-shrink-0 rounded bg-white flex items-center justify-center overflow-hidden mx-1">
              {teamSlugs[m.home_team_id] ? (
                <img src={`/sponsors/${teamSlugs[m.home_team_id]}.png`} alt="" className="w-full h-full object-contain p-0.5" />
              ) : (
                <span className="text-[7px] font-bold text-[#0B3363]">{(teamNames[m.home_team_id] ?? "—").slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <span className="font-bold flex-shrink-0 px-1 w-12 text-center">
              {m.status === "live" ? "● Live" : m.kickoff_at ? new Date(m.kickoff_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "TBD"}
            </span>
            <div className="w-5 h-5 flex-shrink-0 rounded bg-white flex items-center justify-center overflow-hidden mx-1">
              {teamSlugs[m.away_team_id] ? (
                <img src={`/sponsors/${teamSlugs[m.away_team_id]}.png`} alt="" className="w-full h-full object-contain p-0.5" />
              ) : (
                <span className="text-[7px] font-bold text-[#0B3363]">{(teamNames[m.away_team_id] ?? "—").slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <span className="flex-1 text-left font-semibold truncate pl-2">{teamNames[m.away_team_id] ?? "—"}</span>
          </div>
        ))}
        {upcomingFixtures.length === 0 && <div className="text-xs text-white/40 text-center py-4">No fixtures scheduled.</div>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
      <SiteHeader active="fantasy" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        <FantasySubNav poolId={poolId} />
        <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#3EA0D9]">{poolLabel}</div>
            <h1 className="font-display font-bold text-2xl">{teamName}</h1>
            {deadline && (
              <div className={`text-xs mt-1 ${isLocked ? "text-red-600 font-semibold" : "text-[#0B3363]/50 dark:text-white/50"}`}>
                Match Week {upcomingGwNumber} · Deadline: {formatDeadline(deadline)}
                {isLocked && " — locked, changes will apply from next match week"}
              </div>
            )}
          </div>
          <a href={`/fantasy/team/${poolId}/points`} className="text-sm font-semibold text-[#3EA0D9] hover:underline">← My Team</a>
        </div>

        <div className="grid lg:grid-cols-[280px_1fr] gap-6 min-w-0">
          {/* Left: Fixtures (desktop only) */}
          <div className="hidden lg:block">{fixturesCard}</div>

          {/* Right: Pick Team */}
          <div className="min-w-0">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="font-display font-bold text-base">Pick Team</h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-[#0B3363]/5 dark:bg-white/10 rounded-lg p-0.5">
                  <button
                    onClick={() => setViewMode("pitch")}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${viewMode === "pitch" ? "bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white shadow-sm" : "text-[#0B3363]/50 dark:text-white/50"}`}
                  >
                    Pitch
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white shadow-sm" : "text-[#0B3363]/50 dark:text-white/50"}`}
                  >
                    List
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[#0B3363]/50 dark:text-white/50">Formation</label>
                  <select value={formationKey} onChange={(e) => applyFormation(e.target.value)} disabled={isLocked} className="border border-[#0B3363]/15 dark:border-white/15 dark:bg-white/5 rounded-lg px-2 py-1.5 text-xs font-semibold disabled:opacity-50">
                    {Object.keys(FORMATIONS).map((k) => (<option key={k} value={k}>{k}</option>))}
                  </select>
                </div>
              </div>
            </div>
            <p className="text-xs text-[#0B3363]/40 dark:text-white/40 mb-3">
              Tap the yellow icon on a starting player to sub them, tap a bench player to bring them on. Tap C / VC on the right of a player to set captain or vice-captain — {settings.starting_gk_count} GK must always start.
            </p>
            {subModeMessage && <div className="text-xs text-red-600 mb-3">{subModeMessage}</div>}

            {viewMode === "pitch" ? (
              <>
                <PitchBackground>
                  <div className="flex flex-col gap-4">
                    {POSITIONS.map((pos) => {
                      const rowPlayers = startingPlayers.filter((p) => p.position === pos);
                      if (rowPlayers.length === 0) return null;
                      return (
                        <div key={pos} className="flex justify-center gap-3 flex-wrap">
                          {rowPlayers.map((p) => (
                            <PlayerJerseyCard
                              key={p.id}
                              name={p.displayName}
                              teamSlug={teamSlugs[p.team_id]}
                              isGoalkeeper={p.position === "GK"}
                              opponentCode={nextOpponentByTeam[p.team_id]?.code}
                              opponentIsHome={nextOpponentByTeam[p.team_id]?.isHome}
                              showSubIcon={!isLocked}
                              selected={subModeOutId === p.id}
                              dimmed={!!subModeOutId && subModeOutId !== p.id}
                              onSubClick={() => startSub(p)}
                              isCaptain={captainId === p.id}
                              isViceCaptain={viceCaptainId === p.id}
                              onSetCaptain={isLocked ? undefined : () => setCaptain(p.id)}
                              onSetVice={isLocked ? undefined : () => setVice(p.id)}
                            />
                          ))}
                        </div>
                      );
                    })}
                    {startingPlayers.length === 0 && (
                      <div className="text-center text-white/70 text-sm py-10">Pick a formation above, or tap bench players below to build your starting {settings.starting_xi_size}.</div>
                    )}
                  </div>
                </PitchBackground>

                {/* Substitutes — separate white panel below the pitch */}
                <div className="rounded-2xl bg-white dark:bg-white/5 border border-[#0B3363]/10 dark:border-white/10 p-4 mt-4">
                  <div className="flex justify-center gap-6 mb-3">
                    {benchPlayers.map((p) => (
                      <div key={p.id} className="text-[10px] font-bold uppercase text-[#0B3363]/50 dark:text-white/50 tracking-wide">{p.position}</div>
                    ))}
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-1 min-w-0 w-full justify-center">
                    {benchPlayers.map((p) => (
                      <PlayerJerseyCard
                        key={p.id}
                        name={p.displayName}
                        teamSlug={teamSlugs[p.team_id]}
                        isGoalkeeper={p.position === "GK"}
                        opponentCode={nextOpponentByTeam[p.team_id]?.code}
                        opponentIsHome={nextOpponentByTeam[p.team_id]?.isHome}
                        highlighted={!!subModeOutId}
                        dimmed={!subModeOutId}
                        onClick={!isLocked && subModeOutId ? () => completeSub(subModeOutId, p) : undefined}
                      />
                    ))}
                    {benchPlayers.length === 0 && <div className="text-xs text-[#0B3363]/40 dark:text-white/40 py-4">No bench players yet.</div>}
                  </div>
                  <h3 className="font-display font-bold text-sm text-[#0B3363] dark:text-white mt-3 text-center">Substitutes</h3>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 overflow-hidden">
                <div className="px-4 py-2 bg-[#0B3363]/5 dark:bg-white/5 text-[10px] font-bold uppercase text-[#0B3363]/50 dark:text-white/50">Starting {settings.starting_xi_size}</div>
                {startingPlayers.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm border-b border-[#0B3363]/5 dark:border-white/5">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        onClick={() => !isLocked && startSub(p)}
                        className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${subModeOutId === p.id ? "bg-red-500 text-white" : "bg-[#F4B400] text-[#0B3363]"}`}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          {subModeOutId === p.id ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M7 10l5-5 5 5M7 14l5 5 5-5" />}
                        </svg>
                      </button>
                      <span className="text-[10px] font-bold text-[#3EA0D9] flex-shrink-0">{p.position}</span>
                      <span className="truncate">{p.displayName}</span>
                      {captainId === p.id && <span className="text-[9px] font-bold text-[#F4B400] flex-shrink-0">C</span>}
                      {viceCaptainId === p.id && <span className="text-[9px] font-bold text-[#3EA0D9] flex-shrink-0">VC</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {nextOpponentByTeam[p.team_id] && (
                        <span className="text-[10px] text-[#0B3363]/40 dark:text-white/40">
                          {nextOpponentByTeam[p.team_id].code} ({nextOpponentByTeam[p.team_id].isHome ? "H" : "A"})
                        </span>
                      )}
                      <button onClick={() => !isLocked && setCaptain(p.id)} className={`w-5 h-5 rounded-full text-[10px] font-bold ${captainId === p.id ? "bg-[#F4B400] text-[#0B3363]" : "bg-[#0B3363]/10 dark:bg-white/10"}`}>C</button>
                      <button onClick={() => !isLocked && setVice(p.id)} className={`w-5 h-5 rounded-full text-[8px] font-bold ${viceCaptainId === p.id ? "bg-[#3EA0D9] text-white" : "bg-[#0B3363]/10 dark:bg-white/10"}`}>VC</button>
                    </div>
                  </div>
                ))}

                <div className="px-4 py-2 bg-[#0B3363]/5 dark:bg-white/5 text-[10px] font-bold uppercase text-[#0B3363]/50 dark:text-white/50">Substitutes</div>
                {benchPlayers.map((p, i) => {
                  const outfieldIndex = benchPlayers.slice(0, i).filter((q) => q.position !== "GK").length;
                  const label = p.position === "GK" ? "GKP" : `Sub ${outfieldIndex + 1}`;
                  return (
                    <button
                      key={p.id}
                      onClick={() => !isLocked && subModeOutId && completeSub(subModeOutId, p)}
                      disabled={!subModeOutId}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm border-b border-[#0B3363]/5 dark:border-white/5 last:border-0 text-left transition-colors ${
                        subModeOutId ? "hover:bg-[#3EA0D9]/10" : "opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[9px] font-bold text-[#0B3363]/40 dark:text-white/40 flex-shrink-0 w-10">{label}</span>
                        <span className="text-[10px] font-bold text-[#3EA0D9] flex-shrink-0">{p.position}</span>
                        <span className="truncate">{p.displayName}</span>
                      </div>
                      {nextOpponentByTeam[p.team_id] && (
                        <span className="text-[10px] text-[#0B3363]/40 dark:text-white/40 flex-shrink-0">
                          {nextOpponentByTeam[p.team_id].code} ({nextOpponentByTeam[p.team_id].isHome ? "H" : "A"})
                        </span>
                      )}
                    </button>
                  );
                })}
                {squadPlayers.length === 0 && <div className="admin-empty">No squad loaded.</div>}
              </div>
            )}

            {/* Chips — compact, no descriptions, sitting below the team picker */}
            <div className="flex flex-wrap gap-2 mt-4">
              {([
                { key: "bench_boost", label: "Bench Boost" },
                { key: "triple_captain", label: "Triple Captain" },
                { key: "free_hit", label: "Free Hit" },
              ] as const).map((c) => {
                const used = usedChips[c.key];
                const isActive = activeChipThisWeek === c.key;
                const lockedByWeek = c.key === "free_hit" && upcomingGwNumber === 1;
                const disabled = used || isLocked || lockedByWeek || (!!activeChipThisWeek && !isActive);
                return (
                  <button
                    key={c.key}
                    onClick={() => playChip(c.key)}
                    disabled={disabled}
                    className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-[#0B3363]/15 dark:border-white/15 hover:bg-[#0B3363]/5 dark:hover:bg-white/5 transition-colors disabled:opacity-40"
                  >
                    {c.label} {used ? "· Used" : lockedByWeek ? "· From MW2" : "· Play"}
                  </button>
                );
              })}
            </div>
            {chipMessage && <div className="text-xs text-[#0B3363]/60 dark:text-white/60 mt-2">{chipMessage}</div>}

            {/* Fixtures on mobile, below everything */}
            <div className="lg:hidden mt-6">{fixturesCard}</div>

            {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 mt-4">{error}</div>}
            {saved && <div className="rounded-lg bg-green-50 text-green-700 text-sm px-3 py-2 mt-4">Squad saved!</div>}

            <button onClick={saveSquad} disabled={!lineupValid || saving || isLocked} className="w-full mt-4 py-2.5 rounded-lg bg-[#0B3363] text-white dark:bg-[#3EA0D9] font-semibold text-sm disabled:opacity-40">
              {saving ? "Saving…" : "Save Squad"}
            </button>
            {!lineupValid && (
              <p className="text-xs text-[#0B3363]/40 dark:text-white/40 mt-2">
                Set exactly {settings.starting_xi_size} starters (with {settings.starting_gk_count} GK) and choose a captain (C) + vice-captain (VC) to save.
              </p>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
