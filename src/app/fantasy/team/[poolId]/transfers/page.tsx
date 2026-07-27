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
type Settings = { id: string; season_id: string; budget: number; transfer_cost_points: number; free_transfers_per_gw: number };
type SquadPlayer = { playerId: string; name: string; position: Position; price: number; teamId: string; isStarting: boolean };
type Candidate = { id: string; name: string; position: Position; team_id: string; price: number };
type PendingTransfer = { outPlayerId: string; inPlayer: Candidate };

const POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD"];
const POSITION_LABELS: Record<Position, string> = { GK: "Goalkeepers", DEF: "Defenders", MID: "Midfielders", FWD: "Forwards" };
const MAX_PER_REAL_TEAM = 2;

export default function TransfersPage() {
  const params = useParams();
  const router = useRouter();
  const poolId = params.poolId as string;

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [poolLabel, setPoolLabel] = useState("");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [teamSlugs, setTeamSlugs] = useState<Record<string, string | null>>({});
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [teamShortNames, setTeamShortNames] = useState<Record<string, string>>({});
  const [totalPointsByPlayer, setTotalPointsByPlayer] = useState<Record<string, number>>({});
  const [gwsScoredCount, setGwsScoredCount] = useState(0);

  const [viewMode, setViewMode] = useState<"pitch" | "list">("pitch");
  const [pending, setPending] = useState<PendingTransfer[]>([]);
  const [pickingOutId, setPickingOutId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [alertMsg, setAlertMsg] = useState("");

  const [upcomingFixtures, setUpcomingFixtures] = useState<any[]>([]);
  const [upcomingGwId, setUpcomingGwId] = useState<string | null>(null);
  const [upcomingGwNumber, setUpcomingGwNumber] = useState<number | null>(null);
  const [transfersUsedThisWeek, setTransfersUsedThisWeek] = useState(0);
  const [paidTransfersThisWeek, setPaidTransfersThisWeek] = useState(0);
  const [usedChips, setUsedChips] = useState<Record<string, boolean>>({});
  const [activeChipThisWeek, setActiveChipThisWeek] = useState<string | null>(null);
  const [freeHitActive, setFreeHitActive] = useState(false);

  async function loadAll() {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      router.push("/fantasy/login");
      return;
    }

    const { data: settingsRow } = await supabase
      .from("fantasy_settings")
      .select("id,season_id,budget,transfer_cost_points,free_transfers_per_gw,seasons(label,competitions(name,division_id))")
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
      .select("id")
      .eq("fantasy_settings_id", poolId)
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (!team) {
      router.push(`/fantasy/team/${poolId}`);
      return;
    }
    setTeamId(team.id);

    const { data: squadRows } = await supabase
      .from("fantasy_team_players")
      .select("player_id,is_starting,players(id,full_name,fpl_name,nickname,position,team_id)")
      .eq("fantasy_team_id", team.id);

    const divisionId = (settingsRow as any).seasons?.competitions?.division_id;
    const { data: teamsRaw } = await supabase.from("teams").select("id,name,slug,short_name").eq("division_id", divisionId);
    const teamIds = (teamsRaw ?? []).map((t: any) => t.id);
    const slugMap: Record<string, string | null> = {};
    const nameMap: Record<string, string> = {};
    const shortMap: Record<string, string> = {};
    (teamsRaw ?? []).forEach((t: any) => {
      slugMap[t.id] = t.slug;
      nameMap[t.id] = t.name;
      shortMap[t.id] = t.short_name || t.name.slice(0, 3).toUpperCase();
    });
    setTeamSlugs(slugMap);
    setTeamNames(nameMap);
    setTeamShortNames(shortMap);

    const { data: prices } = await supabase.from("fantasy_player_prices").select("player_id,price").eq("fantasy_settings_id", poolId);
    const priceMap: Record<string, number> = {};
    (prices ?? []).forEach((p: any) => (priceMap[p.player_id] = Number(p.price)));

    const sq: SquadPlayer[] = (squadRows ?? []).map((r: any) => ({
      playerId: r.player_id,
      name: r.players.fpl_name || r.players.nickname || r.players.full_name,
      position: r.players.position,
      teamId: r.players.team_id,
      price: priceMap[r.player_id] ?? 0,
      isStarting: r.is_starting,
    }));
    setSquad(sq);

    const existingIds = new Set(sq.map((p) => p.playerId));
    const { data: allPlayers } = await supabase
      .from("players")
      .select("id,full_name,fpl_name,nickname,position,team_id")
      .in("team_id", teamIds.length ? teamIds : ["00000000-0000-0000-0000-000000000000"])
      .not("position", "is", null);
    const cands: Candidate[] = (allPlayers ?? [])
      .filter((p: any) => !existingIds.has(p.id) && priceMap[p.id] !== undefined)
      .map((p: any) => ({ id: p.id, name: p.fpl_name || p.nickname || p.full_name, position: p.position, team_id: p.team_id, price: priceMap[p.id] }));
    setCandidates(cands);

    // Real total points scored so far this season, per player (used for the TP column)
    const { data: allPlayerPoints } = await supabase.from("fantasy_player_gameweek_points").select("player_id,gameweek_id,points").eq("fantasy_settings_id", poolId);
    const totals: Record<string, number> = {};
    const gwSet = new Set<string>();
    (allPlayerPoints ?? []).forEach((p: any) => {
      totals[p.player_id] = (totals[p.player_id] ?? 0) + p.points;
      gwSet.add(p.gameweek_id);
    });
    setTotalPointsByPlayer(totals);
    setGwsScoredCount(gwSet.size);

    const seasonId = (settingsRow as any).season_id;
    const { data: gws } = await supabase.from("gameweeks").select("id,number").eq("season_id", seasonId).order("number");
    const { data: allMatches } = await supabase
      .from("matches")
      .select("id,gameweek_id,home_team_id,away_team_id,kickoff_at,status")
      .eq("season_id", seasonId)
      .in("status", ["scheduled", "live"])
      .order("kickoff_at", { ascending: true });
    const nextGw = (gws ?? []).find((g: any) => (allMatches ?? []).some((m: any) => m.gameweek_id === g.id));
    if (nextGw) {
      setUpcomingGwId(nextGw.id);
      setUpcomingGwNumber(nextGw.number);
      setUpcomingFixtures((allMatches ?? []).filter((m: any) => m.gameweek_id === nextGw.id));

      const [{ data: transfersThisWeek }, { data: chipRows }] = await Promise.all([
        supabase.from("fantasy_transfers").select("id,was_free").eq("fantasy_team_id", team.id).eq("gameweek_id", nextGw.id),
        supabase.from("fantasy_chip_usage").select("chip_type,gameweek_id").eq("fantasy_team_id", team.id),
      ]);
      setTransfersUsedThisWeek((transfersThisWeek ?? []).filter((t: any) => t.was_free).length);
      setPaidTransfersThisWeek((transfersThisWeek ?? []).filter((t: any) => !t.was_free).length);

      const used: Record<string, boolean> = {};
      let activeThisWeek: string | null = null;
      (chipRows ?? []).forEach((r: any) => {
        used[r.chip_type] = true;
        if (r.gameweek_id === nextGw.id) activeThisWeek = r.chip_type;
      });
      setUsedChips(used);
      setActiveChipThisWeek(activeThisWeek);
      setFreeHitActive(activeThisWeek === "free_hit");
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolId, router]);

  const deadline = useMemo(() => computeDeadline(upcomingFixtures), [upcomingFixtures]);
  const isLocked = !!deadline && new Date() > deadline;
  const unlimitedWindow = upcomingGwNumber === 1 || freeHitActive;

  const nextOpponentByTeam: Record<string, { code: string; isHome: boolean }> = useMemo(() => {
    const map: Record<string, { code: string; isHome: boolean }> = {};
    upcomingFixtures.forEach((m: any) => {
      if (m.home_team_id) map[m.home_team_id] = { code: teamShortNames[m.away_team_id] ?? "—", isHome: true };
      if (m.away_team_id) map[m.away_team_id] = { code: teamShortNames[m.home_team_id] ?? "—", isHome: false };
    });
    return map;
  }, [upcomingFixtures, teamShortNames]);

  // Effective squad: the real squad with any pending (unsaved) swaps applied, for display + validation
  const effectiveSquad: SquadPlayer[] = useMemo(() => {
    return squad.map((p) => {
      const swap = pending.find((t) => t.outPlayerId === p.playerId);
      if (!swap) return p;
      return {
        playerId: swap.inPlayer.id,
        name: swap.inPlayer.name,
        position: swap.inPlayer.position,
        teamId: swap.inPlayer.team_id,
        price: swap.inPlayer.price,
        isStarting: p.isStarting,
      };
    });
  }, [squad, pending]);

  const spent = effectiveSquad.reduce((sum, p) => sum + p.price, 0);
  const budget = settings?.budget ?? 100;
  const bank = Math.round((budget - spent) * 10) / 10;

  const freeAllowance = settings?.free_transfers_per_gw ?? 1;
  const totalFreeAvailable = unlimitedWindow ? Infinity : Math.max(0, freeAllowance - transfersUsedThisWeek);
  const freeUsedByPending = unlimitedWindow ? 0 : Math.min(pending.length, totalFreeAvailable);
  const paidByPending = unlimitedWindow ? 0 : Math.max(0, pending.length - totalFreeAvailable);
  const pendingCost = paidByPending * (settings?.transfer_cost_points ?? 4);

  function countFromRealTeam(realTeamId: string, excludingPlayerId?: string) {
    return effectiveSquad.filter((p) => p.teamId === realTeamId && p.playerId !== excludingPlayerId).length;
  }

  function startPick(outPlayerId: string) {
    if (isLocked) return;
    setPickingOutId((prev) => (prev === outPlayerId ? null : outPlayerId));
    setAlertMsg("");
  }

  function pickReplacement(outPlayerId: string, candidate: Candidate) {
    const outPlayer = squad.find((p) => p.playerId === outPlayerId);
    if (!outPlayer) return;

    const teamCount = countFromRealTeam(candidate.team_id, outPlayer.teamId === candidate.team_id ? outPlayerId : undefined);
    if (teamCount >= MAX_PER_REAL_TEAM) {
      setAlertMsg(`Max ${MAX_PER_REAL_TEAM} players per real team.`);
      return;
    }
    const newSpent = spent - outPlayer.price + candidate.price;
    if (newSpent > budget) {
      setAlertMsg("That would put you over budget.");
      return;
    }
    setAlertMsg("");
    setPending((prev) => [...prev.filter((t) => t.outPlayerId !== outPlayerId), { outPlayerId, inPlayer: candidate }]);
    setPickingOutId(null);
  }

  function cancelPending(outPlayerId: string) {
    setPending((prev) => prev.filter((t) => t.outPlayerId !== outPlayerId));
  }

  const eligibleFor = (outPlayerId: string) => {
    const outPlayer = squad.find((p) => p.playerId === outPlayerId);
    if (!outPlayer) return [];
    const usedIds = new Set(effectiveSquad.map((p) => p.playerId));
    return candidates.filter((c) => c.position === outPlayer.position && !usedIds.has(c.id));
  };

  async function confirmTransfers() {
    if (!teamId || !upcomingGwId || pending.length === 0) return;
    setSaving(true);
    setError("");

    let freeLeft = totalFreeAvailable;
    for (const t of pending) {
      const isFree = unlimitedWindow || freeLeft > 0;
      if (!unlimitedWindow && freeLeft > 0) freeLeft--;

      const { error: updateError } = await supabase
        .from("fantasy_team_players")
        .update({ player_id: t.inPlayer.id })
        .eq("fantasy_team_id", teamId)
        .eq("player_id", t.outPlayerId);
      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
      await supabase.from("fantasy_transfers").insert({
        fantasy_team_id: teamId,
        gameweek_id: upcomingGwId,
        player_out_id: t.outPlayerId,
        player_in_id: t.inPlayer.id,
        was_free: isFree,
      });
    }

    setSaving(false);
    setPending([]);
    setMessage(`${pending.length} transfer${pending.length > 1 ? "s" : ""} confirmed.`);
    await loadAll();
  }

  const CHIP_ICONS: Record<string, React.ReactNode> = {
    bench_boost: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="4" rx="1" /><rect x="3" y="10" width="18" height="4" rx="1" /><rect x="3" y="16" width="18" height="4" rx="1" />
      </svg>
    ),
    triple_captain: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l2.4 6.6L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.6-.4z" />
      </svg>
    ),
    free_hit: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
      </svg>
    ),
  };
  const CHIP_DESCRIPTIONS: Record<string, string> = {
    bench_boost: "Counts your 4 bench players' points this match week too.",
    triple_captain: "Your captain scores triple instead of double.",
    free_hit: "Unlimited free transfers for one match week, then reverts.",
  };

  const chipsCard = (
    <div className="rounded-2xl bg-white/20 dark:bg-white/10 border border-[#0B3363]/10 dark:border-white/10 backdrop-blur-sm text-[#0B3363] dark:text-white p-4 mb-4">
      <h2 className="font-display font-bold text-sm mb-3">Chips</h2>
      <div className="flex justify-around gap-2">
        {(["bench_boost", "triple_captain", "free_hit"] as const)
          .filter((key) => key !== "free_hit" || upcomingGwNumber !== 1)
          .map((key) => {
            const label = key === "bench_boost" ? "Bench Boost" : key === "triple_captain" ? "Triple Captain" : "Free Hit";
            const used = usedChips[key];
            const isActive = activeChipThisWeek === key;
            return (
              <div key={key} className="relative group">
                <div className="flex flex-col items-center gap-1 opacity-70">
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center ${isActive ? "bg-[#F4B400] text-[#0B3363]" : "bg-[#0B3363]/10 dark:bg-white/10"}`}>
                    {CHIP_ICONS[key]}
                  </span>
                  <span className="text-[9px] font-semibold text-[#0B3363]/70 dark:text-white/70 text-center leading-tight">
                    {label}
                    <br />
                    {used ? "Used" : "—"}
                  </span>
                </div>
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 rounded-lg bg-[#0B1220] text-white text-[10px] leading-snug px-2.5 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 text-center shadow-lg">
                  {CHIP_DESCRIPTIONS[key]} Play chips from Pick Team.
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );

  const fixturesCard = (
    <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 p-5">
      <div className="inline-block bg-[#0B3363] dark:bg-white text-white dark:text-[#0B3363] font-display font-bold text-sm px-3 py-1.5 rounded-lg mb-3">
        Upcoming Fixtures
      </div>
      <div className="text-xs font-semibold text-[#0B3363]/50 dark:text-white/50 mb-2">Match Week {upcomingGwNumber}</div>
      <div className="divide-y divide-[#0B3363]/10 dark:divide-white/10">
        {upcomingFixtures.map((m) => (
          <div key={m.id} className="flex items-center py-2.5 text-xs">
            <span className="flex-1 text-right font-semibold truncate pr-2">{teamNames[m.home_team_id] ?? "—"}</span>
            <div className="w-5 h-5 flex-shrink-0 rounded bg-white border border-[#0B3363]/10 flex items-center justify-center overflow-hidden mx-1">
              {teamSlugs[m.home_team_id] ? (
                <img src={`/sponsors/${teamSlugs[m.home_team_id]}.png`} alt="" className="w-full h-full object-contain p-0.5" />
              ) : (
                <span className="text-[7px] font-bold text-[#0B3363]">{(teamNames[m.home_team_id] ?? "—").slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <span className="font-bold flex-shrink-0 px-1 w-12 text-center">
              {m.status === "live" ? "● Live" : m.kickoff_at ? new Date(m.kickoff_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "TBD"}
            </span>
            <div className="w-5 h-5 flex-shrink-0 rounded bg-white border border-[#0B3363]/10 flex items-center justify-center overflow-hidden mx-1">
              {teamSlugs[m.away_team_id] ? (
                <img src={`/sponsors/${teamSlugs[m.away_team_id]}.png`} alt="" className="w-full h-full object-contain p-0.5" />
              ) : (
                <span className="text-[7px] font-bold text-[#0B3363]">{(teamNames[m.away_team_id] ?? "—").slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <span className="flex-1 text-left font-semibold truncate pl-2">{teamNames[m.away_team_id] ?? "—"}</span>
          </div>
        ))}
        {upcomingFixtures.length === 0 && <div className="text-xs text-[#0B3363]/40 dark:text-white/40 text-center py-4">No fixtures scheduled.</div>}
      </div>
    </div>
  );

  if (loading || !settings) {
    return (
      <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
        <SiteHeader active="fantasy" />
        <div className="flex-1 flex items-center justify-center text-sm opacity-50">Loading…</div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
      <SiteHeader active="fantasy" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        <FantasySubNav poolId={poolId} />
        <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#3EA0D9]">{poolLabel}</div>
            <h1 className="font-display font-bold text-2xl">Transfers</h1>
          </div>
          {deadline && (
            <div className={`text-xs font-semibold px-3 py-2 rounded-lg bg-white border border-[#0B3363]/10 shadow-sm ${isLocked ? "text-red-600" : "text-[#0B3363]"}`}>
              Match Week {upcomingGwNumber} · Deadline: {formatDeadline(deadline)}
              {isLocked && " — locked"}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl bg-white border border-[#0B3363]/10 shadow-sm px-3 py-2.5 text-center">
            <div className="text-[10px] font-bold uppercase text-[#0B3363]/40">Transfers</div>
            <div className="font-display font-bold text-lg text-[#0B3363]">
              {pending.length}/{unlimitedWindow ? "∞" : totalFreeAvailable}
            </div>
          </div>
          <div className="rounded-xl bg-white border border-[#0B3363]/10 shadow-sm px-3 py-2.5 text-center">
            <div className="text-[10px] font-bold uppercase text-[#0B3363]/40">Cost</div>
            <div className={`font-display font-bold text-lg ${pendingCost > 0 ? "text-red-600" : "text-[#0B3363]"}`}>
              {pendingCost > 0 ? `-${pendingCost} pts` : "0 pts"}
            </div>
          </div>
          <div className="rounded-xl bg-white border border-[#0B3363]/10 shadow-sm px-3 py-2.5 text-center">
            <div className="text-[10px] font-bold uppercase text-[#0B3363]/40">Bank</div>
            <div className="font-display font-bold text-lg text-[#0B3363]">TSH {bank.toFixed(1)}m</div>
          </div>
        </div>
        {unlimitedWindow && (
          <div className="text-xs text-green-700 dark:text-green-400 font-semibold mb-3">
            {freeHitActive ? "Free Hit is active — unlimited free changes this match week." : "Unlimited free transfers until Match Week 1's deadline."}
          </div>
        )}
        {!unlimitedWindow && pending.length > 0 && (
          <div className="text-xs text-[#0B3363]/60 dark:text-white/60 mb-3">
            {freeUsedByPending} free + {paidByPending} paid transfer{paidByPending === 1 ? "" : "s"} queued.
          </div>
        )}

        {message && <div className="rounded-lg bg-green-50 text-green-700 text-sm px-3 py-2 mb-4">{message}</div>}
        {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 mb-4">{error}</div>}
        {alertMsg && <div className="rounded-lg bg-amber-50 text-amber-800 text-sm px-3 py-2 mb-4">{alertMsg}</div>}

        <div className="grid lg:grid-cols-[320px_1fr] gap-6 min-w-0">
          <div className="hidden lg:block">
            {chipsCard}
            {fixturesCard}
          </div>

          <div className="min-w-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-bold text-base">Your Squad</h2>
              <div className="flex items-center bg-[#0B3363]/5 dark:bg-white/10 rounded-lg p-0.5">
                <button onClick={() => setViewMode("pitch")} className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${viewMode === "pitch" ? "bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white shadow-sm" : "text-[#0B3363]/50 dark:text-white/50"}`}>Pitch</button>
                <button onClick={() => setViewMode("list")} className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white shadow-sm" : "text-[#0B3363]/50 dark:text-white/50"}`}>List</button>
              </div>
            </div>

            {viewMode === "pitch" ? (
              <PitchBackground className="max-w-2xl mx-auto">
                <div className="flex flex-col gap-4">
                  {POSITIONS.map((pos) => {
                    const rowPlayers = effectiveSquad.filter((p) => p.position === pos);
                    if (rowPlayers.length === 0) return null;
                    return (
                      <div key={pos} className="flex justify-center gap-10 flex-wrap">
                        {rowPlayers.map((p) => {
                          const isPending = pending.some((t) => t.inPlayer.id === p.playerId);
                          const originalId = isPending ? pending.find((t) => t.inPlayer.id === p.playerId)!.outPlayerId : p.playerId;
                          return (
                            <div key={p.playerId} className="flex flex-col items-center">
                              <PlayerJerseyCard
                                name={p.name}
                                teamSlug={teamSlugs[p.teamId]}
                                isGoalkeeper={p.position === "GK"}
                                opponentCode={nextOpponentByTeam[p.teamId]?.code}
                                opponentIsHome={nextOpponentByTeam[p.teamId]?.isHome}
                                onRemove={isLocked ? undefined : () => (isPending ? cancelPending(originalId) : startPick(p.playerId))}
                                selected={pickingOutId === p.playerId}
                                highlighted={isPending}
                              />
                              {isPending && <span className="text-[9px] text-[#F4B400] font-bold mt-1">Incoming</span>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </PitchBackground>
            ) : (
              <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 overflow-hidden">
                <div className="grid grid-cols-[1fr_70px_60px_50px] sm:grid-cols-[1fr_80px_80px_60px] gap-2 px-4 py-2 bg-[#0B3363]/5 dark:bg-white/5 text-[9px] font-bold uppercase text-[#0B3363]/50 dark:text-white/50">
                  <span>Player</span><span className="text-right">Price</span><span className="text-right">TP</span><span className="text-right">Fix</span>
                </div>
                {POSITIONS.map((pos) => {
                  const rowPlayers = effectiveSquad.filter((p) => p.position === pos);
                  if (rowPlayers.length === 0) return null;
                  return (
                    <div key={pos}>
                      <div className="px-4 py-1.5 text-[10px] font-bold uppercase text-[#3EA0D9] bg-[#3EA0D9]/5">{POSITION_LABELS[pos]}</div>
                      {rowPlayers.map((p) => {
                        const isPending = pending.some((t) => t.inPlayer.id === p.playerId);
                        const originalId = isPending ? pending.find((t) => t.inPlayer.id === p.playerId)!.outPlayerId : p.playerId;
                        return (
                          <div key={p.playerId} className={`grid grid-cols-[1fr_70px_60px_50px] sm:grid-cols-[1fr_80px_80px_60px] gap-2 items-center px-4 py-2.5 text-sm border-b border-[#0B3363]/5 dark:border-white/5 last:border-0 ${isPending ? "bg-[#F4B400]/10" : ""}`}>
                            <button onClick={() => !isLocked && (isPending ? cancelPending(originalId) : startPick(p.playerId))} className="flex items-center gap-2 min-w-0 text-left">
                              <span className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${isPending ? "bg-[#F4B400] text-[#0B3363]" : "bg-[#0B1220]"}`}>×</span>
                              <span className="truncate font-medium">{p.name}</span>
                            </button>
                            <span className="text-right text-xs">TSH {p.price.toFixed(1)}m</span>
                            <span className="text-right text-xs font-bold">{totalPointsByPlayer[p.playerId] ?? 0}</span>
                            <span className="text-right text-[10px] text-[#0B3363]/50 dark:text-white/50">
                              {nextOpponentByTeam[p.teamId] ? `${nextOpponentByTeam[p.teamId].code} (${nextOpponentByTeam[p.teamId].isHome ? "H" : "A"})` : "—"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {pickingOutId && (
              <div className="mt-4 rounded-2xl border border-[#0B3363]/10 dark:border-white/10 p-4">
                <h3 className="font-display font-bold text-sm mb-2">Pick a replacement</h3>
                <div className="max-h-64 overflow-y-auto divide-y divide-[#0B3363]/5 dark:divide-white/5">
                  {eligibleFor(pickingOutId)
                    .sort((a, b) => b.price - a.price)
                    .map((c) => (
                      <button key={c.id} onClick={() => pickReplacement(pickingOutId, c)} className="w-full flex items-center justify-between px-2 py-2 text-sm hover:bg-[#0B3363]/5 dark:hover:bg-white/5 text-left">
                        <span className="truncate">{c.name}</span>
                        <span className="font-display font-bold text-xs flex-shrink-0">TSH {c.price.toFixed(1)}m</span>
                      </button>
                    ))}
                  {eligibleFor(pickingOutId).length === 0 && <div className="p-4 text-center text-xs text-[#0B3363]/40 dark:text-white/40">No eligible replacements.</div>}
                </div>
              </div>
            )}

            {pending.length > 0 && (
              <button
                onClick={confirmTransfers}
                disabled={saving || isLocked}
                className="w-full mt-4 py-2.5 rounded-lg bg-[#0B3363] text-white dark:bg-[#3EA0D9] font-semibold text-sm disabled:opacity-40"
              >
                {saving ? "Saving…" : `Confirm ${pending.length} Transfer${pending.length > 1 ? "s" : ""}${pendingCost > 0 ? ` (-${pendingCost} pts)` : ""}`}
              </button>
            )}

            <div className="lg:hidden mt-6">
              {chipsCard}
              <div className="mt-4">{fixturesCard}</div>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
