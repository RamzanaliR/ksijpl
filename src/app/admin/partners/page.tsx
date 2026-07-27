"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Modal from "@/components/admin/Modal";

type Partner = { id: string; name: string; logo_url: string; website_url: string | null; display_order: number };

export default function PartnersAdmin() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLogo, setNewLogo] = useState("");
  const [newWebsite, setNewWebsite] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editLogo, setEditLogo] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editOrder, setEditOrder] = useState(0);

  async function load() {
    const { data } = await supabase.from("partners").select("id,name,logo_url,website_url,display_order").order("display_order");
    setPartners(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addPartner(e: React.FormEvent) {
    e.preventDefault();
    const maxOrder = partners.reduce((m, p) => Math.max(m, p.display_order), 0);
    const { error } = await supabase.from("partners").insert({
      name: newName,
      logo_url: newLogo,
      website_url: newWebsite || null,
      display_order: maxOrder + 1,
    });
    if (error) {
      alert(error.message);
      return;
    }
    setAddOpen(false);
    setNewName("");
    setNewLogo("");
    setNewWebsite("");
    load();
  }

  function startEdit(p: Partner) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditLogo(p.logo_url);
    setEditWebsite(p.website_url ?? "");
    setEditOrder(p.display_order);
  }

  async function saveEdit(id: string) {
    const { error } = await supabase
      .from("partners")
      .update({ name: editName, logo_url: editLogo, website_url: editWebsite || null, display_order: editOrder })
      .eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    setEditingId(null);
    load();
  }

  async function deletePartner(id: string) {
    if (!confirm("Remove this partner?")) return;
    await supabase.from("partners").delete().eq("id", id);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="admin-page-title">Partners</h1>
          <p className="text-sm text-slate-500 mt-1">Shown in the site footer, above the link columns. Logo can be a full URL or a path under /public, e.g. /logos/my-partner.png.</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="admin-btn admin-btn-primary text-sm px-4">Add Partner</button>
      </div>

      {loading ? (
        <div className="admin-empty">Loading…</div>
      ) : partners.length === 0 ? (
        <div className="admin-empty">No partners yet.</div>
      ) : (
        <div className="admin-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Logo</th>
                  <th>Name</th>
                  <th>Website</th>
                  <th>Order</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((p) =>
                  editingId === p.id ? (
                    <tr key={p.id}>
                      <td>
                        <div className="w-12 h-8 bg-white border border-slate-200 rounded flex items-center justify-center overflow-hidden">
                          <img src={editLogo} alt="" className="object-contain w-full h-full" />
                        </div>
                      </td>
                      <td><input value={editName} onChange={(e) => setEditName(e.target.value)} className="admin-input py-1" /></td>
                      <td><input value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} className="admin-input py-1 w-40" placeholder="https://…" /></td>
                      <td><input type="number" value={editOrder} onChange={(e) => setEditOrder(Number(e.target.value))} className="admin-input py-1 w-16" /></td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => saveEdit(p.id)} className="admin-icon-btn" title="Save">✓</button>
                          <button onClick={() => setEditingId(null)} className="admin-icon-btn" title="Cancel">×</button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={p.id}>
                      <td>
                        <div className="w-12 h-8 bg-white border border-slate-200 rounded flex items-center justify-center overflow-hidden">
                          <img src={p.logo_url} alt={p.name} className="object-contain w-full h-full" />
                        </div>
                      </td>
                      <td>{p.name}</td>
                      <td className="text-slate-400 truncate max-w-[200px]">{p.website_url || "—"}</td>
                      <td className="text-slate-400">{p.display_order}</td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => startEdit(p)} className="admin-icon-btn" title="Edit">Edit</button>
                          <button onClick={() => deletePartner(p.id)} className="admin-icon-btn admin-icon-btn-danger" title="Delete">Delete</button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Partner" description="Appears in the footer once saved.">
        <form onSubmit={addPartner} className="flex flex-col gap-3">
          <div>
            <label className="admin-label">Name</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} required className="admin-input" />
          </div>
          <div>
            <label className="admin-label">Logo URL</label>
            <input value={newLogo} onChange={(e) => setNewLogo(e.target.value)} required className="admin-input" placeholder="/logos/my-partner.png or https://…" />
          </div>
          <div>
            <label className="admin-label">Website URL (optional)</label>
            <input value={newWebsite} onChange={(e) => setNewWebsite(e.target.value)} className="admin-input" placeholder="https://…" />
          </div>
          <button className="admin-btn admin-btn-primary mt-2">Add Partner</button>
        </form>
      </Modal>
    </div>
  );
}
