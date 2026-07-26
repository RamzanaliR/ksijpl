"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

type Position = "GK" | "DEF" | "MID" | "FWD";
type Settings = { id: string; squad_size: number; starting_xi_size: number; starting_gk_count: number };
type Player = { id: string; full_name: string; position: Position; price: number };
type LineupEntry = { isStarting: boolean; benchOrder: number | null };

const POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD"];
const FORMATIONS: Record<string, { DEF: number; MID: number; FWD: number }> = {
  "2-3-2": { DEF: 2, MID: 3, FWD: 2 },
  "3-2-2": { DEF: 3, MID: 2, FWD: 2 },
  "3-3-1": { DEF: 3, MID: 3, FWD: 1 },
};

export default function PickTeam() {
  const params = useParams();
  const router = useRouter();
  const poolId = params.poolId as string;

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [poolLabel, setPoolLabel] = useState("");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [squadPlayers, setSquadPlayers] = useState<Player[]>([]);
  const [lineup, setLineup] = useState<Record<string, LineupEntry>>({});
  const [captainId, setCaptainId] = useState("");
  const [viceCaptainId, setViceCaptainId] = useState("");
  const [formationKey, setFormationKey] = useState("2-3-2");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.push("/fantasy/login");
        return;
      }

      const { data: settingsRow } = await supabase
        .from("fantasy_settings")
        .select("id,squad_size,starting_xi_size,starting_gk_count,seasons(label,competitions(name))")
        .eq("id", poolId)
        .maybeSingle();
      if (!settingsRow) {
        setLoading(false);
        return;
      }
      setSettings(settingsRow as any);
      setPoolLabel(`${(settingsRow as any).seasons?.competitions?.name ?? "Fantasy"} — ${(settingsRow as any).seasons?.label ?? ""}`);

      const { data: team } = await supabase
        .from("fantasy_teams")
        .select("id,team_name")
        .eq("fantasy_settings_id", poolId)
        .eq("user_id", authData.user.id)
        .maybeSingle();

      if (!team) {
        router.push(`/fantasy/team/${poolId}`);
        return;
      }
      setTeamId(team.id);
      setTeamName(team.team_name);

      const { data: squadRows } = await supabase
        .from("fantasy_team_players")
        .select("player_id,is_starting,is_captain,is_vice_captain,bench_order,players(id,full_name,position)")
        .eq("fantasy_team_id", team.id);

      if (!squadRows || squadRows.length < (settingsRow as any).squad_size) {
        router.push(`/fantasy/team/${poolId}`);
        return;
      }

      const priceMap: Record<string, number> = {};
      const { data: prices } = await supabase.from("fantasy_player_prices").select("player_id,price").eq("fantasy_settings_id", poolId);
      (prices ?? []).forEach((p: any) => (priceMap[p.player_id] = Number(p.price)));

      const pls: Player[] = squadRows.map((r: any) => ({
        id: r.players.id,
        full_name: r.players.full_name,
        position: r.players.position,
        price: priceMap[r.players.id] ?? 0,
      }));
      setSquadPlayers(pls);

      const lu: Record<string, LineupEntry> = {};
      squadRows.forEach((r: any) => {
        lu[r.player_id] = { isStarting: r.is_starting, benchOrder: r.bench_order };
        if (r.is_captain) setCaptainId(r.player_id);
        if (r.is_vice_captain) setViceCaptainId(r.player_id);
      });
      setLineup(lu);

      setLoading(false);
    })();
  }, [poolId, router]);

  const startingCount = squadPlayers.filter((p) => lineup[p.id]?.isStarting).length;
  const startingGkCount = squadPlayers.filter((p) => p.position === "GK" && lineup[p.id]?.isStarting).length;
  const benchPlayers = squadPlayers.filter((p) => !lineup[p.id]?.isStarting);
  const startingPlayers = squadPlayers.filter((p) => lineup[p.id]?.isStarting);

  const lineupValid =
    settings &&
    startingCount === settings.starting_xi_size &&
    startingGkCount === settings.starting_gk_count &&
    !!captainId &&
    !!viceCaptainId &&
    captainId !== viceCaptainId &&
    startingPlayers.some((p) => p.id === captainId) &&
    startingPlayers.some((p) => p.id === viceCaptainId);

  function toggleStarting(p: Player) {
    setSaved(false);
    setLineup((prev) => {
      const current = prev[p.id];
      if (!current) return prev;
      const next = { ...prev };
      if (!current.isStarting) {
        if (startingCount >= (settings?.starting_xi_size ?? 8)) return prev;
        if (p.position === "GK") {
          squadPlayers.forEach((other) => {
            if (other.position === "GK" && other.id !== p.id && next[other.id]?.isStarting) {
              next[other.id] = { isStarting: false, benchOrder: 99 };
            }
          });
        }
        next[p.id] = { isStarting: true, benchOrder: null };
      } else {
        next[p.id] = { isStarting: false, benchOrder: 99 };
        if (captainId === p.id) setCaptainId("");
        if (viceCaptainId === p.id) setViceCaptainId("");
      }
      return next;
    });
  }

  function applyFormation(key: string) {
    setSaved(false);
    setFormationKey(key);
    const shape = FORMATIONS[key];
    if (!shape) return;
    const next: Record<string, LineupEntry> = {};
    let benchOrder = 1;

    const gks = squadPlayers.filter((p) => p.position === "GK");
    const currentStartGk = gks.find((p) => lineup[p.id]?.isStarting);
    const startGk = currentStartGk ?? gks[0];
    gks.forEach((p) => {
      next[p.id] = p.id === startGk?.id ? { isStarting: true, benchOrder: null } : { isStarting: false, benchOrder: benchOrder++ };
    });

    (["DEF", "MID", "FWD"] as const).forEach((pos) => {
      const group = squadPlayers.filter((p) => p.position === pos).sort((a, b) => b.price - a.price);
      const count = shape[pos];
      group.forEach((p, i) => {
        next[p.id] = i < count ? { isStarting: true, benchOrder: null } : { isStarting: false, benchOrder: benchOrder++ };
      });
    });

    setLineup(next);
    if (captainId && !next[captainId]?.isStarting) setCaptainId("");
    if (viceCaptainId && !next[viceCaptainId]?.isStarting) setViceCaptainId("");
  }

  function moveBench(playerId: string, direction: -1 | 1) {
    const ordered = [...benchPlayers].sort((a, b) => (lineup[a.id]?.benchOrder ?? 99) - (lineup[b.id]?.benchOrder ?? 99));
    const idx = ordered.findIndex((p) => p.id === playerId);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= ordered.length) return;
    const a = ordered[idx];
    const b = ordered[swapIdx];
    setSaved(false);
    setLineup((prev) => ({
      ...prev,
      [a.id]: { ...prev[a.id], benchOrder: swapIdx + 1 },
      [b.id]: { ...prev[b.id], benchOrder: idx + 1 },
    }));
  }

  useEffect(() => {
    const missing = benchPlayers.filter((p) => lineup[p.id]?.benchOrder == null || lineup[p.id]?.benchOrder === 99);
    if (missing.length === 0) return;
    setLineup((prev) => {
      const next = { ...prev };
      let nextOrder = benchPlayers.filter((p) => next[p.id]?.benchOrder != null && next[p.id]?.benchOrder !== 99).length + 1;
      missing.forEach((p) => {
        next[p.id] = { ...next[p.id], benchOrder: nextOrder };
        nextOrder++;
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [benchPlayers.map((p) => p.id).join(",")]);

  function setCaptain(playerId: string) {
    setSaved(false);
    setCaptainId((prev) => (prev === playerId ? "" : playerId));
    if (viceCaptainId === playerId) setViceCaptainId("");
  }
  function setVice(playerId: string) {
    setSaved(false);
    setViceCaptainId((prev) => (prev === playerId ? "" : playerId));
    if (captainId === playerId) setCaptainId("");
  }

  async function saveSquad() {
    if (!teamId || !lineupValid) return;
    setSaving(true);
    setError("");
    for (const p of squadPlayers) {
      const { error } = await supabase
        .from("fantasy_team_players")
        .update({
          is_starting: !!lineup[p.id]?.isStarting,
          is_captain: p.id === captainId,
          is_vice_captain: p.id === viceCaptainId,
          bench_order: lineup[p.id]?.isStarting ? null : lineup[p.id]?.benchOrder ?? null,
        })
        .eq("fantasy_team_id", teamId)
        .eq("player_id", p.id);
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setSaved(true);
  }

  if (loading || !settings) {
    return (
      <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
        <SiteHeader active="fantasy" />
        <div className="flex-1 flex items-center justify-center text-sm opacity-50">Loading…</div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
      <SiteHeader active="fantasy" />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#3EA0D9]">{poolLabel}</div>
            <h1 className="font-display font-bold text-2xl">{teamName}</h1>
          </div>
          <a href={`/fantasy/team/${poolId}`} className="text-sm font-semibold text-[#3EA0D9] hover:underline">← Edit Squad</a>
        </div>

        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-display font-bold text-base">Pick Team</h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#0B3363]/50 dark:text-white/50">Formation</label>
            <select value={formationKey} onChange={(e) => applyFormation(e.target.value)} className="border border-[#0B3363]/15 dark:border-white/15 dark:bg-white/5 rounded-lg px-2 py-1.5 text-xs font-semibold">
              {Object.keys(FORMATIONS).map((k) => (<option key={k} value={k}>{k}</option>))}
            </select>
          </div>
        </div>
        <p className="text-xs text-[#0B3363]/40 dark:text-white/40 mb-3">
          Pick a formation as a shortcut, then tap any player on the pitch or bench to move them — {settings.starting_gk_count} GK must always start.
        </p>

        <div className="rounded-2xl p-4 sm:p-6 mb-4 min-w-0" style={{ background: "linear-gradient(180deg, #2f8f4e 0%, #1f6b39 100%)" }}>
          <div className="flex flex-col gap-4">
            {POSITIONS.map((pos) => {
              const rowPlayers = startingPlayers.filter((p) => p.position === pos);
              if (rowPlayers.length === 0) return null;
              return (
                <div key={pos} className="flex justify-center gap-3 flex-wrap">
                  {rowPlayers.map((p) => (
                    <div key={p.id} className="w-24 sm:w-28 text-center">
                      <button onClick={() => toggleStarting(p)} className="w-full bg-white rounded-xl p-2 hover:bg-white transition-colors relative shadow-sm">
                        {captainId === p.id && <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#F4B400] text-[#0B3363] text-[10px] font-bold flex items-center justify-center">C</span>}
                        {viceCaptainId === p.id && <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#3EA0D9] text-white text-[10px] font-bold flex items-center justify-center">V</span>}
                        <div className="text-[10px] font-bold text-[#3EA0D9] uppercase">{p.position}</div>
                        <div className="text-xs font-semibold text-[#0B3363] truncate">{p.full_name}</div>
                        <div className="text-[10px] text-[#0B3363]/50">TSH {p.price.toFixed(1)}m</div>
                      </button>
                      <div className="flex justify-center gap-1 mt-1">
                        <button onClick={() => setCaptain(p.id)} className={`text-[10px] font-bold w-5 h-5 rounded-full ${captainId === p.id ? "bg-[#F4B400] text-[#0B3363]" : "bg-white/20 text-white"}`}>C</button>
                        <button onClick={() => setVice(p.id)} className={`text-[10px] font-bold w-5 h-5 rounded-full ${viceCaptainId === p.id ? "bg-[#3EA0D9] text-white" : "bg-white/20 text-white"}`}>V</button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
            {startingPlayers.length === 0 && (
              <div className="text-center text-white/70 text-sm py-10">Pick a formation above, or tap bench players below to build your starting {settings.starting_xi_size}.</div>
            )}
          </div>
        </div>

        <div>
          <h3 className="font-display font-bold text-sm mb-2">Bench ({benchPlayers.length}/{settings.squad_size - settings.starting_xi_size})</h3>
          <div className="flex gap-3 overflow-x-auto pb-2 min-w-0 w-full">
            {[...benchPlayers]
              .sort((a, b) => (lineup[a.id]?.benchOrder ?? 99) - (lineup[b.id]?.benchOrder ?? 99))
              .map((p, i, arr) => (
                <div key={p.id} className="w-28 flex-shrink-0 text-center">
                  <button
                    onClick={() => toggleStarting(p)}
                    disabled={startingCount >= settings.starting_xi_size}
                    className="w-full rounded-xl p-2 bg-white border border-[#0B3363]/10 hover:border-[#3EA0D9]/50 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    <div className="text-[10px] font-bold text-[#0B3363]/40 uppercase">Sub {i + 1} · {p.position}</div>
                    <div className="text-xs font-semibold truncate text-[#0B3363]">{p.full_name}</div>
                    <div className="text-[10px] text-[#0B3363]/40">TSH {p.price.toFixed(1)}m</div>
                  </button>
                  <div className="flex justify-center gap-1 mt-1">
                    <button onClick={() => moveBench(p.id, -1)} disabled={i === 0} className="w-6 h-6 text-xs disabled:opacity-20">↑</button>
                    <button onClick={() => moveBench(p.id, 1)} disabled={i === arr.length - 1} className="w-6 h-6 text-xs disabled:opacity-20">↓</button>
                  </div>
                </div>
              ))}
            {benchPlayers.length === 0 && <div className="text-xs text-[#0B3363]/40 dark:text-white/40 py-4">No bench players yet.</div>}
          </div>
        </div>

        {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 mt-4">{error}</div>}
        {saved && <div className="rounded-lg bg-green-50 text-green-700 text-sm px-3 py-2 mt-4">Squad saved!</div>}

        <button onClick={saveSquad} disabled={!lineupValid || saving} className="w-full mt-4 py-2.5 rounded-lg bg-[#0B3363] text-white dark:bg-[#3EA0D9] font-semibold text-sm disabled:opacity-40">
          {saving ? "Saving…" : "Save Squad"}
        </button>
        {!lineupValid && (
          <p className="text-xs text-[#0B3363]/40 dark:text-white/40 mt-2">
            Set exactly {settings.starting_xi_size} starters (with {settings.starting_gk_count} GK) and choose a captain (C) + vice-captain (V) to save.
          </p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
