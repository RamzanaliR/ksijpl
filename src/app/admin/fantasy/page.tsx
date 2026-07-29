"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { computeGameweekPoints, type ComputeResult } from "@/lib/fantasy-compute";

type Settings = {
  id: string;
  season_id: string;
  budget: number;
  squad_size: number;
  starting_xi_size: number;
  min_gk: number;
  min_def: number;
  min_mid: number;
  min_fwd: number;
  starting_gk_count: number;
  seasons: { label: string; competitions: { name: string; sponsor_name: string; division_id: string } } | null;
};
type Player = { id: string; full_name: string; nickname: string | null; position: string; team_id: string; teamName: string };
type Gameweek = { id: string; number: number; round_name: string | null; total: number; completed: number };

const DIVISION_LABELS: Record<string, string> = {
  gofiber: "gofiber KSIJ PL Fantasy",
  "Care & Cure": "Care & Cure KSIJ PL Fantasy",
};
const POSITIONS = ["GK", "DEF", "MID", "FWD"];

export default function FantasyAdmin() {
  const [pools, setPools] = useState<Settings[]>([]);
  const [selectedPoolId, setSelectedPoolId] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [teamCount, setTeamCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [selectedGwId, setSelectedGwId] = useState("");
  const [computing, setComputing] = useState(false);
  const [computeError, setComputeError] = useState("");
  const [computeResult, setComputeResult] = useState<ComputeResult | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("fantasy_settings")
        .select("id,season_id,budget,squad_size,starting_xi_size,min_gk,min_def,min_mid,min_fwd,starting_gk_count,seasons(label,competitions(name,sponsor_name,division_id))")
        .order("id");
      const ordered = [...((data as any) ?? [])].sort(
        (a: any, b: any) =>
          ["gofiber", "Care & Cure"].indexOf(a.seasons?.competitions?.sponsor_name) -
          ["gofiber", "Care & Cure"].indexOf(b.seasons?.competitions?.sponsor_name)
      );
      setPools(ordered);
      if (ordered.length) setSelectedPoolId(ordered[0].id);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selectedPoolId) return;
    loadPool(selectedPoolId);
  }, [selectedPoolId, pools]);

  async function loadPool(poolId: string) {
    const pool = pools.find((p) => p.id === poolId);
    if (!pool) return;
    const divisionId = pool.seasons?.competitions?.division_id;

    const [{ data: teamsRaw }, { data: priceRows }, { count }] = await Promise.all([
      supabase.from("teams").select("id,name").eq("division_id", divisionId),
      supabase.from("fantasy_player_prices").select("player_id,price").eq("fantasy_settings_id", poolId),
      supabase.from("fantasy_teams").select("*", { count: "exact", head: true }).eq("fantasy_settings_id", poolId),
    ]);
    setTeamCount(count ?? 0);

    const teamNameMap: Record<string, string> = {};
    (teamsRaw ?? []).forEach((t: any) => (teamNameMap[t.id] = t.name));
    const teamIds = (teamsRaw ?? []).map((t: any) => t.id);

    const { data: playersRaw } = await supabase
      .from("players")
      .select("id,full_name,nickname,position,team_id")
      .in("team_id", teamIds.length ? teamIds : ["00000000-0000-0000-0000-000000000000"])
      .not("position", "is", null)
      .order("full_name");

    setPlayers(
      (playersRaw ?? []).map((p: any) => ({ ...p, teamName: teamNameMap[p.team_id] ?? "—" }))
    );

    const priceMap: Record<string, number> = {};
    (priceRows ?? []).forEach((p: any) => (priceMap[p.player_id] = Number(p.price)));
    setPrices(priceMap);

    const { data: gws } = await supabase.from("gameweeks").select("id,number,round_name").eq("season_id", pool.season_id).order("number");
    const { data: allMatches } = await supabase.from("matches").select("id,gameweek_id,status").eq("season_id", pool.season_id);
    const gwList: Gameweek[] = (gws ?? []).map((g: any) => {
      const ms = (allMatches ?? []).filter((m: any) => m.gameweek_id === g.id);
      return { id: g.id, number: g.number, round_name: g.round_name, total: ms.length, completed: ms.filter((m: any) => m.status === "completed").length };
    });
    setGameweeks(gwList);
    if (gwList.length && !selectedGwId) setSelectedGwId(gwList[0].id);
    setComputeResult(null);
    setComputeError("");
  }

  async function runCompute() {
    if (!selectedGwId) return;
    setComputing(true);
    setComputeError("");
    setComputeResult(null);
    try {
      const result = await computeGameweekPoints(selectedPoolId, selectedGwId);
      setComputeResult(result);
    } catch (e: any) {
      setComputeError(e.message ?? "Something went wrong");
    }
    setComputing(false);
  }

  async function savePrice(playerId: string, value: string) {
    const price = Number(value);
    if (!Number.isFinite(price) || price <= 0) return;
    setSavingId(playerId);
    await supabase
      .from("fantasy_player_prices")
      .upsert({ fantasy_settings_id: selectedPoolId, player_id: playerId, price }, { onConflict: "fantasy_settings_id,player_id" });
    setPrices((prev) => ({ ...prev, [playerId]: price }));
    setSavingId(null);
  }

  const pool = pools.find((p) => p.id === selectedPoolId);

  if (loading) return <div className="admin-subtitle">Loading…</div>;

  return (
    <div>
      <h1 className="admin-page-title mb-6">Fantasy</h1>

      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {pools.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedPoolId(p.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              p.id === selectedPoolId ? "admin-btn-primary" : "bg-[#0B3363]/5 text-[#0B3363]"
            }`}
          >
            {DIVISION_LABELS[p.seasons?.competitions?.sponsor_name ?? ""] ?? p.seasons?.competitions?.name}
          </button>
        ))}
      </div>

      {pool && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="admin-stat-card">
            <div className="admin-stat-label">Budget</div>
            <div className="admin-stat-value">TSH {pool.budget}m</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">Squad</div>
            <div className="admin-stat-value">{pool.starting_xi_size}+{pool.squad_size - pool.starting_xi_size}</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">Formation</div>
            <div className="admin-stat-value text-lg">{pool.min_gk}-{pool.min_def}-{pool.min_mid}-{pool.min_fwd}</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">Teams Entered</div>
            <div className="admin-stat-value">{teamCount}</div>
          </div>
        </div>
      )}

      <div className="admin-stat-label mb-3">Gameweek Points</div>
      <div className="admin-card p-5 mb-8">
        <div className="flex items-end gap-3 flex-wrap mb-3">
          <div>
            <label className="admin-label">Match week</label>
            <select value={selectedGwId} onChange={(e) => { setSelectedGwId(e.target.value); setComputeResult(null); setComputeError(""); }} className="admin-select">
              {gameweeks.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.round_name ?? `Match Week ${g.number}`} — {g.completed}/{g.total} completed
                </option>
              ))}
            </select>
          </div>
          <button onClick={runCompute} disabled={computing || !selectedGwId} className="admin-btn admin-btn-primary">
            {computing ? "Computing…" : "Compute Points"}
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          This now runs automatically the moment the last match in a match week is marked completed in Live Console. Use this button to re-run it manually if you correct a score, event, or MOTM afterwards — it's safe to re-run any time.
        </p>

        {computeError && <div className="admin-alert admin-alert-error mb-3">{computeError}</div>}

        {computeResult && (
          <div>
            <div className="text-xs text-slate-500 mb-2">
              Scored {computeResult.playersScored} players across {computeResult.teamsScored} fantasy teams.
            </div>
            <div className="admin-card overflow-hidden">
              <table className="admin-table">
                <thead><tr><th>Team</th><th className="text-right">Points</th></tr></thead>
                <tbody>
                  {computeResult.teamResults.map((t, i) => (
                    <tr key={t.teamId}>
                      <td>{i + 1}. {t.teamName}</td>
                      <td className="text-right font-bold">{t.points}</td>
                    </tr>
                  ))}
                  {computeResult.teamResults.length === 0 && (
                    <tr><td colSpan={2} className="admin-empty">No fantasy teams entered yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="admin-stat-label mb-3">Scoring Rules</div>
      <p className="text-sm text-slate-500 mb-4 max-w-2xl">
        This is exactly how points are calculated — nothing here is editable, it's a reference for what "Compute Points" applies to every player automatically.
        Player prices moved to <a href="/admin/players" className="text-[#3EA0D9] hover:underline">Players</a>, since that's where you already manage everything else about a player.
      </p>
      <div className="admin-card overflow-hidden mb-8 max-w-2xl">
        <table className="admin-table">
          <thead>
            <tr><th>Event</th><th className="text-right">GK</th><th className="text-right">DEF</th><th className="text-right">MID</th><th className="text-right">FWD</th></tr>
          </thead>
          <tbody>
            <tr><td>Appearance (any minutes)</td><td className="text-right">+1</td><td className="text-right">+1</td><td className="text-right">+1</td><td className="text-right">+1</td></tr>
            <tr><td>Goal</td><td className="text-right">+10</td><td className="text-right">+6</td><td className="text-right">+5</td><td className="text-right">+4</td></tr>
            <tr><td>Assist</td><td className="text-right">+3</td><td className="text-right">+3</td><td className="text-right">+3</td><td className="text-right">+3</td></tr>
            <tr><td>Clean sheet</td><td className="text-right">+4</td><td className="text-right">+4</td><td className="text-right">—</td><td className="text-right">—</td></tr>
            <tr><td>Every 3 goals conceded</td><td className="text-right">-3</td><td className="text-right">-3</td><td className="text-right">—</td><td className="text-right">—</td></tr>
            <tr><td>Penalty save</td><td className="text-right">+5</td><td className="text-right">—</td><td className="text-right">—</td><td className="text-right">—</td></tr>
            <tr><td>Penalty miss</td><td className="text-right" colSpan={4}>-2 (any position)</td></tr>
            <tr><td>Yellow card</td><td className="text-right" colSpan={4}>-1 (any position)</td></tr>
            <tr><td>Red card</td><td className="text-right" colSpan={4}>-2 (any position)</td></tr>
            <tr><td>Own goal</td><td className="text-right" colSpan={4}>-2 (any position)</td></tr>
            <tr><td>Man of the Match</td><td className="text-right" colSpan={4}>+3 (any position)</td></tr>
            <tr><td>Captain</td><td className="text-right" colSpan={4}>×2 total (×3 if Triple Captain is active)</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
