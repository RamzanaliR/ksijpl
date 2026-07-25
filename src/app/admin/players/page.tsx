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
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Players</h1>

      <div className="mb-6">
        <label className="block text-xs font-semibold text-slate-500 mb-1">Team</label>
        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          className="border rounded px-3 py-2 text-sm w-72"
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={addPlayer} className="bg-white border rounded-xl p-5 mb-8 flex gap-3 items-end flex-wrap">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Full name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border rounded px-3 py-2 text-sm w-56"
            placeholder="e.g. John Mushi"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Position</label>
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Squad #</label>
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className="border rounded px-3 py-2 text-sm w-20"
            type="number"
          />
        </div>
        <button className="bg-blue-700 text-white px-4 py-2 rounded text-sm font-semibold">
          Add Player
        </button>
      </form>

      <div className="bg-white border rounded-xl divide-y">
        {players.map((p) => (
          <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span className="w-64">{p.full_name}</span>
            <select
              value={p.position ?? ""}
              onChange={(e) => updatePosition(p.id, e.target.value)}
              className={`text-xs border rounded px-1.5 py-1 w-20 ${!p.position ? "border-amber-400 bg-amber-50" : "border-slate-200"}`}
            >
              <option value="">—</option>
              {POSITIONS.map((pos) => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>
            <span className="text-xs text-slate-400 w-10">#{p.squad_number}</span>
            <button onClick={() => deletePlayer(p.id)} className="text-xs text-red-600 hover:underline">
              Delete
            </button>
          </div>
        ))}
        {players.length === 0 && (
          <div className="px-4 py-4 text-sm text-slate-400">No players yet for this team.</div>
        )}
      </div>
    </div>
  );
}
