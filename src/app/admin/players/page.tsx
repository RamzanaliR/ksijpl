"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Modal from "@/components/admin/Modal";

type Division = { id: string; name: string; slug: string };
type Team = { id: string; name: string; division_id: string };
type Player = { id: string; full_name: string; position: string | null; squad_number: number | null; team_id: string };

const POSITIONS = ["GK", "DEF", "MID", "FWD"];

const DIVISION_LABELS: Record<string, string> = {
  juniors: "Care & Cure KSIJ PL",
  seniors: "goFiber KSIJ PL",
};

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

export default function PlayersAdmin() {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamByDivision, setSelectedTeamByDivision] = useState<Record<string, string>>({});
  const [playersByTeam, setPlayersByTeam] = useState<Record<string, Player[]>>({});

  const [addOpen, setAddOpen] = useState(false);
  const [addTeamId, setAddTeamId] = useState("");
  const [name, setName] = useState("");
  const [position, setPosition] = useState("MID");
  const [number, setNumber] = useState("");
  const [saving, setSaving] = useState(false);

  const orderedDivisions = useMemo(
    () => [...divisions].sort((a, b) => ["juniors", "seniors"].indexOf(a.slug) - ["juniors", "seniors"].indexOf(b.slug)),
    [divisions]
  );

  async function loadBase() {
    const [{ data: divs }, { data: tms }] = await Promise.all([
      supabase.from("divisions").select("id,name,slug").order("name"),
      supabase.from("teams").select("id,name,division_id").order("name"),
    ]);
    setDivisions(divs ?? []);
    setTeams(tms ?? []);

    const defaults: Record<string, string> = {};
    (divs ?? []).forEach((d) => {
      const first = (tms ?? []).find((t) => t.division_id === d.id);
      if (first) defaults[d.id] = first.id;
    });
    setSelectedTeamByDivision((prev) => ({ ...defaults, ...prev }));
    if (!addTeamId && tms && tms.length) setAddTeamId(tms[0].id);
  }

  async function loadPlayers(teamId: string) {
    const { data } = await supabase
      .from("players")
      .select("id,full_name,position,squad_number,team_id")
      .eq("team_id", teamId)
      .order("squad_number");
    setPlayersByTeam((prev) => ({ ...prev, [teamId]: data ?? [] }));
  }

  useEffect(() => {
    loadBase();
  }, []);

  useEffect(() => {
    Object.values(selectedTeamByDivision).forEach((teamId) => {
      if (teamId) loadPlayers(teamId);
    });
  }, [selectedTeamByDivision]);

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !addTeamId) return;
    setSaving(true);
    const { error } = await supabase.from("players").insert({
      full_name: name,
      position,
      squad_number: number ? Number(number) : null,
      team_id: addTeamId,
    });
    setSaving(false);
    if (!error) {
      setName("");
      setNumber("");
      setAddOpen(false);
      loadPlayers(addTeamId);
    } else {
      alert(error.message);
    }
  }

  async function deletePlayer(teamId: string, id: string) {
    if (!confirm("Delete this player?")) return;
    await supabase.from("players").delete().eq("id", id);
    loadPlayers(teamId);
  }

  async function updatePosition(teamId: string, id: string, newPosition: string) {
    await supabase.from("players").update({ position: newPosition || null }).eq("id", id);
    loadPlayers(teamId);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="admin-page-title">Players</h1>
        <button onClick={() => setAddOpen(true)} className="admin-btn admin-btn-primary">
          <PlusIcon /> Add Player
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {orderedDivisions.map((d) => {
          const divisionTeams = teams.filter((t) => t.division_id === d.id);
          const selectedTeam = selectedTeamByDivision[d.id] ?? "";
          const players = playersByTeam[selectedTeam] ?? [];
          return (
            <div key={d.id}>
              <h2 className="font-semibold text-[#0B3363] mb-2 text-sm">{DIVISION_LABELS[d.slug] ?? d.name}</h2>
              <div className="mb-3">
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeamByDivision((prev) => ({ ...prev, [d.id]: e.target.value }))}
                  className="admin-select"
                >
                  {divisionTeams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="admin-card overflow-hidden">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Pos</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((p) => (
                      <tr key={p.id}>
                        <td className="text-slate-400 w-10">{p.squad_number ?? "—"}</td>
                        <td>{p.full_name}</td>
                        <td>
                          <select
                            value={p.position ?? ""}
                            onChange={(e) => updatePosition(selectedTeam, p.id, e.target.value)}
                            className={`text-xs border rounded-lg px-1.5 py-1 w-[4.5rem] outline-none transition-colors ${
                              !p.position ? "border-amber-400 bg-amber-50" : "border-slate-200 text-[#0B3363]"
                            }`}
                          >
                            <option value="">—</option>
                            {POSITIONS.map((pos) => (
                              <option key={pos} value={pos}>{pos}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <div className="flex justify-end">
                            <button
                              onClick={() => deletePlayer(selectedTeam, p.id)}
                              className="admin-icon-btn admin-icon-btn-danger"
                              aria-label="Delete"
                              title="Delete"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {selectedTeam && players.length === 0 && (
                  <div className="admin-empty">No players yet for this team.</div>
                )}
                {!selectedTeam && <div className="admin-empty">No teams in this division yet.</div>}
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Player" description="Add a player to any team.">
        <form onSubmit={addPlayer} className="flex flex-col gap-3">
          <div>
            <label className="admin-label">Team</label>
            <select value={addTeamId} onChange={(e) => setAddTeamId(e.target.value)} className="admin-select">
              {orderedDivisions.map((d) => (
                <optgroup key={d.id} label={DIVISION_LABELS[d.slug] ?? d.name}>
                  {teams.filter((t) => t.division_id === d.id).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="admin-label">Full name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="admin-input"
              placeholder="e.g. John Mushi"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="admin-label">Position</label>
              <select value={position} onChange={(e) => setPosition(e.target.value)} className="admin-select">
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="w-24">
              <label className="admin-label">Squad #</label>
              <input value={number} onChange={(e) => setNumber(e.target.value)} className="admin-input" type="number" />
            </div>
          </div>
          <button disabled={saving} className="admin-btn admin-btn-primary mt-2">
            {saving ? "Adding…" : "Add Player"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
