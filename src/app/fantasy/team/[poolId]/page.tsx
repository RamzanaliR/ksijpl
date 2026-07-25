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

const POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD"];
const POSITION_LABELS: Record<Position, string> = { GK: "Goalkeepers", DEF: "Defenders", MID: "Midfielders", FWD: "Forwards" };

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

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

      // Existing team + squad, if any
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

  function togglePlayer(p: Player) {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p.id)) {
        next.delete(p.id);
        setLineup((lu) => {
          const copy = { ...lu };
          delete copy[p.id];
          return copy;
        });
        if (captainId === p.id) setCaptainId("");
        if (viceCaptainId === p.id) setViceCaptainId("");
      } else {
        if (next.size >= (settings?.squad_size ?? 12)) return prev;
        if (countByPos(p.position) >= requiredByPosition[p.position]) return prev;
        if (p.price > remaining) return prev;
        next.add(p.id);
        setLineup((lu) => ({ ...lu, [p.id]: { isStarting: false, benchOrder: null } }));
      }
      return next;
    });
  }

  function toggleStarting(p: Player) {
    setSaved(false);
    setLineup((prev) => {
      const current = prev[p.id];
      if (!current) return prev;
      const next = { ...prev };

      if (!current.isStarting) {
        // Turning ON: if GK and one already starting, bench that other GK first
        if (p.position === "GK") {
          selectedPlayers.forEach((other) => {
            if (other.position === "GK" && other.id !== p.id && next[other.id]?.isStarting) {
              next[other.id] = { isStarting: false, benchOrder: null };
            }
          });
        }
        next[p.id] = { isStarting: true, benchOrder: null };
      } else {
        next[p.id] = { isStarting: false, benchOrder: null };
      }
      return next;
    });
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

  // Assign default bench order whenever the bench set changes and orders are missing
  useEffect(() => {
    const missing = benchPlayers.filter((p) => lineup[p.id]?.benchOrder == null);
    if (missing.length === 0) return;
    setLineup((prev) => {
      const next = { ...prev };
      let nextOrder = benchPlayers.filter((p) => next[p.id]?.benchOrder != null).length + 1;
      missing.forEach((p) => {
        next[p.id] = { ...next[p.id], benchOrder: nextOrder };
        nextOrder++;
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [benchPlayers.map((p) => p.id).join(",")]);

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

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
      <SiteHeader active="fantasy" />
      <main className="max-w-5xl mx-auto px-6 py-8 flex-1 w-full">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#3EA0D9]">{poolLabel}</div>
            <h1 className="font-display font-bold text-2xl">{teamName}</h1>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="text-right">
              <div className="text-[10px] uppercase text-[#0B3363]/40 dark:text-white/40">Budget left</div>
              <div className={`font-display font-bold ${remaining < 0 ? "text-red-600" : ""}`}>£{remaining.toFixed(1)}m</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase text-[#0B3363]/40 dark:text-white/40">Squad</div>
              <div className="font-display font-bold">{selected.size}/{settings.squad_size}</div>
            </div>
          </div>
        </div>

        {/* Position counters */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {POSITIONS.map((pos) => (
            <span
              key={pos}
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                countByPos(pos) === requiredByPosition[pos] ? "bg-green-500/15 text-green-700 dark:text-green-400" : "bg-[#0B3363]/5 dark:bg-white/10"
              }`}
            >
              {pos} {countByPos(pos)}/{requiredByPosition[pos]}
            </span>
          ))}
        </div>

        {!squadComplete ? (
          <div className="space-y-8">
            {POSITIONS.map((pos) => (
              <section key={pos}>
                <h2 className="font-display font-bold text-sm mb-3">{POSITION_LABELS[pos]}</h2>
                <div className="grid sm:grid-cols-2 gap-2">
                  {players
                    .filter((p) => p.position === pos)
                    .sort((a, b) => b.price - a.price)
                    .map((p) => {
                      const isSel = selected.has(p.id);
                      const disabled =
                        !isSel &&
                        (selected.size >= settings.squad_size ||
                          countByPos(pos) >= requiredByPosition[pos] ||
                          p.price > remaining);
                      return (
                        <button
                          key={p.id}
                          onClick={() => togglePlayer(p)}
                          disabled={disabled}
                          className={`flex items-center justify-between text-sm px-3 py-2 rounded-lg border transition-colors text-left ${
                            isSel
                              ? "border-[#3EA0D9] bg-[#3EA0D9]/10"
                              : disabled
                              ? "border-[#0B3363]/5 dark:border-white/5 opacity-40"
                              : "border-[#0B3363]/10 dark:border-white/10 hover:border-[#3EA0D9]/50"
                          }`}
                        >
                          <span className="truncate">
                            {p.full_name}
                            <span className="text-[#0B3363]/40 dark:text-white/40"> · {p.teamName}</span>
                          </span>
                          <span className="font-display font-bold flex-shrink-0 ml-2">£{p.price.toFixed(1)}</span>
                        </button>
                      );
                    })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-8">
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-bold text-sm">
                  Starting {settings.starting_xi_size} ({startingCount}/{settings.starting_xi_size})
                </h2>
                <button onClick={() => setSelected(new Set())} className="text-xs text-red-600 hover:underline">Reset squad</button>
              </div>
              <p className="text-xs text-[#0B3363]/40 dark:text-white/40 mb-3">
                Exactly {settings.starting_gk_count} goalkeeper must start. Tap a player to move them between Starting and Bench.
              </p>
              <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 divide-y divide-[#0B3363]/5 dark:divide-white/5">
                {selectedPlayers.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="truncate">
                      <span className="text-[10px] font-bold text-[#3EA0D9] mr-2">{p.position}</span>
                      {p.nickname || p.full_name}
                    </span>
                    <button
                      onClick={() => toggleStarting(p)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
                        lineup[p.id]?.isStarting ? "bg-green-500/15 text-green-700 dark:text-green-400" : "bg-[#0B3363]/5 dark:bg-white/10"
                      }`}
                    >
                      {lineup[p.id]?.isStarting ? "Starting" : "Bench"}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex flex-col gap-6">
              <section>
                <h2 className="font-display font-bold text-sm mb-3">Captain &amp; Vice-Captain</h2>
                <div className="flex flex-col gap-2">
                  <div>
                    <label className="text-xs text-[#0B3363]/50 dark:text-white/50 block mb-1">Captain (2x points)</label>
                    <select value={captainId} onChange={(e) => setCaptainId(e.target.value)} className="w-full border border-[#0B3363]/15 dark:border-white/15 dark:bg-white/5 rounded-lg px-3 py-2 text-sm">
                      <option value="">Select…</option>
                      {startingPlayers.map((p) => (
                        <option key={p.id} value={p.id}>{p.nickname || p.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#0B3363]/50 dark:text-white/50 block mb-1">Vice-Captain</label>
                    <select value={viceCaptainId} onChange={(e) => setViceCaptainId(e.target.value)} className="w-full border border-[#0B3363]/15 dark:border-white/15 dark:bg-white/5 rounded-lg px-3 py-2 text-sm">
                      <option value="">Select…</option>
                      {startingPlayers.filter((p) => p.id !== captainId).map((p) => (
                        <option key={p.id} value={p.id}>{p.nickname || p.full_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="font-display font-bold text-sm mb-3">Bench Priority</h2>
                <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 divide-y divide-[#0B3363]/5 dark:divide-white/5">
                  {[...benchPlayers]
                    .sort((a, b) => (lineup[a.id]?.benchOrder ?? 99) - (lineup[b.id]?.benchOrder ?? 99))
                    .map((p, i, arr) => (
                      <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <span className="truncate">
                          <span className="text-[10px] font-bold text-[#0B3363]/40 dark:text-white/40 mr-2">Sub {i + 1}</span>
                          {p.nickname || p.full_name}
                        </span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => moveBench(p.id, -1)} disabled={i === 0} className="w-6 h-6 flex items-center justify-center disabled:opacity-20">↑</button>
                          <button onClick={() => moveBench(p.id, 1)} disabled={i === arr.length - 1} className="w-6 h-6 flex items-center justify-center disabled:opacity-20">↓</button>
                        </div>
                      </div>
                    ))}
                </div>
              </section>

              {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
              {saved && <div className="rounded-lg bg-green-50 text-green-700 text-sm px-3 py-2">Squad saved!</div>}

              <button
                onClick={saveSquad}
                disabled={!lineupValid || saving}
                className="py-2.5 rounded-lg bg-[#0B3363] text-white dark:bg-[#3EA0D9] font-semibold text-sm disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save Squad"}
              </button>
              {!lineupValid && (
                <p className="text-xs text-[#0B3363]/40 dark:text-white/40 -mt-3">
                  Set exactly {settings.starting_xi_size} starters (with {settings.starting_gk_count} GK) and pick a captain + vice-captain to save.
                </p>
              )}
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
