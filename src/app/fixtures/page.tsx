"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import TeamBadge from "@/components/TeamBadge";
import { supabase } from "@/lib/supabase";

type Division = "seniors" | "juniors";

type Match = {
  id: string;
  kickoff_at: string | null;
  venue: string | null;
  home_score: number | null;
  away_score: number | null;
  home_pen_score: number | null;
  away_pen_score: number | null;
  gameweek_number: number;
  gameweek_label: string;
  home_team_id: string;
  home_team_name: string;
  home_team_slug: string | null;
  home_logo: string | null;
  away_team_id: string;
  away_team_name: string;
  away_team_slug: string | null;
  away_logo: string | null;
};

type MatchGroup = {
  gwLabel: string;
  gwNumber: number;
  date: string;
  matches: Match[];
};

const SENIORS_COMP = "e0eee160-729a-4cbd-a29a-20d36115db31";
const JUNIORS_COMP = "544019cb-0615-4b38-b9b8-03e71dfe1706";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    timeZone: "Africa/Dar_es_Salaam",
  });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", timeZone: "Africa/Dar_es_Salaam",
  });
}

export default function FixturesPage() {
  const [division, setDivision] = useState<Division>("seniors");
  const [groups, setGroups] = useState<MatchGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const compId = division === "seniors" ? SENIORS_COMP : JUNIORS_COMP;

    // Get current season
    const { data: seasons } = await supabase.from("seasons").select("id")
      .eq("competition_id", compId).eq("is_current", true).limit(1);
    const seasonId = seasons?.[0]?.id;
    if (!seasonId) { setGroups([]); setLoading(false); return; }

    // Get all gameweeks
    const { data: gws } = await supabase.from("gameweeks")
      .select("id,number,round_name").eq("season_id", seasonId).order("number");

    // Get all matches
    const { data: rawMatches } = await supabase.from("matches")
      .select("id,kickoff_at,venue,home_score,away_score,home_pen_score,away_pen_score,gameweek_id,home_team_id,away_team_id")
      .eq("season_id", seasonId)
      .order("kickoff_at");

    // Get all unique team IDs from the matches, then fetch team data
    const teamIds = [...new Set([
      ...(rawMatches ?? []).map((m: any) => m.home_team_id),
      ...(rawMatches ?? []).map((m: any) => m.away_team_id),
    ].filter(Boolean))];
    const { data: teamsData } = teamIds.length
      ? await supabase.from("teams").select("id,name,slug,sponsor_logo_url").in("id", teamIds)
      : { data: [] };
    const teamMap: Record<string, any> = {};
    (teamsData ?? []).forEach((t: any) => { teamMap[t.id] = t; });

    const gwMap: Record<string, { number: number; label: string }> = {};
    (gws ?? []).forEach((g: any) => {
      gwMap[g.id] = { number: g.number, label: g.round_name ?? `Match Week ${g.number}` };
    });

    const matches: Match[] = (rawMatches ?? []).map((m: any) => {
      const ht = teamMap[m.home_team_id] ?? {};
      const at = teamMap[m.away_team_id] ?? {};
      return {
        id: m.id,
        kickoff_at: m.kickoff_at,
        venue: m.venue,
        home_score: m.home_score,
        away_score: m.away_score,
        home_pen_score: m.home_pen_score,
        away_pen_score: m.away_pen_score,
        gameweek_number: gwMap[m.gameweek_id]?.number ?? 0,
        gameweek_label: gwMap[m.gameweek_id]?.label ?? "—",
        home_team_id: m.home_team_id,
        home_team_name: ht.name ?? "—",
        home_team_slug: ht.slug ?? null,
        home_logo: ht.sponsor_logo_url ?? null,
        away_team_id: m.away_team_id,
        away_team_name: at.name ?? "—",
        away_team_slug: at.slug ?? null,
        away_logo: at.sponsor_logo_url ?? null,
      };
    });

    // Group by gameweek + date
    const grouped: Record<string, MatchGroup> = {};
    matches.forEach((m) => {
      const dateStr = m.kickoff_at
        ? formatDate(m.kickoff_at)
        : "Date TBC";
      const key = `${m.gameweek_number}__${dateStr}`;
      if (!grouped[key]) {
        grouped[key] = { gwLabel: m.gameweek_label, gwNumber: m.gameweek_number, date: dateStr, matches: [] };
      }
      grouped[key].matches.push(m);
    });

    setGroups(Object.values(grouped).sort((a, b) => a.gwNumber - b.gwNumber || a.date.localeCompare(b.date)));
    setLoading(false);
  }, [division]);

  useEffect(() => { load(); }, [load]);

  const now = new Date();

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
      <SiteHeader active="seasons" />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="font-display font-bold text-2xl sm:text-3xl">Fixtures & Results</h1>
            <p className="text-sm text-[#0B3363]/50 dark:text-white/50 mt-0.5">All matches for the current season</p>
          </div>
        </div>

        {/* Division toggle */}
        <div className="flex gap-1 p-1 bg-[#0B3363]/5 dark:bg-white/5 rounded-xl w-fit mb-6">
          {(["seniors", "juniors"] as Division[]).map((d) => (
            <button key={d} onClick={() => setDivision(d)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                division === d ? "bg-[#0B3363] text-white dark:bg-[#3EA0D9]" : "text-[#0B3363]/60 dark:text-white/60 hover:text-[#0B3363]"
              }`}>
              {d === "seniors" ? "goFiber PL" : "Care & Cure PL"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-[#0B3363]/30 dark:text-white/30">Loading fixtures…</div>
        ) : groups.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#0B3363]/30 dark:text-white/30">No fixtures yet for this season.</div>
        ) : (
          <div className="space-y-8">
            {groups.map((group) => (
              <div key={`${group.gwNumber}__${group.date}`}>
                {/* GW + date header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-xs font-bold bg-[#0B3363] text-white dark:bg-[#3EA0D9] px-2.5 py-1 rounded-lg">
                    {group.gwLabel}
                  </div>
                  <div className="text-sm font-semibold text-[#0B3363]/60 dark:text-white/60">{group.date}</div>
                </div>

                {/* Match cards */}
                <div className="space-y-2">
                  {group.matches.map((m) => {
                    const completed = m.home_score !== null;
                    const upcoming = m.kickoff_at && new Date(m.kickoff_at) > now;
                    return (
                      <Link key={m.id} href={`/matches/${m.id}`}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-[#0B3363]/8 dark:border-white/8 bg-white dark:bg-white/5 hover:border-[#3EA0D9] transition-colors">

                        {/* Home team */}
                        <div className="flex-1 flex items-center gap-2 justify-end min-w-0">
                          <span className="text-sm font-semibold truncate text-right">{m.home_team_name}</span>
                          <TeamBadge name={m.home_team_name} slug={m.home_team_slug} logoUrl={m.home_logo} size={28} className="flex-shrink-0" />
                        </div>

                        {/* Score or time */}
                        <div className="flex-shrink-0 w-20 text-center">
                          {completed ? (
                            <div>
                              <div className={`font-display font-bold text-lg ${completed ? "text-[#0B3363] dark:text-white" : ""}`}>
                                {m.home_score} – {m.away_score}
                              </div>
                              {m.home_pen_score !== null && (
                                <div className="text-[10px] text-[#0B3363]/40 dark:text-white/40">
                                  ({m.home_pen_score}–{m.away_pen_score} pens)
                                </div>
                              )}
                              <div className="text-[9px] font-bold text-[#0B3363]/30 dark:text-white/30 uppercase">FT</div>
                            </div>
                          ) : (
                            <div>
                              <div className="font-bold text-sm text-[#0B3363]/70 dark:text-white/70">
                                {m.kickoff_at ? formatTime(m.kickoff_at) : "TBC"}
                              </div>
                              {m.venue && (
                                <div className="text-[10px] text-[#0B3363]/40 dark:text-white/40">{m.venue}</div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Away team */}
                        <div className="flex-1 flex items-center gap-2 min-w-0">
                          <TeamBadge name={m.away_team_name} slug={m.away_team_slug} logoUrl={m.away_logo} size={28} className="flex-shrink-0" />
                          <span className="text-sm font-semibold truncate">{m.away_team_name}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
