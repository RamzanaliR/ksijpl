"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import FantasySubNav from "@/components/FantasySubNav";
import { computeDeadline, formatDeadline } from "@/lib/fantasy-deadline";

type Position = "GK" | "DEF" | "MID" | "FWD";
type Settings = { id: string; season_id: string; budget: number; transfer_cost_points: number; free_transfers_per_gw: number };
type SquadPlayer = {
  playerId: string;
  name: string;
  position: Position;
  price: number;
  teamId: string;
  isStarting: boolean;
};
type Candidate = { id: string; name: string; position: Position; team_id: string; price: number };

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
  const [transferOutId, setTransferOutId] = useState<string | null>(null);
  const [transferInId, setTransferInId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [alertMsg, setAlertMsg] = useState("");
  const [upcomingFixtures, setUpcomingFixtures] = useState<any[]>([]);
  const [upcomingGwId, setUpcomingGwId] = useState<string | null>(null);
  const [upcomingGwNumber, setUpcomingGwNumber] = useState<number | null>(null);
  const [transfersUsedThisWeek, setTransfersUsedThisWeek] = useState(0);
  const [paidTransfersThisWeek, setPaidTransfersThisWeek] = useState(0);
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
    const { data: teamsRaw } = await supabase.from("teams").select("id").eq("division_id", divisionId);
    const teamIds = (teamsRaw ?? []).map((t: any) => t.id);
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

    const seasonId = (settingsRow as any).season_id;
    const { data: gws } = await supabase.from("gameweeks").select("id,number").eq("season_id", seasonId).order("number");
    const { data: allMatches } = await supabase
      .from("matches")
      .select("id,gameweek_id,kickoff_at,status")
      .eq("season_id", seasonId)
      .in("status", ["scheduled", "live"])
      .order("kickoff_at", { ascending: true });
    const nextGw = (gws ?? []).find((g: any) => (allMatches ?? []).some((m: any) => m.gameweek_id === g.id));
    if (nextGw) {
      setUpcomingGwId(nextGw.id);
      setUpcomingGwNumber(nextGw.number);
      setUpcomingFixtures((allMatches ?? []).filter((m: any) => m.gameweek_id === nextGw.id));

      const [{ data: transfersThisWeek }, { data: chipRow }] = await Promise.all([
        supabase.from("fantasy_transfers").select("id,was_free").eq("fantasy_team_id", team.id).eq("gameweek_id", nextGw.id),
        supabase.from("fantasy_chip_usage").select("chip_type").eq("fantasy_team_id", team.id).eq("gameweek_id", nextGw.id).maybeSingle(),
      ]);
      setTransfersUsedThisWeek((transfersThisWeek ?? []).filter((t: any) => t.was_free).length);
      setPaidTransfersThisWeek((transfersThisWeek ?? []).filter((t: any) => !t.was_free).length);
      setFreeHitActive(chipRow?.chip_type === "free_hit");
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolId, router]);

  const deadline = useMemo(() => computeDeadline(upcomingFixtures), [upcomingFixtures]);
  const isLocked = !!deadline && new Date() > deadline;

  // Unlimited free transfers until Match Week 1's deadline, and whenever Free Hit is active
  const unlimitedWindow = upcomingGwNumber === 1 || freeHitActive;
  const freeTransfersLeft = unlimitedWindow ? Infinity : Math.max(0, (settings?.free_transfers_per_gw ?? 1) - transfersUsedThisWeek);

  const outgoing = squad.find((p) => p.playerId === transferOutId) ?? null;
  const eligibleCandidates = outgoing ? candidates.filter((c) => c.position === outgoing.position) : [];
  const incoming = candidates.find((c) => c.id === transferInId) ?? null;

  const spent = squad.reduce((sum, p) => sum + p.price, 0);
  const budget = settings?.budget ?? 100;
  const budgetAfterSwap = outgoing && incoming ? budget - spent + outgoing.price - incoming.price : budget - spent;
  const wouldExceedBudget = !!(outgoing && incoming) && budgetAfterSwap < 0;

  const isFree = unlimitedWindow || freeTransfersLeft > 0;
  const cost = isFree ? 0 : settings?.transfer_cost_points ?? 4;

  function countFromRealTeam(realTeamId: string, excludingPlayerId?: string) {
    return squad.filter((p) => p.teamId === realTeamId && p.playerId !== excludingPlayerId).length;
  }

  function selectOut(playerId: string) {
    setTransferOutId((prev) => (prev === playerId ? null : playerId));
    setTransferInId(null);
    setMessage("");
    setError("");
    setAlertMsg("");
  }

  function selectIn(candidate: Candidate) {
    if (!outgoing) return;
    const currentFromTeam = countFromRealTeam(candidate.team_id, outgoing.teamId === candidate.team_id ? outgoing.playerId : undefined);
    if (currentFromTeam >= MAX_PER_REAL_TEAM) {
      setAlertMsg(`Max ${MAX_PER_REAL_TEAM} players per real team.`);
      return;
    }
    setAlertMsg("");
    setTransferInId(candidate.id);
  }

  async function confirmTransfer() {
    if (!teamId || !outgoing || !incoming || wouldExceedBudget || !upcomingGwId) return;
    setSaving(true);
    setError("");

    const { error: updateError } = await supabase
      .from("fantasy_team_players")
      .update({ player_id: incoming.id })
      .eq("fantasy_team_id", teamId)
      .eq("player_id", outgoing.playerId);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    await supabase.from("fantasy_transfers").insert({
      fantasy_team_id: teamId,
      gameweek_id: upcomingGwId,
      player_out_id: outgoing.playerId,
      player_in_id: incoming.id,
      was_free: isFree,
    });

    setSaving(false);
    setTransferOutId(null);
    setTransferInId(null);
    setMessage(`Transferred ${outgoing.name} out for ${incoming.name}.`);
    await loadAll();
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

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
      <SiteHeader active="fantasy" />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        <FantasySubNav poolId={poolId} />
        <div className="mb-2">
          <div className="text-xs font-bold uppercase tracking-wider text-[#3EA0D9]">{poolLabel}</div>
          <h1 className="font-display font-bold text-2xl">Transfers</h1>
        </div>
        {deadline && (
          <div className={`text-xs mb-2 ${isLocked ? "text-red-600 font-semibold" : "text-[#0B3363]/50 dark:text-white/50"}`}>
            Match Week {upcomingGwNumber} · Deadline: {formatDeadline(deadline)}
            {isLocked && " — transfers are locked until the next match week"}
          </div>
        )}
        {unlimitedWindow && (
          <div className="text-xs text-green-700 dark:text-green-400 font-semibold mb-4">
            {freeHitActive ? "Free Hit is active — unlimited free changes this match week." : "Unlimited free transfers until Match Week 1's deadline."}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl bg-white border border-[#0B3363]/10 shadow-sm px-4 py-2.5 text-center">
            <div className="text-[10px] font-bold uppercase text-[#0B3363]/40">Transfers</div>
            <div className="font-display font-bold text-lg text-[#0B3363]">
              {unlimitedWindow ? "∞" : `${transfersUsedThisWeek}/${settings.free_transfers_per_gw}`}
            </div>
          </div>
          <div className="rounded-xl bg-white border border-[#0B3363]/10 shadow-sm px-4 py-2.5 text-center">
            <div className="text-[10px] font-bold uppercase text-[#0B3363]/40">Cost</div>
            <div className={`font-display font-bold text-lg ${paidTransfersThisWeek > 0 ? "text-red-600" : "text-[#0B3363]"}`}>
              {paidTransfersThisWeek > 0 ? `-${paidTransfersThisWeek * (settings.transfer_cost_points ?? 4)} pts` : "0 pts"}
            </div>
          </div>
          <div className="rounded-xl bg-white border border-[#0B3363]/10 shadow-sm px-4 py-2.5 text-center">
            <div className="text-[10px] font-bold uppercase text-[#0B3363]/40">Bank</div>
            <div className="font-display font-bold text-lg text-[#0B3363]">TSH {(budget - spent).toFixed(1)}m</div>
          </div>
        </div>

        {message && <div className="rounded-lg bg-green-50 text-green-700 text-sm px-3 py-2 mb-4">{message}</div>}
        {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 mb-4">{error}</div>}
        {alertMsg && <div className="rounded-lg bg-amber-50 text-amber-800 text-sm px-3 py-2 mb-4">{alertMsg}</div>}

        <h2 className="font-display font-bold text-sm mb-2">Your squad — tap a player to transfer out</h2>
        <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 overflow-hidden mb-6">
          {squad.map((p) => (
            <button
              key={p.playerId}
              onClick={() => !isLocked && selectOut(p.playerId)}
              disabled={isLocked}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm border-b border-[#0B3363]/5 dark:border-white/5 last:border-0 text-left transition-colors disabled:opacity-50 ${
                transferOutId === p.playerId ? "bg-red-50 dark:bg-red-500/10" : "hover:bg-[#0B3363]/5 dark:hover:bg-white/5"
              }`}
            >
              <span className="min-w-0 truncate">
                <span className="text-[10px] font-bold text-[#3EA0D9] mr-2">{p.position}</span>
                {p.name}
                {!p.isStarting && <span className="text-[10px] text-[#0B3363]/40 dark:text-white/40 ml-1.5">bench</span>}
              </span>
              <span className="font-display font-bold text-xs flex-shrink-0">TSH {p.price.toFixed(1)}m</span>
            </button>
          ))}
        </div>

        {outgoing && (
          <>
            <h2 className="font-display font-bold text-sm mb-2">
              Bring in a {outgoing.position} for {outgoing.name}
            </h2>
            <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 max-h-72 overflow-y-auto mb-4">
              {eligibleCandidates
                .sort((a, b) => b.price - a.price)
                .map((c) => {
                  const wouldExceed = budget - spent + outgoing.price - c.price < 0;
                  const teamFull = countFromRealTeam(c.team_id, outgoing.teamId === c.team_id ? outgoing.playerId : undefined) >= MAX_PER_REAL_TEAM;
                  return (
                    <button
                      key={c.id}
                      onClick={() => selectIn(c)}
                      disabled={wouldExceed || teamFull}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm border-b border-[#0B3363]/5 dark:border-white/5 last:border-0 text-left transition-colors disabled:opacity-30 ${
                        transferInId === c.id ? "bg-green-50 dark:bg-green-500/10" : "hover:bg-[#0B3363]/5 dark:hover:bg-white/5"
                      }`}
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="font-display font-bold text-xs flex-shrink-0">TSH {c.price.toFixed(1)}m</span>
                    </button>
                  );
                })}
              {eligibleCandidates.length === 0 && <div className="p-4 text-center text-xs text-[#0B3363]/40 dark:text-white/40">No eligible replacements.</div>}
            </div>
          </>
        )}

        {outgoing && incoming && (
          <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 p-4 mb-6">
            <div className="text-sm mb-2">
              <span className="font-semibold">{outgoing.name}</span> → <span className="font-semibold">{incoming.name}</span>
            </div>
            <div className="text-xs text-[#0B3363]/50 dark:text-white/50 mb-3">
              New bank: TSH {budgetAfterSwap.toFixed(1)}m · {isFree ? "Free transfer" : `Costs ${cost} points from this match week's score`}
            </div>
            {wouldExceedBudget && <div className="text-xs text-red-600 mb-3">This transfer would put you over budget.</div>}
            <button
              onClick={confirmTransfer}
              disabled={saving || wouldExceedBudget || isLocked}
              className="w-full py-2.5 rounded-lg bg-[#0B3363] text-white dark:bg-[#3EA0D9] font-semibold text-sm disabled:opacity-40"
            >
              {saving ? "Saving…" : "Confirm Transfer"}
            </button>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
