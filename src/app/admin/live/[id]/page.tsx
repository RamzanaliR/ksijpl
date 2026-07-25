"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Modal from "@/components/admin/Modal";

type Team = { id: string; name: string };
type Player = { id: string; full_name: string; nickname: string | null; squad_number: number | null; position: string | null };
type MatchEvent = { id: string; team_id: string; player_id: string; type: string; created_at: string };
type MatchRow = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_pens: number | null;
  away_pens: number | null;
  home_motm_player_id: string | null;
  away_motm_player_id: string | null;
  kickoff_at: string | null;
  venue: string | null;
};

const EVENT_META: Record<string, { label: string; icon: string; short: string }> = {
  goal: { label: "Goal", icon: "⚽", short: "G" },
  assist: { label: "Assist", icon: "🅰️", short: "A" },
  yellow_card: { label: "Yellow Card", icon: "🟨", short: "Y" },
  red_card: { label: "Red Card", icon: "🟥", short: "R" },
};

export default function LiveMatchConsole() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.id as string;

  const [match, setMatch] = useState<MatchRow | null>(null);
  const [homeTeam, setHomeTeam] = useState<Team | null>(null);
  const [awayTeam, setAwayTeam] = useState<Team | null>(null);
  const [homePlayers, setHomePlayers] = useState<Player[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
  const [present, setPresent] = useState<Set<string>>(new Set());
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyPlayerId, setBusyPlayerId] = useState<string | null>(null);
  const [activeSide, setActiveSide] = useState<"home" | "away">("home");
  const [pensOpen, setPensOpen] = useState(false);
  const [homePensInput, setHomePensInput] = useState("");
  const [awayPensInput, setAwayPensInput] = useState("");

  const load = useCallback(async () => {
    const { data: m } = await supabase
      .from("matches")
      .select("id,home_team_id,away_team_id,status,home_score,away_score,home_pens,away_pens,home_motm_player_id,away_motm_player_id,kickoff_at,venue")
      .eq("id", matchId)
      .maybeSingle();
    if (!m) {
      setLoading(false);
      return;
    }
    setMatch(m);
    setHomePensInput(m.home_pens?.toString() ?? "");
    setAwayPensInput(m.away_pens?.toString() ?? "");

    const [{ data: teamsData }, { data: attendance }, { data: evts }] = await Promise.all([
      supabase.from("teams").select("id,name").in("id", [m.home_team_id, m.away_team_id]),
      supabase.from("match_attendance").select("player_id").eq("match_id", matchId),
      supabase.from("match_events").select("id,team_id,player_id,type,created_at").eq("match_id", matchId).order("created_at", { ascending: false }),
    ]);
    setHomeTeam(teamsData?.find((t) => t.id === m.home_team_id) ?? null);
    setAwayTeam(teamsData?.find((t) => t.id === m.away_team_id) ?? null);
    setPresent(new Set((attendance ?? []).map((a) => a.player_id)));
    setEvents(evts ?? []);

    const [{ data: hp }, { data: ap }] = await Promise.all([
      supabase.from("players").select("id,full_name,nickname,squad_number,position").eq("team_id", m.home_team_id).order("squad_number"),
      supabase.from("players").select("id,full_name,nickname,squad_number,position").eq("team_id", m.away_team_id).order("squad_number"),
    ]);
    setHomePlayers(hp ?? []);
    setAwayPlayers(ap ?? []);
    setLoading(false);
  }, [matchId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    load();
  }, [load]);

  async function toggleAttendance(playerId: string, teamId: string) {
    if (present.has(playerId)) {
      await supabase.from("match_attendance").delete().eq("match_id", matchId).eq("player_id", playerId);
      setPresent((prev) => {
        const next = new Set(prev);
        next.delete(playerId);
        return next;
      });
    } else {
      await supabase
        .from("match_attendance")
        .upsert({ match_id: matchId, player_id: playerId, team_id: teamId, present: true, recorded_by: userId }, { onConflict: "match_id,player_id" });
      setPresent((prev) => new Set(prev).add(playerId));
    }
  }

  async function logEvent(playerId: string, teamId: string, type: string) {
    if (!match) return;
    setBusyPlayerId(playerId + type);

    if (!present.has(playerId)) {
      await supabase
        .from("match_attendance")
        .upsert({ match_id: matchId, player_id: playerId, team_id: teamId, present: true, recorded_by: userId }, { onConflict: "match_id,player_id" });
      setPresent((prev) => new Set(prev).add(playerId));
    }

    const { data: inserted, error } = await supabase
      .from("match_events")
      .insert({ match_id: matchId, team_id: teamId, player_id: playerId, type, recorded_by: userId })
      .select("id,team_id,player_id,type,created_at")
      .single();

    if (!error && inserted) {
      setEvents((prev) => [inserted, ...prev]);
      if (type === "goal") {
        const isHome = teamId === match.home_team_id;
        const newHome = (match.home_score ?? 0) + (isHome ? 1 : 0);
        const newAway = (match.away_score ?? 0) + (!isHome ? 1 : 0);
        await supabase.from("matches").update({ home_score: newHome, away_score: newAway }).eq("id", matchId);
        setMatch((prev) => (prev ? { ...prev, home_score: newHome, away_score: newAway } : prev));
      }
    }
    setBusyPlayerId(null);
  }

  async function undoEvent(event: MatchEvent) {
    await supabase.from("match_events").delete().eq("id", event.id);
    setEvents((prev) => prev.filter((e) => e.id !== event.id));
    if (event.type === "goal" && match) {
      const isHome = event.team_id === match.home_team_id;
      const newHome = Math.max(0, (match.home_score ?? 0) - (isHome ? 1 : 0));
      const newAway = Math.max(0, (match.away_score ?? 0) - (!isHome ? 1 : 0));
      await supabase.from("matches").update({ home_score: newHome, away_score: newAway }).eq("id", matchId);
      setMatch((prev) => (prev ? { ...prev, home_score: newHome, away_score: newAway } : prev));
    }
  }

  async function setStatus(status: string) {
    await supabase.from("matches").update({ status }).eq("id", matchId);
    setMatch((prev) => (prev ? { ...prev, status } : prev));
  }

  async function saveMotm(side: "home" | "away", playerId: string) {
    const field = side === "home" ? "home_motm_player_id" : "away_motm_player_id";
    const current = side === "home" ? match?.home_motm_player_id : match?.away_motm_player_id;
    const next = current === playerId ? null : playerId;
    await supabase.from("matches").update({ [field]: next }).eq("id", matchId);
    setMatch((prev) => (prev ? { ...prev, [field]: next } : prev));
  }

  async function savePenalties(e: React.FormEvent) {
    e.preventDefault();
    const hp = homePensInput === "" ? null : Number(homePensInput);
    const ap = awayPensInput === "" ? null : Number(awayPensInput);
    await supabase.from("matches").update({ home_pens: hp, away_pens: ap }).eq("id", matchId);
    setMatch((prev) => (prev ? { ...prev, home_pens: hp, away_pens: ap } : prev));
    setPensOpen(false);
  }

  function eventCount(playerId: string, type: string) {
    return events.filter((e) => e.player_id === playerId && e.type === type).length;
  }

  function playerName(id: string, list: Player[]) {
    const p = list.find((pl) => pl.id === id);
    return p ? (p.nickname ? `${p.full_name} "${p.nickname}"` : p.full_name) : "—";
  }

  if (loading) {
    return <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center text-slate-400 text-sm">Loading…</div>;
  }
  if (!match) {
    return <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center text-slate-400 text-sm">Match not found.</div>;
  }

  const hasPens = match.home_pens !== null && match.away_pens !== null;
  const activeTeamId = activeSide === "home" ? match.home_team_id : match.away_team_id;
  const activePlayers = activeSide === "home" ? homePlayers : awayPlayers;
  const activeMotm = activeSide === "home" ? match.home_motm_player_id : match.away_motm_player_id;

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-10">
      <div className="sticky top-0 z-10 bg-[#0B3363] text-white px-4 py-3 flex items-center justify-between">
        <button onClick={() => router.push("/admin/live")} className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          Back
        </button>
        <div className="font-display font-bold text-sm truncate px-2">{homeTeam?.name} vs {awayTeam?.name}</div>
        <a href="/admin" className="text-xs text-white/60 hover:text-white flex-shrink-0">Exit</a>
      </div>

      {/* Scoreboard */}
      <div className="max-w-3xl mx-auto p-4">
        <div className="admin-card p-5 mb-4 flex items-center justify-between">
          <div className="text-center flex-1 min-w-0">
            <div className="font-semibold text-sm text-[#0B3363] truncate">{homeTeam?.name}</div>
          </div>
          <div className="flex flex-col items-center px-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-display font-bold text-3xl text-[#0B3363]">{match.home_score ?? 0}</span>
              <span className="text-slate-300">–</span>
              <span className="font-display font-bold text-3xl text-[#0B3363]">{match.away_score ?? 0}</span>
            </div>
            {hasPens && (
              <div className="text-xs text-slate-400 mt-0.5">Pens {match.home_pens}–{match.away_pens}</div>
            )}
          </div>
          <div className="text-center flex-1 min-w-0">
            <div className="font-semibold text-sm text-[#0B3363] truncate">{awayTeam?.name}</div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="flex items-center justify-center gap-2">
            {match.status !== "scheduled" && (
              <span className={`admin-pill ${match.status === "live" ? "admin-pill-warning" : "admin-pill-success"}`}>
                {match.status}
              </span>
            )}
            {match.status === "scheduled" && (
              <button onClick={() => setStatus("live")} className="admin-btn admin-btn-primary py-1.5 px-3 text-xs">Start Match</button>
            )}
            {match.status === "live" && (
              <button onClick={() => setStatus("completed")} className="admin-btn admin-btn-primary py-1.5 px-3 text-xs">Full Time</button>
            )}
            {match.status === "completed" && (
              <button onClick={() => setStatus("live")} className="admin-btn admin-btn-ghost py-1.5 px-3 text-xs">Reopen match</button>
            )}
          </div>
          <button onClick={() => setPensOpen(true)} className="admin-btn bg-[#0B3363]/5 hover:bg-[#0B3363]/10 text-[#0B3363] py-1.5 px-3 text-xs">
            {hasPens ? "Edit Penalties" : "Penalties"}
          </button>
        </div>

        {/* Team tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveSide("home")}
            className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold truncate transition-colors ${
              activeSide === "home" ? "admin-btn-primary" : "bg-white text-[#0B3363] border border-[#0B3363]/10"
            }`}
          >
            {homeTeam?.name ?? "Home"}
          </button>
          <button
            onClick={() => setActiveSide("away")}
            className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold truncate transition-colors ${
              activeSide === "away" ? "admin-btn-primary" : "bg-white text-[#0B3363] border border-[#0B3363]/10"
            }`}
          >
            {awayTeam?.name ?? "Away"}
          </button>
        </div>

        {/* Active team roster */}
        <div className="mb-6">
          <TeamRoster
            players={activePlayers}
            present={present}
            eventCount={eventCount}
            busyPlayerId={busyPlayerId}
            motmPlayerId={activeMotm}
            onToggleAttendance={(pid) => toggleAttendance(pid, activeTeamId)}
            onLogEvent={(pid, type) => logEvent(pid, activeTeamId, type)}
            onSetMotm={(pid) => saveMotm(activeSide, pid)}
          />
        </div>

        {/* Event feed */}
        <div>
          <div className="admin-stat-label mb-2">Match Events</div>
          <div className="admin-card overflow-hidden">
            {events.map((e) => {
              const list = e.team_id === match.home_team_id ? homePlayers : awayPlayers;
              const meta = EVENT_META[e.type];
              return (
                <div key={e.id} className="admin-row">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex-shrink-0">{meta?.icon}</span>
                    <span className="truncate">
                      <span className="font-medium text-[#0B3363]">{meta?.label}</span> — {playerName(e.player_id, list)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-slate-400">
                      {new Date(e.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <button onClick={() => undoEvent(e)} className="admin-btn-danger text-xs">Undo</button>
                  </div>
                </div>
              );
            })}
            {events.length === 0 && <div className="admin-empty">No events logged yet.</div>}
          </div>
        </div>
      </div>

      <Modal open={pensOpen} onClose={() => setPensOpen(false)} title="Penalty Shootout" description="Enter the final penalty shootout score.">
        <form onSubmit={savePenalties} className="flex flex-col gap-3">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="admin-label truncate block">{homeTeam?.name}</label>
              <input value={homePensInput} onChange={(e) => setHomePensInput(e.target.value)} type="number" min={0} className="admin-input" />
            </div>
            <span className="text-slate-400 pb-2.5">–</span>
            <div className="flex-1">
              <label className="admin-label truncate block">{awayTeam?.name}</label>
              <input value={awayPensInput} onChange={(e) => setAwayPensInput(e.target.value)} type="number" min={0} className="admin-input" />
            </div>
          </div>
          <button className="admin-btn admin-btn-primary mt-2">Save Penalties</button>
        </form>
      </Modal>
    </div>
  );
}

function TeamRoster({
  players,
  present,
  eventCount,
  busyPlayerId,
  motmPlayerId,
  onToggleAttendance,
  onLogEvent,
  onSetMotm,
}: {
  players: Player[];
  present: Set<string>;
  eventCount: (playerId: string, type: string) => number;
  busyPlayerId: string | null;
  motmPlayerId: string | null;
  onToggleAttendance: (playerId: string) => void;
  onLogEvent: (playerId: string, type: string) => void;
  onSetMotm: (playerId: string) => void;
}) {
  return (
    <div className="admin-card overflow-hidden">
      {players.map((p) => {
        const isPresent = present.has(p.id);
        const isMotm = motmPlayerId === p.id;
        return (
          <div key={p.id} className="px-4 py-3 border-b border-[#0B3363]/5 last:border-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <button onClick={() => onToggleAttendance(p.id)} className="flex items-center gap-2 min-w-0 text-left flex-1">
                <span
                  className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                    isPresent ? "bg-[#3EA0D9] border-[#3EA0D9]" : "border-slate-300"
                  }`}
                >
                  {isPresent && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                </span>
                <span className="text-xs text-slate-400 flex-shrink-0">{p.squad_number ?? "—"}</span>
                <span className={`text-sm truncate ${isPresent ? "text-[#0B3363] font-medium" : "text-slate-400"}`}>
                  {p.nickname || p.full_name}
                </span>
              </button>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  {(["goal", "assist", "yellow_card", "red_card"] as const).map((type) => {
                    const count = eventCount(p.id, type);
                    return count > 0 ? (
                      <span key={type}>{EVENT_META[type].icon}{count > 1 ? count : ""}</span>
                    ) : null;
                  })}
                </div>
                <button
                  onClick={() => onSetMotm(p.id)}
                  aria-label="Man of the Match"
                  title="Man of the Match"
                  className={`admin-icon-btn ${isMotm ? "text-[#F4B400]" : ""}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={isMotm ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.1 6.6-5.8-3.1-5.8 3.1 1.1-6.6-4.8-4.6 6.6-.9z" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {(["goal", "assist", "yellow_card", "red_card"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => onLogEvent(p.id, type)}
                  disabled={busyPlayerId === p.id + type}
                  className="admin-btn bg-[#0B3363]/5 hover:bg-[#0B3363]/10 text-[#0B3363] text-xs py-1.5 px-2.5 flex-1"
                >
                  {EVENT_META[type].icon} {EVENT_META[type].short}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {players.length === 0 && <div className="admin-empty">No players registered for this team.</div>}
    </div>
  );
}
