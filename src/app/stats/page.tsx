"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import TeamBadge from "@/components/TeamBadge";
import { supabase } from "@/lib/supabase";

type Division = "seniors" | "juniors";
type StatTab = "season" | "alltime";
type StatCategory = "goals" | "assists" | "clean_sheets" | "motm";
type SortDir = "desc" | "asc";

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
  // extra stats for sortable columns
  goals: number;
  assists: number;
  cleanSheets: number;
  motm: number;
};

const SENIORS_COMPETITION_ID = "e0eee160-729a-4cbd-a29a-20d36115db31";
const JUNIORS_COMPETITION_ID = "544019cb-0615-4b38-b9b8-03e71dfe1706";

const CATEGORY_CONFIG: Record<StatCategory, { label: string; icon: string; unit: string }> = {
  goals:        { label: "Golden Boot",       icon: "⚽", unit: "goals" },
  assists:      { label: "Assists",           icon: "🅰️", unit: "assists" },
  clean_sheets: { label: "Clean Sheets",      icon: "🧤", unit: "CS" },
  motm:         { label: "Man of the Match",  icon: "⭐", unit: "awards" },
};

const PAGE_SIZE = 10;

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

  const [tab, setTab]           = useState<StatTab>((searchParams.get("tab") as StatTab) ?? "season");
  const [division, setDivision] = useState<Division>((searchParams.get("div") as Division) ?? "seniors");
  const [category, setCategory] = useState<StatCategory>((searchParams.get("cat") as StatCategory) ?? "goals");
  const [allRows, setAllRows]   = useState<PlayerStatRow[]>([]);
  const [loading, setLoading]   = useState(false);
  const [page, setPage]         = useState(1);
  const [sortKey, setSortKey]   = useState<"value" | "goals" | "assists" | "cleanSheets" | "motm">("value");
  const [sortDir, setSortDir]   = useState<SortDir>("desc");

  // Sync URL
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("tab", tab); params.set("div", division); params.set("cat", category);
    router.replace(`/stats?${params.toString()}`, { scroll: false });
    setPage(1);
  }, [tab, division, category, router]);

  // Sort handler
  function handleSort(key: typeof sortKey) {
    if (key === sortKey) setSortDir((d) => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
    setPage(1);
  }

  // Load all stats
  const loadStats = useCallback(async () => {
    setLoading(true); setAllRows([]);
    const compId = division === "seniors" ? SENIORS_COMPETITION_ID : JUNIORS_COMPETITION_ID;
    const { data: seasons } = await supabase.from("seasons").select("id")
      .eq("competition_id", compId).order("created_at", { ascending: false }).limit(tab === "season" ? 1 : 100);
    const seasonIds = (seasons ?? []).map((s: any) => s.id);
    if (!seasonIds.length) { setLoading(false); return; }

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

    // Tally all stats per player
    const goalT: Record<string, number>  = {};
    const assistT: Record<string, number> = {};
    const motmT: Record<string, number>  = {};
    const csT: Record<string, number>    = {};

    (events ?? []).forEach((e: any) => {
      if (e.type === "goal")   goalT[e.player_id]   = (goalT[e.player_id]   ?? 0) + 1;
      if (e.type === "assist") assistT[e.player_id] = (assistT[e.player_id] ?? 0) + 1;
    });
    (matchesData ?? []).forEach((m: any) => {
      if (m.home_motm_player_id) motmT[m.home_motm_player_id] = (motmT[m.home_motm_player_id] ?? 0) + 1;
      if (m.away_motm_player_id) motmT[m.away_motm_player_id] = (motmT[m.away_motm_player_id] ?? 0) + 1;
      if (m.home_score === 0)
        Object.values(playerMap).filter((p: any) => p.team_id === m.away_team_id && p.position === "GK")
          .forEach((p: any) => { csT[p.id] = (csT[p.id] ?? 0) + 1; });
      if (m.away_score === 0)
        Object.values(playerMap).filter((p: any) => p.team_id === m.home_team_id && p.position === "GK")
          .forEach((p: any) => { csT[p.id] = (csT[p.id] ?? 0) + 1; });
    });

    // Primary value by category
    const primaryTally = category === "goals" ? goalT : category === "assists" ? assistT : category === "clean_sheets" ? csT : motmT;

    // Build full rows — only players with stats in primary category
    const result: PlayerStatRow[] = Object.entries(primaryTally)
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
          goals: goalT[pid] ?? 0,
          assists: assistT[pid] ?? 0,
          cleanSheets: csT[pid] ?? 0,
          motm: motmT[pid] ?? 0,
        };
      });

    // Assign ranks before sorting by user column
    result.sort((a, b) => b.value - a.value);
    let rank = 1;
    result.forEach((r, i) => {
      if (i > 0 && r.value < result[i - 1].value) rank = i + 1;
      r.rank = rank;
    });

    setAllRows(result);
    setLoading(false);
  }, [tab, division, category]);

  useEffect(() => { loadStats(); }, [loadStats]);

  // Sort + paginate
  const sorted = [...allRows].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    return sortDir === "desc" ? bv - av : av - bv;
  });
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const SortHeader = ({ label, sk }: { label: string; sk: typeof sortKey }) => (
    <th
      onClick={() => handleSort(sk)}
      className="text-center py-2 px-2 cursor-pointer select-none hover:text-[#0B3363] dark:hover:text-white transition-colors group"
    >
      <span className="flex items-center justify-center gap-0.5">
        {label}
        <span className="text-[8px] opacity-40 group-hover:opacity-70">
          {sortKey === sk ? (sortDir === "desc" ? "▼" : "▲") : "⇅"}
        </span>
      </span>
    </th>
  );

  const catConfig = CATEGORY_CONFIG[category];

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
      <SiteHeader active="stats" />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">

        <div className="mb-6">
          <h1 className="font-display font-bold text-2xl sm:text-3xl mb-1">Stats Centre</h1>
          <p className="text-sm text-[#0B3363]/50 dark:text-white/50">Player statistics for KSIJ DAR Premier League</p>
        </div>

        {/* Sub-nav */}
        <div className="flex gap-4 border-b border-[#0B3363]/10 dark:border-white/10 mb-6 overflow-x-auto">
          {(["season", "alltime"] as StatTab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`pb-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                tab === t ? "border-[#0B3363] dark:border-[#3EA0D9] text-[#0B3363] dark:text-white"
                          : "border-transparent text-[#0B3363]/40 dark:text-white/40 hover:text-[#0B3363] dark:hover:text-white"
              }`}>
              {t === "season" ? "Season Stats" : "All-time Stats"}
            </button>
          ))}
          <span className="pb-3 text-sm text-[#0B3363]/20 dark:text-white/20 whitespace-nowrap cursor-not-allowed">Player (coming soon)</span>
        </div>

        {/* Controls */}
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
                  category === key ? "bg-[#0B3363] text-white dark:bg-[#3EA0D9]"
                                   : "bg-[#0B3363]/5 dark:bg-white/10 text-[#0B3363]/70 dark:text-white/70 hover:bg-[#0B3363]/10"
                }`}>
                <span>{cfg.icon}</span> {cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-[#0B3363]/8 dark:border-white/8 flex items-center gap-2">
            <span className="text-base">{catConfig.icon}</span>
            <h2 className="font-display font-bold text-sm">{catConfig.label}</h2>
            <span className="text-xs text-[#0B3363]/40 dark:text-white/40 ml-1">
              · {tab === "season" ? "Current season" : "All time"} · {division === "seniors" ? "goFiber PL" : "Care & Cure PL"}
            </span>
            {allRows.length > 0 && (
              <span className="ml-auto text-xs text-[#0B3363]/40 dark:text-white/40">{allRows.length} players</span>
            )}
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-[#0B3363]/30 dark:text-white/30">Loading…</div>
          ) : allRows.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#0B3363]/30 dark:text-white/30">
              No {catConfig.unit} recorded yet — check back after Match Week 1.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase text-[#0B3363]/40 dark:text-white/40 border-b border-[#0B3363]/10 dark:border-white/10">
                    <th className="text-center py-2 px-3 w-10">#</th>
                    <th className="text-left py-2 px-3 cursor-pointer hover:text-[#0B3363] dark:hover:text-white" onClick={() => handleSort("value")}>
                      Player {sortKey === "value" ? (sortDir === "desc" ? "▼" : "▲") : ""}
                    </th>
                    <th className="text-left py-2 px-2">Team</th>
                    <SortHeader label="Goals" sk="goals" />
                    <SortHeader label="Assists" sk="assists" />
                    <SortHeader label="CS" sk="cleanSheets" />
                    <SortHeader label="MOTM" sk="motm" />
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r, i) => (
                    <tr key={r.playerId} className={`h-11 border-b border-[#0B3363]/5 dark:border-white/5 last:border-0 ${i < 3 && page === 1 ? "bg-[#F4B400]/5" : ""}`}>
                      <td className="px-3 text-center">
                        <span className={`font-display font-bold text-sm ${
                          r.rank === 1 ? "text-[#F4B400]" : r.rank === 2 ? "text-slate-400" : r.rank === 3 ? "text-amber-700" : "text-[#0B3363]/30 dark:text-white/30"
                        }`}>
                          {r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : r.rank}
                        </span>
                      </td>
                      <td className="px-3">
                        <div className="font-semibold truncate max-w-[160px]">{r.name}</div>
                        <div className="text-[10px] text-[#0B3363]/40 dark:text-white/40">{r.position}</div>
                      </td>
                      <td className="px-2">
                        <TeamBadge name={r.teamName} slug={r.teamSlug} logoUrl={r.teamLogoUrl} size={16} className="text-xs" />
                      </td>
                      <td className={`px-2 text-center font-bold ${category === "goals" ? "text-[#3EA0D9]" : ""}`}>{r.goals || "—"}</td>
                      <td className={`px-2 text-center font-bold ${category === "assists" ? "text-[#3EA0D9]" : ""}`}>{r.assists || "—"}</td>
                      <td className={`px-2 text-center font-bold ${category === "clean_sheets" ? "text-[#3EA0D9]" : ""}`}>{r.cleanSheets || "—"}</td>
                      <td className={`px-2 text-center font-bold ${category === "motm" ? "text-[#3EA0D9]" : ""}`}>{r.motm || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-[#0B3363]/15 text-sm disabled:opacity-30 hover:bg-[#0B3363]/5 transition-colors">
              ← Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)}
                className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${
                  p === page ? "bg-[#0B3363] text-white dark:bg-[#3EA0D9]" : "hover:bg-[#0B3363]/5 border border-[#0B3363]/15"
                }`}>
                {p}
              </button>
            ))}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg border border-[#0B3363]/15 text-sm disabled:opacity-30 hover:bg-[#0B3363]/5 transition-colors">
              Next →
            </button>
          </div>
        )}

        <div className="mt-6">
          <Link href="/seasons" className="text-xs text-[#3EA0D9] hover:underline">← League Table & Season Overview</Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
