"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import TeamBadge from "@/components/TeamBadge";

type Division = "seniors" | "juniors";
type StatRow = { name: string; teamName: string; teamSlug: string | null; teamLogoUrl: string | null; value: number };
type Stats = { goals: StatRow[]; assists: StatRow[]; clean_sheets: StatRow[]; motm: StatRow[] };

const SENIORS_COMPETITION_ID = "e0eee160-729a-4cbd-a29a-20d36115db31";
const JUNIORS_COMPETITION_ID = "544019cb-0615-4b38-b9b8-03e71dfe1706";

const CATS = [
  { key: "goals",        label: "Golden Boot", icon: "⚽" },
  { key: "assists",      label: "Assists",      icon: "🅰️" },
  { key: "clean_sheets", label: "Clean Sheets", icon: "🧤" },
  { key: "motm",         label: "MOTM",         icon: "⭐" },
] as const;

export default function StatsWidget() {
  const [division, setDivision] = useState<Division>("seniors");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const compId = division === "seniors" ? SENIORS_COMPETITION_ID : JUNIORS_COMPETITION_ID;

      const { data: seasons } = await supabase.from("seasons").select("id").eq("competition_id", compId)
        .order("created_at", { ascending: false }).limit(1);
      const seasonIds = (seasons ?? []).map((s: any) => s.id);
      if (!seasonIds.length) { setStats(null); setLoading(false); return; }

      const { data: seasonTeams } = await supabase.from("season_teams").select("team_id").in("season_id", seasonIds);
      const teamIds = [...new Set((seasonTeams ?? []).map((st: any) => st.team_id))];

      const { data: teamsData } = await supabase.from("teams").select("id,name,slug,sponsor_logo_url").in("id", teamIds);
      const teamMap: Record<string, any> = Object.fromEntries((teamsData ?? []).map((t: any) => [t.id, t]));

      const { data: matchesData } = await supabase.from("matches")
        .select("id,home_motm_player_id,away_motm_player_id,home_team_id,away_team_id,home_score,away_score")
        .in("season_id", seasonIds).not("home_score", "is", null);

      const matchIds = (matchesData ?? []).map((m: any) => m.id);

      const { data: playersData } = await supabase.from("players")
        .select("id,full_name,fpl_name,nickname,position,team_id").in("team_id", teamIds);
      const playerMap: Record<string, any> = Object.fromEntries((playersData ?? []).map((p: any) => [p.id, p]));

      const { data: events } = await supabase.from("match_events").select("player_id,type")
        .in("match_id", matchIds.length ? matchIds : ["00000000-0000-0000-0000-000000000000"])
        .in("type", ["goal", "assist"]);

      // Tally
      const goalTally: Record<string, number> = {};
      const assistTally: Record<string, number> = {};
      const motmTally: Record<string, number> = {};
      const csTally: Record<string, number> = {};

      (events ?? []).forEach((e: any) => {
        if (e.type === "goal") goalTally[e.player_id] = (goalTally[e.player_id] ?? 0) + 1;
        if (e.type === "assist") assistTally[e.player_id] = (assistTally[e.player_id] ?? 0) + 1;
      });
      (matchesData ?? []).forEach((m: any) => {
        if (m.home_motm_player_id) motmTally[m.home_motm_player_id] = (motmTally[m.home_motm_player_id] ?? 0) + 1;
        if (m.away_motm_player_id) motmTally[m.away_motm_player_id] = (motmTally[m.away_motm_player_id] ?? 0) + 1;
        if (m.home_score === 0) {
          Object.values(playerMap).filter((p: any) => p.team_id === m.away_team_id && p.position === "GK")
            .forEach((p: any) => { csTally[p.id] = (csTally[p.id] ?? 0) + 1; });
        }
        if (m.away_score === 0) {
          Object.values(playerMap).filter((p: any) => p.team_id === m.home_team_id && p.position === "GK")
            .forEach((p: any) => { csTally[p.id] = (csTally[p.id] ?? 0) + 1; });
        }
      });

      const toRows = (tally: Record<string, number>): StatRow[] =>
        Object.entries(tally)
          .filter(([pid]) => playerMap[pid])
          .map(([pid, val]) => {
            const p = playerMap[pid];
            const t = teamMap[p.team_id] ?? {};
            return { name: p.fpl_name || p.nickname || p.full_name, teamName: t.name ?? "—", teamSlug: t.slug ?? null, teamLogoUrl: t.sponsor_logo_url ?? null, value: val };
          })
          .sort((a, b) => b.value - a.value)
          .slice(0, 3);

      setStats({ goals: toRows(goalTally), assists: toRows(assistTally), clean_sheets: toRows(csTally), motm: toRows(motmTally) });
      setLoading(false);
    })();
  }, [division]);

  const hasAnyData = stats && Object.values(stats).some((rows) => rows.length > 0);

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 py-10 w-full">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="font-display font-bold text-xl sm:text-2xl">Stats Centre</h2>
          <p className="text-sm text-[#0B3363]/50 dark:text-white/50">Top performers this season</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 p-1 bg-[#0B3363]/5 dark:bg-white/5 rounded-xl">
            {(["seniors","juniors"] as Division[]).map((d) => (
              <button key={d} onClick={() => setDivision(d)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  division === d ? "bg-[#0B3363] text-white dark:bg-[#3EA0D9]" : "text-[#0B3363]/60 dark:text-white/60"
                }`}>
                {d === "seniors" ? "goFiber PL" : "Care & Cure PL"}
              </button>
            ))}
          </div>
          <Link href={`/stats?div=${division}`} className="text-xs font-semibold text-[#3EA0D9] hover:underline whitespace-nowrap">
            View all →
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0,1,2,3].map((i) => <div key={i} className="rounded-2xl bg-[#0B3363]/5 dark:bg-white/5 h-40 animate-pulse" />)}
        </div>
      ) : !hasAnyData ? (
        <div className="rounded-2xl border border-dashed border-[#0B3363]/15 dark:border-white/15 py-10 text-center text-sm text-[#0B3363]/30 dark:text-white/30">
          Stats will appear here after Match Week 1 — check back on 5 September.
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {CATS.map(({ key, label, icon }) => {
            const rows = stats?.[key] ?? [];
            return (
              <Link key={key} href={`/stats?div=${division}&cat=${key}`}
                className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 bg-white dark:bg-white/5 p-4 hover:border-[#3EA0D9] transition-colors group">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{icon}</span>
                    <span className="font-display font-bold text-sm">{label}</span>
                  </div>
                  <span className="text-xs text-[#3EA0D9] group-hover:underline">All →</span>
                </div>
                {rows.length === 0 ? (
                  <p className="text-xs text-[#0B3363]/30 dark:text-white/30">No data yet</p>
                ) : (
                  <div className="space-y-2.5">
                    {rows.map((r, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#0B3363]/30 dark:text-white/30 w-4 flex-shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate">{r.name}</div>
                          <TeamBadge name={r.teamName} slug={r.teamSlug} logoUrl={r.teamLogoUrl} size={12} className="text-[10px] text-[#0B3363]/40 dark:text-white/40" />
                        </div>
                        <span className="font-display font-bold text-sm flex-shrink-0">{r.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
