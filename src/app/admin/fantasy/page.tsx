"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Settings = {
  id: string;
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

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("fantasy_settings")
        .select("id,budget,squad_size,starting_xi_size,min_gk,min_def,min_mid,min_fwd,starting_gk_count,seasons(label,competitions(name,sponsor_name,division_id))")
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
            <div className="admin-stat-value">£{pool.budget}m</div>
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

      <div className="admin-stat-label mb-3">Player Prices</div>
      <div className="space-y-8">
        {POSITIONS.map((pos) => (
          <section key={pos}>
            <h2 className="font-semibold text-[#0B3363] mb-2 text-sm">{pos}</h2>
            <div className="admin-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr><th>Player</th><th>Team</th><th className="text-right">Price (£m)</th></tr>
                  </thead>
                  <tbody>
                    {players
                      .filter((p) => p.position === pos)
                      .map((p) => (
                        <tr key={p.id}>
                          <td>{p.full_name}{p.nickname ? ` "${p.nickname}"` : ""}</td>
                          <td className="text-slate-400">{p.teamName}</td>
                          <td className="text-right">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              defaultValue={prices[p.id] ?? ""}
                              onBlur={(e) => savePrice(p.id, e.target.value)}
                              disabled={savingId === p.id}
                              className="admin-input w-20 text-right py-1 inline-block"
                            />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {players.filter((p) => p.position === pos).length === 0 && (
                <div className="admin-empty">No {pos} players with a price yet.</div>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
