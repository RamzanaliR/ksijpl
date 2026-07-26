"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import FantasySubNav from "@/components/FantasySubNav";
import TeamBadge from "@/components/TeamBadge";

type Gameweek = { id: string; number: number; round_name: string | null };
type Match = {
  id: string;
  gameweek_id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  kickoff_at: string | null;
  venue: string | null;
};

export default function FantasyFixturesPage() {
  const params = useParams();
  const router = useRouter();
  const poolId = params.poolId as string;

  const [loading, setLoading] = useState(true);
  const [poolLabel, setPoolLabel] = useState("");
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [teamSlugs, setTeamSlugs] = useState<Record<string, string | null>>({});
  const [selectedGwId, setSelectedGwId] = useState("");

  useEffect(() => {
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.push("/fantasy/login");
        return;
      }

      const { data: settingsRow } = await supabase
        .from("fantasy_settings")
        .select("id,season_id,seasons(label,competitions(name,division_id))")
        .eq("id", poolId)
        .maybeSingle();
      if (!settingsRow) {
        setLoading(false);
        return;
      }
      setPoolLabel(`${(settingsRow as any).seasons?.competitions?.name ?? "Fantasy"} — ${(settingsRow as any).seasons?.label ?? ""}`);

      const seasonId = (settingsRow as any).season_id;
      const divisionId = (settingsRow as any).seasons?.competitions?.division_id;

      const [{ data: gws }, { data: allMatches }, { data: teamsRaw }] = await Promise.all([
        supabase.from("gameweeks").select("id,number,round_name").eq("season_id", seasonId).order("number"),
        supabase.from("matches").select("id,gameweek_id,home_team_id,away_team_id,home_score,away_score,status,kickoff_at,venue").eq("season_id", seasonId),
        supabase.from("teams").select("id,name,slug").eq("division_id", divisionId),
      ]);

      setGameweeks(gws ?? []);
      setMatches(allMatches ?? []);
      const nameMap: Record<string, string> = {};
      const slugMap: Record<string, string | null> = {};
      (teamsRaw ?? []).forEach((t: any) => {
        nameMap[t.id] = t.name;
        slugMap[t.id] = t.slug;
      });
      setTeamNames(nameMap);
      setTeamSlugs(slugMap);

      // Default to the current/next incomplete match week, else the last one
      const nextGw = (gws ?? []).find((g: any) => (allMatches ?? []).some((m: any) => m.gameweek_id === g.id && m.status !== "completed"));
      setSelectedGwId(nextGw?.id ?? gws?.[gws.length - 1]?.id ?? "");

      setLoading(false);
    })();
  }, [poolId, router]);

  const gwMatches = matches.filter((m) => m.gameweek_id === selectedGwId).sort((a, b) => new Date(a.kickoff_at ?? 0).getTime() - new Date(b.kickoff_at ?? 0).getTime());
  const currentGw = gameweeks.find((g) => g.id === selectedGwId);

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
          <h1 className="font-display font-bold text-2xl">Fixtures</h1>
        </div>

        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => {
              const idx = gameweeks.findIndex((g) => g.id === selectedGwId);
              if (idx > 0) setSelectedGwId(gameweeks[idx - 1].id);
            }}
            disabled={gameweeks.findIndex((g) => g.id === selectedGwId) <= 0}
            className="w-8 h-8 rounded-full bg-[#0B3363]/5 dark:bg-white/10 disabled:opacity-30"
          >
            ‹
          </button>
          <div className="font-display font-bold text-sm">{currentGw?.round_name ?? `Match Week ${currentGw?.number ?? ""}`}</div>
          <button
            onClick={() => {
              const idx = gameweeks.findIndex((g) => g.id === selectedGwId);
              if (idx >= 0 && idx < gameweeks.length - 1) setSelectedGwId(gameweeks[idx + 1].id);
            }}
            disabled={gameweeks.findIndex((g) => g.id === selectedGwId) >= gameweeks.length - 1}
            className="w-8 h-8 rounded-full bg-[#0B3363]/5 dark:bg-white/10 disabled:opacity-30"
          >
            ›
          </button>
        </div>

        <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 divide-y divide-[#0B3363]/5 dark:divide-white/5">
          {gwMatches.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <TeamBadge name={teamNames[m.home_team_id]} slug={teamSlugs[m.home_team_id]} size={22} className="w-2/5" />
              <span className="flex-shrink-0 px-2 text-center">
                {m.status === "completed" ? (
                  <span className="font-display font-bold bg-[#0B3363]/5 dark:bg-white/10 px-2 py-1 rounded">{m.home_score}–{m.away_score}</span>
                ) : m.status === "live" ? (
                  <span className="font-display font-bold text-red-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> {m.home_score ?? 0}–{m.away_score ?? 0}
                  </span>
                ) : (
                  <span className="text-xs text-[#0B3363]/40 dark:text-white/40">
                    {m.kickoff_at ? new Date(m.kickoff_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "TBD"}
                  </span>
                )}
              </span>
              <TeamBadge name={teamNames[m.away_team_id]} slug={teamSlugs[m.away_team_id]} size={22} className="w-2/5 flex-row-reverse text-right" />
            </div>
          ))}
          {gwMatches.length === 0 && <div className="p-6 text-center text-xs text-[#0B3363]/40 dark:text-white/40">No fixtures for this match week.</div>}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
