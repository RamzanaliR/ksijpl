"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

type Position = "GK" | "DEF" | "MID" | "FWD";
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
};
type Player = {
  id: string;
  full_name: string;
  position: Position;
  team_id: string;
  teamName: string;
  price: number;
};
type SortMode = "price_desc" | "price_asc" | "name";

const POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD"];
const POSITION_LABELS: Record<Position, string> = { GK: "Goalkeeper", DEF: "Defenders", MID: "Midfielders", FWD: "Forwards" };

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
  const [continuing, setContinuing] = useState(false);

  const [upcomingFixtures, setUpcomingFixtures] = useState<any[]>([]);
  const [upcomingGwNumber, setUpcomingGwNumber] = useState<number | null>(null);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [teamSlugs, setTeamSlugs] = useState<Record<string, string | null>>({});

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
        .select("id,season_id,budget,squad_size,starting_xi_size,min_gk,min_def,min_mid,min_fwd,starting_gk_count,seasons(label,competitions(name,sponsor_name,division_id))")
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
        supabase.from("teams").select("id,name,slug").eq("division_id", divisionId),
        supabase.from("fantasy_player_prices").select("player_id,price").eq("fantasy_settings_id", poolId),
      ]);
      const teamNameMap: Record<string, string> = {};
      const teamSlugMap: Record<string, string | null> = {};
      (teamsRaw ?? []).forEach((t: any) => {
        teamNameMap[t.id] = t.name;
        teamSlugMap[t.id] = t.slug;
      });
      setTeamNames(teamNameMap);
      setTeamSlugs(teamSlugMap);
      const priceMap: Record<string, number> = {};
      (prices ?? []).forEach((p: any) => (priceMap[p.player_id] = Number(p.price)));

      const seasonId = (settingsRow as any).season_id;
      const { data: gws } = await supabase.from("gameweeks").select("id,number").eq("season_id", seasonId).order("number");
      const { data: allMatches } = await supabase
        .from("matches")
        .select("id,gameweek_id,home_team_id,away_team_id,kickoff_at,venue,status")
        .eq("season_id", seasonId)
        .in("status", ["scheduled", "live"])
        .order("kickoff_at", { ascending: true });
      const nextGw = (gws ?? []).find((g: any) => (allMatches ?? []).some((m: any) => m.gameweek_id === g.id));
      if (nextGw) {
        setUpcomingGwNumber(nextGw.number);
        setUpcomingFixtures((allMatches ?? []).filter((m: any) => m.gameweek_id === nextGw.id));
      }

      const teamIds = (teamsRaw ?? []).map((t: any) => t.id);
      const { data: playersRaw } = await supabase
        .from("players")
        .select("id,full_name,position,team_id")
        .in("team_id", teamIds.length ? teamIds : ["00000000-0000-0000-0000-000000000000"])
        .not("position", "is", null);

      const playerList: Player[] = (playersRaw ?? [])
        .filter((p: any) => priceMap[p.id] !== undefined)
        .map((p: any) => ({
          id: p.id,
          full_name: p.full_name,
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
          .select("player_id")
          .eq("fantasy_team_id", existingTeam.id);

        if (squadRows && squadRows.length) {
          setSelected(new Set(squadRows.map((r: any) => r.player_id)));
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

  function addPlayer(p: Player) {
    if (selected.has(p.id)) return;
    if (selected.size >= (settings?.squad_size ?? 12)) return;
    if (countByPos(p.position) >= requiredByPosition[p.position]) return;
    if (p.price > remaining) return;
    setSelected((prev) => new Set(prev).add(p.id));
  }

  function removePlayer(p: Player) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(p.id);
      return next;
    });
  }

  function togglePlayer(p: Player) {
    if (selected.has(p.id)) removePlayer(p);
    else addPlayer(p);
  }

  function autoPick() {
    let remainingBudget = remaining;
    const nextSelected = new Set(selected);
    for (const pos of POSITIONS) {
      const need = requiredByPosition[pos] - countByPos(pos);
      if (need <= 0) continue;
      const candidates = players.filter((p) => p.position === pos && !nextSelected.has(p.id)).sort((a, b) => a.price - b.price);
      let filled = 0;
      for (const c of candidates) {
        if (filled >= need) break;
        if (c.price > remainingBudget) continue;
        nextSelected.add(c.id);
        remainingBudget = Math.round((remainingBudget - c.price) * 10) / 10;
        filled++;
      }
    }
    setSelected(nextSelected);
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

  async function continueToPickTeam() {
    if (!teamId || !squadComplete) return;
    setContinuing(true);
    await supabase.from("fantasy_team_players").delete().eq("fantasy_team_id", teamId);
    const rows = [...selected].map((playerId) => ({
      fantasy_team_id: teamId,
      player_id: playerId,
      is_starting: false,
      is_captain: false,
      is_vice_captain: false,
      bench_order: null,
    }));
    const { error } = await supabase.from("fantasy_team_players").insert(rows);
    setContinuing(false);
    if (error) {
      alert(error.message);
      return;
    }
    router.push(`/fantasy/team/${poolId}/pick-team`);
  }

  const filteredPlayers = players
    .filter((p) => (posFilter === "ALL" ? true : p.position === posFilter))
    .filter((p) => p.full_name.toLowerCase().includes(search.toLowerCase()))
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

        {upcomingFixtures.length > 0 && (
          <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display font-bold text-sm">Match Week {upcomingGwNumber} Fixtures</h2>
              <span className="text-[10px] text-[#0B3363]/40 dark:text-white/40">Use this to guide your picks</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 min-w-0 w-full">
              {upcomingFixtures.map((m) => (
                <div key={m.id} className="rounded-xl bg-[#0B3363]/5 dark:bg-white/5 px-3 py-2 text-xs">
                  <div className="font-semibold flex items-center gap-1 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      {teamSlugs[m.home_team_id] && (
                        <img src={`/sponsors/${teamSlugs[m.home_team_id]}.png`} alt="" className="w-4 h-4 object-contain rounded bg-white border border-[#0B3363]/10" />
                      )}
                      {teamNames[m.home_team_id] ?? "—"}
                    </span>
                    <span className="text-[#0B3363]/40 dark:text-white/40 font-normal">vs</span>
                    <span className="inline-flex items-center gap-1">
                      {teamSlugs[m.away_team_id] && (
                        <img src={`/sponsors/${teamSlugs[m.away_team_id]}.png`} alt="" className="w-4 h-4 object-contain rounded bg-white border border-[#0B3363]/10" />
                      )}
                      {teamNames[m.away_team_id] ?? "—"}
                    </span>
                  </div>
                  <div className="text-[#0B3363]/40 dark:text-white/40 mt-0.5">
                    {m.status === "live" ? "● Live now" : m.kickoff_at ? new Date(m.kickoff_at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Time TBD"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-[340px_1fr] gap-6 min-w-0">
          {/* Left: Player Selection */}
          <section className="min-w-0">
            <h2 className="font-display font-bold text-base mb-1">Player Selection</h2>
            <p className="text-xs text-[#0B3363]/40 dark:text-white/40 mb-3">Select players to fill your squad. Max budget TSH {budget}m.</p>
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
              <button onClick={() => setSelected(new Set())} className="text-xs text-red-600 hover:underline">Reset</button>
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
                  <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm bg-white dark:bg-white/5">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-[#0B3363] dark:text-white">{p.full_name}</div>
                      <div className="text-xs text-[#0B3363]/40 dark:text-white/40 truncate">{p.position} · {p.teamName}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-display font-bold text-xs">TSH {p.price.toFixed(1)}m</span>
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
          <section className="min-w-0">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="font-display font-bold text-base">Squad Selection</h2>
              <div className="flex items-center gap-3">
                <div className={`text-sm font-bold px-3 py-1.5 rounded-lg ${selected.size === settings.squad_size ? "bg-green-500/15 text-green-700 dark:text-green-400" : "bg-[#0B3363]/5 dark:bg-white/10"}`}>
                  {selected.size}/{settings.squad_size} selected
                </div>
                <div className={`text-sm font-bold px-3 py-1.5 rounded-lg ${remaining < 0 ? "bg-red-500/15 text-red-600" : "bg-[#F4B400]/20"}`}>
                  TSH {remaining.toFixed(1)}m bank
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <button onClick={autoPick} disabled={squadFull} className="admin-btn admin-btn-gold text-xs sm:text-sm">Auto Pick</button>
              <span className="text-xs text-[#0B3363]/40 dark:text-white/40">Fills any empty slots within budget.</span>
            </div>

            <div className="rounded-2xl p-4 sm:p-6 mb-4" style={{ background: "linear-gradient(180deg, #2f8f4e 0%, #1f6b39 100%)" }}>
              <div className="flex flex-col gap-4">
                {POSITIONS.map((pos) => (
                  <div key={pos} className="flex justify-center gap-3 flex-wrap">
                    {buildSlots(pos).map((p, i) => (
                      <div key={p?.id ?? `${pos}-empty-${i}`} className="w-20 sm:w-24 text-center">
                        {p ? (
                          <button onClick={() => removePlayer(p)} className="w-full bg-white hover:bg-white rounded-xl p-2 transition-colors shadow-sm">
                            <div className="text-[9px] font-bold text-[#3EA0D9] uppercase">{p.position}</div>
                            <div className="text-[11px] font-semibold text-[#0B3363] truncate">{p.full_name}</div>
                            <div className="text-[10px] text-[#0B3363]/50">TSH {p.price.toFixed(1)}m</div>
                          </button>
                        ) : (
                          <button onClick={() => setPosFilter(pos)} className="w-full bg-black/10 hover:bg-black/15 rounded-xl p-3 flex flex-col items-center gap-1 transition-colors">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
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
              <button
                onClick={continueToPickTeam}
                disabled={continuing}
                className="w-full py-2.5 rounded-lg bg-[#0B3363] text-white dark:bg-[#3EA0D9] font-semibold text-sm disabled:opacity-40"
              >
                {continuing ? "Saving…" : "Continue to Pick Team →"}
              </button>
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
