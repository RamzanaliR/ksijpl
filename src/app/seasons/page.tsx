"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import TeamBadge from "@/components/TeamBadge";

type Competition = { id: string; name: string; division_id: string; sponsor_name: string };
type Season = { id: string; label: string };
type StandingRow = { team_id: string; played: number; won: number; goals_for: number; goals_against: number; goal_difference: number; points: number };
type PlayerStat = {
  id: string;
  full_name: string;
  nickname: string | null;
  team_id: string;
  gp: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  motm: number;
};

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
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
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
      setStandings(standingsData ?? []);

      const teamIds = (teams ?? []).map((t: any) => t.id);
      const [{ data: players }, { data: attendance }, { data: events }, { data: matches }] = await Promise.all([
        supabase.from("players").select("id,full_name,nickname,team_id").in("team_id", teamIds.length ? teamIds : ["00000000-0000-0000-0000-000000000000"]),
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
        nickname: p.nickname,
        team_id: p.team_id,
        gp: gpCount[p.id] ?? 0,
        goals: evCount[p.id]?.goal ?? 0,
        assists: evCount[p.id]?.assist ?? 0,
        yellow: evCount[p.id]?.yellow_card ?? 0,
        red: evCount[p.id]?.red_card ?? 0,
        motm: motmCount[p.id] ?? 0,
      }));
      stats.sort((a, b) => b.goals - a.goals || b.assists - a.assists || b.gp - a.gp);
      setPlayerStats(stats);
      setLoadingData(false);
    })();
  }, [selectedSeasonId, activeCompId, competitions]);

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
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase text-[#0B3363]/40 dark:text-white/40 border-b border-[#0B3363]/10 dark:border-white/10">
                        <th className="text-left py-2 px-3">Pos</th>
                        <th className="text-left py-2 px-3">Team</th>
                        <th className="text-right py-2 px-2">GP</th>
                        <th className="text-right py-2 px-2">W</th>
                        <th className="text-right py-2 px-2">GF</th>
                        <th className="text-right py-2 px-2">GA</th>
                        <th className="text-right py-2 px-2">GD</th>
                        <th className="text-right py-2 px-3">PTS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((row, i) => (
                        <tr key={row.team_id} className="border-b border-[#0B3363]/5 dark:border-white/5 last:border-0 even:bg-[#0B3363]/[0.03] dark:even:bg-white/[0.03]">
                          <td className="py-3 sm:py-2 px-3 text-[#0B3363]/40 dark:text-white/40 font-semibold">{i + 1}</td>
                          <td className="py-3 sm:py-2 px-3">
                            <a href={`/teams/${row.team_id}`} className="hover:text-[#3EA0D9] transition-colors">
                              <TeamBadge name={teamMap[row.team_id]} slug={teamSlugs[row.team_id]} size={26} />
                            </a>
                          </td>
                          <td className="py-3 sm:py-2 px-2 text-right">{row.played}</td>
                          <td className="py-3 sm:py-2 px-2 text-right">{row.won}</td>
                          <td className="py-3 sm:py-2 px-2 text-right">{row.goals_for}</td>
                          <td className="py-3 sm:py-2 px-2 text-right">{row.goals_against}</td>
                          <td className="py-3 sm:py-2 px-2 text-right">{row.goal_difference}</td>
                          <td className="py-3 sm:py-2 px-3 text-right font-bold text-[#3EA0D9]">{row.points}</td>
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
              <div className="inline-block bg-white text-[#0B3363] font-display font-bold text-sm px-3 py-1.5 rounded-lg mb-4">
                Player Stats
              </div>
              <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 overflow-hidden">
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white dark:bg-[#0B1220]">
                      <tr className="text-[10px] uppercase text-[#0B3363]/40 dark:text-white/40 border-b border-[#0B3363]/10 dark:border-white/10">
                        <th className="text-left py-2 px-3">Name</th>
                        <th className="text-left py-2 px-2">Team</th>
                        <th className="text-right py-2 px-2">GP</th>
                        <th className="text-right py-2 px-2">G</th>
                        <th className="text-right py-2 px-2">A</th>
                        <th className="text-right py-2 px-2">YC</th>
                        <th className="text-right py-2 px-2">RC</th>
                        <th className="text-right py-2 px-3">MM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playerStats.map((p) => (
                        <tr key={p.id} className="border-b border-[#0B3363]/5 dark:border-white/5 last:border-0">
                          <td className="py-2 px-3 truncate max-w-[140px]">
                            {p.full_name}
                            {p.nickname && <span className="text-xs text-[#0B3363]/40 dark:text-white/40"> "{p.nickname}"</span>}
                          </td>
                          <td className="py-2 px-2">
                            <TeamBadge name={teamMap[p.team_id] ?? "—"} slug={teamSlugs[p.team_id]} size={16} className="text-xs" />
                          </td>
                          <td className="py-2 px-2 text-right">{p.gp}</td>
                          <td className="py-2 px-2 text-right font-bold text-[#3EA0D9]">{p.goals}</td>
                          <td className="py-2 px-2 text-right">{p.assists}</td>
                          <td className="py-2 px-2 text-right">{p.yellow}</td>
                          <td className="py-2 px-2 text-right">{p.red}</td>
                          <td className="py-2 px-3 text-right">{p.motm}</td>
                        </tr>
                      ))}
                      {playerStats.length === 0 && (
                        <tr><td colSpan={8} className="py-6 text-center text-xs text-[#0B3363]/40 dark:text-white/40">No players found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
