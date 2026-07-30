"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import TeamBadge from "@/components/TeamBadge";
import { supabase } from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────

type Division = "seniors" | "juniors";
type StatTab = "season" | "alltime";
type StatCategory = "goals" | "assists" | "clean_sheets" | "motm";

type PlayerStatRow = {
  rank: number;
  playerId: string;
  name: string;
  teamId: string;
  teamName: string;
  teamSlug: string | null;
  teamLogoUrl: string | null;
  value: number;
  position: string;
};

const SENIORS_COMPETITION_ID = "e0eee160-729a-4cbd-a29a-20d36115db31";
const JUNIORS_COMPETITION_ID = "544019cb-0615-4b38-b9b8-03e71dfe1706";

const CATEGORY_CONFIG: Record<StatCategory, { label: string; icon: string; unit: string; positions?: string[] }> = {
  goals:        { label: "Golden Boot",  icon: "⚽", unit: "goals" },
  assists:      { label: "Assists",      icon: "🅰️", unit: "assists" },
  clean_sheets: { label: "Clean Sheets", icon: "🧤", unit: "CS", positions: ["GK"] },
  motm:         { label: "Man of the Match", icon: "⭐", unit: "awards" },
};

// ─── Main page (wrapped in Suspense for useSearchParams) ─────────────────────

export default function StatsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm opacity-50">Loading…</div>}>
      <StatsContent />
    </Suspense>
  );
}

function StatsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [tab, setTab] = useState<StatTab>((searchParams.get("tab") as StatTab) ?? "season");
  const [division, setDivision] = useState<Division>((searchParams.get("div") as Division) ?? "seniors");
  const [category, setCategory] = useState<StatCategory>((searchParams.get("cat") as StatCategory) ?? "goals");
  const [rows, setRows] = useState<PlayerStatRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Update URL params when state changes
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    params.set("div", division);
    params.set("cat", category);
    router.replace(`/stats?${params.toString()}`, { scroll: false });
  }, [tab, division, category, router]);

  // ─── Load stats ──────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    setLoading(true);
    setRows([]);

    const compId = division === "seniors" ? SENIORS_COMPETITION_ID : JUNIORS_COMPETITION_ID;

    // Get current season (or all seasons for all-time)
    const { data: seasons } = await supabase
      .from("seasons").select("id")
      .eq("competition_id", compId)
      .order("created_at", { ascending: false })
      .limit(tab === "season" ? 1 : 100);

    const seasonIds = (seasons ?? []).map((s: any) => s.id);
    if (!seasonIds.length) { setLoading(false); return; }

    // Get team IDs for this division
    const { data: seasonTeams } = await supabase
      .from("season_teams").select("team_id").in("season_id", seasonIds);
    const teamIds = [...new Set((seasonTeams ?? []).map((st: any) => st.team_id))];
    if (!teamIds.length) { setLoading(false); return; }

    // Get teams for metadata
    const { data: teamsData } = await supabase
      .from("teams").select("id,name,slug,sponsor_logo_url").in("id", teamIds);
    const teamMap: Record<string, any> = Object.fromEntries((teamsData ?? []).map((t: any) => [t.id, t]));

    // Get all matches in these seasons
    const { data: matchesData } = await supabase
      .from("matches").select("id,home_motm_player_id,away_motm_player_id,home_team_id,away_team_id,home_score,away_score")
      .in("season_id", seasonIds)
      .not("home_score", "is", null);

    const matchIds = (matchesData ?? []).map((m: any) => m.id);

    // Get players
    const posFilter = CATEGORY_CONFIG[category].positions;
    let playerQuery = supabase.from("players").select("id,full_name,fpl_name,nickname,position,team_id").in("team_id", teamIds);
    if (posFilter) playerQuery = playerQuery.in("position", posFilter);
    const { data: playersData } = await playerQuery;

    const playerMap: Record<string, any> = Object.fromEntries((playersData ?? []).map((p: any) => [p.id, p]));

    // Tally stats
    const tally: Record<string, number> = {};
    const add = (pid: string, n = 1) => { if (pid) tally[pid] = (tally[pid] ?? 0) + n; };

    if (category === "goals" || category === "assists") {
      const evType = category === "goals" ? "goal" : "assist";
      const { data: events } = await supabase
        .from("match_events").select("player_id,type")
        .in("match_id", matchIds.length ? matchIds : ["00000000-0000-0000-0000-000000000000"])
        .eq("type", evType);
      (events ?? []).forEach((e: any) => add(e.player_id));
    } else if (category === "motm") {
      (matchesData ?? []).forEach((m: any) => {
        if (m.home_motm_player_id) add(m.home_motm_player_id);
        if (m.away_motm_player_id) add(m.away_motm_player_id);
      });
    } else if (category === "clean_sheets") {
      // Clean sheet = GK's team kept 0 goals in that match
      (matchesData ?? []).forEach((m: any) => {
        if (m.home_score === 0) {
          // Away team kept clean sheet — find GK in away team
          Object.values(playerMap).filter((p: any) => p.team_id === m.away_team_id && p.position === "GK")
            .forEach((p: any) => add(p.id));
        }
        if (m.away_score === 0) {
          Object.values(playerMap).filter((p: any) => p.team_id === m.home_team_id && p.position === "GK")
            .forEach((p: any) => add(p.id));
        }
      });
    }

    // Build rows — only include players with > 0
    const result: PlayerStatRow[] = Object.entries(tally)
      .filter(([pid]) => playerMap[pid])
      .map(([pid, val]) => {
        const p = playerMap[pid];
        const t = teamMap[p.team_id] ?? {};
        return {
          rank: 0,
          playerId: pid,
          name: p.fpl_name || p.nickname || p.full_name,
          teamId: p.team_id,
          teamName: t.name ?? "—",
          teamSlug: t.slug ?? null,
          teamLogoUrl: t.sponsor_logo_url ?? null,
          value: val,
          position: p.position,
        };
      })
      .sort((a, b) => b.value - a.value);

    // Assign ranks (handle ties)
    let rank = 1;
    result.forEach((r, i) => {
      if (i > 0 && r.value < result[i - 1].value) rank = i + 1;
      r.rank = rank;
    });

    setRows(result);
    setLoading(false);
  }, [tab, division, category]);

  useEffect(() => { loadStats(); }, [loadStats]);

  // ─── Render ──────────────────────────────────────────────────────────────

  const catConfig = CATEGORY_CONFIG[category];

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
      <SiteHeader active="seasons" />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">

        {/* Page header */}
        <div className="mb-6">
          <h1 className="font-display font-bold text-2xl sm:text-3xl mb-1">Stats Centre</h1>
          <p className="text-sm text-[#0B3363]/50 dark:text-white/50">Player statistics for KSIJ DAR Premier League</p>
        </div>

        {/* Sub-nav */}
        <div className="flex gap-4 border-b border-[#0B3363]/10 dark:border-white/10 mb-6 overflow-x-auto">
          {(["season", "alltime"] as StatTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                tab === t
                  ? "border-[#0B3363] dark:border-[#3EA0D9] text-[#0B3363] dark:text-white"
                  : "border-transparent text-[#0B3363]/40 dark:text-white/40 hover:text-[#0B3363] dark:hover:text-white"
              }`}
            >
              {t === "season" ? "Season Stats" : "All-time Stats"}
            </button>
          ))}
          {/* Placeholder for future tabs */}
          <span className="pb-3 text-sm text-[#0B3363]/20 dark:text-white/20 whitespace-nowrap cursor-not-allowed">Player (coming soon)</span>
        </div>

        {/* Division toggle + category pills */}
        <div className="flex flex-wrap gap-3 items-center justify-between mb-6">
          <div className="flex gap-1 p-1 bg-[#0B3363]/5 dark:bg-white/5 rounded-xl">
            {(["seniors","juniors"] as Division[]).map((d) => (
              <button key={d} onClick={() => setDivision(d)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                  division === d ? "bg-[#0B3363] text-white dark:bg-[#3EA0D9]" : "text-[#0B3363]/60 dark:text-white/60 hover:text-[#0B3363]"
                }`}>
                {d === "seniors" ? "goFiber PL" : "Care & Cure PL"}
              </button>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap">
            {(Object.entries(CATEGORY_CONFIG) as [StatCategory, typeof catConfig][]).map(([key, cfg]) => (
              <button key={key} onClick={() => setCategory(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  category === key
                    ? "bg-[#0B3363] text-white dark:bg-[#3EA0D9]"
                    : "bg-[#0B3363]/5 dark:bg-white/10 text-[#0B3363]/70 dark:text-white/70 hover:bg-[#0B3363]/10"
                }`}>
                <span>{cfg.icon}</span> {cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="admin-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[#0B3363]/8 dark:border-white/8 flex items-center gap-2">
            <span className="text-lg">{catConfig.icon}</span>
            <h2 className="font-display font-bold text-sm">{catConfig.label}</h2>
            <span className="text-xs text-[#0B3363]/40 dark:text-white/40 ml-1">
              · {tab === "season" ? "Current season" : "All time"} · {division === "seniors" ? "goFiber PL" : "Care & Cure PL"}
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-[#0B3363]/30 dark:text-white/30">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#0B3363]/30 dark:text-white/30">
              No {catConfig.unit} recorded yet — check back after Match Week 1.
            </div>
          ) : (
            <div className="divide-y divide-[#0B3363]/5 dark:divide-white/5">
              {rows.map((r, i) => (
                <div key={r.playerId}
                  className={`flex items-center gap-3 px-4 py-3 ${i < 3 ? "bg-[#F4B400]/5" : ""}`}>
                  {/* Rank */}
                  <div className={`w-8 text-center font-display font-bold text-sm flex-shrink-0 ${
                    r.rank === 1 ? "text-[#F4B400]" :
                    r.rank === 2 ? "text-slate-400" :
                    r.rank === 3 ? "text-amber-700" :
                    "text-[#0B3363]/30 dark:text-white/30"
                  }`}>
                    {r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : r.rank}
                  </div>

                  {/* Player info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{r.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <TeamBadge name={r.teamName} slug={r.teamSlug} logoUrl={r.teamLogoUrl} size={14} className="text-xs text-[#0B3363]/50 dark:text-white/50" />
                      <span className="text-[10px] text-[#0B3363]/30 dark:text-white/30">{r.position}</span>
                    </div>
                  </div>

                  {/* Stat value */}
                  <div className={`text-right flex-shrink-0 ${i < 3 ? "font-display font-bold text-lg text-[#0B3363] dark:text-white" : "font-bold text-sm text-[#0B3363]/70 dark:text-white/70"}`}>
                    {r.value}
                    <div className="text-[9px] font-normal text-[#0B3363]/30 dark:text-white/30 uppercase">{catConfig.unit}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Back to seasons */}
        <div className="mt-4">
          <Link href="/seasons" className="text-xs text-[#3EA0D9] hover:underline">← League Table & Season Overview</Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
