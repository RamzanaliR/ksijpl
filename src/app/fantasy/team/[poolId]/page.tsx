"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

type Position = "GK" | "DEF" | "MID" | "FWD";
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
};
type Player = {
  id: string;
  full_name: string;
  nickname: string | null;
  position: Position;
  team_id: string;
  teamName: string;
  price: number;
};
type LineupEntry = { isStarting: boolean; benchOrder: number | null };
type SortMode = "price_desc" | "price_asc" | "name";

const POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD"];
const POSITION_LABELS: Record<Position, string> = { GK: "Goalkeeper", DEF: "Defenders", MID: "Midfielders", FWD: "Forwards" };

const FORMATIONS: Record<string, { DEF: number; MID: number; FWD: number }> = {
  "2-3-2": { DEF: 2, MID: 3, FWD: 2 },
  "3-2-2": { DEF: 3, MID: 2, FWD: 2 },
  "3-3-1": { DEF: 3, MID: 3, FWD: 1 },
};

export default function SquadBuilder() {
  const params = useParams();
  const router = useRouter();
  const poolId = params.poolId as string;

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [poolLabel, setPoolLabel] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [teamNameInput, setTeamNameInput] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lineup, setLineup] = useState<Record<string, LineupEntry>>({});
  const [captainId, setCaptainId] = useState<string>("");
  const [viceCaptainId, setViceCaptainId] = useState<string>("");
  const [formationKey, setFormationKey] = useState<string>("2-3-2");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<Position | "ALL">("ALL");
  const [sortMode, setSortMode] = useState<SortMode>("price_desc");

  useEffect(() => {
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.push("/fantasy/login");
        return;
      }
      setUserId(authData.user.id);

      const { data: settingsRow } = await supabase
        .from("fantasy_settings")
        .select("id,budget,squad_size,starting_xi_size,min_gk,min_def,min_mid,min_fwd,starting_gk_count,seasons(label,competitions(name,sponsor_name,division_id))")
        .eq("id", poolId)
        .maybeSingle();

      if (!settingsRow) {
        setLoading(false);
        return;
      }
      setSettings(settingsRow as any);
      const comp = (settingsRow as any).seasons?.competitions;
      setPoolLabel(`${comp?.name ?? "Fantasy"} — ${(settingsRow as any).seasons?.label ?? ""}`);

      const divisionId = comp?.division_id;
      const [{ data: teamsRaw }, { data: prices }] = await Promise.all([
        supabase.from("teams").select("id,name").eq("division_id", divisionId),
        supabase.from("fantasy_player_prices").select("player_id,price").eq("fantasy_settings_id", poolId),
      ]);
      const teamNameMap: Record<string, string> = {};
      (teamsRaw ?? []).forEach((t: any) => (teamNameMap[t.id] = t.name));
      const priceMap: Record<string, number> = {};
      (prices ?? []).forEach((p: any) => (priceMap[p.player_id] = Number(p.price)));

      const teamIds = (teamsRaw ?? []).map((t: any) => t.id);
      const { data: playersRaw } = await supabase
        .from("players")
        .select("id,full_name,nickname,position,team_id")
        .in("team_id", teamIds.length ? teamIds : ["00000000-0000-0000-0000-000000000000"])
        .not("position", "is", null);

      const playerList: Player[] = (playersRaw ?? [])
        .filter((p: any) => priceMap[p.id] !== undefined)
        .map((p: any) => ({
          id: p.id,
          full_name: p.full_name,
          nickname: p.nickname,
          position: p.position,
          team_id: p.team_id,
          teamName: teamNameMap[p.team_id] ?? "—",
          price: priceMap[p.id],
        }));
      setPlayers(playerList);

      const { data: existingTeam } = await supabase
        .from("fantasy_teams")
        .select("id,team_name")
        .eq("fantasy_settings_id", poolId)
        .eq("user_id", authData.user.id)
        .maybeSingle();

      if (existingTeam) {
        setTeamId(existingTeam.id);
        setTeamName(existingTeam.team_name);

        const { data: squadRows } = await supabase
          .from("fantasy_team_players")
          .select("player_id,is_starting,is_captain,is_vice_captain,bench_order")
          .eq("fantasy_team_id", existingTeam.id);

        if (squadRows && squadRows.length) {
          const sel = new Set<string>();
          const lu: Record<string, LineupEntry> = {};
          squadRows.forEach((r: any) => {
            sel.add(r.player_id);
            lu[r.player_id] = { isStarting: r.is_starting, benchOrder: r.bench_order };
            if (r.is_captain) setCaptainId(r.player_id);
            if (r.is_vice_captain) setViceCaptainId(r.player_id);
          });
          setSelected(sel);
          setLineup(lu);
        }
      }

      setLoading(false);
    })();
  }, [poolId, router]);

  const requiredByPosition: Record<Position, number> = useMemo(
    () => ({
      GK: settings?.min_gk ?? 2,
      DEF: settings?.min_def ?? 4,
      MID: settings?.min_mid ?? 4,
      FWD: settings?.min_fwd ?? 2,
    }),
    [settings]
  );

  const selectedPlayers = players.filter((p) => selected.has(p.id));
  const countByPos = (pos: Position) => selectedPlayers.filter((p) => p.position === pos).length;
  const spent = selectedPlayers.reduce((sum, p) => sum + p.price, 0);
  const budget = settings?.budget ?? 100;
  const remaining = Math.round((budget - spent) * 10) / 10;
  const squadFull = selected.size === (settings?.squad_size ?? 12);
  const squadComplete = squadFull && POSITIONS.every((pos) => countByPos(pos) === requiredByPosition[pos]);

  const startingCount = selectedPlayers.filter((p) => lineup[p.id]?.isStarting).length;
  const startingGkCount = selectedPlayers.filter((p) => p.position === "GK" && lineup[p.id]?.isStarting).length;
  const benchPlayers = selectedPlayers.filter((p) => !lineup[p.id]?.isStarting);
  const startingPlayers = selectedPlayers.filter((p) => lineup[p.id]?.isStarting);
  const lineupValid =
    squadComplete &&
    startingCount === (settings?.starting_xi_size ?? 8) &&
    startingGkCount === (settings?.starting_gk_count ?? 1) &&
    !!captainId &&
    !!viceCaptainId &&
    captainId !== viceCaptainId &&
    startingPlayers.some((p) => p.id === captainId) &&
    startingPlayers.some((p) => p.id === viceCaptainId);

  function addPlayer(p: Player) {
    setSaved(false);
    if (selected.has(p.id)) return;
    if (selected.size >= (settings?.squad_size ?? 12)) return;
    if (countByPos(p.position) >= requiredByPosition[p.position]) return;
    if (p.price > remaining) return;
    setSelected((prev) => new Set(prev).add(p.id));
    setLineup((lu) => ({ ...lu, [p.id]: { isStarting: false, benchOrder: null } }));
  }

  function removePlayer(p: Player) {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(p.id);
      return next;
    });
    setLineup((lu) => {
      const copy = { ...lu };
      delete copy[p.id];
      return copy;
    });
    if (captainId === p.id) setCaptainId("");
    if (viceCaptainId === p.id) setViceCaptainId("");
  }

  function togglePlayer(p: Player) {
    if (selected.has(p.id)) removePlayer(p);
    else addPlayer(p);
  }

  function autoPick() {
    setSaved(false);
    let remainingBudget = remaining;
    const nextSelected = new Set(selected);
    const nextLineup = { ...lineup };

    for (const pos of POSITIONS) {
      const need = requiredByPosition[pos] - countByPos(pos);
      if (need <= 0) continue;
      const candidates = players
        .filter((p) => p.position === pos && !nextSelected.has(p.id))
        .sort((a, b) => a.price - b.price);
      let filled = 0;
      for (const c of candidates) {
        if (filled >= need) break;
        if (c.price > remainingBudget) continue;
        nextSelected.add(c.id);
        nextLineup[c.id] = { isStarting: false, benchOrder: null };
        remainingBudget = Math.round((remainingBudget - c.price) * 10) / 10;
        filled++;
      }
    }
    setSelected(nextSelected);
    setLineup(nextLineup);
  }

  function toggleStarting(p: Player) {
    setSaved(false);
    setLineup((prev) => {
      const current = prev[p.id];
      if (!current) return prev;
      const next = { ...prev };

      if (!current.isStarting) {
        if (startingCount >= (settings?.starting_xi_size ?? 8)) return prev;
        if (p.position === "GK") {
          selectedPlayers.forEach((other) => {
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
    setFormationKey(key);
    const shape = FORMATIONS[key];
    if (!shape) return;
    const next: Record<string, LineupEntry> = {};
    let benchOrder = 1;

    // Exactly 1 GK starts — keep the current starting GK if there is one
    const gks = selectedPlayers.filter((p) => p.position === "GK");
    const currentStartGk = gks.find((p) => lineup[p.id]?.isStarting);
    const startGk = currentStartGk ?? gks[0];
    gks.forEach((p) => {
      next[p.id] = p.id === startGk?.id ? { isStarting: true, benchOrder: null } : { isStarting: false, benchOrder: benchOrder++ };
    });

    (["DEF", "MID", "FWD"] as const).forEach((pos) => {
      const group = selectedPlayers.filter((p) => p.position === pos).sort((a, b) => b.price - a.price);
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
    const ordered = [...benchPlayers].sort(
      (a, b) => (lineup[a.id]?.benchOrder ?? 99) - (lineup[b.id]?.benchOrder ?? 99)
    );
    const idx = ordered.findIndex((p) => p.id === playerId);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= ordered.length) return;
    const a = ordered[idx];
    const b = ordered[swapIdx];
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
    setCaptainId((prev) => (prev === playerId ? "" : playerId));
    if (viceCaptainId === playerId) setViceCaptainId("");
  }
  function setVice(playerId: string) {
    setViceCaptainId((prev) => (prev === playerId ? "" : playerId));
    if (captainId === playerId) setCaptainId("");
  }

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!teamNameInput.trim() || !userId) return;
    setCreatingTeam(true);
    const { data, error } = await supabase
      .from("fantasy_teams")
      .insert({ fantasy_settings_id: poolId, user_id: userId, team_name: teamNameInput.trim() })
      .select("id,team_name")
      .single();
    setCreatingTeam(false);
    if (error || !data) {
      alert(error?.message ?? "Could not create team");
      return;
    }
    setTeamId(data.id);
    setTeamName(data.team_name);
  }

  async function saveSquad() {
    if (!teamId || !lineupValid) return;
    setSaving(true);
    setError("");

    await supabase.from("fantasy_team_players").delete().eq("fantasy_team_id", teamId);

    const rows = selectedPlayers.map((p) => ({
      fantasy_team_id: teamId,
      player_id: p.id,
      is_starting: !!lineup[p.id]?.isStarting,
      is_captain: p.id === captainId,
      is_vice_captain: p.id === viceCaptainId,
      bench_order: lineup[p.id]?.isStarting ? null : lineup[p.id]?.benchOrder ?? null,
    }));

    const { error } = await supabase.from("fantasy_team_players").insert(rows);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
  }

  const filteredPlayers = players
    .filter((p) => (posFilter === "ALL" ? true : p.position === posFilter))
    .filter((p) => p.full_name.toLowerCase().includes(search.toLowerCase()) || (p.nickname ?? "").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortMode === "price_desc") return b.price - a.price;
      if (sortMode === "price_asc") return a.price - b.price;
      return a.full_name.localeCompare(b.full_name);
    });

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
        <SiteHeader active="fantasy" />
        <div className="flex-1 flex items-center justify-center text-sm opacity-50">Loading…</div>
        <SiteFooter />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
        <SiteHeader active="fantasy" />
        <div className="flex-1 flex items-center justify-center text-sm opacity-50">Fantasy pool not found.</div>
        <SiteFooter />
      </div>
    );
  }

  if (!teamId) {
    return (
      <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
        <SiteHeader active="fantasy" />
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-sm">
            <h1 className="font-display font-bold text-2xl mb-1">{poolLabel}</h1>
            <p className="text-[#0B3363]/60 dark:text-white/60 mb-6 text-sm">Name your fantasy team to get started.</p>
            <form onSubmit={createTeam} className="flex flex-col gap-3">
              <input
                value={teamNameInput}
                onChange={(e) => setTeamNameInput(e.target.value)}
                placeholder="e.g. Ramzi's XI"
                required
                className="border border-[#0B3363]/15 dark:border-white/15 dark:bg-white/5 rounded-lg px-3 py-2.5 text-sm"
              />
              <button disabled={creatingTeam} className="py-2.5 rounded-lg bg-[#0B3363] text-white dark:bg-[#3EA0D9] font-semibold text-sm disabled:opacity-50">
                {creatingTeam ? "Creating…" : "Create Team"}
              </button>
            </form>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  // Build fixed-shape slots for the Squad Selection pitch: filled ones show the player, empty ones show a placeholder
  function buildSlots(pos: Position) {
    const count = requiredByPosition[pos];
    const filled = selectedPlayers.filter((p) => p.position === pos);
    const slots: (Player | null)[] = [];
    for (let i = 0; i < count; i++) slots.push(filled[i] ?? null);
    return slots;
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
      <SiteHeader active="fantasy" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        <div className="mb-4">
          <div className="text-xs font-bold uppercase tracking-wider text-[#3EA0D9]">{poolLabel}</div>
          <h1 className="font-display font-bold text-2xl">{teamName}</h1>
        </div>

        <div className="grid lg:grid-cols-[340px_1fr] gap-6">
          {/* Left: Player Selection */}
          <section>
            <h2 className="font-display font-bold text-base mb-1">Player Selection</h2>
            <p className="text-xs text-[#0B3363]/40 dark:text-white/40 mb-3">Select players to fill your squad. Max budget £{budget}m.</p>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name"
              className="w-full border border-[#0B3363]/15 dark:border-white/15 dark:bg-white/5 rounded-lg px-3 py-2 text-sm mb-2"
            />
            <div className="flex gap-2 mb-2">
              <select value={posFilter} onChange={(e) => setPosFilter(e.target.value as any)} className="flex-1 border border-[#0B3363]/15 dark:border-white/15 dark:bg-white/5 rounded-lg px-2 py-1.5 text-xs">
                <option value="ALL">All positions</option>
                {POSITIONS.map((pos) => (<option key={pos} value={pos}>{POSITION_LABELS[pos]}</option>))}
              </select>
              <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} className="flex-1 border border-[#0B3363]/15 dark:border-white/15 dark:bg-white/5 rounded-lg px-2 py-1.5 text-xs">
                <option value="price_desc">Price: high–low</option>
                <option value="price_asc">Price: low–high</option>
                <option value="name">Name</option>
              </select>
            </div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs bg-[#3EA0D9]/15 text-[#3EA0D9] font-semibold px-2.5 py-1 rounded-lg">{filteredPlayers.length} players shown</div>
              <button onClick={() => { setSelected(new Set()); setLineup({}); setCaptainId(""); setViceCaptainId(""); }} className="text-xs text-red-600 hover:underline">
                Reset
              </button>
            </div>

            <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 max-h-[560px] overflow-y-auto divide-y divide-[#0B3363]/5 dark:divide-white/5">
              {filteredPlayers.map((p) => {
                const isSel = selected.has(p.id);
                const disabled =
                  !isSel &&
                  (selected.size >= settings.squad_size ||
                    countByPos(p.position) >= requiredByPosition[p.position] ||
                    p.price > remaining);
                return (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{p.nickname || p.full_name}</div>
                      <div className="text-xs text-[#0B3363]/40 dark:text-white/40 truncate">{p.position} · {p.teamName}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-display font-bold text-xs">£{p.price.toFixed(1)}</span>
                      <button
                        onClick={() => togglePlayer(p)}
                        disabled={disabled}
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                          isSel
                            ? "bg-[#0B3363] text-white dark:bg-[#3EA0D9]"
                            : disabled
                            ? "bg-[#0B3363]/5 dark:bg-white/5 text-[#0B3363]/20 dark:text-white/20"
                            : "bg-[#3EA0D9]/15 text-[#3EA0D9] hover:bg-[#3EA0D9]/25"
                        }`}
                      >
                        {isSel ? "✓" : "+"}
                      </button>
                    </div>
                  </div>
                );
              })}
              {filteredPlayers.length === 0 && <div className="p-4 text-center text-xs text-[#0B3363]/40 dark:text-white/40">No players match.</div>}
            </div>
          </section>

          {/* Right: Squad Selection */}
          <section>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="font-display font-bold text-base">Squad Selection</h2>
              <div className="flex items-center gap-3">
                <div className={`text-sm font-bold px-3 py-1.5 rounded-lg ${selected.size === settings.squad_size ? "bg-green-500/15 text-green-700 dark:text-green-400" : "bg-[#0B3363]/5 dark:bg-white/10"}`}>
                  {selected.size}/{settings.squad_size} selected
                </div>
                <div className={`text-sm font-bold px-3 py-1.5 rounded-lg ${remaining < 0 ? "bg-red-500/15 text-red-600" : "bg-[#F4B400]/20"}`}>
                  £{remaining.toFixed(1)}m bank
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <button onClick={autoPick} disabled={squadFull} className="admin-btn admin-btn-gold text-xs sm:text-sm">
                Auto Pick
              </button>
              <span className="text-xs text-[#0B3363]/40 dark:text-white/40">Fills any empty slots within budget.</span>
            </div>

            {/* Fixed-shape pitch: 2 GK / 4 DEF / 4 MID / 2 FWD, "+" placeholders for empty slots */}
            <div className="rounded-2xl p-4 sm:p-6 mb-6" style={{ background: "linear-gradient(180deg, #2f8f4e 0%, #1f6b39 100%)" }}>
              <div className="flex flex-col gap-4">
                {POSITIONS.map((pos) => (
                  <div key={pos} className="flex justify-center gap-3 flex-wrap">
                    {buildSlots(pos).map((p, i) => (
                      <div key={p?.id ?? `${pos}-empty-${i}`} className="w-20 sm:w-24 text-center">
                        {p ? (
                          <button
                            onClick={() => removePlayer(p)}
                            className="w-full bg-white/95 hover:bg-white rounded-xl p-2 transition-colors"
                          >
                            <div className="text-[9px] font-bold text-[#3EA0D9] uppercase">{p.position}</div>
                            <div className="text-[11px] font-semibold text-[#0B3363] truncate">{p.nickname || p.full_name}</div>
                            <div className="text-[10px] text-[#0B3363]/50">£{p.price.toFixed(1)}</div>
                          </button>
                        ) : (
                          <button
                            onClick={() => setPosFilter(pos)}
                            className="w-full bg-black/10 hover:bg-black/15 rounded-xl p-3 flex flex-col items-center gap-1 transition-colors"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 5v14M5 12h14" />
                              <circle cx="12" cy="12" r="10" opacity="0" />
                            </svg>
                            <span className="text-[10px] font-bold text-white uppercase">{pos}</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {!squadComplete ? (
              <p className="text-xs text-[#0B3363]/40 dark:text-white/40">
                Fill all {settings.squad_size} slots within budget to move on to picking your starting {settings.starting_xi_size}.
              </p>
            ) : (
              <>
                {/* Step 2: Pick Team */}
                <div className="border-t border-[#0B3363]/10 dark:border-white/10 pt-6">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <h2 className="font-display font-bold text-base">Step 2 — Pick Team</h2>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-[#0B3363]/50 dark:text-white/50">Formation</label>
                      <select
                        value={formationKey}
                        onChange={(e) => applyFormation(e.target.value)}
                        className="border border-[#0B3363]/15 dark:border-white/15 dark:bg-white/5 rounded-lg px-2 py-1.5 text-xs font-semibold"
                      >
                        {Object.keys(FORMATIONS).map((k) => (<option key={k} value={k}>{k}</option>))}
                      </select>
                    </div>
                  </div>
                  <p className="text-xs text-[#0B3363]/40 dark:text-white/40 mb-3">
                    Pick a formation as a shortcut, then tap any player on the pitch or bench to move them — {settings.starting_gk_count} GK must always start.
                  </p>

                  <div className="rounded-2xl p-4 sm:p-6 mb-4" style={{ background: "linear-gradient(180deg, #2f8f4e 0%, #1f6b39 100%)" }}>
                    <div className="flex flex-col gap-4">
                      {POSITIONS.map((pos) => {
                        const rowPlayers = startingPlayers.filter((p) => p.position === pos);
                        if (rowPlayers.length === 0) return null;
                        return (
                          <div key={pos} className="flex justify-center gap-3 flex-wrap">
                            {rowPlayers.map((p) => (
                              <div key={p.id} className="w-24 sm:w-28 text-center">
                                <button onClick={() => toggleStarting(p)} className="w-full bg-white/95 rounded-xl p-2 hover:bg-white transition-colors relative">
                                  {captainId === p.id && <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#F4B400] text-[#0B3363] text-[10px] font-bold flex items-center justify-center">C</span>}
                                  {viceCaptainId === p.id && <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#3EA0D9] text-white text-[10px] font-bold flex items-center justify-center">V</span>}
                                  <div className="text-[10px] font-bold text-[#3EA0D9] uppercase">{p.position}</div>
                                  <div className="text-xs font-semibold text-[#0B3363] truncate">{p.nickname || p.full_name}</div>
                                  <div className="text-[10px] text-[#0B3363]/50">£{p.price.toFixed(1)}</div>
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
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {[...benchPlayers]
                        .sort((a, b) => (lineup[a.id]?.benchOrder ?? 99) - (lineup[b.id]?.benchOrder ?? 99))
                        .map((p, i, arr) => (
                          <div key={p.id} className="w-28 flex-shrink-0 text-center">
                            <button
                              onClick={() => toggleStarting(p)}
                              disabled={startingCount >= settings.starting_xi_size}
                              className="w-full rounded-xl p-2 border border-[#0B3363]/10 dark:border-white/10 hover:border-[#3EA0D9]/50 transition-colors disabled:opacity-50"
                            >
                              <div className="text-[10px] font-bold text-[#0B3363]/40 dark:text-white/40 uppercase">Sub {i + 1} · {p.position}</div>
                              <div className="text-xs font-semibold truncate">{p.nickname || p.full_name}</div>
                              <div className="text-[10px] text-[#0B3363]/40 dark:text-white/40">£{p.price.toFixed(1)}</div>
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
                </div>

                {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 mt-4">{error}</div>}
                {saved && <div className="rounded-lg bg-green-50 text-green-700 text-sm px-3 py-2 mt-4">Squad saved!</div>}

                <button
                  onClick={saveSquad}
                  disabled={!lineupValid || saving}
                  className="w-full mt-4 py-2.5 rounded-lg bg-[#0B3363] text-white dark:bg-[#3EA0D9] font-semibold text-sm disabled:opacity-40"
                >
                  {saving ? "Saving…" : "Save Squad"}
                </button>
                {!lineupValid && (
                  <p className="text-xs text-[#0B3363]/40 dark:text-white/40 mt-2">
                    Set exactly {settings.starting_xi_size} starters (with {settings.starting_gk_count} GK) and choose a captain (C) + vice-captain (V) to save.
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
