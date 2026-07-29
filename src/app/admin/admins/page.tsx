"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type AdminRow = { id: string; full_name: string | null; role: string };
type Profile = { id: string; display_name: string | null };

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  matchday_admin: "Matchday Admin",
  fantasy_admin: "Fantasy Admin",
};

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("matchday_admin");
  const [result, setResult] = useState<{ email: string; temp_password: string } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [addExistingId, setAddExistingId] = useState("");
  const [addExistingRole, setAddExistingRole] = useState("matchday_admin");
  const [addingExisting, setAddingExisting] = useState(false);

  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingRoleValue, setEditingRoleValue] = useState("matchday_admin");

  async function load() {
    const [{ data: adminRows }, { data: profileRows }] = await Promise.all([
      supabase.from("admin_users").select("id,full_name,role"),
      supabase.from("fantasy_profiles").select("id,display_name"),
    ]);
    setAdmins(adminRows ?? []);
    setProfiles(profileRows ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  const adminIds = new Set(admins.map((a) => a.id));
  const nonAdminProfiles = profiles.filter((p) => !adminIds.has(p.id));

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

  async function addExisting(e: React.FormEvent) {
    e.preventDefault();
    if (!addExistingId) return;
    setAddingExisting(true);
    setError("");
    const profile = profiles.find((p) => p.id === addExistingId);
    const { error } = await supabase.from("admin_users").insert({
      id: addExistingId,
      full_name: profile?.display_name ?? null,
      role: addExistingRole,
    });
    setAddingExisting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setAddExistingId("");
    load();
  }

  async function changeRole(id: string) {
    const { error } = await supabase.from("admin_users").update({ role: editingRoleValue }).eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    setEditingRoleId(null);
    load();
  }

  async function removeAdmin(id: string) {
    if (!confirm("Remove admin access for this person?")) return;
    await supabase.from("admin_users").delete().eq("id", id);
    load();
  }

  return (
    <div>
      <h1 className="admin-page-title mb-1">Admins</h1>
      <p className="admin-subtitle mb-6 max-w-2xl">
        Invite a brand-new admin, promote someone who's already registered (e.g. via Fantasy), or change an existing admin's role.
      </p>

      <div className="admin-stat-label mb-2">Invite a New Admin</div>
      <form onSubmit={invite} className="admin-card p-5 mb-8 flex gap-3 items-end flex-wrap">
        <div>
          <label className="admin-label">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="admin-input w-56"
          />
        </div>
        <div>
          <label className="admin-label">Full name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="admin-input w-48"
          />
        </div>
        <div>
          <label className="admin-label">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="admin-select">
            <option value="matchday_admin">Matchday Admin</option>
            <option value="fantasy_admin">Fantasy Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
        </div>
        <button disabled={loading} className="admin-btn admin-btn-primary">
          {loading ? "Inviting…" : "Invite Admin"}
        </button>
      </form>

      <div className="admin-stat-label mb-2">Promote an Existing Registered User</div>
      <form onSubmit={addExisting} className="admin-card p-5 mb-8 flex gap-3 items-end flex-wrap">
        <div>
          <label className="admin-label">Registered user</label>
          <select value={addExistingId} onChange={(e) => setAddExistingId(e.target.value)} className="admin-select w-64">
            <option value="">Select a person…</option>
            {nonAdminProfiles.map((p) => (
              <option key={p.id} value={p.id}>{p.display_name || p.id}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="admin-label">Role</label>
          <select value={addExistingRole} onChange={(e) => setAddExistingRole(e.target.value)} className="admin-select">
            <option value="matchday_admin">Matchday Admin</option>
            <option value="fantasy_admin">Fantasy Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
        </div>
        <button disabled={addingExisting || !addExistingId} className="admin-btn admin-btn-primary">
          {addingExisting ? "Adding…" : "Make Admin"}
        </button>
        {nonAdminProfiles.length === 0 && (
          <p className="text-xs text-slate-400 w-full">No registered users available to promote — only people who have signed up (e.g. via Fantasy) show up here.</p>
        )}
      </form>

      {error && <div className="admin-alert admin-alert-error mb-4 max-w-lg">{error}</div>}
      {result && (
        <div className="admin-alert admin-alert-warning mb-6 max-w-lg">
          <div className="font-semibold mb-1">Share these credentials securely — shown only once:</div>
          <div>Email: {result.email}</div>
          <div>Temporary password: <code className="bg-white px-1.5 py-0.5 rounded">{result.temp_password}</code></div>
          <div className="mt-1 text-xs">They should change this password from Account after logging in.</div>
        </div>
      )}

      <div className="admin-stat-label mb-2">Current Admins</div>
      <div className="admin-card overflow-hidden max-w-lg">
        {admins.map((a) => (
          <div key={a.id} className="admin-row">
            <span className="text-[#0B3363]">{a.full_name || "—"}</span>
            {editingRoleId === a.id ? (
              <div className="flex items-center gap-2">
                <select value={editingRoleValue} onChange={(e) => setEditingRoleValue(e.target.value)} className="admin-select py-1 text-xs">
                  <option value="matchday_admin">Matchday Admin</option>
                  <option value="fantasy_admin">Fantasy Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
                <button onClick={() => changeRole(a.id)} className="admin-icon-btn" title="Save">✓</button>
                <button onClick={() => setEditingRoleId(null)} className="admin-icon-btn" title="Cancel">×</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="admin-pill">{ROLE_LABELS[a.role] ?? a.role}</span>
                <button
                  onClick={() => {
                    setEditingRoleId(a.id);
                    setEditingRoleValue(a.role);
                  }}
                  className="admin-icon-btn"
                  title="Change role"
                >
                  Edit
                </button>
                <button onClick={() => removeAdmin(a.id)} className="admin-icon-btn admin-icon-btn-danger" title="Remove">Remove</button>
              </div>
            )}
          </div>
        ))}
        {admins.length === 0 && <div className="admin-empty">No admins yet.</div>}
      </div>
    </div>
  );
}
