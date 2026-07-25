import { supabase } from "@/lib/supabase";

export default async function AdminDashboard() {
  const [{ count: teams }, { count: players }, { count: matches }, { data: seasons }] =
    await Promise.all([
      supabase.from("teams").select("*", { count: "exact", head: true }),
      supabase.from("players").select("*", { count: "exact", head: true }),
      supabase.from("matches").select("*", { count: "exact", head: true }),
      supabase
        .from("seasons")
        .select("label, is_active, competitions(name)")
        .eq("is_active", true),
    ]);

  return (
    <div>
      <h1 className="admin-page-title mb-1">Dashboard</h1>
      <p className="admin-subtitle mb-6">A quick look at what's live on the site right now.</p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="admin-stat-card">
          <div className="admin-stat-label">Teams</div>
          <div className="admin-stat-value">{teams ?? 0}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Players</div>
          <div className="admin-stat-value">{players ?? 0}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Matches</div>
          <div className="admin-stat-value">{matches ?? 0}</div>
        </div>
      </div>

      <div className="admin-card p-5">
        <div className="admin-stat-label mb-3">Active Seasons</div>
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
    </div>
  );
}
