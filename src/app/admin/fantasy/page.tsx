"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { computeGameweekPoints, type ComputeResult } from "@/lib/fantasy-compute";

// ─── Types ────────────────────────────────────────────────────────────────────

type Settings = {
  id: string; season_id: string; budget: number; squad_size: number;
  starting_xi_size: number; min_gk: number; min_def: number; min_mid: number;
  min_fwd: number; starting_gk_count: number;
  seasons: { label: string; competitions: { name: string; sponsor_name: string; division_id: string } } | null;
};
type Gameweek = { id: string; number: number; round_name: string | null; total: number; completed: number };
type FantasyTeam = {
  id: string; team_name: string; user_id: string;
  email: string | null;
  squad_count: number;
  xi_count: number;
  total_pts: number;
  gw_pts: number | null;
  transfers: number;
  chips_used: string[];
  created_at: string;
};

const DIVISION_LABELS: Record<string, string> = {
  gofiber: "goFiber PL",
  "Care & Cure": "Care & Cure PL",
};

type Tab = "points" | "scoring" | "teams";

// ─── Component ────────────────────────────────────────────────────────────────

export default function FantasyAdmin() {
  const [pools, setPools]           = useState<Settings[]>([]);
  const [selectedPoolId, setSelectedPoolId] = useState("");
  const [teamCount, setTeamCount]   = useState(0);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<Tab>("points");

  // Points tab
  const [gameweeks, setGameweeks]   = useState<Gameweek[]>([]);
  const [selectedGwId, setSelectedGwId] = useState("");
  const [computing, setComputing]   = useState(false);
  const [computeError, setComputeError] = useState("");
  const [computeResult, setComputeResult] = useState<ComputeResult | null>(null);
  const [gwHistory, setGwHistory]   = useState<Record<string, number>>({}); // gwId → teamCount scored

  // Teams tab
  const [teams, setTeams]           = useState<FantasyTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamsSearch, setTeamsSearch] = useState("");

  // ── Init ──────────────────────────────────────────────────────────────────

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

  const loadPool = useCallback(async (poolId: string) => {
    const pool = pools.find((p) => p.id === poolId);
    if (!pool) return;

    const [{ count }, { data: gws }, { data: allMatches }] = await Promise.all([
      supabase.from("fantasy_teams").select("*", { count: "exact", head: true }).eq("fantasy_settings_id", poolId),
      supabase.from("gameweeks").select("id,number,round_name").eq("season_id", pool.season_id).order("number", { ascending: false }),
      supabase.from("matches").select("id,gameweek_id,status").eq("season_id", pool.season_id),
    ]);
    setTeamCount(count ?? 0);

    const gwList: Gameweek[] = (gws ?? []).map((g: any) => {
      const ms = (allMatches ?? []).filter((m: any) => m.gameweek_id === g.id);
      return { id: g.id, number: g.number, round_name: g.round_name, total: ms.length, completed: ms.filter((m: any) => m.status === "completed").length };
    });
    setGameweeks(gwList);
    if (gwList.length) setSelectedGwId(gwList[0].id);

    // Load scoring history (which GWs have been computed)
    const { data: scored } = await supabase.from("fantasy_gameweek_points")
      .select("gameweek_id").eq("fantasy_settings_id", poolId);
    const hist: Record<string, number> = {};
    (scored ?? []).forEach((r: any) => { hist[r.gameweek_id] = (hist[r.gameweek_id] ?? 0) + 1; });
    setGwHistory(hist);

    setComputeResult(null);
    setComputeError("");
  }, [pools]);

  useEffect(() => {
    if (selectedPoolId && pools.length) loadPool(selectedPoolId);
  }, [selectedPoolId, pools, loadPool]);

  // ── Teams tab ─────────────────────────────────────────────────────────────

  const loadTeams = useCallback(async () => {
    if (!selectedPoolId) return;
    setTeamsLoading(true);

    const pool = pools.find((p) => p.id === selectedPoolId);
    const latestGwId = gameweeks[0]?.id;

    // Get all fantasy teams
    const { data: rawTeams } = await supabase.from("fantasy_teams")
      .select("id,team_name,user_id,created_at").eq("fantasy_settings_id", selectedPoolId);

    if (!rawTeams?.length) { setTeams([]); setTeamsLoading(false); return; }

    const teamIds = rawTeams.map((t: any) => t.id);
    const userIds = rawTeams.map((t: any) => t.user_id);

    // Squad counts
    const { data: squadRows } = await supabase.from("fantasy_team_players")
      .select("fantasy_team_id").in("fantasy_team_id", teamIds);
    const squadCount: Record<string, number> = {};
    (squadRows ?? []).forEach((r: any) => { squadCount[r.fantasy_team_id] = (squadCount[r.fantasy_team_id] ?? 0) + 1; });

    // XI picked (gameweek squads)
    const { data: xiRows } = latestGwId ? await supabase.from("fantasy_gameweek_squads")
      .select("fantasy_team_id").eq("gameweek_id", latestGwId).in("fantasy_team_id", teamIds)
      : { data: [] };
    const xiTeams = new Set((xiRows ?? []).map((r: any) => r.fantasy_team_id));

    // Total points
    const { data: ptsRows } = await supabase.from("fantasy_gameweek_points")
      .select("fantasy_team_id,net_points").in("fantasy_team_id", teamIds);
    const totalPts: Record<string, number> = {};
    const gwPts: Record<string, number> = {};
    (ptsRows ?? []).forEach((r: any) => {
      totalPts[r.fantasy_team_id] = (totalPts[r.fantasy_team_id] ?? 0) + (r.net_points ?? 0);
    });
    // Latest GW points
    if (latestGwId) {
      const { data: latestPts } = await supabase.from("fantasy_gameweek_points")
        .select("fantasy_team_id,net_points").eq("gameweek_id", latestGwId).in("fantasy_team_id", teamIds);
      (latestPts ?? []).forEach((r: any) => { gwPts[r.fantasy_team_id] = r.net_points ?? 0; });
    }

    // Transfer counts
    const { data: transferRows } = await supabase.from("fantasy_transfers")
      .select("fantasy_team_id").in("fantasy_team_id", teamIds);
    const transferCount: Record<string, number> = {};
    (transferRows ?? []).forEach((r: any) => { transferCount[r.fantasy_team_id] = (transferCount[r.fantasy_team_id] ?? 0) + 1; });

    // Chip usage
    const { data: chipRows } = await supabase.from("fantasy_chip_usage")
      .select("fantasy_team_id,chip_type").in("fantasy_team_id", teamIds);
    const chipMap: Record<string, string[]> = {};
    (chipRows ?? []).forEach((r: any) => {
      if (!chipMap[r.fantasy_team_id]) chipMap[r.fantasy_team_id] = [];
      chipMap[r.fantasy_team_id].push(r.chip_type);
    });

    // User emails from fantasy_profiles
    const { data: profiles } = await supabase.from("fantasy_profiles")
      .select("user_id,display_name").in("user_id", userIds);
    const profileMap: Record<string, string> = {};
    (profiles ?? []).forEach((p: any) => { profileMap[p.user_id] = p.display_name; });

    const result: FantasyTeam[] = rawTeams.map((t: any) => ({
      id: t.id,
      team_name: t.team_name,
      user_id: t.user_id,
      email: profileMap[t.user_id] ?? null,
      squad_count: squadCount[t.id] ?? 0,
      xi_count: xiTeams.has(t.id) ? 1 : 0,
      total_pts: totalPts[t.id] ?? 0,
      gw_pts: gwPts[t.id] ?? null,
      transfers: transferCount[t.id] ?? 0,
      chips_used: chipMap[t.id] ?? [],
      created_at: t.created_at,
    })).sort((a, b) => b.total_pts - a.total_pts);

    setTeams(result);
    setTeamsLoading(false);
  }, [selectedPoolId, pools, gameweeks]);

  useEffect(() => {
    if (tab === "teams") loadTeams();
  }, [tab, loadTeams]);

  // ── Compute ───────────────────────────────────────────────────────────────

  async function runCompute() {
    if (!selectedGwId) return;
    setComputing(true); setComputeError(""); setComputeResult(null);
    try {
      const result = await computeGameweekPoints(selectedPoolId, selectedGwId);
      setComputeResult(result);
      await loadPool(selectedPoolId); // refresh history
    } catch (e: any) {
      setComputeError(e.message ?? "Something went wrong");
    }
    setComputing(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const pool = pools.find((p) => p.id === selectedPoolId);
  const filteredTeams = teams.filter((t) => {
    const q = teamsSearch.toLowerCase();
    return !q || t.team_name.toLowerCase().includes(q) || (t.email ?? "").toLowerCase().includes(q);
  });

  if (loading) return <div className="admin-subtitle">Loading…</div>;

  return (
    <div>
      <h1 className="admin-page-title mb-4">Fantasy</h1>

      {/* Pool selector */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {pools.map((p) => (
          <button key={p.id} onClick={() => { setSelectedPoolId(p.id); setComputeResult(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${p.id === selectedPoolId ? "admin-btn-primary" : "bg-[#0B3363]/5 text-[#0B3363]"}`}>
            {DIVISION_LABELS[p.seasons?.competitions?.sponsor_name ?? ""] ?? p.seasons?.competitions?.name}
          </button>
        ))}
      </div>

      {/* Pool stats */}
      {pool && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="admin-stat-card"><div className="admin-stat-label">Budget</div><div className="admin-stat-value">TSH {pool.budget}m</div></div>
          <div className="admin-stat-card"><div className="admin-stat-label">Squad</div><div className="admin-stat-value">{pool.starting_xi_size}+{pool.squad_size - pool.starting_xi_size}</div></div>
          <div className="admin-stat-card"><div className="admin-stat-label">Formation</div><div className="admin-stat-value text-lg">{pool.min_gk}-{pool.min_def}-{pool.min_mid}-{pool.min_fwd}</div></div>
          <div className="admin-stat-card"><div className="admin-stat-label">Managers</div><div className="admin-stat-value">{teamCount}</div></div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[#0B3363]/10 mb-5">
        {([
          { key: "points", label: "Gameweek Points" },
          { key: "scoring", label: "Scoring Rules" },
          { key: "teams", label: `Registered Teams${teamCount > 0 ? ` (${teamCount})` : ""}` },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === t.key ? "border-[#0B3363] text-[#0B3363] dark:border-[#3EA0D9] dark:text-white" : "border-transparent text-[#0B3363]/40 hover:text-[#0B3363]"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Gameweek Points ──────────────────────────────────────────── */}
      {tab === "points" && (
        <div className="space-y-5">
          <div className="admin-card p-5">
            <div className="flex items-end gap-3 flex-wrap mb-3">
              <div>
                <label className="admin-label">Match week</label>
                <select value={selectedGwId} onChange={(e) => { setSelectedGwId(e.target.value); setComputeResult(null); setComputeError(""); }} className="admin-select">
                  {gameweeks.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.round_name ?? `Match Week ${g.number}`}
                      {gwHistory[g.id] ? " ✓ scored" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <button onClick={runCompute} disabled={computing || !selectedGwId} className="admin-btn admin-btn-primary">
                {computing ? "Computing…" : gwHistory[selectedGwId] ? "Re-compute Points" : "Compute Points"}
              </button>
            </div>
            <p className="text-xs text-[#0B3363]/40 mb-4">
              Runs automatically when the last match in a gameweek is marked complete. Use <strong>Re-compute</strong> after correcting a score, event, or MOTM — safe to run any time.
            </p>
            {computeError && <div className="admin-alert admin-alert-error mb-3">{computeError}</div>}
            {computeResult && (
              <div>
                <div className="text-xs text-[#0B3363]/50 mb-2">
                  Scored {computeResult.playersScored} players across {computeResult.teamsScored} fantasy teams.
                </div>
                <div className="admin-card overflow-hidden">
                  <table className="admin-table">
                    <thead><tr><th>#</th><th>Manager</th><th className="text-right">GW Pts</th></tr></thead>
                    <tbody>
                      {computeResult.teamResults.map((t, i) => (
                        <tr key={t.teamId}>
                          <td className="text-[#0B3363]/40">{i + 1}</td>
                          <td>{t.teamName}</td>
                          <td className="text-right font-bold text-[#3EA0D9]">{t.points}</td>
                        </tr>
                      ))}
                      {computeResult.teamResults.length === 0 && (
                        <tr><td colSpan={3} className="admin-empty">No fantasy teams entered yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Scoring history */}
          {gameweeks.length > 0 && (
            <div className="admin-card overflow-hidden">
              <div className="px-4 py-3 border-b border-[#0B3363]/8"><h3 className="font-display font-bold text-sm">Scoring History</h3></div>
              <div className="divide-y divide-[#0B3363]/5">
                {gameweeks.map((g) => (
                  <div key={g.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-sm font-medium flex-1">{g.round_name ?? `Match Week ${g.number}`}</span>
                    <span className="text-xs text-[#0B3363]/40">{g.completed}/{g.total} matches</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${gwHistory[g.id] ? "bg-green-50 text-green-700" : "bg-[#0B3363]/5 text-[#0B3363]/30"}`}>
                      {gwHistory[g.id] ? `✓ Scored` : "Not scored"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Scoring Rules ───────────────────────────────────────────── */}
      {tab === "scoring" && (
        <div className="max-w-2xl">
          <p className="text-sm text-[#0B3363]/50 mb-4">
            Reference for how points are calculated. Currently fixed — editable scoring per pool coming in a future update.
          </p>
          <div className="admin-card overflow-hidden">
            <table className="admin-table">
              <thead><tr><th>Event</th><th className="text-center">GK</th><th className="text-center">DEF</th><th className="text-center">MID</th><th className="text-center">FWD</th></tr></thead>
              <tbody>
                {[
                  ["Appearance", "+1", "+1", "+1", "+1"],
                  ["Goal", "+10", "+6", "+5", "+4"],
                  ["Assist", "+3", "+3", "+3", "+3"],
                  ["Clean sheet", "+4", "+4", "—", "—"],
                  ["Every 3 goals conceded", "−3", "−3", "—", "—"],
                  ["Penalty save", "+5", "—", "—", "—"],
                  ["Penalty miss", "−2", "−2", "−2", "−2"],
                  ["Yellow card", "−1", "−1", "−1", "−1"],
                  ["Red card", "−2", "−2", "−2", "−2"],
                  ["Own goal", "−2", "−2", "−2", "−2"],
                  ["Man of the Match", "+3", "+3", "+3", "+3"],
                ].map(([event, gk, def, mid, fwd]) => (
                  <tr key={event}><td>{event}</td><td className="text-center">{gk}</td><td className="text-center">{def}</td><td className="text-center">{mid}</td><td className="text-center">{fwd}</td></tr>
                ))}
                <tr className="bg-[#F4B400]/5">
                  <td>Captain</td>
                  <td className="text-center" colSpan={4}>×2 points (×3 with Triple Captain chip)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 admin-card p-4">
            <div className="font-display font-bold text-sm mb-2">Chips</div>
            <div className="space-y-1.5 text-sm text-[#0B3363]/70">
              <div>🔺 <strong>Triple Captain</strong> — Captain scores 3× instead of 2×. Once per season.</div>
              <div>🔋 <strong>Bench Boost</strong> — All 4 bench players score this gameweek. Once per season.</div>
              <div>🔄 <strong>Free Hit</strong> — Unlimited transfers this week, squad reverts after. Once per season.</div>
              <div>🔁 <strong>Wildcard</strong> — Unlimited free transfers permanently. Once per half-season.</div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Registered Teams ────────────────────────────────────────── */}
      {tab === "teams" && (
        <div>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <input value={teamsSearch} onChange={(e) => setTeamsSearch(e.target.value)}
              placeholder="Search by team or manager name…"
              className="admin-input flex-1 min-w-[200px]" />
            <button onClick={loadTeams} className="admin-btn admin-btn-secondary text-sm">↺ Refresh</button>
            <span className="text-sm text-[#0B3363]/40">{filteredTeams.length} teams</span>
          </div>

          {teamsLoading ? (
            <div className="admin-card p-8 text-center text-sm text-[#0B3363]/30">Loading teams…</div>
          ) : filteredTeams.length === 0 ? (
            <div className="admin-card p-8 text-center text-sm text-[#0B3363]/30">
              {teamCount === 0 ? "No managers registered yet." : "No teams match your search."}
            </div>
          ) : (
            <div className="admin-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th className="text-left">#</th>
                      <th className="text-left">Team</th>
                      <th className="text-left">Manager</th>
                      <th className="text-center">Squad</th>
                      <th className="text-center">XI Set?</th>
                      <th className="text-center">Total Pts</th>
                      <th className="text-center">GW Pts</th>
                      <th className="text-center">Transfers</th>
                      <th className="text-center">Chips</th>
                      <th className="text-left">Registered</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTeams.map((t, i) => (
                      <tr key={t.id}>
                        <td className="text-[#0B3363]/30">{i + 1}</td>
                        <td className="font-semibold">{t.team_name}</td>
                        <td className="text-xs text-[#0B3363]/50">{t.email ?? t.user_id.slice(0, 8)}</td>
                        <td className="text-center">
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${t.squad_count >= 12 ? "bg-green-50 text-green-700" : t.squad_count > 0 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-500"}`}>
                            {t.squad_count}/12
                          </span>
                        </td>
                        <td className="text-center">
                          {t.xi_count > 0
                            ? <span className="text-green-600 font-bold text-sm">✓</span>
                            : <span className="text-[#0B3363]/20 text-sm">—</span>}
                        </td>
                        <td className="text-center font-bold text-[#3EA0D9]">{t.total_pts}</td>
                        <td className="text-center text-sm">{t.gw_pts ?? "—"}</td>
                        <td className="text-center text-sm">{t.transfers}</td>
                        <td className="text-center text-xs">
                          {t.chips_used.length === 0 ? <span className="text-[#0B3363]/20">None</span>
                            : t.chips_used.map((c) => (
                              <span key={c} className="inline-block bg-[#F4B400]/15 text-amber-700 px-1 py-0.5 rounded text-[10px] mr-0.5">{c}</span>
                            ))}
                        </td>
                        <td className="text-xs text-[#0B3363]/40">
                          {new Date(t.created_at).toLocaleDateString("en-GB", { day:"numeric", month:"short" })}
                        </td>
                        <td>
                          <Link href={`/fantasy/team/${selectedPoolId}/leaderboard/${t.id}`}
                            className="text-xs text-[#3EA0D9] hover:underline whitespace-nowrap">
                            View →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Summary row */}
          {filteredTeams.length > 0 && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="admin-stat-card">
                <div className="admin-stat-label">Squad complete</div>
                <div className="admin-stat-value">{filteredTeams.filter((t) => t.squad_count >= 12).length}/{filteredTeams.length}</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-label">XI submitted</div>
                <div className="admin-stat-value">{filteredTeams.filter((t) => t.xi_count > 0).length}/{filteredTeams.length}</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-label">Avg total pts</div>
                <div className="admin-stat-value">{filteredTeams.length > 0 ? Math.round(filteredTeams.reduce((s, t) => s + t.total_pts, 0) / filteredTeams.length) : 0}</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-label">Chips used</div>
                <div className="admin-stat-value">{filteredTeams.reduce((s, t) => s + t.chips_used.length, 0)}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
