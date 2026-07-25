"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Division = { id: string; name: string; slug: string };
type Team = { id: string; name: string; short_name: string | null; division_id: string };

export default function TeamsAdmin() {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [newName, setNewName] = useState("");
  const [newShort, setNewShort] = useState("");
  const [newDivision, setNewDivision] = useState("");
  const [loading, setLoading] = useState(true);

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
    const { error } = await supabase
      .from("teams")
      .insert({ name: newName, short_name: newShort || null, division_id: newDivision });
    if (!error) {
      setNewName("");
      setNewShort("");
      load();
    } else {
      alert(error.message);
    }
  }

  async function renameTeam(id: string, name: string) {
    await supabase.from("teams").update({ name }).eq("id", id);
  }

  async function deleteTeam(id: string) {
    if (!confirm("Delete this team? This cannot be undone.")) return;
    await supabase.from("teams").delete().eq("id", id);
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Teams</h1>

      <form onSubmit={addTeam} className="bg-white border rounded-xl p-5 mb-8 flex gap-3 items-end flex-wrap">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Division</label>
          <select
            value={newDivision}
            onChange={(e) => setNewDivision(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Team name</label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="border rounded px-3 py-2 text-sm w-56"
            placeholder="e.g. Dar Falcons"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Short name</label>
          <input
            value={newShort}
            onChange={(e) => setNewShort(e.target.value)}
            className="border rounded px-3 py-2 text-sm w-24"
            placeholder="DAR"
          />
        </div>
        <button className="bg-blue-700 text-white px-4 py-2 rounded text-sm font-semibold">
          Add Team
        </button>
      </form>

      {loading ? (
        <div className="text-slate-500 text-sm">Loading…</div>
      ) : (
        divisions.map((d) => (
          <div key={d.id} className="mb-8">
            <h2 className="font-semibold text-slate-700 mb-2">
              {d.name} ({teams.filter((t) => t.division_id === d.id).length})
            </h2>
            <div className="bg-white border rounded-xl divide-y">
              {teams
                .filter((t) => t.division_id === d.id)
                .map((t) => (
                  <div key={t.id} className="flex items-center justify-between px-4 py-2.5">
                    <input
                      defaultValue={t.name}
                      onBlur={(e) => renameTeam(t.id, e.target.value)}
                      className="text-sm bg-transparent focus:bg-slate-50 rounded px-2 py-1 w-64"
                    />
                    <span className="text-xs text-slate-400 mr-4">{t.short_name}</span>
                    <button
                      onClick={() => deleteTeam(t.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
