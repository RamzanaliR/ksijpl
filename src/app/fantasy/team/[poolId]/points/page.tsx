"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import FantasySubNav from "@/components/FantasySubNav";
import PitchBackground from "@/components/PitchBackground";
import PlayerJerseyCard from "@/components/PlayerJerseyCard";

type Position = "GK" | "DEF" | "MID" | "FWD";
type GwHistoryRow = { gameweekId: string; number: number; roundName: string | null; points: number };
type SquadRow = {
  playerId: string;
  name: string;
  position: Position;
  teamSlug: string | null;
  points: number;
  multiplier: number;
  isStarting: boolean;
};

const POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD"];
const CHIP_META: Record<string, { label: string }> = {
  bench_boost: { label: "Bench Boost" },
  triple_captain: { label: "Triple Captain" },
  free_hit: { label: "Free Hit" },
};

export default function MyTeamPage() {
  const params = useParams();
  const router = useRouter();
  const poolId = params.poolId as string;

  const [loading, setLoading] = useState(true);
  const [poolLabel, setPoolLabel] = useState("");
  const [teamName, setTeamName] = useState("");
  const [budget, setBudget] = useState(100);
  const [squadValue, setSquadValue] = useState(0);
  const [freeTransfers, setFreeTransfers] = useState<number | "∞">(1);
  const [usedChips, setUsedChips] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<GwHistoryRow[]>([]);
  const [rank, setRank] = useState<number | null>(null);
  const [totalTeams, setTotalTeams] = useState(0);
  const [selectedGwId, setSelectedGwId] = useState("");
  const [squadBreakdown, setSquadBreakdown] = useState<SquadRow[]>([]);
  const [latestScoredGwId, setLatestScoredGwId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.push("/fantasy/login");
        return;
      }

      const { data: settingsRow } = await supabase
        .from("fantasy_settings")
        .select("id,season_id,budget,free_transfers_per_gw,seasons(label,competitions(name))")
        .eq("id", poolId)
        .maybeSingle();
      if (!settingsRow) {
        setLoading(false);
        return;
      }
      setPoolLabel(`${(settingsRow as any).seasons?.competitions?.name ?? "Fantasy"} — ${(settingsRow as any).seasons?.label ?? ""}`);
      setBudget((settingsRow as any).budget);

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
      setTeamName(team.team_name);

      const seasonId = (settingsRow as any).season_id;
      const { data: gws } = await supabase.from("gameweeks").select("id,number,round_name").eq("season_id", seasonId).order("number");

      const { data: myPoints } = await supabase.from("fantasy_gameweek_points").select("gameweek_id,net_points").eq("fantasy_team_id", team.id);
      const pointsByGw: Record<string, number> = {};
      (myPoints ?? []).forEach((p: any) => (pointsByGw[p.gameweek_id] = p.net_points));

      const historyRows: GwHistoryRow[] = (gws ?? [])
        .filter((g: any) => pointsByGw[g.id] !== undefined)
        .map((g: any) => ({ gameweekId: g.id, number: g.number, roundName: g.round_name, points: pointsByGw[g.id] }))
        .reverse();
      setHistory(historyRows);
      if (historyRows.length) {
        setSelectedGwId(historyRows[0].gameweekId);
        setLatestScoredGwId(historyRows[0].gameweekId);
      }

      // Rank among all teams in the pool, by cumulative total
      const { data: allTeams } = await supabase.from("fantasy_teams").select("id").eq("fantasy_settings_id", poolId);
      const allTeamIds = (allTeams ?? []).map((t: any) => t.id);
      const { data: allPoints } = await supabase.from("fantasy_gameweek_points").select("fantasy_team_id,net_points").in("fantasy_team_id", allTeamIds);
      const totals: Record<string, number> = {};
      (allPoints ?? []).forEach((p: any) => (totals[p.fantasy_team_id] = (totals[p.fantasy_team_id] ?? 0) + p.net_points));
      const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
      const myRank = sorted.findIndex(([id]) => id === team.id);
      setRank(myRank >= 0 ? myRank + 1 : null);
      setTotalTeams(allTeamIds.length);

      // Squad value + free transfers left this week
      const { data: squadRows } = await supabase.from("fantasy_team_players").select("player_id").eq("fantasy_team_id", team.id);
      const { data: prices } = await supabase.from("fantasy_player_prices").select("player_id,price").eq("fantasy_settings_id", poolId);
      const priceMap: Record<string, number> = {};
      (prices ?? []).forEach((p: any) => (priceMap[p.player_id] = Number(p.price)));
      const value = (squadRows ?? []).reduce((sum: number, r: any) => sum + (priceMap[r.player_id] ?? 0), 0);
      setSquadValue(value);

      const { data: allMatches } = await supabase
        .from("matches")
        .select("id,gameweek_id,kickoff_at,status")
        .eq("season_id", seasonId)
        .in("status", ["scheduled", "live"])
        .order("kickoff_at", { ascending: true });
      const nextGw = (gws ?? []).find((g: any) => (allMatches ?? []).some((m: any) => m.gameweek_id === g.id));

      const { data: chipRows } = await supabase.from("fantasy_chip_usage").select("chip_type").eq("fantasy_team_id", team.id);
      const used: Record<string, boolean> = {};
      (chipRows ?? []).forEach((r: any) => (used[r.chip_type] = true));
      setUsedChips(used);

      if (nextGw) {
        const isPreMw1 = (nextGw as any).number === 1;
        const { data: chipRow } = await supabase.from("fantasy_chip_usage").select("chip_type").eq("fantasy_team_id", team.id).eq("gameweek_id", nextGw.id).maybeSingle();
        const freeHitActive = chipRow?.chip_type === "free_hit";
        if (isPreMw1 || freeHitActive) {
          setFreeTransfers("∞");
        } else {
          const { data: transfersThisWeek } = await supabase.from("fantasy_transfers").select("id,was_free").eq("fantasy_team_id", team.id).eq("gameweek_id", nextGw.id);
          const used = (transfersThisWeek ?? []).filter((t: any) => t.was_free).length;
          setFreeTransfers(Math.max(0, ((settingsRow as any).free_transfers_per_gw ?? 1) - used));
        }
      }

      setLoading(false);
    })();
  }, [poolId, router]);

  useEffect(() => {
    if (!selectedGwId) return;
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;
      const { data: team } = await supabase
        .from("fantasy_teams")
        .select("id")
        .eq("fantasy_settings_id", poolId)
        .eq("user_id", authData.user.id)
        .maybeSingle();
      if (!team) return;

      const { data: squadRows } = await supabase
        .from("fantasy_gameweek_squads")
        .select("player_id,is_starting,multiplier,players(full_name,fpl_name,nickname,position,team_id)")
        .eq("fantasy_team_id", team.id)
        .eq("gameweek_id", selectedGwId);

      const teamIds = [...new Set((squadRows ?? []).map((r: any) => r.players?.team_id).filter(Boolean))];
      const { data: teamsRaw } = await supabase.from("teams").select("id,slug").in("id", teamIds.length ? teamIds : ["00000000-0000-0000-0000-000000000000"]);
      const slugMap: Record<string, string | null> = {};
      (teamsRaw ?? []).forEach((t: any) => (slugMap[t.id] = t.slug));

      const { data: playerPoints } = await supabase
        .from("fantasy_player_gameweek_points")
        .select("player_id,points")
        .eq("gameweek_id", selectedGwId)
        .in("player_id", (squadRows ?? []).map((r: any) => r.player_id));

      const pointsMap: Record<string, number> = {};
      (playerPoints ?? []).forEach((p: any) => (pointsMap[p.player_id] = p.points));

      const rows: SquadRow[] = (squadRows ?? [])
        .map((r: any) => ({
          playerId: r.player_id,
          name: r.players?.fpl_name || r.players?.nickname || r.players?.full_name || "—",
          position: r.players?.position,
          teamSlug: slugMap[r.players?.team_id] ?? null,
          points: (pointsMap[r.player_id] ?? 0) * r.multiplier,
          multiplier: r.multiplier,
          isStarting: r.is_starting,
        }))
        .sort((a: SquadRow, b: SquadRow) => Number(b.isStarting) - Number(a.isStarting) || b.points - a.points);
      setSquadBreakdown(rows);
    })();
  }, [selectedGwId, poolId]);

  const totalPoints = history.reduce((sum, h) => sum + h.points, 0);
  const currentGw = history.find((h) => h.gameweekId === selectedGwId);
  const bank = Math.round((budget - squadValue) * 10) / 10;
  const startingOnPitch = squadBreakdown.filter((r) => r.isStarting);
  const benchOnly = squadBreakdown.filter((r) => !r.isStarting);

  if (loading) {
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
        <div className="mb-6">
          <div className="text-xs font-bold uppercase tracking-wider text-[#3EA0D9]">{poolLabel}</div>
          <h1 className="font-display font-bold text-2xl">{teamName}</h1>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3 mb-8">
          {[
            ["Total pts", totalPoints],
            ["Rank", rank ? `${rank}/${totalTeams}` : "—"],
            ["Team value", `TSH ${squadValue.toFixed(1)}m`],
            ["Bank", `TSH ${bank.toFixed(1)}m`],
            ["Free transfers", freeTransfers],
            ["Match weeks", history.length],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-xl bg-white border border-[#0B3363]/10 shadow-sm text-center py-3">
              <div className="text-[9px] font-bold uppercase text-[#0B3363]/40">{label}</div>
              <div className="font-display font-bold text-lg text-[#0B3363]">{value}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {Object.entries(CHIP_META).map(([key, meta]) => (
            <span
              key={key}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                usedChips[key] ? "bg-[#0B3363]/5 dark:bg-white/10 text-[#0B3363]/40 dark:text-white/40" : "bg-green-500/10 text-green-700 dark:text-green-400"
              }`}
            >
              {meta.label} {usedChips[key] ? "· Used" : "· Available"}
            </span>
          ))}
        </div>

        {startingOnPitch.length > 0 && (
          <div className="mb-8">
            <h2 className="font-display font-bold text-base mb-3">
              {currentGw?.roundName ?? `Match Week ${currentGw?.number}`} lineup — {currentGw?.points} pts
            </h2>
            <PitchBackground>
              <div className="flex flex-col gap-4">
                {POSITIONS.map((pos) => {
                  const rowPlayers = startingOnPitch.filter((p) => p.position === pos);
                  if (rowPlayers.length === 0) return null;
                  return (
                    <div key={pos} className="flex justify-center gap-3 flex-wrap">
                      {rowPlayers.map((p) => (
                        <div key={p.playerId} className="text-center">
                          <PlayerJerseyCard name={p.name} teamSlug={p.teamSlug} badge={p.multiplier > 1 ? "C" : null} />
                          <div className="text-white font-display font-bold text-sm -mt-1">{p.points} pts</div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </PitchBackground>
            {benchOnly.length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-2 mt-4 justify-center">
                {benchOnly.map((p) => (
                  <div key={p.playerId} className="text-center opacity-50">
                    <PlayerJerseyCard name={p.name} teamSlug={p.teamSlug} />
                    <div className="text-[#0B3363] dark:text-white font-display font-bold text-xs">{p.points} pts</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#0B3363]/15 dark:border-white/15 p-8 text-center text-sm text-[#0B3363]/40 dark:text-white/40">
            No match weeks scored yet — points appear here once the admin computes a completed match week.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-bold text-base">Match week points</h2>
              <select value={selectedGwId} onChange={(e) => setSelectedGwId(e.target.value)} className="border border-[#0B3363]/15 dark:border-white/15 dark:bg-white/5 rounded-lg px-2 py-1.5 text-xs font-semibold">
                {history.map((h) => (
                  <option key={h.gameweekId} value={h.gameweekId}>{h.roundName ?? `Match Week ${h.number}`}</option>
                ))}
              </select>
            </div>

            <h2 className="font-display font-bold text-base mb-3">Match week history</h2>
            <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {history.map((h) => (
                    <tr key={h.gameweekId} className="border-b border-[#0B3363]/5 dark:border-white/5 last:border-0">
                      <td className="py-2 px-4">{h.roundName ?? `Match Week ${h.number}`}</td>
                      <td className="py-2 px-4 text-right font-bold">{h.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
