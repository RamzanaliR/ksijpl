import Link from "next/link";
import { supabase } from "@/lib/supabase";

const ACTIONS = [
  {
    href: "/admin/teams",
    label: "Add a team",
    sub: "Register a new club",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="7" r="3.2" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
        <circle cx="18" cy="8" r="2.6" /><path d="M15.8 13.3A5.2 5.2 0 0 1 21.5 18" />
      </svg>
    ),
  },
  {
    href: "/admin/players",
    label: "Add a player",
    sub: "Build out a roster",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    ),
  },
  {
    href: "/admin/fixtures",
    label: "Import fixtures",
    sub: "Upload a CSV of matches",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18" /><path d="M8 3v3M16 3v3" />
      </svg>
    ),
  },
  {
    href: "/admin/media",
    label: "Upload media",
    sub: "Logos, crests & jerseys",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="14" rx="2" /><circle cx="8.5" cy="9.5" r="1.6" />
        <path d="M21 15.5l-5.5-5-9.5 8" />
      </svg>
    ),
  },
];

const CHECKLIST = [
  { label: "Final Care & Cure league logo", done: false },
  { label: "Confirm real Juniors match jerseys", done: false },
  { label: "Change the shared admin password", done: false },
  { label: "Enter Season 03 fixtures", done: false },
];

export default async function AdminDashboard() {
  const [{ count: teamsCount }, { count: playersCount }, { count: matchesCount }, { data: seasons }, { data: divisions }] =
    await Promise.all([
      supabase.from("teams").select("*", { count: "exact", head: true }),
      supabase.from("players").select("*", { count: "exact", head: true }),
      supabase.from("matches").select("*", { count: "exact", head: true }),
      supabase.from("seasons").select("label, is_active, competitions(name)").eq("is_active", true),
      supabase.from("divisions").select("id,name,slug").order("name"),
    ]);

  const [{ data: teamsAll }, { data: playersAll }, { data: upcoming }, { data: recent }] = await Promise.all([
    supabase.from("teams").select("id,division_id"),
    supabase.from("players").select("id,team_id"),
    supabase
      .from("matches")
      .select("id,kickoff_at,home_team_id,away_team_id,status")
      .eq("status", "scheduled")
      .order("kickoff_at", { ascending: true })
      .limit(4),
    supabase
      .from("matches")
      .select("id,kickoff_at,home_team_id,away_team_id,home_score,away_score,status")
      .eq("status", "completed")
      .order("kickoff_at", { ascending: false })
      .limit(4),
  ]);

  const { data: allTeamsNamed } = await supabase.from("teams").select("id,name");
  const teamName = (id: string) => allTeamsNamed?.find((t) => t.id === id)?.name ?? "—";

  const orderedDivisions = [...(divisions ?? [])].sort(
    (a: any, b: any) => ["juniors", "seniors"].indexOf(a.slug) - ["juniors", "seniors"].indexOf(b.slug)
  );

  return (
    <div>
      <h1 className="admin-page-title mb-1">Dashboard</h1>
      <p className="admin-subtitle mb-6">A quick look at what's live on the site right now.</p>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="admin-stat-card">
          <div className="admin-stat-label">Teams</div>
          <div className="admin-stat-value">{teamsCount ?? 0}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Players</div>
          <div className="admin-stat-value">{playersCount ?? 0}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Matches</div>
          <div className="admin-stat-value">{matchesCount ?? 0}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Divisions</div>
          <div className="admin-stat-value">{divisions?.length ?? 0}</div>
        </div>
      </div>

      <div className="mb-8">
        <div className="admin-stat-label mb-3">Quick actions</div>
        <div className="grid grid-cols-4 gap-4">
          {ACTIONS.map((a) => (
            <Link key={a.href} href={a.href} className="admin-action-card">
              <div className="admin-action-icon">{a.icon}</div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#0B3363] truncate">{a.label}</div>
                <div className="text-xs text-slate-400 truncate">{a.sub}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="admin-card p-5">
          <div className="admin-stat-label mb-3">Squad overview</div>
          <div className="space-y-4">
            {orderedDivisions.map((d: any) => {
              const teamsInDiv = (teamsAll ?? []).filter((t: any) => t.division_id === d.id);
              const teamIds = new Set(teamsInDiv.map((t: any) => t.id));
              const playersInDiv = (playersAll ?? []).filter((p: any) => teamIds.has(p.team_id));
              const avgSquad = teamsInDiv.length ? Math.round((playersInDiv.length / teamsInDiv.length) * 10) / 10 : 0;
              const pct = Math.min(100, Math.round((avgSquad / 15) * 100));
              return (
                <div key={d.id}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium text-[#0B3363]">{d.name}</span>
                    <span className="text-xs text-slate-400">
                      {teamsInDiv.length} teams · {playersInDiv.length} players · avg {avgSquad}/team
                    </span>
                  </div>
                  <div className="admin-progress-track">
                    <div className="admin-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="admin-stat-label mt-6 mb-3">Active seasons</div>
          {seasons && seasons.length > 0 ? (
            <ul className="space-y-1.5">
              {seasons.map((s: any, i: number) => (
                <li key={i} className="text-sm text-[#0B3363] flex items-center gap-2">
                  <span className="admin-pill admin-pill-success">Live</span>
                  {s.competitions?.name} — {s.label}
                </li>
              ))}
            </ul>
          ) : (
            <div className="admin-empty">No active seasons.</div>
          )}
        </div>

        <div className="admin-card p-5">
          <div className="admin-stat-label mb-3">Upcoming fixtures</div>
          {upcoming && upcoming.length > 0 ? (
            <ul className="space-y-2 mb-6">
              {upcoming.map((m: any) => (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <span className="text-[#0B3363] truncate">
                    {teamName(m.home_team_id)} <span className="text-slate-400">vs</span> {teamName(m.away_team_id)}
                  </span>
                  <span className="text-xs text-slate-400 flex-shrink-0 ml-3">
                    {m.kickoff_at ? new Date(m.kickoff_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "TBD"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="admin-empty mb-6">
              No fixtures scheduled yet.{" "}
              <Link href="/admin/fixtures" className="text-[#3EA0D9] hover:underline">Import some</Link>.
            </div>
          )}

          <div className="admin-stat-label mb-3">Recent results</div>
          {recent && recent.length > 0 ? (
            <ul className="space-y-2">
              {recent.map((m: any) => (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <span className="text-[#0B3363] truncate">
                    {teamName(m.home_team_id)} <span className="text-slate-400">vs</span> {teamName(m.away_team_id)}
                  </span>
                  <span className="font-display font-bold text-xs bg-[#0B3363]/5 px-2 py-0.5 rounded flex-shrink-0 ml-3">
                    {m.home_score}–{m.away_score}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="admin-empty">No results yet.</div>
          )}
        </div>
      </div>

      <div className="admin-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="admin-stat-label">Getting ready for the season</div>
          <span className="admin-pill admin-pill-warning">Placeholder</span>
        </div>
        <ul className="space-y-2">
          {CHECKLIST.map((item, i) => (
            <li key={i} className="flex items-center gap-2.5 text-sm text-[#0B3363]">
              <span className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0" />
              {item.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
