"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type CheckItem = { label: string; done: boolean; href: string; detail?: string };
type LiveStat  = { label: string; value: string | number; sub?: string; href?: string; alert?: boolean };
type Activity  = { label: string; time: string; href?: string };

const SENIORS_ID = "e0eee160-729a-4cbd-a29a-20d36115db31";
const JUNIORS_ID = "544019cb-0615-4b38-b9b8-03e71dfe1706";

export default function AdminDashboard() {
  const [checks, setChecks]   = useState<CheckItem[]>([]);
  const [stats, setStats]     = useState<LiveStat[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [gwLabel, setGwLabel] = useState("—");
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    const hr = new Date().getHours();
    setGreeting(hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening");
    loadDashboard();
  }, []);

  async function loadDashboard() {
    // ── Current gameweek ──────────────────────────────────────────────────
    const { data: seniorSeasons } = await supabase.from("seasons").select("id")
      .eq("competition_id", SENIORS_ID).order("created_at", { ascending: false }).limit(1);
    const seniorSeasonId = seniorSeasons?.[0]?.id;

    const { data: gws } = await supabase.from("gameweeks").select("id,number,round_name")
      .eq("season_id", seniorSeasonId ?? "00000000-0000-0000-0000-000000000000")
      .order("number", { ascending: false }).limit(1);
    const gw = gws?.[0];
    const gwLbl = gw?.round_name ?? (gw ? `Match Week ${gw.number}` : "—");
    const gwId  = gw?.id;
    setGwLabel(gwLbl);

    // ── Fetch data in parallel ────────────────────────────────────────────
    const [
      { data: allMatches },
      { data: completedMatches },
      { data: pendingMedia },
      { data: fantasyTeams },
      { data: fantasySettings },
      { count: playerCount },
      { count: teamCount },
    ] = await Promise.all([
      supabase.from("matches").select("id,home_score,kickoff_at").eq("season_id", seniorSeasonId ?? "x"),
      supabase.from("matches").select("id").eq("season_id", seniorSeasonId ?? "x").not("home_score","is",null),
      supabase.from("generated_media").select("id").eq("status","pending_approval"),
      supabase.from("fantasy_teams").select("id"),
      supabase.from("fantasy_settings").select("id,budget,squad_size").limit(1),
      supabase.from("players").select("*",{count:"exact",head:true}),
      supabase.from("teams").select("*",{count:"exact",head:true}),
    ]);

    // All players count (without team filter)
    const { count: allPlayerCount } = await supabase.from("players").select("*",{count:"exact",head:true});
    const { count: allTeamCount }   = await supabase.from("teams").select("*",{count:"exact",head:true});

    // Matches needing results (kickoff in past, no score)
    const now = new Date().toISOString();
    const needingResults = (allMatches ?? []).filter((m: any) => m.kickoff_at < now && m.home_score == null).length;

    // TOTW published for current gw?
    const { data: totw } = await supabase.from("team_of_week")
      .select("published").eq("gameweek_id", gwId ?? "x").eq("division","seniors").maybeSingle();
    const totwDone = totw?.published === true;

    // Fantasy gameweek points computed?
    const { data: fpts } = await supabase.from("fantasy_gameweek_points")
      .select("id").eq("gameweek_id", gwId ?? "x").limit(1);
    const fantasyScored = (fpts?.length ?? 0) > 0;

    // Fantasy deadline set?
    const { data: deadline } = await supabase.from("gameweeks")
      .select("id").eq("id", gwId ?? "x").not("number","is",null).maybeSingle();

    // ── Weekly checklist ──────────────────────────────────────────────────
    setChecks([
      {
        label: "Fixtures entered",
        done: (allMatches?.length ?? 0) > 0,
        href: "/admin/fixtures",
        detail: `${allMatches?.length ?? 0} matches in current season`,
      },
      {
        label: "Results entered",
        done: needingResults === 0,
        href: "/admin/fixtures",
        detail: needingResults > 0 ? `${needingResults} match${needingResults > 1 ? "es" : ""} need results` : "All results up to date",
        ...(needingResults > 0 ? {} : {}),
      },
      {
        label: "TOTW selected & published",
        done: totwDone,
        href: "/admin/totw",
        detail: totwDone ? "Published" : "Not published yet",
      },
      {
        label: "Fantasy points computed",
        done: fantasyScored,
        href: "/admin/fantasy",
        detail: fantasyScored ? "Scored" : "Not yet scored for this gameweek",
      },
      {
        label: "Media graphics approved",
        done: (pendingMedia?.length ?? 0) === 0,
        href: "/admin/media",
        detail: (pendingMedia?.length ?? 0) > 0
          ? `${pendingMedia!.length} graphic${pendingMedia!.length > 1 ? "s" : ""} awaiting approval`
          : "All approved",
      },
    ]);

    // ── Live numbers ──────────────────────────────────────────────────────
    setStats([
      {
        label: "Fantasy Managers",
        value: fantasyTeams?.length ?? 0,
        sub: "registered teams",
        href: "/admin/fantasy",
      },
      {
        label: "Pending Results",
        value: needingResults,
        sub: "matches need scores",
        href: "/admin/fixtures",
        alert: needingResults > 0,
      },
      {
        label: "Media Pending",
        value: pendingMedia?.length ?? 0,
        sub: "graphics awaiting review",
        href: "/admin/media",
        alert: (pendingMedia?.length ?? 0) > 0,
      },
      {
        label: "Players",
        value: allPlayerCount ?? 0,
        sub: "registered this season",
        href: "/admin/players",
      },
      {
        label: "Teams",
        value: allTeamCount ?? 0,
        sub: "total clubs",
        href: "/admin/teams",
      },
      {
        label: "Matches Played",
        value: completedMatches?.length ?? 0,
        sub: `of ${allMatches?.length ?? 0} total`,
        href: "/admin/fixtures",
      },
    ]);

    // ── Quick activity ────────────────────────────────────────────────────
    const { data: recentMedia } = await supabase.from("generated_media")
      .select("template_type,status,created_at").order("created_at",{ascending:false}).limit(5);
    const { data: recentMatches } = await supabase.from("matches")
      .select("home_score,away_score,kickoff_at,home_team:teams!matches_home_team_id_fkey(name),away_team:teams!matches_away_team_id_fkey(name)")
      .not("home_score","is",null).order("kickoff_at",{ascending:false}).limit(4);

    const acts: Activity[] = [];
    (recentMatches ?? []).forEach((m: any) => {
      acts.push({
        label: `Result: ${m.home_team?.name} ${m.home_score}–${m.away_score} ${m.away_team?.name}`,
        time: formatRelative(m.kickoff_at),
        href: "/admin/fixtures",
      });
    });
    (recentMedia ?? []).forEach((m: any) => {
      acts.push({
        label: `${capitalise(m.template_type.replace(/_/g," "))} graphic — ${m.status.replace(/_/g," ")}`,
        time: formatRelative(m.created_at),
        href: "/admin/media",
      });
    });
    acts.sort((a, b) => 0); // keep insertion order (already time-sorted)
    setActivity(acts.slice(0, 8));

    setLoading(false);
  }

  function formatRelative(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  function capitalise(s: string) {
    return s.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const doneCount = checks.filter((c) => c.done).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="admin-page-title mb-0.5">{greeting} 👋</h1>
          <p className="admin-subtitle">
            {loading ? "Loading…" : `${gwLabel} · KSIJ DAR PL`}
          </p>
        </div>
        {!loading && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold ${
            doneCount === checks.length
              ? "bg-green-50 text-green-700"
              : "bg-amber-50 text-amber-700"
          }`}>
            <span className="text-lg">{doneCount === checks.length ? "✅" : "⚠️"}</span>
            {doneCount}/{checks.length} tasks complete
          </div>
        )}
      </div>

      {/* Weekly Checklist + Live Stats */}
      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">

        {/* Checklist */}
        <div className="admin-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[#0B3363]/8 flex items-center justify-between">
            <h2 className="font-display font-bold text-sm">This week's checklist</h2>
            <span className="text-xs text-[#0B3363]/40">{gwLabel}</span>
          </div>
          {loading ? (
            <div className="p-6 text-center text-sm text-[#0B3363]/30">Loading…</div>
          ) : (
            <div className="divide-y divide-[#0B3363]/5">
              {checks.map((item, i) => (
                <Link key={i} href={item.href}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[#0B3363]/3 transition-colors group">
                  <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs ${
                    item.done ? "bg-green-100 text-green-600" : "bg-amber-50 text-amber-500"
                  }`}>
                    {item.done ? "✓" : "!"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold ${item.done ? "text-[#0B3363]/50 dark:text-white/50 line-through" : ""}`}>
                      {item.label}
                    </div>
                    {item.detail && (
                      <div className="text-xs text-[#0B3363]/40 dark:text-white/40 mt-0.5">{item.detail}</div>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-[#0B3363]/20 group-hover:text-[#3EA0D9] transition-colors flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Live numbers */}
        <div className="space-y-3">
          {loading ? (
            <div className="admin-card p-6 text-center text-sm text-[#0B3363]/30">Loading…</div>
          ) : (
            stats.map((s, i) => (
              <Link key={i} href={s.href ?? "#"}
                className={`admin-card flex items-center gap-3 px-4 py-3 hover:border-[#3EA0D9] transition-colors ${s.alert ? "border-amber-200 bg-amber-50/50" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[#0B3363]/50 dark:text-white/50 font-medium">{s.label}</div>
                  {s.sub && <div className="text-[10px] text-[#0B3363]/30 dark:text-white/30">{s.sub}</div>}
                </div>
                <div className={`font-display font-bold text-xl flex-shrink-0 ${
                  s.alert && Number(s.value) > 0 ? "text-amber-600" : "text-[#0B3363] dark:text-white"
                }`}>{s.value}</div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions + Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Quick Actions */}
        <div className="admin-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[#0B3363]/8">
            <h2 className="font-display font-bold text-sm">Quick actions</h2>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            {[
              { label: "Enter results", icon: "⚽", href: "/admin/fixtures", desc: "Update match scores" },
              { label: "Generate graphics", icon: "🎨", href: "/admin/media", desc: "Create match week graphics" },
              { label: "Select TOTW", icon: "🏆", href: "/admin/totw", desc: "Pick team of the week" },
              { label: "Live console", icon: "📺", href: "/admin/live", desc: "Score live matches" },
              { label: "Add players", icon: "👤", href: "/admin/players", desc: "Register new players" },
              { label: "Manage fixtures", icon: "📅", href: "/admin/fixtures", desc: "Add or edit fixtures" },
              { label: "Fantasy settings", icon: "⚙️", href: "/admin/fantasy", desc: "Deadlines & scoring" },
              { label: "Media assets", icon: "🖼️", href: "/admin/media", desc: "Logos, jerseys, crests" },
            ].map((a, i) => (
              <Link key={i} href={a.href}
                className="flex items-start gap-2.5 p-3 rounded-xl border border-[#0B3363]/8 hover:border-[#3EA0D9] hover:bg-[#3EA0D9]/5 transition-colors group">
                <span className="text-xl flex-shrink-0">{a.icon}</span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#0B3363] dark:text-white group-hover:text-[#3EA0D9] transition-colors">{a.label}</div>
                  <div className="text-[10px] text-[#0B3363]/40 dark:text-white/40 mt-0.5">{a.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="admin-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[#0B3363]/8 flex items-center justify-between">
            <h2 className="font-display font-bold text-sm">Recent activity</h2>
          </div>
          {loading ? (
            <div className="p-6 text-center text-sm text-[#0B3363]/30">Loading…</div>
          ) : activity.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#0B3363]/30">
              No activity yet — enter some results or generate graphics to get started.
            </div>
          ) : (
            <div className="divide-y divide-[#0B3363]/5">
              {activity.map((a, i) => (
                <Link key={i} href={a.href ?? "#"}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[#0B3363]/3 transition-colors">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#3EA0D9] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{a.label}</div>
                  </div>
                  <div className="text-[10px] text-[#0B3363]/30 dark:text-white/30 flex-shrink-0">{a.time}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
