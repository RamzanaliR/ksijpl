"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import TeamBadge from "@/components/TeamBadge";

type Division = "seniors" | "juniors";
type StatRow = { name: string; teamName: string; teamSlug: string | null; teamLogoUrl: string | null; value: number };
type Stats = { goals: StatRow[]; assists: StatRow[]; clean_sheets: StatRow[] };

const SENIORS_COMPETITION_ID = "e0eee160-729a-4cbd-a29a-20d36115db31";
const JUNIORS_COMPETITION_ID = "544019cb-0615-4b38-b9b8-03e71dfe1706";

const CATS = [
  { key: "goals",        label: "Golden Boot", icon: "⚽", cat: "goals" },
  { key: "assists",      label: "Assists",      icon: "🅰️", cat: "assists" },
  { key: "clean_sheets", label: "Clean Sheets", icon: "🧤", cat: "clean_sheets" },
] as const;

async function fetchStats(division: Division): Promise<Stats> {
  const compId = division === "seniors" ? SENIORS_COMPETITION_ID : JUNIORS_COMPETITION_ID;
  const { data: seasons } = await supabase.from("seasons").select("id")
    .eq("competition_id", compId).order("created_at", { ascending: false }).limit(1);
  const seasonIds = (seasons ?? []).map((s: any) => s.id);
  if (!seasonIds.length) return { goals: [], assists: [], clean_sheets: [] };

  const { data: seasonTeams } = await supabase.from("season_teams").select("team_id").in("season_id", seasonIds);
  const teamIds = [...new Set((seasonTeams ?? []).map((st: any) => st.team_id))];

  const { data: teamsData } = await supabase.from("teams").select("id,name,slug,sponsor_logo_url").in("id", teamIds);
  const teamMap: Record<string, any> = Object.fromEntries((teamsData ?? []).map((t: any) => [t.id, t]));

  const { data: matchesData } = await supabase.from("matches")
    .select("id,home_team_id,away_team_id,home_score,away_score")
    .in("season_id", seasonIds).not("home_score", "is", null);
  const matchIds = (matchesData ?? []).map((m: any) => m.id);

  const { data: playersData } = await supabase.from("players")
    .select("id,full_name,fpl_name,nickname,position,team_id").in("team_id", teamIds);
  const playerMap: Record<string, any> = Object.fromEntries((playersData ?? []).map((p: any) => [p.id, p]));

  const { data: events } = await supabase.from("match_events").select("player_id,type")
    .in("match_id", matchIds.length ? matchIds : ["00000000-0000-0000-0000-000000000000"])
    .in("type", ["goal", "assist"]);

  const goalT: Record<string, number> = {};
  const assistT: Record<string, number> = {};
  const csT: Record<string, number> = {};

  (events ?? []).forEach((e: any) => {
    if (e.type === "goal")   goalT[e.player_id]   = (goalT[e.player_id]   ?? 0) + 1;
    if (e.type === "assist") assistT[e.player_id] = (assistT[e.player_id] ?? 0) + 1;
  });
  (matchesData ?? []).forEach((m: any) => {
    if (m.home_score === 0)
      Object.values(playerMap).filter((p: any) => p.team_id === m.away_team_id && p.position === "GK")
        .forEach((p: any) => { csT[p.id] = (csT[p.id] ?? 0) + 1; });
    if (m.away_score === 0)
      Object.values(playerMap).filter((p: any) => p.team_id === m.home_team_id && p.position === "GK")
        .forEach((p: any) => { csT[p.id] = (csT[p.id] ?? 0) + 1; });
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
      .slice(0, 5);

  return { goals: toRows(goalT), assists: toRows(assistT), clean_sheets: toRows(csT) };
}

// ─── Compact mode (homepage sidebar) ─────────────────────────────────────────

export default function StatsWidget({ compact }: { compact?: boolean }) {
  const [division, setDivision] = useState<Division>("seniors");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<"goals" | "assists" | "clean_sheets">("goals");

  useEffect(() => {
    setLoading(true);
    fetchStats(division).then((s) => { setStats(s); setLoading(false); });
  }, [division]);

  if (compact) {
    // Compact sidebar version for homepage
    const activeRows = stats?.[activeCat] ?? [];
    return (
      <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#0B3363]/8 dark:border-white/8 flex items-center justify-between">
          <h2 className="font-display font-bold text-sm">Stats Centre</h2>
          <Link href={`/stats?div=${division}&cat=${activeCat}`} className="text-xs text-[#3EA0D9] hover:underline font-semibold">View all →</Link>
        </div>

        {/* Division toggle */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex gap-1 p-1 bg-[#0B3363]/5 dark:bg-white/5 rounded-xl w-fit">
            {(["seniors","juniors"] as Division[]).map((d) => (
              <button key={d} onClick={() => setDivision(d)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  division === d ? "bg-[#0B3363] text-white dark:bg-[#3EA0D9]" : "text-[#0B3363]/60 dark:text-white/60"
                }`}>
                {d === "seniors" ? "goFiber PL" : "Care & Cure PL"}
              </button>
            ))}
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 px-4 pb-3">
          {CATS.map(({ key, label, icon }) => (
            <button key={key} onClick={() => setActiveCat(key)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex-1 justify-center ${
                activeCat === key ? "bg-[#0B3363] text-white dark:bg-[#3EA0D9]" : "bg-[#0B3363]/5 dark:bg-white/10 text-[#0B3363]/60"
              }`}>
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Rows */}
        <div className="divide-y divide-[#0B3363]/5 dark:divide-white/5">
          {loading ? (
            <div className="py-6 text-center text-xs text-[#0B3363]/30 dark:text-white/30">Loading…</div>
          ) : activeRows.length === 0 ? (
            <div className="py-6 px-4 text-center text-xs text-[#0B3363]/30 dark:text-white/30">
              Stats available after Match Week 1
            </div>
          ) : activeRows.map((r, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <span className={`font-display font-bold text-sm w-5 text-center flex-shrink-0 ${
                i === 0 ? "text-[#F4B400]" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-[#0B3363]/30 dark:text-white/30"
              }`}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate">{r.name}</div>
                <TeamBadge name={r.teamName} slug={r.teamSlug} logoUrl={r.teamLogoUrl} size={12} className="text-[10px] text-[#0B3363]/40 dark:text-white/40" />
              </div>
              <span className="font-display font-bold text-base flex-shrink-0">{r.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Full standalone widget (removed from homepage — kept for potential reuse)
  return null;
}
