"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import PitchBackground from "@/components/PitchBackground";

// ─── Types ───────────────────────────────────────────────────────────────────

type Division = "seniors" | "juniors";
type Position = "GK" | "DEF" | "MID" | "FWD";

type Formation = { label: string; def: number; mid: number; fwd: number };

type Player = {
  id: string;
  full_name: string;
  fpl_name: string | null;
  position: Position;
  team_id: string;
  teamSlug: string | null;
  teamName: string;
  goals: number;
  assists: number;
  motm: number;
  score: number;
};

type SlotKey =
  | "gk"
  | "def_1" | "def_2" | "def_3" | "def_4"
  | "mid_1" | "mid_2" | "mid_3" | "mid_4"
  | "fwd_1" | "fwd_2" | "fwd_3";

type Gameweek = { id: string; number: number; label: string };

// ─── Constants ───────────────────────────────────────────────────────────────

const SENIORS_COMPETITION_ID = "e0eee160-729a-4cbd-a29a-20d36115db31";
const JUNIORS_COMPETITION_ID = "544019cb-0615-4b38-b9b8-03e71dfe1706";

const FORMATIONS: Record<string, Formation> = {
  "2-3-2": { label: "2-3-2", def: 2, mid: 3, fwd: 2 },
  "3-3-1": { label: "3-3-1", def: 3, mid: 3, fwd: 1 },
  "2-4-1": { label: "2-4-1", def: 2, mid: 4, fwd: 1 },
  "3-2-2": { label: "3-2-2", def: 3, mid: 2, fwd: 2 },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getActiveSlots(formation: string): SlotKey[] {
  const f = FORMATIONS[formation] ?? FORMATIONS["2-3-2"];
  const slots: SlotKey[] = ["gk"];
  for (let i = 1; i <= f.def; i++) slots.push(`def_${i}` as SlotKey);
  for (let i = 1; i <= f.mid; i++) slots.push(`mid_${i}` as SlotKey);
  for (let i = 1; i <= f.fwd; i++) slots.push(`fwd_${i}` as SlotKey);
  return slots;
}

function slotPosition(slot: SlotKey): Position {
  if (slot === "gk") return "GK";
  if (slot.startsWith("def")) return "DEF";
  if (slot.startsWith("mid")) return "MID";
  return "FWD";
}

function slotLabel(slot: SlotKey): string {
  if (slot === "gk") return "GK";
  const [pos, n] = slot.split("_");
  return `${pos.toUpperCase()} ${n}`;
}

function displayName(p: Player | { fpl_name: string | null; full_name: string }) {
  return p.fpl_name || p.full_name;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TOTWAdminPage() {
  const [division, setDivision] = useState<Division>("seniors");
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [selectedGw, setSelectedGw] = useState<string>("");
  const [formation, setFormation] = useState("2-3-2");
  const [selectorName, setSelectorName] = useState("Ramzi Rajani");

  const [slots, setSlots] = useState<Partial<Record<SlotKey, string>>>({});
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerMap, setPlayerMap] = useState<Record<string, Player>>({});

  const [pickingSlot, setPickingSlot] = useState<SlotKey | null>(null);
  const [search, setSearch] = useState("");

  const [savedId, setSavedId] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Pitch scaling
  // ─── Load gameweeks ──────────────────────────────────────────────────────

  const loadGameweeks = useCallback(async (div: Division) => {
    const compId = div === "seniors" ? SENIORS_COMPETITION_ID : JUNIORS_COMPETITION_ID;
    const { data: seasons } = await supabase.from("seasons").select("id").eq("competition_id", compId);
    if (!seasons?.length) return;
    const { data: gws } = await supabase
      .from("gameweeks").select("id,number,round_name")
      .in("season_id", seasons.map((s: any) => s.id))
      .order("number", { ascending: false });
    const mapped = (gws ?? []).map((g: any) => ({
      id: g.id, number: g.number,
      label: g.round_name ?? `Match Week ${g.number}`,
    }));
    setGameweeks(mapped);
    if (mapped.length) setSelectedGw(mapped[0].id);
  }, []);

  useEffect(() => { loadGameweeks(division); }, [division, loadGameweeks]);

  // ─── Load players + stats ────────────────────────────────────────────────

  const loadPlayersAndStats = useCallback(async () => {
    if (!selectedGw) return;
    const { data: matches } = await supabase
      .from("matches").select("id,home_motm_player_id,away_motm_player_id")
      .eq("gameweek_id", selectedGw);
    const matchIds = (matches ?? []).map((m: any) => m.id);
    const { data: events } = await supabase
      .from("match_events").select("player_id,type")
      .in("match_id", matchIds.length ? matchIds : ["00000000-0000-0000-0000-000000000000"]);

    const stats: Record<string, { goals: number; assists: number; motm: number }> = {};
    const bump = (pid: string, key: "goals" | "assists" | "motm") => {
      if (!pid) return;
      if (!stats[pid]) stats[pid] = { goals: 0, assists: 0, motm: 0 };
      stats[pid][key]++;
    };
    (events ?? []).forEach((e: any) => {
      if (e.type === "goal") bump(e.player_id, "goals");
      if (e.type === "assist") bump(e.player_id, "assists");
    });
    (matches ?? []).forEach((m: any) => {
      if (m.home_motm_player_id) bump(m.home_motm_player_id, "motm");
      if (m.away_motm_player_id) bump(m.away_motm_player_id, "motm");
    });

    const compId = division === "seniors" ? SENIORS_COMPETITION_ID : JUNIORS_COMPETITION_ID;
    const { data: seasons } = await supabase.from("seasons").select("id").eq("competition_id", compId);
    const seasonIds = (seasons ?? []).map((s: any) => s.id);
    const { data: seasonTeams } = await supabase
      .from("season_teams").select("team_id")
      .in("season_id", seasonIds.length ? seasonIds : ["00000000-0000-0000-0000-000000000000"]);
    const teamIds = [...new Set((seasonTeams ?? []).map((st: any) => st.team_id))];

    const { data: rawPlayers } = await supabase
      .from("players").select("id,full_name,fpl_name,position,team_id,teams(name,slug)")
      .in("team_id", teamIds.length ? teamIds : ["00000000-0000-0000-0000-000000000000"])
      .order("full_name");

    const mapped: Player[] = (rawPlayers ?? []).map((p: any) => {
      const s = stats[p.id] ?? { goals: 0, assists: 0, motm: 0 };
      return {
        id: p.id,
        full_name: p.full_name,
        fpl_name: p.fpl_name,
        position: p.position,
        team_id: p.team_id,
        teamSlug: p.teams?.slug ?? null,
        teamName: p.teams?.name ?? "",
        goals: s.goals, assists: s.assists, motm: s.motm,
        score: s.goals * 3 + s.assists * 2 + s.motm * 4,
      };
    });
    setPlayers(mapped);
    setPlayerMap(Object.fromEntries(mapped.map((p) => [p.id, p])));
  }, [selectedGw, division]);

  // ─── Load existing record ────────────────────────────────────────────────

  const loadExisting = useCallback(async () => {
    if (!selectedGw) return;
    const { data } = await supabase
      .from("team_of_week").select("*")
      .eq("gameweek_id", selectedGw).eq("division", division).maybeSingle();
    if (data) {
      setSavedId(data.id);
      setFormation(data.formation);
      setSelectorName(data.selector_name);
      setPublished(data.published);
      const restored: Partial<Record<SlotKey, string>> = {};
      const allSlots: SlotKey[] = ["gk","def_1","def_2","def_3","def_4","mid_1","mid_2","mid_3","mid_4","fwd_1","fwd_2","fwd_3"];
      for (const s of allSlots) { if (data[`${s}_player_id`]) restored[s] = data[`${s}_player_id`]; }
      setSlots(restored);
    } else {
      setSavedId(null); setPublished(false); setSlots({});
    }
  }, [selectedGw, division]);

  useEffect(() => {
    loadPlayersAndStats();
    loadExisting();
    setPickingSlot(null);
    setSearch("");
  }, [selectedGw, division, loadPlayersAndStats, loadExisting]);

  // ─── Auto-suggest ────────────────────────────────────────────────────────

  function autoFill() {
    const f = FORMATIONS[formation];
    const byPos = (pos: Position, count: number) =>
      [...players].filter((p) => p.position === pos).sort((a, b) => b.score - a.score).slice(0, count).map((p) => p.id);
    const newSlots: Partial<Record<SlotKey, string>> = {};
    const gks = byPos("GK", 1); if (gks[0]) newSlots["gk"] = gks[0];
    byPos("DEF", f.def).forEach((id, i) => { newSlots[`def_${i+1}` as SlotKey] = id; });
    byPos("MID", f.mid).forEach((id, i) => { newSlots[`mid_${i+1}` as SlotKey] = id; });
    byPos("FWD", f.fwd).forEach((id, i) => { newSlots[`fwd_${i+1}` as SlotKey] = id; });
    setSlots(newSlots);
  }

  // ─── Save / Publish ──────────────────────────────────────────────────────

  async function save(publish: boolean) {
    if (!selectedGw) return;
    setSaving(true); setSaveMsg("");
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = { gameweek_id: selectedGw, division, formation, selector_name: selectorName, published: publish, updated_at: new Date().toISOString() };
    const allSlots: SlotKey[] = ["gk","def_1","def_2","def_3","def_4","mid_1","mid_2","mid_3","mid_4","fwd_1","fwd_2","fwd_3"];
    for (const s of allSlots) { payload[`${s}_player_id`] = slots[s] ?? null; }
    let error;
    if (savedId) {
      ({ error } = await supabase.from("team_of_week").update(payload).eq("id", savedId));
    } else {
      payload.created_by = user?.id;
      const { data, error: insertErr } = await supabase.from("team_of_week").insert(payload).select("id").single();
      if (data) setSavedId(data.id);
      error = insertErr;
    }
    setSaving(false);
    if (error) { setSaveMsg(`Error: ${error.message}`); }
    else { setPublished(publish); setSaveMsg(publish ? "Published!" : "Saved as draft."); setTimeout(() => setSaveMsg(""), 3000); }
  }

  // ─── Derived ─────────────────────────────────────────────────────────────

  const activeSlots = getActiveSlots(formation);
  const usedIds = new Set(Object.values(slots).filter(Boolean));
  const selectedGwLabel = gameweeks.find((g) => g.id === selectedGw)?.label ?? "";
  const pickingPos = pickingSlot ? slotPosition(pickingSlot) : null;
  const filteredPlayers = players
    .filter((p) => !pickingPos || p.position === pickingPos)
    .filter((p) => { const q = search.toLowerCase(); return !q || p.full_name.toLowerCase().includes(q) || (p.fpl_name ?? "").toLowerCase().includes(q) || p.teamName.toLowerCase().includes(q); })
    .sort((a, b) => b.score - a.score);
  const filledCount = activeSlots.filter((s) => slots[s]).length;
  const totalCount  = activeSlots.length;
  const allFilled   = filledCount === totalCount;
  const f = FORMATIONS[formation];

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h1 className="admin-page-title mb-0.5">Team of the Week</h1>
        <p className="admin-subtitle">Select and publish the TOTW for each match week.</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex gap-1 p-1 bg-[#0B3363]/5 rounded-xl">
          {(["seniors","juniors"] as Division[]).map((d) => (
            <button key={d} onClick={() => setDivision(d)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${division === d ? "bg-[#0B3363] text-white" : "text-[#0B3363]/60 hover:text-[#0B3363]"}`}>
              {d === "seniors" ? "goFiber PL" : "Care & Cure PL"}
            </button>
          ))}
        </div>
        <div>
          <label className="admin-label">Match Week</label>
          <select value={selectedGw} onChange={(e) => setSelectedGw(e.target.value)} className="admin-select w-44">
            {gameweeks.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
          </select>
        </div>
        <div>
          <label className="admin-label">Formation</label>
          <select value={formation} onChange={(e) => { setFormation(e.target.value); setSlots({}); }} className="admin-select w-32">
            {Object.keys(FORMATIONS).map((fm) => <option key={fm} value={fm}>{fm}</option>)}
          </select>
        </div>
        <div>
          <label className="admin-label">Selector name</label>
          <input value={selectorName} onChange={(e) => setSelectorName(e.target.value)} className="admin-input w-44" placeholder="e.g. Ramzi Rajani" />
        </div>
      </div>

      {/* Main 2-col grid */}
      <div className="grid lg:grid-cols-[360px_1fr] gap-6 items-start">

        {/* Left: Player picker */}
        <div className="admin-card overflow-hidden">
          <div className="p-4 border-b border-[#0B3363]/8 flex items-center justify-between">
            <div>
              <h2 className="font-display font-bold text-sm">
                {pickingSlot ? `Picking: ${slotLabel(pickingSlot)} (${pickingPos})` : "Player Selection"}
              </h2>
              {!pickingSlot && <p className="text-xs text-[#0B3363]/40 mt-0.5">Click a jersey on the pitch to pick</p>}
            </div>
            {pickingSlot && (
              <button onClick={() => { setPickingSlot(null); setSearch(""); }} className="text-xs text-[#0B3363]/40 hover:text-[#0B3363]">✕ Cancel</button>
            )}
          </div>
          <div className="px-4 py-2 border-b border-[#0B3363]/5 flex items-center justify-between">
            <button onClick={autoFill} className="admin-btn admin-btn-gold text-xs">✨ Auto-suggest</button>
            <span className="text-xs text-[#0B3363]/40">{filledCount}/{totalCount} filled</span>
          </div>
          <div className="px-4 py-2 border-b border-[#0B3363]/5">
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={pickingSlot ? `Search ${pickingPos} players…` : "Search players…"}
              className="w-full border border-[#0B3363]/15 rounded-lg px-3 py-1.5 text-xs" />
          </div>
          <div className="max-h-[500px] overflow-y-auto divide-y divide-[#0B3363]/5">
            {filteredPlayers.map((p) => {
              const isUsed = usedIds.has(p.id);
              const isPicked = pickingSlot && slots[pickingSlot] === p.id;
              return (
                <button key={p.id}
                  disabled={!pickingSlot || (isUsed && !isPicked)}
                  onClick={() => {
                    if (!pickingSlot) return;
                    setSlots((prev) => ({ ...prev, [pickingSlot]: p.id }));
                    setPickingSlot(null); setSearch("");
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                    ${isPicked ? "bg-[#F4B400]/10" : ""}
                    ${isUsed && !isPicked ? "opacity-40 cursor-not-allowed" : ""}
                    ${!pickingSlot ? "cursor-default" : !isUsed ? "hover:bg-[#0B3363]/5 cursor-pointer" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate">{displayName(p)}</div>
                    <div className="text-[10px] text-[#0B3363]/40 truncate">{p.teamName} · {p.position}</div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 text-[10px]">
                    {p.goals > 0 && <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full font-bold">⚽{p.goals}</span>}
                    {p.assists > 0 && <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">🅰️{p.assists}</span>}
                    {p.motm > 0 && <span className="bg-[#F4B400]/15 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">⭐{p.motm}</span>}
                  </div>
                </button>
              );
            })}
            {filteredPlayers.length === 0 && <div className="p-6 text-center text-xs text-[#0B3363]/30">No players match.</div>}
          </div>
        </div>

        {/* Right: Pitch + actions */}
        <div className="space-y-4">
          <div className="admin-card p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <h2 className="font-display font-bold text-sm">{selectorName}'s {selectedGwLabel} TOTW</h2>
                <p className="text-xs text-[#0B3363]/40">{formation} · {division === "seniors" ? "goFiber PL" : "Care & Cure PL"}</p>
              </div>
              {published && <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">Published</span>}
            </div>

            {/* Fluid pitch — fills container, cards shrink proportionally */}
            <PitchBackground>
              <div className="flex flex-col gap-3">
                {/* FWD */}
                {f.fwd > 0 && (
                  <div className="flex justify-center gap-2 sm:gap-4">
                    {activeSlots.filter((s) => s.startsWith("fwd")).map((slot) => (
                      <TOTWJerseySlot key={slot} slot={slot} playerId={slots[slot]} playerMap={playerMap}
                        isActive={pickingSlot === slot}
                        onPick={() => { setPickingSlot(slot); setSearch(""); }}
                        onRemove={() => setSlots((p) => { const n = {...p}; delete n[slot]; return n; })} />
                    ))}
                  </div>
                )}
                {/* MID */}
                {f.mid > 0 && (
                  <div className="flex justify-center gap-2 sm:gap-4">
                    {activeSlots.filter((s) => s.startsWith("mid")).map((slot) => (
                      <TOTWJerseySlot key={slot} slot={slot} playerId={slots[slot]} playerMap={playerMap}
                        isActive={pickingSlot === slot}
                        onPick={() => { setPickingSlot(slot); setSearch(""); }}
                        onRemove={() => setSlots((p) => { const n = {...p}; delete n[slot]; return n; })} />
                    ))}
                  </div>
                )}
                {/* DEF */}
                {f.def > 0 && (
                  <div className="flex justify-center gap-2 sm:gap-4">
                    {activeSlots.filter((s) => s.startsWith("def")).map((slot) => (
                      <TOTWJerseySlot key={slot} slot={slot} playerId={slots[slot]} playerMap={playerMap}
                        isActive={pickingSlot === slot}
                        onPick={() => { setPickingSlot(slot); setSearch(""); }}
                        onRemove={() => setSlots((p) => { const n = {...p}; delete n[slot]; return n; })} />
                    ))}
                  </div>
                )}
                {/* GK */}
                <div className="flex justify-center">
                  <TOTWJerseySlot slot="gk" playerId={slots["gk"]} playerMap={playerMap}
                    isActive={pickingSlot === "gk"}
                    onPick={() => { setPickingSlot("gk"); setSearch(""); }}
                    onRemove={() => setSlots((p) => { const n = {...p}; delete n["gk"]; return n; })} />
                </div>
              </div>
            </PitchBackground>

            {/* Actions */}
            <div className="flex gap-2 mt-4 flex-wrap items-center">
              <button onClick={() => save(false)} disabled={saving || filledCount === 0} className="admin-btn admin-btn-secondary text-xs">
                {saving ? "Saving…" : "Save draft"}
              </button>
              <button onClick={() => save(true)} disabled={saving || !allFilled} className="admin-btn admin-btn-primary text-xs">
                {saving ? "Publishing…" : `Publish${!allFilled ? ` (${filledCount}/${totalCount})` : " ✓"}`}
              </button>
              <button onClick={() => setSlots({})} disabled={filledCount === 0} className="admin-btn text-xs border border-red-100 text-red-400 hover:bg-red-50 disabled:opacity-30">
                Clear
              </button>
              {savedId && published && (
                <button onClick={() => save(false)} disabled={saving} className="admin-btn text-xs border border-amber-200 text-amber-700">Unpublish</button>
              )}
              {saveMsg && <span className={`text-xs font-semibold ${saveMsg.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>{saveMsg}</span>}
            </div>
          </div>

          {/* Top performers */}
          {players.some((p) => p.score > 0) && (
            <div className="admin-card p-4">
              <h3 className="font-display font-bold text-xs mb-3 text-[#0B3363]/50 uppercase tracking-wide">Top performers this week</h3>
              <div className="space-y-1.5">
                {players.filter((p) => p.score > 0).slice(0, 8).map((p) => (
                  <div key={p.id} className="flex items-center gap-2 text-xs">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#0B3363]/5 text-[#0B3363]/50 w-8 text-center">{p.position}</span>
                    <span className="font-medium truncate flex-1">{displayName(p)}</span>
                    <span className="text-[#0B3363]/40 text-[10px] hidden sm:block truncate">{p.teamName}</span>
                    <div className="flex gap-1 flex-shrink-0 text-[10px]">
                      {p.goals > 0 && <span className="text-green-600 font-bold">⚽{p.goals}</span>}
                      {p.assists > 0 && <span className="text-blue-600 font-bold">🅰️{p.assists}</span>}
                      {p.motm > 0 && <span className="text-amber-600 font-bold">⭐{p.motm}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Jersey Mini ─────────────────────────────────────────────────────────────

function JerseyMini({ teamSlug, isGk }: { teamSlug: string | null; isGk: boolean }) {
  const [fmt, setFmt] = useState<"png"|"svg"|"placeholder">(teamSlug ? "png" : "placeholder");
  const base = teamSlug ? `/jerseys/${teamSlug}${isGk ? "-gk-home" : "-home"}` : null;
  const src  = fmt === "placeholder" ? "/jerseys/placeholder.png" : `${base}.${fmt}`;
  return (
    <img
      src={src}
      alt=""
      className="w-8 h-8 sm:w-9 sm:h-9 object-contain"
      onError={() => {
        if (fmt === "png") setFmt("svg");
        else if (fmt === "svg") setFmt("placeholder");
      }}
    />
  );
}

// ─── TOTW Jersey Slot ─────────────────────────────────────────────────────────

function TOTWJerseySlot({ slot, playerId, playerMap, isActive, onPick, onRemove }: {
  slot: SlotKey;
  playerId?: string;
  playerMap: Record<string, Player>;
  isActive: boolean;
  onPick: () => void;
  onRemove: () => void;
}) {
  const player = playerId ? playerMap[playerId] : null;

  const name = player ? displayName(player) : null;
  const shortName = name ? name.split(" ").slice(-1)[0].slice(0, 8) : null;

  if (player) {
    return (
      <button
        onClick={onRemove}
        className={`relative flex flex-col items-center gap-0.5 flex-shrink-0 w-[60px] sm:w-[72px]
          ${isActive ? "opacity-70" : ""}`}
      >
        <div className={`w-full rounded-lg bg-white/15 flex flex-col items-center py-1.5 px-1 border-2 transition-all
          ${isActive ? "border-[#F4B400]" : "border-white/20"}`}>
          <JerseyMini teamSlug={player.teamSlug} isGk={slot === "gk"} />
          <span className="text-[8px] sm:text-[9px] text-white font-semibold text-center leading-tight mt-0.5 truncate w-full px-0.5">
            {shortName}
          </span>
        </div>
        <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onPick}
      className={`flex-shrink-0 w-[60px] sm:w-[72px] flex flex-col items-center gap-0.5 rounded-lg p-1.5 border-2 border-dashed transition-all
        ${isActive ? "border-[#F4B400] bg-[#F4B400]/20" : "border-white/30 bg-black/10 hover:bg-black/20 hover:border-white/50"}`}
    >
      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-dashed border-white/40 flex items-center justify-center">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
      </div>
      <span className="text-[8px] font-bold text-white/50 uppercase leading-none">{slotLabel(slot)}</span>
    </button>
  );
}

