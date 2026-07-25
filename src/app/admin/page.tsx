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
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border p-5">
          <div className="text-xs text-slate-500 uppercase font-semibold">Teams</div>
          <div className="text-3xl font-bold text-blue-900 mt-1">{teams ?? 0}</div>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <div className="text-xs text-slate-500 uppercase font-semibold">Players</div>
          <div className="text-3xl font-bold text-blue-900 mt-1">{players ?? 0}</div>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <div className="text-xs text-slate-500 uppercase font-semibold">Matches</div>
          <div className="text-3xl font-bold text-blue-900 mt-1">{matches ?? 0}</div>
        </div>
      </div>
      <div className="bg-white rounded-xl border p-5">
        <div className="text-xs text-slate-500 uppercase font-semibold mb-3">Active Seasons</div>
        <ul className="text-sm space-y-1">
          {seasons?.map((s: any, i: number) => (
            <li key={i}>
              {s.competitions?.name} — {s.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
