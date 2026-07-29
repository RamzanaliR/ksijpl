"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import FantasySubNav from "@/components/FantasySubNav";
import PitchBackground from "@/components/PitchBackground";
import PlayerJerseyCard from "@/components/PlayerJerseyCard";

type Position = "GK" | "DEF" | "MID" | "FWD";
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

export default function ManagerSquadPage() {
  const params = useParams();
  const router = useRouter();
  const poolId = params.poolId as string;
  const teamId = params.teamId as string;

  const [loading, setLoading] = useState(true);
  const [poolLabel, setPoolLabel] = useState("");
  const [teamName, setTeamName] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [gwLabel, setGwLabel] = useState("");
  const [gwTotal, setGwTotal] = useState(0);
  const [squadBreakdown, setSquadBreakdown] = useState<SquadRow[]>([]);
  const [noScoredWeeks, setNoScoredWeeks] = useState(false);

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

      const { data: team } = await supabase.from("fantasy_teams").select("id,team_name").eq("id", teamId).maybeSingle();
      if (!team) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setTeamName(team.team_name);

      const seasonId = (settingsRow as any).season_id;
      const { data: gws } = await supabase.from("gameweeks").select("id,number,round_name").eq("season_id", seasonId).order("number", { ascending: false });

      const { data: myPoints } = await supabase.from("fantasy_gameweek_points").select("gameweek_id,net_points").eq("fantasy_team_id", teamId);
      const pointsByGw: Record<string, number> = {};
      (myPoints ?? []).forEach((p: any) => (pointsByGw[p.gameweek_id] = p.net_points));

      const latestScored = (gws ?? []).find((g: any) => pointsByGw[g.id] !== undefined);
      if (!latestScored) {
        setNoScoredWeeks(true);
        setLoading(false);
        return;
      }
      setGwLabel((latestScored as any).round_name ?? `Match Week ${(latestScored as any).number}`);
      setGwTotal(pointsByGw[latestScored.id]);

      const { data: squadRows } = await supabase
        .from("fantasy_gameweek_squads")
        .select("player_id,is_starting,multiplier,players(full_name,fpl_name,nickname,position,team_id)")
        .eq("fantasy_team_id", teamId)
        .eq("gameweek_id", latestScored.id);

      const teamIds = [...new Set((squadRows ?? []).map((r: any) => r.players?.team_id).filter(Boolean))];
      const { data: teamsRaw } = await supabase.from("teams").select("id,slug").in("id", teamIds.length ? teamIds : ["00000000-0000-0000-0000-000000000000"]);
      const slugMap: Record<string, string | null> = {};
      (teamsRaw ?? []).forEach((t: any) => (slugMap[t.id] = t.slug));

      const { data: playerPoints } = await supabase
        .from("fantasy_player_gameweek_points")
        .select("player_id,points")
        .eq("gameweek_id", latestScored.id)
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

      setLoading(false);
    })();
  }, [poolId, teamId, router]);

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
        <Link href={`/fantasy/team/${poolId}/leaderboard`} className="text-xs font-semibold text-[#3EA0D9] hover:underline mb-3 inline-block">
          ← Back to Leagues
        </Link>

        {notFound ? (
          <div className="rounded-2xl border border-dashed border-[#0B3363]/15 dark:border-white/15 p-8 text-center text-sm text-[#0B3363]/40 dark:text-white/40">
            Team not found.
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="font-display font-bold text-2xl">{teamName}</h1>
              <p className="text-xs text-[#0B3363]/40 dark:text-white/40">Read-only view</p>
            </div>

            {noScoredWeeks ? (
              <div className="rounded-2xl border border-dashed border-[#0B3363]/15 dark:border-white/15 p-8 text-center text-sm text-[#0B3363]/40 dark:text-white/40">
                No match weeks scored yet for this team.
              </div>
            ) : (
              <div className="mb-8">
                <h2 className="font-display font-bold text-base mb-3">{gwLabel} lineup — {gwTotal} pts</h2>
                <PitchBackground>
                  <div className="flex flex-col gap-4">
                    {POSITIONS.map((pos) => {
                      const rowPlayers = startingOnPitch.filter((p) => p.position === pos);
                      if (rowPlayers.length === 0) return null;
                      return (
                        <div key={pos} className="flex justify-center gap-3 flex-wrap">
                          {rowPlayers.map((p) => (
                            <div key={p.playerId} className="text-center">
                              <PlayerJerseyCard name={p.name} teamSlug={p.teamSlug} isGoalkeeper={p.position === "GK"} isCaptain={p.multiplier > 1} />
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
                        <PlayerJerseyCard name={p.name} teamSlug={p.teamSlug} isGoalkeeper={p.position === "GK"} />
                        <div className="text-[#0B3363] dark:text-white font-display font-bold text-xs">{p.points} pts</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
