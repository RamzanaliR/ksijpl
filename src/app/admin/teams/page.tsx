"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Modal from "@/components/admin/Modal";

type Division = { id: string; name: string; slug: string };
type Team = { id: string; name: string; short_name: string | null; division_id: string };

const DIVISION_LABELS: Record<string, string> = {
  juniors: "Care & Cure KSIJ PL Teams",
  seniors: "goFiber KSIJ PL Teams",
};

const EditIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </svg>
);
const CheckIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);
const XIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </svg>
);
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export default function TeamsAdmin() {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newShort, setNewShort] = useState("");
  const [newDivision, setNewDivision] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editShort, setEditShort] = useState("");
  const [mobileTab, setMobileTab] = useState(0);

  async function load() {
    setLoading(true);
    const [{ data: divs }, { data: tms }] = await Promise.all([
      supabase.from("divisions").select("id,name,slug").order("name"),
      supabase.from("teams").select("id,name,short_name,division_id").order("name"),
    ]);
    setDivisions(divs ?? []);
    setTeams(tms ?? []);
    if (divs && divs.length && !newDivision) setNewDivision(divs[0].id);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!newName || !newDivision) return;
    setSaving(true);
    const { error } = await supabase
      .from("teams")
      .insert({ name: newName, short_name: newShort || null, division_id: newDivision });
    setSaving(false);
    if (!error) {
      setNewName("");
      setNewShort("");
      setAddOpen(false);
      load();
    } else {
      alert(error.message);
    }
  }

  function startEdit(t: Team) {
    setEditingId(t.id);
    setEditName(t.name);
    setEditShort(t.short_name ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    const { error } = await supabase
      .from("teams")
      .update({ name: editName, short_name: editShort || null })
      .eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    setEditingId(null);
    load();
  }

  async function deleteTeam(id: string) {
    if (!confirm("Delete this team? This cannot be undone.")) return;
    await supabase.from("teams").delete().eq("id", id);
    load();
  }

  // Juniors on the left, Seniors on the right, regardless of DB ordering
  const orderedDivisions = [...divisions].sort((a, b) => {
    const order = ["juniors", "seniors"];
    return order.indexOf(a.slug) - order.indexOf(b.slug);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="admin-page-title">Teams</h1>
        <button onClick={() => setAddOpen(true)} className="admin-btn admin-btn-primary">
          <PlusIcon /> Add Team
        </button>
      </div>

      {loading ? (
        <div className="admin-subtitle">Loading…</div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4 md:hidden">
            {orderedDivisions.map((d, i) => (
              <button
                key={d.id}
                onClick={() => setMobileTab(i)}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  i === mobileTab ? "admin-btn-primary" : "bg-[#0B3363]/5 text-[#0B3363]"
                }`}
              >
                {DIVISION_LABELS[d.slug] ?? d.name}
              </button>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {orderedDivisions.map((d, i) => (
              <div key={d.id} className={i === mobileTab ? "" : "hidden md:block"}>
                <h2 className="font-semibold text-[#0B3363] mb-2 text-sm">
                  {DIVISION_LABELS[d.slug] ?? d.name}
                  <span className="admin-pill ml-2 align-middle">{teams.filter((t) => t.division_id === d.id).length}</span>
                </h2>
                <div className="admin-card overflow-hidden">
                  <div className="overflow-x-auto">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Team</th>
                        <th>Short</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teams
                        .filter((t) => t.division_id === d.id)
                        .map((t) =>
                          editingId === t.id ? (
                            <tr key={t.id}>
                              <td>
                                <input
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="admin-input py-1"
                                  autoFocus
                                />
                              </td>
                              <td>
                                <input
                                  value={editShort}
                                  onChange={(e) => setEditShort(e.target.value)}
                                  className="admin-input py-1 w-20"
                                  placeholder="e.g. DAR"
                                />
                              </td>
                              <td>
                                <div className="flex items-center justify-end gap-1">
                                  <button onClick={() => saveEdit(t.id)} className="admin-icon-btn" aria-label="Save" title="Save">
                                    <CheckIcon />
                                  </button>
                                  <button onClick={cancelEdit} className="admin-icon-btn" aria-label="Cancel" title="Cancel">
                                    <XIcon />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            <tr key={t.id}>
                              <td>{t.name}</td>
                              <td className="text-slate-400">{t.short_name || "—"}</td>
                              <td>
                                <div className="flex items-center justify-end gap-1">
                                  <button onClick={() => startEdit(t)} className="admin-icon-btn" aria-label="Edit" title="Edit">
                                    <EditIcon />
                                  </button>
                                  <button onClick={() => deleteTeam(t.id)} className="admin-icon-btn admin-icon-btn-danger" aria-label="Delete" title="Delete">
                                    <TrashIcon />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        )}
                    </tbody>
                  </table>
                  </div>
                  {teams.filter((t) => t.division_id === d.id).length === 0 && (
                    <div className="admin-empty">No teams yet.</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Team" description="Create a new team in a division.">
        <form onSubmit={addTeam} className="flex flex-col gap-3">
          <div>
            <label className="admin-label">Division</label>
            <select value={newDivision} onChange={(e) => setNewDivision(e.target.value)} className="admin-select">
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="admin-label">Team name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="admin-input"
              placeholder="e.g. Dar Falcons"
            />
          </div>
          <div>
            <label className="admin-label">Short name</label>
            <input
              value={newShort}
              onChange={(e) => setNewShort(e.target.value)}
              className="admin-input"
              placeholder="e.g. DAR"
            />
          </div>
          <button disabled={saving} className="admin-btn admin-btn-primary mt-2">
            {saving ? "Adding…" : "Add Team"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
