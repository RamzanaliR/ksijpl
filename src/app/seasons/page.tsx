"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import TeamBadge from "@/components/TeamBadge";
import { getSponsorLogoMap } from "@/lib/sponsor-logos";

type Competition = { id: string; name: string; division_id: string; sponsor_name: string };
type Season = { id: string; label: string };
type StandingRow = { team_id: string; played: number; won: number; goals_for: number; goals_against: number; goal_difference: number; points: number };
type PlayerStat = {
  id: string;
  full_name: string;
  fpl_name: string | null;
  nickname: string | null;
  team_id: string;
  gp: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  motm: number;
  clean_sheets: number | null;
};

const PS_COLS: { col: string; label: string; center: boolean }[] = [
  { col: "full_name", label: "Name",  center: false },
  { col: "",          label: "Team",  center: false },
  { col: "gp",        label: "GP",    center: true  },
  { col: "goals",     label: "G",     center: true  },
  { col: "assists",   label: "A",     center: true  },
  { col: "yellow",    label: "YC",    center: true  },
  { col: "red",       label: "RC",    center: true  },
  { col: "motm",      label: "MM",    center: true  },
];

const PS_COLS_CS: { col: string; label: string; center: boolean }[] = [
  ...PS_COLS,
  { col: "clean_sheets", label: "CS", center: true },
];

const DIVISION_LABELS: Record<string, string> = {
  gofiber: "gofiber KSIJ PL",
  "Care & Cure": "Care & Cure KSIJ PL",
};

export default function SeasonsPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [activeCompId, setActiveCompId] = useState("");
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [teamMap, setTeamMap] = useState<Record<string, string>>({});
  const [teamSlugs, setTeamSlugs] = useState<Record<string, string | null>>({});
  const [teamLogoUrls, setTeamLogoUrls] = useState<Record<string, string>>({});
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [psHasCS, setPsHasCS] = useState(false);
  const [psSort, setPsSort] = useState<{ col: keyof PlayerStat; dir: "asc" | "desc" }>({ col: "goals", dir: "desc" });
  const [psPage, setPsPage] = useState(0);
  const [psSearch, setPsSearch] = useState("");
  const [psTeamFilter, setPsTeamFilter] = useState("");
  const PS_PER_PAGE = 10;
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("competitions")
        .select("id,name,division_id,sponsor_name")
        .eq("type", "league")
        .order("name");
      const ordered = [...(data ?? [])].sort(
        (a: any, b: any) => ["gofiber", "Care & Cure"].indexOf(a.sponsor_name) - ["gofiber", "Care & Cure"].indexOf(b.sponsor_name)
      );
      setCompetitions(ordered);
      if (ordered.length) setActiveCompId(ordered[0].id);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!activeCompId) return;
    (async () => {
      const { data } = await supabase
        .from("seasons")
        .select("id,label,created_at")
        .eq("competition_id", activeCompId)
        .order("created_at", { ascending: false });
      setSeasons(data ?? []);
      if (data && data.length) setSelectedSeasonId(data[0].id);
    })();
  }, [activeCompId]);

  useEffect(() => {
    if (!selectedSeasonId) return;
    const comp = competitions.find((c) => c.id === activeCompId);
    if (!comp) return;
    setLoadingData(true);
    (async () => {
      const [{ data: teams }, { data: standingsData }] = await Promise.all([
        supabase.from("teams").select("id,name,slug").eq("division_id", comp.division_id),
        supabase
          .from("standings")
          .select("team_id,played,won,goals_for,goals_against,goal_difference,points")
          .eq("season_id", selectedSeasonId)
          .order("points", { ascending: false })
          .order("goal_difference", { ascending: false }),
      ]);
      const tMap: Record<string, string> = {};
      const tSlugs: Record<string, string | null> = {};
      (teams ?? []).forEach((t: any) => {
        tMap[t.id] = t.name;
        tSlugs[t.id] = t.slug;
      });
      setTeamMap(tMap);
      setTeamSlugs(tSlugs);
      getSponsorLogoMap().then(setTeamLogoUrls);
      setStandings(standingsData ?? []);

      const teamIds = (teams ?? []).map((t: any) => t.id);

      const { data: archived } = await supabase
        .from("season_player_stats")
        .select("id,player_name,player_id,team_id,pld,goals,assists,yellow,red,motm,clean_sheets")
        .eq("season_id", selectedSeasonId);

      if (archived && archived.length) {
        const hasCS = archived.some((a: any) => a.clean_sheets !== null);
        setPsHasCS(hasCS);
        const stats: PlayerStat[] = archived.map((a: any) => ({
          id: a.id,
          full_name: a.player_name,
          fpl_name: null,
          nickname: null,
          team_id: a.team_id ?? "",
          gp: a.pld,
          goals: a.goals,
          assists: a.assists,
          yellow: a.yellow,
          red: a.red,
          motm: a.motm,
          clean_sheets: a.clean_sheets,
        }));
        stats.sort((a, b) => b.goals - a.goals || b.assists - a.assists || b.gp - a.gp);
        setPlayerStats(stats);
        setLoadingData(false);
        return;
      }
      setPsHasCS(false);

      const [{ data: players }, { data: attendance }, { data: events }, { data: matches }] = await Promise.all([
        supabase.from("players").select("id,full_name,fpl_name,nickname,team_id").in("team_id", teamIds.length ? teamIds : ["00000000-0000-0000-0000-000000000000"]),
        supabase.from("match_attendance").select("player_id").in("team_id", teamIds.length ? teamIds : ["00000000-0000-0000-0000-000000000000"]),
        supabase.from("match_events").select("player_id,type").in("team_id", teamIds.length ? teamIds : ["00000000-0000-0000-0000-000000000000"]),
        supabase.from("matches").select("home_motm_player_id,away_motm_player_id").eq("season_id", selectedSeasonId),
      ]);

      const gpCount: Record<string, number> = {};
      (attendance ?? []).forEach((a: any) => (gpCount[a.player_id] = (gpCount[a.player_id] ?? 0) + 1));
      const evCount: Record<string, Record<string, number>> = {};
      (events ?? []).forEach((e: any) => {
        if (!evCount[e.player_id]) evCount[e.player_id] = {};
        evCount[e.player_id][e.type] = (evCount[e.player_id][e.type] ?? 0) + 1;
      });
      const motmCount: Record<string, number> = {};
      (matches ?? []).forEach((m: any) => {
        if (m.home_motm_player_id) motmCount[m.home_motm_player_id] = (motmCount[m.home_motm_player_id] ?? 0) + 1;
        if (m.away_motm_player_id) motmCount[m.away_motm_player_id] = (motmCount[m.away_motm_player_id] ?? 0) + 1;
      });

      const stats: PlayerStat[] = (players ?? []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        fpl_name: p.fpl_name ?? null,
        nickname: p.nickname,
        team_id: p.team_id,
        gp: gpCount[p.id] ?? 0,
        goals: evCount[p.id]?.goal ?? 0,
        assists: evCount[p.id]?.assist ?? 0,
        yellow: evCount[p.id]?.yellow_card ?? 0,
        red: evCount[p.id]?.red_card ?? 0,
        motm: motmCount[p.id] ?? 0,
        clean_sheets: null,
      }));
      stats.sort((a, b) => b.goals - a.goals || b.assists - a.assists || b.gp - a.gp);
      setPlayerStats(stats);
      setLoadingData(false);
    })();
  }, [selectedSeasonId, activeCompId, competitions]);

  // Sorted + paginated player stats
  const sortedStats = [...playerStats].sort((a, b) => {
    const av = a[psSort.col] as number | string;
    const bv = b[psSort.col] as number | string;
    if (typeof av === "number" && typeof bv === "number") return psSort.dir === "desc" ? bv - av : av - bv;
    return psSort.dir === "desc" ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
  });
  const filteredStats = sortedStats.filter((p) => {
    const q = psSearch.toLowerCase();
    const nameMatch = !q || p.full_name.toLowerCase().includes(q) || (p.fpl_name ?? "").toLowerCase().includes(q) || (p.nickname ?? "").toLowerCase().includes(q);
    const teamMatch = !psTeamFilter || p.team_id === psTeamFilter;
    return nameMatch && teamMatch;
  });
  const psTotal = filteredStats.length;
  const psTotalPages = Math.ceil(psTotal / PS_PER_PAGE);
  const pagedStats = filteredStats.slice(psPage * PS_PER_PAGE, (psPage + 1) * PS_PER_PAGE);

  function toggleSort(col: keyof PlayerStat) {
    setPsSort((prev) => prev.col === col ? { col, dir: prev.dir === "desc" ? "asc" : "desc" } : { col, dir: "desc" });
    setPsPage(0);
  }

  // Reset page on filter change
  function handlePsSearch(v: string) { setPsSearch(v); setPsPage(0); }
  function handlePsTeam(v: string) { setPsTeamFilter(v); setPsPage(0); }

  const activeComp = competitions.find((c) => c.id === activeCompId);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
        <SiteHeader active="seasons" />
        <div className="flex-1 flex items-center justify-center text-sm opacity-50">Loading…</div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
      <SiteHeader active="seasons" />
      <main className="max-w-6xl mx-auto px-6 py-10 flex-1 w-full">
        <h1 className="font-display font-bold text-3xl mb-1">Seasons</h1>
        <p className="text-[#0B3363]/60 dark:text-white/60 mb-6">Full league table and player stats.</p>

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {competitions.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCompId(c.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  c.id === activeCompId
                    ? "bg-[#0B3363] text-white dark:bg-[#3EA0D9] dark:text-[#0B1220]"
                    : "bg-[#0B3363]/5 dark:bg-white/10 hover:bg-[#0B3363]/10 dark:hover:bg-white/15"
                }`}
              >
                {DIVISION_LABELS[c.sponsor_name] ?? c.name}
              </button>
            ))}
          </div>

          {seasons.length > 0 && (
            <div>
              <select
                value={selectedSeasonId}
                onChange={(e) => setSelectedSeasonId(e.target.value)}
                className="border border-[#0B3363]/15 dark:border-white/15 dark:bg-white/5 rounded-lg px-3 py-2 text-sm font-semibold"
              >
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {loadingData ? (
          <div className="text-sm opacity-50 py-10 text-center">Loading season data…</div>
        ) : (
          <div className="grid lg:grid-cols-[2fr_3fr] gap-6 min-w-0">
            {/* League Table — 40% */}
            <section className="min-w-0">
              <div className="inline-block bg-white text-[#0B3363] font-display font-bold text-sm px-3 py-1.5 rounded-lg mb-4">
                League Table
              </div>
              <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 overflow-hidden">
                <div className="overflow-x-auto max-h-[440px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase text-[#0B3363]/40 dark:text-white/40 border-b border-[#0B3363]/10 dark:border-white/10">
                        <th className="text-left py-2 px-3 w-8">Pos</th>
                        <th className="text-left py-2 px-3">Team</th>
                        <th className="text-center py-2 px-2">GP</th>
                        <th className="text-center py-2 px-2">W</th>
                        <th className="text-center py-2 px-2">GF</th>
                        <th className="text-center py-2 px-2">GA</th>
                        <th className="text-center py-2 px-2">GD</th>
                        <th className="text-center py-2 px-3">PTS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((row, i) => (
                        <tr key={row.team_id} className="h-10 border-b border-[#0B3363]/5 dark:border-white/5 last:border-0 even:bg-[#0B3363]/[0.03] dark:even:bg-white/[0.03]">
                          <td className="px-3 text-[#0B3363]/40 dark:text-white/40 font-semibold text-center">{i + 1}</td>
                          <td className="px-3">
                            <a href={`/teams/${row.team_id}`} className="hover:text-[#3EA0D9] transition-colors">
                              <TeamBadge name={teamMap[row.team_id]} slug={teamSlugs[row.team_id]} logoUrl={teamLogoUrls[row.team_id]} size={22} />
                            </a>
                          </td>
                          <td className="px-2 text-center">{row.played}</td>
                          <td className="px-2 text-center">{row.won}</td>
                          <td className="px-2 text-center">{row.goals_for}</td>
                          <td className="px-2 text-center">{row.goals_against}</td>
                          <td className="px-2 text-center">{row.goal_difference}</td>
                          <td className="px-3 text-center font-bold text-[#3EA0D9]">{row.points}</td>
                        </tr>
                      ))}
                      {standings.length === 0 && (
                        <tr><td colSpan={8} className="py-6 text-center text-xs text-[#0B3363]/40 dark:text-white/40">No completed matches yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Player Stats — 60% */}
            <section className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="inline-block bg-white text-[#0B3363] font-display font-bold text-sm px-3 py-1.5 rounded-lg flex-shrink-0">
                  Player Stats
                </div>
                <input
                  value={psSearch}
                  onChange={(e) => handlePsSearch(e.target.value)}
                  placeholder="Search player…"
                  className="flex-1 min-w-[140px] border border-[#0B3363]/15 dark:border-white/15 dark:bg-white/5 rounded-lg px-3 py-1.5 text-xs"
                />
                <select
                  value={psTeamFilter}
                  onChange={(e) => handlePsTeam(e.target.value)}
                  className="border border-[#0B3363]/15 dark:border-white/15 dark:bg-[#0B1220] rounded-lg px-2 py-1.5 text-xs min-w-[130px]"
                >
                  <option value="">All teams</option>
                  {Object.entries(teamMap).sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white dark:bg-[#0B1220]">
                      <tr className="text-[10px] uppercase text-[#0B3363]/40 dark:text-white/40 border-b border-[#0B3363]/10 dark:border-white/10">
                        {(psHasCS ? PS_COLS_CS : PS_COLS).map(({ col, label, center }) =>
                          col === "" ? (
                            <th key="team" className="text-left py-2 px-2">{label}</th>
                          ) : (
                            <th key={col}
                              onClick={() => toggleSort(col as keyof PlayerStat)}
                              className={"py-2 px-2 cursor-pointer select-none hover:text-[#3EA0D9] transition-colors " + (center ? "text-center " : "text-left ") + (psSort.col === col ? "text-[#3EA0D9]" : "")}>
                              {label}{psSort.col === col ? (psSort.dir === "desc" ? " ↓" : " ↑") : ""}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {pagedStats.map((p) => (
                        <tr key={p.id} className="h-10 border-b border-[#0B3363]/5 dark:border-white/5 last:border-0">
                          <td className="px-3 truncate max-w-[140px]">
                            <span className="font-medium">{p.fpl_name || p.full_name}</span>
                            {p.nickname && !p.fpl_name && <span className="text-xs text-[#0B3363]/40 dark:text-white/40"> "{p.nickname}"</span>}
                          </td>
                          <td className="px-2">
                            {p.team_id ? (
                              <TeamBadge name={teamMap[p.team_id] ?? "—"} slug={teamSlugs[p.team_id]} logoUrl={teamLogoUrls[p.team_id]} size={16} className="text-xs" />
                            ) : (
                              <span className="text-xs text-[#0B3363]/30 dark:text-white/30">—</span>
                            )}
                          </td>
                          <td className="px-2 text-center">{p.gp}</td>
                          <td className="px-2 text-center font-bold text-[#3EA0D9]">{p.goals}</td>
                          <td className="px-2 text-center">{p.assists}</td>
                          <td className="px-2 text-center">{p.yellow}</td>
                          <td className="px-2 text-center">{p.red}</td>
                          <td className="px-3 text-center">{p.motm}</td>
                          {psHasCS && <td className="px-3 text-center">{p.clean_sheets ?? 0}</td>}
                        </tr>
                      ))}
                      {pagedStats.length === 0 && (
                        <tr><td colSpan={psHasCS ? 9 : 8} className="py-6 text-center text-xs text-[#0B3363]/40 dark:text-white/40">No players found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {psTotalPages > 1 && (
                <div className="flex items-center justify-center gap-1 px-3 py-3 border-t border-[#0B3363]/8 dark:border-white/8 flex-wrap">
                  {/* Prev */}
                  <button onClick={() => setPsPage(p => Math.max(0, p - 1))} disabled={psPage === 0}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#0B3363]/15 dark:border-white/15 disabled:opacity-30 hover:border-[#3EA0D9] text-xs transition-colors">
                    ‹
                  </button>
                  {/* Smart page numbers */}
                  {(() => {
                    const pages: (number | "...")[] = [];
                    if (psTotalPages <= 7) {
                      for (let i = 0; i < psTotalPages; i++) pages.push(i);
                    } else {
                      pages.push(0);
                      if (psPage > 2) pages.push("...");
                      for (let i = Math.max(1, psPage - 1); i <= Math.min(psTotalPages - 2, psPage + 1); i++) pages.push(i);
                      if (psPage < psTotalPages - 3) pages.push("...");
                      pages.push(psTotalPages - 1);
                    }
                    return pages.map((p, i) =>
                      p === "..." ? (
                        <span key={`dots-${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-[#0B3363]/40 dark:text-white/40">…</span>
                      ) : (
                        <button key={p} onClick={() => setPsPage(p as number)}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold border transition-colors ${
                            p === psPage
                              ? "bg-[#3EA0D9] text-white border-[#3EA0D9]"
                              : "border-[#0B3363]/15 dark:border-white/15 hover:border-[#3EA0D9]"
                          }`}>
                          {(p as number) + 1}
                        </button>
                      )
                    );
                  })()}
                  {/* Next */}
                  <button onClick={() => setPsPage(p => Math.min(psTotalPages - 1, p + 1))} disabled={psPage === psTotalPages - 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#0B3363]/15 dark:border-white/15 disabled:opacity-30 hover:border-[#3EA0D9] text-xs transition-colors">
                    ›
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
