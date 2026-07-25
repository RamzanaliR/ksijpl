"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type AdminRow = { id: string; full_name: string | null; role: string };

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("matchday_admin");
  const [result, setResult] = useState<{ email: string; temp_password: string } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const { data } = await supabase.from("admin_users").select("id,full_name,role");
    setAdmins(data ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invite-admin`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, full_name: fullName, role }),
      }
    );
    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(json.error ?? "Something went wrong");
      return;
    }
    setResult(json);
    setEmail("");
    setFullName("");
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Admins</h1>

      <form onSubmit={invite} className="bg-white border rounded-xl p-5 mb-6 flex gap-3 items-end flex-wrap">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border rounded px-3 py-2 text-sm w-56"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Full name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="border rounded px-3 py-2 text-sm w-48"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="border rounded px-3 py-2 text-sm">
            <option value="matchday_admin">Matchday Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
        </div>
        <button disabled={loading} className="bg-blue-700 text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-50">
          {loading ? "Inviting…" : "Invite Admin"}
        </button>
      </form>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded px-3 py-2 mb-4 max-w-lg">{error}</div>}
      {result && (
        <div className="bg-amber-50 border border-amber-300 text-amber-800 text-sm rounded px-4 py-3 mb-6 max-w-lg">
          <div className="font-semibold mb-1">Share these credentials securely — shown only once:</div>
          <div>Email: {result.email}</div>
          <div>Temporary password: <code className="bg-white px-1.5 py-0.5 rounded">{result.temp_password}</code></div>
          <div className="mt-1 text-xs">They should change this password from Account after logging in.</div>
        </div>
      )}

      <div className="bg-white border rounded-xl divide-y max-w-lg">
        {admins.map((a) => (
          <div key={a.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span>{a.full_name || "—"}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{a.role}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
