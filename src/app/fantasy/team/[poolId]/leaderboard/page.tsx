"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import FantasySubNav from "@/components/FantasySubNav";

type Row = { teamId: string; teamName: string; total: number; gwPoints: number };

export default function Leaderboard() {
  const params = useParams();
  const router = useRouter();
  const poolId = params.poolId as string;

  const [loading, setLoading] = useState(true);
  const [poolLabel, setPoolLabel] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [latestGwNumber, setLatestGwNumber] = useState<number | null>(null);

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

      const { data: myTeam } = await supabase
        .from("fantasy_teams")
        .select("id")
        .eq("fantasy_settings_id", poolId)
        .eq("user_id", authData.user.id)
        .maybeSingle();
      setMyTeamId(myTeam?.id ?? null);

      const { data: teams } = await supabase.from("fantasy_teams").select("id,team_name").eq("fantasy_settings_id", poolId);

      const seasonId = (settingsRow as any).season_id;
      const { data: gws } = await supabase.from("gameweeks").select("id,number").eq("season_id", seasonId).order("number", { ascending: false });
      const latestGw = gws?.[0];
      setLatestGwNumber(latestGw?.number ?? null);

      const teamIds = (teams ?? []).map((t: any) => t.id);
      const { data: pointsRows } = await supabase
        .from("fantasy_gameweek_points")
        .select("fantasy_team_id,gameweek_id,net_points")
        .in("fantasy_team_id", teamIds.length ? teamIds : ["00000000-0000-0000-0000-000000000000"]);

      const totalByTeam: Record<string, number> = {};
      const latestByTeam: Record<string, number> = {};
      (pointsRows ?? []).forEach((p: any) => {
        totalByTeam[p.fantasy_team_id] = (totalByTeam[p.fantasy_team_id] ?? 0) + p.net_points;
        if (latestGw && p.gameweek_id === latestGw.id) latestByTeam[p.fantasy_team_id] = p.net_points;
      });

      const list: Row[] = (teams ?? []).map((t: any) => ({
        teamId: t.id,
        teamName: t.team_name,
        total: totalByTeam[t.id] ?? 0,
        gwPoints: latestByTeam[t.id] ?? 0,
      }));
      list.sort((a, b) => b.total - a.total);
      setRows(list);

      setLoading(false);
    })();
  }, [poolId, router]);

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
      <SiteHeader active="fantasy" />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        <FantasySubNav poolId={poolId} />
        <div className="mb-6">
          <div className="text-xs font-bold uppercase tracking-wider text-[#3EA0D9]">{poolLabel}</div>
          <h1 className="font-display font-bold text-2xl">Leaderboard</h1>
        </div>

        {loading ? (
          <div className="text-sm opacity-50 py-10 text-center">Loading…</div>
        ) : (
          <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase text-[#0B3363]/40 dark:text-white/40 border-b border-[#0B3363]/10 dark:border-white/10">
                  <th className="text-left py-2.5 px-4">Rank</th>
                  <th className="text-left py-2.5 px-2">Team</th>
                  <th className="text-right py-2.5 px-2">{latestGwNumber ? `MW${latestGwNumber}` : "GW"}</th>
                  <th className="text-right py-2.5 px-4">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.teamId}
                    className={`border-b border-[#0B3363]/5 dark:border-white/5 last:border-0 ${
                      r.teamId === myTeamId ? "bg-[#F4B400]/10" : ""
                    }`}
                  >
                    <td className="py-2.5 px-4 text-[#0B3363]/40 dark:text-white/40">{i + 1}</td>
                    <td className="py-2.5 px-2 font-medium">
                      {r.teamName}
                      {r.teamId === myTeamId && <span className="text-[10px] text-[#3EA0D9] font-bold ml-1.5">YOU</span>}
                    </td>
                    <td className="py-2.5 px-2 text-right">{r.gwPoints}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-[#3EA0D9]">{r.total}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-xs text-[#0B3363]/40 dark:text-white/40">No fantasy teams have entered yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
