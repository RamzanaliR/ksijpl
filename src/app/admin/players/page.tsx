"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Team = { id: string; name: string };
type Player = { id: string; full_name: string; position: string | null; squad_number: number | null; team_id: string };

const POSITIONS = ["GK", "DEF", "MID", "FWD"];

export default function PlayersAdmin() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [name, setName] = useState("");
  const [position, setPosition] = useState("MID");
  const [number, setNumber] = useState("");

  async function loadTeams() {
    const { data } = await supabase.from("teams").select("id,name").order("name");
    setTeams(data ?? []);
    if (data && data.length && !selectedTeam) setSelectedTeam(data[0].id);
  }

  async function loadPlayers(teamId: string) {
    const { data } = await supabase
      .from("players")
      .select("id,full_name,position,squad_number,team_id")
      .eq("team_id", teamId)
      .order("squad_number");
    setPlayers(data ?? []);
  }

  useEffect(() => {
    loadTeams();
  }, []);

  useEffect(() => {
    if (selectedTeam) loadPlayers(selectedTeam);
  }, [selectedTeam]);

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !selectedTeam) return;
    const { error } = await supabase.from("players").insert({
      full_name: name,
      position,
      squad_number: number ? Number(number) : null,
      team_id: selectedTeam,
    });
    if (!error) {
      setName("");
      setNumber("");
      loadPlayers(selectedTeam);
    } else {
      alert(error.message);
    }
  }

  async function deletePlayer(id: string) {
    if (!confirm("Delete this player?")) return;
    await supabase.from("players").delete().eq("id", id);
    loadPlayers(selectedTeam);
  }

  async function updatePosition(id: string, newPosition: string) {
    await supabase.from("players").update({ position: newPosition || null }).eq("id", id);
    loadPlayers(selectedTeam);
  }

  return (
    <div>
      <h1 className="admin-page-title mb-6">Players</h1>

      <div className="mb-6 max-w-xs">
        <label className="admin-label">Team</label>
        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          className="admin-select"
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={addPlayer} className="admin-card p-5 mb-8 flex gap-3 items-end flex-wrap">
        <div>
          <label className="admin-label">Full name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="admin-input w-56"
            placeholder="e.g. John Mushi"
          />
        </div>
        <div>
          <label className="admin-label">Position</label>
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="admin-select"
          >
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="admin-label">Squad #</label>
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className="admin-input w-20"
            type="number"
          />
        </div>
        <button className="admin-btn admin-btn-primary">Add Player</button>
      </form>

      <div className="admin-card overflow-hidden">
        {players.map((p) => (
          <div key={p.id} className="admin-row">
            <span className="w-64 text-[#0B3363]">{p.full_name}</span>
            <select
              value={p.position ?? ""}
              onChange={(e) => updatePosition(p.id, e.target.value)}
              className={`text-xs border rounded-lg px-1.5 py-1 w-20 outline-none transition-colors ${
                !p.position ? "border-amber-400 bg-amber-50" : "border-slate-200 text-[#0B3363]"
              }`}
            >
              <option value="">—</option>
              {POSITIONS.map((pos) => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>
            <span className="text-xs text-slate-400 w-10">#{p.squad_number}</span>
            <button onClick={() => deletePlayer(p.id)} className="admin-btn-danger">
              Delete
            </button>
          </div>
        ))}
        {players.length === 0 && (
          <div className="admin-empty">No players yet for this team.</div>
        )}
      </div>
    </div>
  );
}
