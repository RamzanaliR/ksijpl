"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

type Pool = {
  id: string;
  season_id: string;
  sponsorName: string;
  label: string;
};

type PlayerRow = {
  playerId: string;
  name: string;
  fplName: string | null;
  position: "GK" | "DEF" | "MID" | "FWD";
  teamId: string;
  teamName: string;
  currentPrice: number;
  newPrice: number;
  dirty: boolean;
};

const POSITIONS = ["GK", "DEF", "MID", "FWD"] as const;

const PRICE_FLOORS: Record<string, number> = { GK: 4.5, DEF: 4.5, MID: 5.0, FWD: 5.5 };
const PRICE_CEILINGS: Record<string, number> = { GK: 6.5, DEF: 7.5, MID: 9.0, FWD: 10.0 };

export default function PricesAdminPage() {
  const [pools, setPools]           = useState<Pool[]>([]);
  const [selectedPool, setSelectedPool] = useState("");
  const [players, setPlayers]       = useState<PlayerRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saveMsg, setSaveMsg]       = useState("");
  const [search, setSearch]         = useState("");
  const [posFilter, setPosFilter]   = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [dirtyOnly, setDirtyOnly]   = useState(false);
  const [teams, setTeams]           = useState<{ id: string; name: string }[]>([]);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ── Load pools ──────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("fantasy_settings")
        .select("id,season_id,seasons(label,competitions(sponsor_name))").order("id");
      const mapped: Pool[] = ((data as any) ?? []).map((p: any) => ({
        id: p.id,
        season_id: p.season_id,
        sponsorName: p.seasons?.competitions?.sponsor_name ?? "",
        label: p.seasons?.label ?? "",
      }));
      setPools(mapped);
      if (mapped.length) setSelectedPool(mapped[0].id);
    })();
  }, []);

  // ── Load players + prices ───────────────────────────────────────────────────

  const loadPlayers = useCallback(async () => {
    if (!selectedPool) return;
    setLoading(true);

    const pool = pools.find((p) => p.id === selectedPool);
    if (!pool) return;

    // Get division teams
    const { data: divisionData } = await supabase.from("fantasy_settings")
      .select("seasons(competitions(division_id))").eq("id", selectedPool).single();
    const divisionId = (divisionData as any)?.seasons?.competitions?.division_id;

    const [{ data: teamsData }, { data: priceRows }] = await Promise.all([
      supabase.from("teams").select("id,name").eq("division_id", divisionId ?? "x").order("name"),
      supabase.from("fantasy_player_prices").select("player_id,price").eq("fantasy_settings_id", selectedPool),
    ]);

    const teamList = (teamsData ?? []) as { id: string; name: string }[];
    setTeams(teamList);
    const teamMap = Object.fromEntries(teamList.map((t) => [t.id, t.name]));
    const teamIds = teamList.map((t) => t.id);

    const { data: rawPlayers } = await supabase.from("players")
      .select("id,full_name,fpl_name,position,team_id")
      .in("team_id", teamIds.length ? teamIds : ["x"])
      .not("position", "is", null)
      .order("full_name");

    const priceMap: Record<string, number> = {};
    (priceRows ?? []).forEach((p: any) => { priceMap[p.player_id] = Number(p.price); });

    const rows: PlayerRow[] = ((rawPlayers ?? []) as any[]).map((p) => {
      const pos = p.position as "GK" | "DEF" | "MID" | "FWD";
      const price = priceMap[p.id] ?? PRICE_FLOORS[pos];
      return {
        playerId: p.id,
        name: p.full_name,
        fplName: p.fpl_name,
        position: pos,
        teamId: p.team_id,
        teamName: teamMap[p.team_id] ?? "—",
        currentPrice: price,
        newPrice: price,
        dirty: false,
      };
    });

    setPlayers(rows);
    setLoading(false);
  }, [selectedPool, pools]);

  useEffect(() => { loadPlayers(); }, [loadPlayers]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function updatePrice(playerId: string, raw: string) {
    const val = parseFloat(raw);
    setPlayers((prev) => prev.map((p) =>
      p.playerId !== playerId ? p : {
        ...p,
        newPrice: isNaN(val) ? p.newPrice : val,
        dirty: isNaN(val) ? p.dirty : val !== p.currentPrice,
      }
    ));
  }

  function nudgePrice(playerId: string, delta: number) {
    setPlayers((prev) => prev.map((p) => {
      if (p.playerId !== playerId) return p;
      const raw = Math.round((p.newPrice + delta) * 2) / 2;
      const clamped = Math.max(PRICE_FLOORS[p.position], Math.min(PRICE_CEILINGS[p.position], raw));
      return { ...p, newPrice: clamped, dirty: clamped !== p.currentPrice };
    }));
  }

  function resetPlayer(playerId: string) {
    setPlayers((prev) => prev.map((p) =>
      p.playerId !== playerId ? p : { ...p, newPrice: p.currentPrice, dirty: false }
    ));
  }

  async function saveAll() {
    const dirty = players.filter((p) => p.dirty);
    if (!dirty.length) { setSaveMsg("No changes to save."); return; }
    setSaving(true); setSaveMsg("");

    const upserts = dirty.map((p) => ({
      fantasy_settings_id: selectedPool,
      player_id: p.playerId,
      price: p.newPrice,
    }));

    const { error } = await supabase.from("fantasy_player_prices")
      .upsert(upserts, { onConflict: "fantasy_settings_id,player_id" });

    if (error) {
      setSaveMsg(`Error: ${error.message}`);
    } else {
      setPlayers((prev) => prev.map((p) => ({ ...p, currentPrice: p.newPrice, dirty: false })));
      setSaveMsg(`✓ Saved ${dirty.length} price${dirty.length > 1 ? "s" : ""}.`);
      setTimeout(() => setSaveMsg(""), 4000);
    }
    setSaving(false);
  }

  async function resetAll() {
    if (!confirm("Reset all unsaved changes?")) return;
    setPlayers((prev) => prev.map((p) => ({ ...p, newPrice: p.currentPrice, dirty: false })));
  }

  // ── Filtered list ────────────────────────────────────────────────────────────

  const filtered = players.filter((p) => {
    const q = search.toLowerCase();
    if (q && !p.name.toLowerCase().includes(q) && !(p.fplName ?? "").toLowerCase().includes(q)) return false;
    if (posFilter !== "all" && p.position !== posFilter) return false;
    if (teamFilter !== "all" && p.teamId !== teamFilter) return false;
    if (dirtyOnly && !p.dirty) return false;
    return true;
  });

  const dirtyCount = players.filter((p) => p.dirty).length;

  const posStats = POSITIONS.map((pos) => ({
    pos,
    count: players.filter((p) => p.position === pos).length,
    avg: (() => {
      const rows = players.filter((p) => p.position === pos);
      return rows.length ? (rows.reduce((s, p) => s + p.newPrice, 0) / rows.length).toFixed(1) : "—";
    })(),
  }));

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="admin-page-title mb-0.5">Player Prices</h1>
          <p className="admin-subtitle">Bulk update fantasy player prices. Changes are saved all at once.</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {dirtyCount > 0 && (
            <>
              <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                {dirtyCount} unsaved change{dirtyCount > 1 ? "s" : ""}
              </span>
              <button onClick={resetAll} className="admin-btn text-xs border border-[#0B3363]/15">Reset</button>
            </>
          )}
          <button onClick={saveAll} disabled={saving || dirtyCount === 0} className="admin-btn admin-btn-primary">
            {saving ? "Saving…" : `Save ${dirtyCount > 0 ? `${dirtyCount} change${dirtyCount > 1 ? "s" : ""}` : "changes"}`}
          </button>
          {saveMsg && <span className={`text-xs font-semibold ${saveMsg.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>{saveMsg}</span>}
        </div>
      </div>

      {/* Pool selector */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {pools.map((p) => (
          <button key={p.id} onClick={() => setSelectedPool(p.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${p.id === selectedPool ? "admin-btn-primary" : "bg-[#0B3363]/5 text-[#0B3363]"}`}>
            {p.sponsorName || "Pool"} — {p.label}
          </button>
        ))}
      </div>

      {/* Position summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {posStats.map(({ pos, count, avg }) => (
          <div key={pos} className="admin-stat-card">
            <div className="admin-stat-label">{pos} ({count} players)</div>
            <div className="admin-stat-value text-base">avg {avg}m</div>
            <div className="text-[10px] text-[#0B3363]/40 mt-0.5">
              {PRICE_FLOORS[pos]}–{PRICE_CEILINGS[pos]}m range
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search player…" className="admin-input flex-1 min-w-[160px]" />
        <select value={posFilter} onChange={(e) => setPosFilter(e.target.value)} className="admin-select w-28">
          <option value="all">All positions</option>
          {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="admin-select w-44">
          <option value="all">All teams</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer select-none">
          <input type="checkbox" checked={dirtyOnly} onChange={(e) => setDirtyOnly(e.target.checked)} />
          Changed only
        </label>
        <span className="text-xs text-[#0B3363]/40">{filtered.length} players</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="admin-card p-8 text-center text-sm text-[#0B3363]/30">Loading…</div>
      ) : (
        <div className="admin-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase text-[#0B3363]/40 border-b border-[#0B3363]/10">
                  <th className="text-left py-2 px-4">Player</th>
                  <th className="text-left py-2 px-2">Team</th>
                  <th className="text-center py-2 px-2">Pos</th>
                  <th className="text-center py-2 px-2">Current</th>
                  <th className="text-center py-2 px-3">New Price</th>
                  <th className="py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.playerId} className={`h-11 border-b border-[#0B3363]/5 last:border-0 ${p.dirty ? "bg-amber-50/50 dark:bg-amber-900/10" : ""}`}>
                    <td className="px-4">
                      <div className="font-semibold text-xs truncate max-w-[160px]">{p.fplName || p.name}</div>
                    </td>
                    <td className="px-2 text-xs text-[#0B3363]/50 dark:text-white/50 max-w-[100px] truncate">{p.teamName}</td>
                    <td className="px-2 text-center">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        p.position === "GK" ? "bg-yellow-50 text-yellow-700" :
                        p.position === "DEF" ? "bg-blue-50 text-blue-700" :
                        p.position === "MID" ? "bg-green-50 text-green-700" :
                        "bg-red-50 text-red-700"
                      }`}>{p.position}</span>
                    </td>
                    <td className="px-2 text-center text-xs text-[#0B3363]/50">{p.currentPrice}m</td>
                    <td className="px-3">
                      <div className="flex items-center gap-1 justify-center">
                        <button onClick={() => nudgePrice(p.playerId, -0.5)}
                          className="w-6 h-6 rounded border border-[#0B3363]/15 text-[#0B3363]/50 hover:bg-[#0B3363]/5 text-xs flex items-center justify-center">−</button>
                        <input
                          ref={(el) => { inputRefs.current[p.playerId] = el; }}
                          value={p.newPrice}
                          onChange={(e) => updatePrice(p.playerId, e.target.value)}
                          onBlur={(e) => {
                            // Snap to nearest 0.5 on blur
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) {
                              const snapped = Math.round(val * 2) / 2;
                              const clamped = Math.max(PRICE_FLOORS[p.position], Math.min(PRICE_CEILINGS[p.position], snapped));
                              updatePrice(p.playerId, String(clamped));
                            }
                          }}
                          type="number" step="0.5"
                          min={PRICE_FLOORS[p.position]} max={PRICE_CEILINGS[p.position]}
                          className={`w-16 text-center border rounded-lg px-2 py-1 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-[#3EA0D9] ${
                            p.dirty ? "border-amber-300 bg-amber-50 dark:bg-amber-900/20" : "border-[#0B3363]/15"
                          }`}
                        />
                        <button onClick={() => nudgePrice(p.playerId, 0.5)}
                          className="w-6 h-6 rounded border border-[#0B3363]/15 text-[#0B3363]/50 hover:bg-[#0B3363]/5 text-xs flex items-center justify-center">+</button>
                        <span className="text-xs text-[#0B3363]/40">m</span>
                      </div>
                    </td>
                    <td className="px-2 text-center">
                      {p.dirty && (
                        <button onClick={() => resetPlayer(p.playerId)}
                          className="text-[10px] text-[#0B3363]/30 hover:text-[#0B3363] transition-colors">↩</button>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-sm text-[#0B3363]/30">No players match your filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
