"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Modal from "@/components/admin/Modal";

type Division = { id: string; name: string; slug: string };
type Team = { id: string; name: string; division_id: string };
type Player = { id: string; full_name: string; position: string | null; squad_number: number | null; team_id: string; fpl_name: string | null };
type Season = { id: string; label: string; division_id: string };
type SeasonPlayer = { id: string; player_id: string; full_name: string };

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
  const [pricesByTeam, setPricesByTeam] = useState<Record<string, Record<string, number>>>({});
  const [poolByDivision, setPoolByDivision] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNumber, setEditNumber] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [addTeamId, setAddTeamId] = useState("");
  const [name, setName] = useState("");
  const [fplName, setFplName] = useState("");
  const [position, setPosition] = useState("MID");
  const [number, setNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [mobileTab, setMobileTab] = useState(0);

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonId, setSeasonId] = useState(""); // "" = current-team-assignment mode
  const [seasonSquad, setSeasonSquad] = useState<SeasonPlayer[]>([]);
  const [seasonAddPlayerId, setSeasonAddPlayerId] = useState("");
  const [seasonBusy, setSeasonBusy] = useState(false);

  const orderedDivisions = useMemo(
    () => [...divisions].sort((a, b) => ["juniors", "seniors"].indexOf(a.slug) - ["juniors", "seniors"].indexOf(b.slug)),
    [divisions]
  );

  async function loadBase() {
    const [{ data: divs }, { data: tms }, { data: pools }, { data: seas }] = await Promise.all([
      supabase.from("divisions").select("id,name,slug").order("name"),
      supabase.from("teams").select("id,name,division_id").order("name"),
      supabase.from("fantasy_settings").select("id,seasons(competitions(division_id))").eq("is_active", true),
      supabase.from("seasons").select("id,label,created_at,competitions(division_id,type)").order("created_at", { ascending: false }),
    ]);
    setDivisions(divs ?? []);
    setTeams(tms ?? []);
    const seasonNum = (label: string) => parseInt(label.match(/\d+/)?.[0] ?? "0", 10);
    setSeasons(
      (seas ?? [])
        .filter((s: any) => s.competitions?.type === "league")
        .map((s: any) => ({ id: s.id, label: s.label, division_id: s.competitions.division_id }))
        .sort((a, b) => seasonNum(b.label) - seasonNum(a.label))
    );
    const poolMap: Record<string, string> = {};
    (pools ?? []).forEach((p: any) => {
      const divId = p.seasons?.competitions?.division_id;
      if (divId) poolMap[divId] = p.id;
    });
    setPoolByDivision(poolMap);

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
      .select("id,full_name,position,squad_number,team_id,fpl_name")
      .eq("team_id", teamId)
      .order("squad_number");
    setPlayersByTeam((prev) => ({ ...prev, [teamId]: data ?? [] }));

    const team = teams.find((t) => t.id === teamId);
    const poolId = team ? poolByDivision[team.division_id] : undefined;
    if (poolId && data && data.length) {
      const { data: priceRows } = await supabase
        .from("fantasy_player_prices")
        .select("player_id,price")
        .eq("fantasy_settings_id", poolId)
        .in("player_id", data.map((p) => p.id));
      const priceMap: Record<string, number> = {};
      (priceRows ?? []).forEach((r: any) => (priceMap[r.player_id] = Number(r.price)));
      setPricesByTeam((prev) => ({ ...prev, [teamId]: priceMap }));
    }
  }

  async function savePrice(teamId: string, playerId: string, value: string) {
    const team = teams.find((t) => t.id === teamId);
    const poolId = team ? poolByDivision[team.division_id] : undefined;
    if (!poolId) return;
    const price = Number(value);
    if (!value || isNaN(price)) return;
    await supabase.from("fantasy_player_prices").upsert({ fantasy_settings_id: poolId, player_id: playerId, price }, { onConflict: "fantasy_settings_id,player_id" });
    setPricesByTeam((prev) => ({ ...prev, [teamId]: { ...(prev[teamId] ?? {}), [playerId]: price } }));
  }

  useEffect(() => {
    loadBase();
  }, []);

  useEffect(() => {
    Object.values(selectedTeamByDivision).forEach((teamId) => {
      if (teamId) loadPlayers(teamId);
    });
  }, [selectedTeamByDivision]);

  const seasonDivisionId = seasons.find((s) => s.id === seasonId)?.division_id ?? "";
  const seasonTeamId = seasonDivisionId ? selectedTeamByDivision[seasonDivisionId] ?? "" : "";

  async function loadSeasonSquad(sid: string, teamId: string) {
    if (!sid || !teamId) {
      setSeasonSquad([]);
      return;
    }
    const { data } = await supabase
      .from("season_players")
      .select("id,player_id,players(full_name)")
      .eq("season_id", sid)
      .eq("team_id", teamId);
    setSeasonSquad((data ?? []).map((r: any) => ({ id: r.id, player_id: r.player_id, full_name: r.players?.full_name ?? "—" })));
  }

  useEffect(() => {
    loadSeasonSquad(seasonId, seasonTeamId);
  }, [seasonId, seasonTeamId]);

  async function addToSeasonSquad() {
    if (!seasonId || !seasonTeamId || !seasonAddPlayerId) return;
    setSeasonBusy(true);
    const { error } = await supabase
      .from("season_players")
      .insert({ season_id: seasonId, team_id: seasonTeamId, player_id: seasonAddPlayerId });
    setSeasonBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    setSeasonAddPlayerId("");
    loadSeasonSquad(seasonId, seasonTeamId);
  }

  async function removeFromSeasonSquad(rowId: string) {
    await supabase.from("season_players").delete().eq("id", rowId);
    loadSeasonSquad(seasonId, seasonTeamId);
  }

  async function copyCurrentSquad() {
    if (!seasonId || !seasonTeamId) return;
    const current = playersByTeam[seasonTeamId] ?? [];
    if (!current.length) return;
    setSeasonBusy(true);
    const { error } = await supabase
      .from("season_players")
      .upsert(
        current.map((p) => ({ season_id: seasonId, team_id: seasonTeamId, player_id: p.id })),
        { onConflict: "season_id,player_id" }
      );
    setSeasonBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    loadSeasonSquad(seasonId, seasonTeamId);
  }

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !addTeamId) return;
    setSaving(true);
    const { error } = await supabase.from("players").insert({
      full_name: name,
      fpl_name: fplName || null,
      position,
      squad_number: number ? Number(number) : null,
      team_id: addTeamId,
    });
    setSaving(false);
    if (!error) {
      setName("");
      setFplName("");
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

  async function updateFplName(teamId: string, id: string, value: string) {
    await supabase.from("players").update({ fpl_name: value || null }).eq("id", id);
  }

  async function saveEditPlayer(teamId: string, id: string) {
    const { error } = await supabase
      .from("players")
      .update({ full_name: editName, squad_number: editNumber ? Number(editNumber) : null })
      .eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    setEditingId(null);
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

      <div className="admin-card p-4 mb-8">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
          <h2 className="font-semibold text-[#0B3363] text-sm">Season Squad</h2>
          <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)} className="admin-select w-auto">
            <option value="">Current team assignment (no season)</option>
            {orderedDivisions.map((d) => (
              <optgroup key={d.id} label={DIVISION_LABELS[d.slug] ?? d.name}>
                {seasons.filter((s) => s.division_id === d.id).map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        {seasonId ? (
          <>
            <p className="text-xs text-[#0B3363]/50 mb-3">
              Squad for {teams.find((t) => t.id === seasonTeamId)?.name ?? "—"} in {seasons.find((s) => s.id === seasonId)?.label}.
              Pick the team above in that division's list, then manage its season roster here.
            </p>
            <div className="flex items-center gap-2 mb-3">
              <select
                value={seasonAddPlayerId}
                onChange={(e) => setSeasonAddPlayerId(e.target.value)}
                className="admin-select w-auto"
                disabled={!seasonTeamId}
              >
                <option value="">Add player to this season…</option>
                {(playersByTeam[seasonTeamId] ?? [])
                  .filter((p) => !seasonSquad.some((sp) => sp.player_id === p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
              </select>
              <button onClick={addToSeasonSquad} disabled={seasonBusy || !seasonAddPlayerId} className="admin-btn admin-btn-secondary">
                Add
              </button>
              <button onClick={copyCurrentSquad} disabled={seasonBusy || !seasonTeamId} className="admin-btn admin-btn-secondary">
                Copy current squad
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {seasonSquad.map((sp) => (
                <span key={sp.id} className="admin-pill flex items-center gap-1.5">
                  {sp.full_name}
                  <button onClick={() => removeFromSeasonSquad(sp.id)} className="text-[#0B3363]/50 hover:text-red-500" aria-label="Remove">×</button>
                </span>
              ))}
              {seasonSquad.length === 0 && <span className="text-xs text-[#0B3363]/40">No players in this season's squad yet.</span>}
            </div>
          </>
        ) : (
          <p className="text-xs text-[#0B3363]/50">
            Select a season to build that season's squad per team (used for archived seasons on the public Team page).
          </p>
        )}
      </div>

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
        {orderedDivisions.map((d, i) => {
          const divisionTeams = teams.filter((t) => t.division_id === d.id);
          const selectedTeam = selectedTeamByDivision[d.id] ?? "";
          const players = playersByTeam[selectedTeam] ?? [];
          return (
            <div key={d.id} className={i === mobileTab ? "" : "hidden md:block"}>
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
                <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>FPL Name</th>
                      <th>Pos</th>
                      <th>Price</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((p) => (
                      <tr key={p.id}>
                        {editingId === p.id ? (
                          <>
                            <td className="w-14">
                              <input
                                value={editNumber}
                                onChange={(e) => setEditNumber(e.target.value)}
                                type="number"
                                className="text-xs border border-slate-200 rounded-lg px-1.5 py-1 w-12 outline-none text-[#0B3363]"
                              />
                            </td>
                            <td>
                              <input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="text-xs border border-slate-200 rounded-lg px-1.5 py-1 w-full outline-none text-[#0B3363]"
                              />
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="text-slate-400 w-10">{p.squad_number ?? "—"}</td>
                            <td>{p.full_name}</td>
                          </>
                        )}
                        <td>
                          <input
                            defaultValue={p.fpl_name ?? ""}
                            onBlur={(e) => updateFplName(selectedTeam, p.id, e.target.value)}
                            placeholder="e.g. Salah"
                            className="text-xs border border-slate-200 rounded-lg px-1.5 py-1 w-24 outline-none text-[#0B3363]"
                          />
                        </td>
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
                          {poolByDivision[teams.find((t) => t.id === selectedTeam)?.division_id ?? ""] ? (
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              defaultValue={pricesByTeam[selectedTeam]?.[p.id] ?? ""}
                              onBlur={(e) => savePrice(selectedTeam, p.id, e.target.value)}
                              placeholder="TSH"
                              className="text-xs border border-slate-200 rounded-lg px-1.5 py-1 w-16 outline-none text-[#0B3363]"
                            />
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td>
                          <div className="flex justify-end gap-1">
                            {editingId === p.id ? (
                              <>
                                <button onClick={() => saveEditPlayer(selectedTeam, p.id)} className="admin-icon-btn" aria-label="Save" title="Save">✓</button>
                                <button onClick={() => setEditingId(null)} className="admin-icon-btn" aria-label="Cancel" title="Cancel">×</button>
                              </>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingId(p.id);
                                  setEditName(p.full_name);
                                  setEditNumber(p.squad_number?.toString() ?? "");
                                }}
                                className="admin-icon-btn"
                                aria-label="Edit"
                                title="Edit"
                              >
                                Edit
                              </button>
                            )}
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
                </div>
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
          <div>
            <label className="admin-label">FPL Name (short, shown on fantasy jersey cards)</label>
            <input
              value={fplName}
              onChange={(e) => setFplName(e.target.value)}
              className="admin-input"
              placeholder="e.g. Mushi"
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
