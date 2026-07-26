"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import FantasySubNav from "@/components/FantasySubNav";

type GwHistoryRow = { gameweekId: string; number: number; roundName: string | null; points: number };
type SquadRow = { playerId: string; name: string; points: number; multiplier: number; isStarting: boolean };

export default function PointsPage() {
  const params = useParams();
  const router = useRouter();
  const poolId = params.poolId as string;

  const [loading, setLoading] = useState(true);
  const [poolLabel, setPoolLabel] = useState("");
  const [teamName, setTeamName] = useState("");
  const [history, setHistory] = useState<GwHistoryRow[]>([]);
  const [rank, setRank] = useState<number | null>(null);
  const [totalTeams, setTotalTeams] = useState(0);
  const [selectedGwId, setSelectedGwId] = useState("");
  const [squadBreakdown, setSquadBreakdown] = useState<SquadRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.push("/fantasy/login");
        return;
      }

      const { data: settingsRow } = await supabase
        .from("fantasy_settings")
        .select("id,season_id,seasons(label,competitions(name))")
        .eq("id", poolId)
        .maybeSingle();
      if (!settingsRow) {
        setLoading(false);
        return;
      }
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
      if (historyRows.length) setSelectedGwId(historyRows[0].gameweekId);

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
        .select("player_id,is_starting,multiplier,players(full_name,fpl_name,nickname)")
        .eq("fantasy_team_id", team.id)
        .eq("gameweek_id", selectedGwId);

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

        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="rounded-xl bg-white border border-[#0B3363]/10 shadow-sm text-center py-4">
            <div className="text-[10px] font-bold uppercase text-[#0B3363]/40">Total points</div>
            <div className="font-display font-bold text-2xl text-[#0B3363]">{totalPoints}</div>
          </div>
          <div className="rounded-xl bg-white border border-[#0B3363]/10 shadow-sm text-center py-4">
            <div className="text-[10px] font-bold uppercase text-[#0B3363]/40">Rank</div>
            <div className="font-display font-bold text-2xl text-[#0B3363]">{rank ? `${rank}/${totalTeams}` : "—"}</div>
          </div>
          <div className="rounded-xl bg-white border border-[#0B3363]/10 shadow-sm text-center py-4">
            <div className="text-[10px] font-bold uppercase text-[#0B3363]/40">Match weeks played</div>
            <div className="font-display font-bold text-2xl text-[#0B3363]">{history.length}</div>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#0B3363]/15 dark:border-white/15 p-8 text-center text-sm text-[#0B3363]/40 dark:text-white/40">
            No match weeks scored yet — points appear here once the admin computes a completed match week.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-bold text-base">
                {currentGw?.roundName ?? `Match Week ${currentGw?.number}`} — {currentGw?.points} pts
              </h2>
              <select value={selectedGwId} onChange={(e) => setSelectedGwId(e.target.value)} className="border border-[#0B3363]/15 dark:border-white/15 dark:bg-white/5 rounded-lg px-2 py-1.5 text-xs font-semibold">
                {history.map((h) => (
                  <option key={h.gameweekId} value={h.gameweekId}>{h.roundName ?? `Match Week ${h.number}`}</option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 overflow-hidden mb-8">
              <table className="w-full text-sm">
                <tbody>
                  {squadBreakdown.map((r) => (
                    <tr key={r.playerId} className={`border-b border-[#0B3363]/5 dark:border-white/5 last:border-0 ${!r.isStarting ? "opacity-50" : ""}`}>
                      <td className="py-2 px-4">
                        {r.name}
                        {r.multiplier === 2 && <span className="text-[10px] font-bold text-[#F4B400] ml-1.5">C×2</span>}
                        {!r.isStarting && <span className="text-[10px] text-[#0B3363]/40 dark:text-white/40 ml-1.5">bench</span>}
                      </td>
                      <td className="py-2 px-4 text-right font-bold">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
