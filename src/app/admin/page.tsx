"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type GwPhase = "setup" | "lockout" | "live" | "scoring" | "closed";

type GwStatus = {
  id: string;
  label: string;
  number: number;
  phase: GwPhase;
  totalMatches: number;
  completedMatches: number;
  firstKickoff: string | null;
  lastKickoff: string | null;
  deadlineAt: string | null;
};

type SystemPing = {
  label: string;
  status: "ok" | "warn" | "error";
  detail: string;
  href?: string;
};

type QueueItem = {
  severity: "critical" | "warning" | "routine";
  label: string;
  detail: string;
  actionLabel: string;
  href: string;
};

type LiveStat = { label: string; value: string | number; sub?: string; href?: string; alert?: boolean };

// ─── Constants ────────────────────────────────────────────────────────────────

const SENIORS_ID = "e0eee160-729a-4cbd-a29a-20d36115db31";

const PHASE_CONFIG: Record<GwPhase, { label: string; color: string; bg: string; dot: string }> = {
  setup:   { label: "Setup",   color: "text-slate-500",  bg: "bg-slate-100",  dot: "bg-slate-400" },
  lockout: { label: "Lockout", color: "text-amber-700",  bg: "bg-amber-50",   dot: "bg-amber-500" },
  live:    { label: "Live",    color: "text-green-700",  bg: "bg-green-50",   dot: "bg-green-500" },
  scoring: { label: "Scoring", color: "text-blue-700",   bg: "bg-blue-50",    dot: "bg-blue-500" },
  closed:  { label: "Closed",  color: "text-[#0B3363]/40", bg: "bg-slate-50", dot: "bg-slate-300" },
};

const PHASES: GwPhase[] = ["setup", "lockout", "live", "scoring", "closed"];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [gw, setGw]           = useState<GwStatus | null>(null);
  const [pings, setPings]     = useState<SystemPing[]>([]);
  const [queue, setQueue]     = useState<QueueItem[]>([]);
  const [stats, setStats]     = useState<LiveStat[]>([]);
  const [countdown, setCountdown] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState("");
  const [adoptionRate, setAdoptionRate] = useState<number | null>(null);
  const [now, setNow]         = useState(new Date());

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const hr = now.getHours();
    setGreeting(hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening");

    // Update countdown
    if (gw?.deadlineAt) {
      const diff = new Date(gw.deadlineAt).getTime() - now.getTime();
      if (diff > 0) {
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        if (d > 0) setCountdown(`${d}d ${h}h`);
        else if (h > 0) setCountdown(`${h}h ${m}m`);
        else setCountdown(`${m}m ${s}s`);
      } else {
        setCountdown("Expired");
      }
    } else if (gw?.firstKickoff) {
      const diff = new Date(gw.firstKickoff).getTime() - now.getTime();
      if (diff > 0) {
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        if (d > 0) setCountdown(`Kickoff in ${d}d ${h}h`);
        else if (h > 0) setCountdown(`Kickoff in ${h}h ${m}m`);
        else setCountdown(`Kickoff in ${m}m`);
      } else {
        setCountdown("");
      }
    }
  }, [now, gw]);

  const load = useCallback(async () => {
    const nowIso = new Date().toISOString();

    // ── Current season + gameweek ────────────────────────────────────────
    const { data: seasons } = await supabase.from("seasons").select("id")
      .eq("competition_id", SENIORS_ID).order("created_at", { ascending: false }).limit(1);
    const seasonId = seasons?.[0]?.id;

    const { data: gwData } = await supabase.from("gameweeks")
      .select("id,number,round_name")
      .eq("season_id", seasonId ?? "x")
      .order("number", { ascending: false }).limit(1);
    const gwRow = gwData?.[0];
    const gwId = gwRow?.id;

    const { data: matches } = await supabase.from("matches")
      .select("id,home_score,kickoff_at").eq("gameweek_id", gwId ?? "x");

    const completed = (matches ?? []).filter((m: any) => m.home_score !== null).length;
    const total     = (matches ?? []).length;
    const kickoffs  = (matches ?? []).map((m: any) => m.kickoff_at).filter(Boolean).sort();
    const first     = kickoffs[0] ?? null;
    const last      = kickoffs[kickoffs.length - 1] ?? null;

    // Deadline: 4 hours before first kickoff
    const deadlineAt = first ? new Date(new Date(first).getTime() - 4 * 3600000).toISOString() : null;

    // Determine phase
    let phase: GwPhase = "setup";
    if (total === 0) phase = "setup";
    else if (deadlineAt && nowIso < deadlineAt) phase = "setup";
    else if (deadlineAt && nowIso >= deadlineAt && first && nowIso < first) phase = "lockout";
    else if (first && nowIso >= first && last && nowIso <= last) phase = "live";
    else if (last && nowIso > last && completed < total) phase = "scoring";
    else if (completed === total && total > 0) phase = "closed";

    const gwStatus: GwStatus = {
      id: gwId ?? "",
      label: gwRow?.round_name ?? (gwRow ? `Match Week ${gwRow.number}` : "—"),
      number: gwRow?.number ?? 0,
      phase,
      totalMatches: total,
      completedMatches: completed,
      firstKickoff: first,
      lastKickoff: last,
      deadlineAt,
    };
    setGw(gwStatus);

    // ── System pings ─────────────────────────────────────────────────────
    const { data: adminSettings } = await supabase.from("admin_settings")
      .select("key,value,updated_at")
      .in("key", ["canva_access_token","canva_token_expires_at","instagram_access_token"]);

    const byKey = Object.fromEntries((adminSettings ?? []).map((r: any) => [r.key, r]));
    const canvaToken   = byKey["canva_access_token"]?.value;
    const canvaExpiry  = byKey["canva_token_expires_at"]?.value;
    const igToken      = byKey["instagram_access_token"]?.value;
    const canvaExpired = canvaExpiry ? new Date(canvaExpiry) < new Date() : true;

    const newPings: SystemPing[] = [
      {
        label: "Canva",
        status: !canvaToken || canvaToken.length < 10 ? "error" : canvaExpired ? "warn" : "ok",
        detail: !canvaToken || canvaToken.length < 10
          ? "Not connected"
          : canvaExpired ? "Token expired — re-authorise" : "Connected",
        href: canvaExpired || !canvaToken ? "/admin/media" : undefined,
      },
      {
        label: "Instagram",
        status: !igToken || igToken.length < 10 ? "warn" : "ok",
        detail: !igToken || igToken.length < 10 ? "Not configured" : "Connected",
        href: "/admin/media",
      },
      {
        label: "Fantasy Deadline",
        status: phase === "lockout" ? "warn" : phase === "live" || phase === "scoring" || phase === "closed" ? "ok" : "ok",
        detail: phase === "lockout" ? "Transfers locked" : phase === "live" ? "In progress" : deadlineAt ? new Date(deadlineAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "No deadline set",
      },
    ];
    setPings(newPings);

    // ── Exception queue ──────────────────────────────────────────────────
    const newQueue: QueueItem[] = [];

    // Critical: results missing for past matches
    const pastNoScore = (matches ?? []).filter((m: any) =>
      m.kickoff_at < nowIso && m.home_score === null
    ).length;
    if (pastNoScore > 0) {
      newQueue.push({
        severity: "critical",
        label: `${pastNoScore} match${pastNoScore > 1 ? "es" : ""} missing results`,
        detail: "Matches have kicked off but scores haven't been entered.",
        actionLabel: "Enter results →",
        href: "/admin/fixtures",
      });
    }

    // Warning: Canva expired
    if (canvaToken && canvaExpired) {
      newQueue.push({
        severity: "critical",
        label: "Canva token expired",
        detail: "Graphics cannot be generated until you re-authorise.",
        actionLabel: "Re-authorise →",
        href: "/admin/media",
      });
    }

    // Warning: pending media
    const { data: pendingMedia } = await supabase.from("generated_media")
      .select("id").eq("status","pending_approval");
    if ((pendingMedia?.length ?? 0) > 0) {
      newQueue.push({
        severity: "warning",
        label: `${pendingMedia!.length} graphic${pendingMedia!.length > 1 ? "s" : ""} awaiting approval`,
        detail: "Generated graphics need review before publishing to Instagram.",
        actionLabel: "Review graphics →",
        href: "/admin/media",
      });
    }

    // Warning: TOTW not published
    const { data: totw } = await supabase.from("team_of_week")
      .select("published").eq("gameweek_id", gwId ?? "x").eq("division","seniors").maybeSingle();
    if (!totw?.published && phase !== "setup") {
      newQueue.push({
        severity: "warning",
        label: "Team of the Week not published",
        detail: `${gwStatus.label} TOTW hasn't been selected yet.`,
        actionLabel: "Select TOTW →",
        href: "/admin/totw",
      });
    }

    // Routine: fantasy not scored
    const { data: fpts } = await supabase.from("fantasy_gameweek_points")
      .select("id").eq("gameweek_id", gwId ?? "x").limit(1);
    if ((fpts?.length ?? 0) === 0 && phase === "scoring") {
      newQueue.push({
        severity: "routine",
        label: "Fantasy points not computed",
        detail: "All matches are complete — ready to run the scoring engine.",
        actionLabel: "Compute points →",
        href: "/admin/fantasy",
      });
    }

    setQueue(newQueue);

    // ── Adoption rate ────────────────────────────────────────────────────
    const { data: allTeams }  = await supabase.from("fantasy_teams").select("id");
    const { data: squadTeams } = await supabase.from("fantasy_gameweek_squads")
      .select("fantasy_team_id").eq("gameweek_id", gwId ?? "x");
    const totalManagers = allTeams?.length ?? 0;
    const submittedManagers = new Set((squadTeams ?? []).map((r: any) => r.fantasy_team_id)).size;
    setAdoptionRate(totalManagers > 0 ? Math.round((submittedManagers / totalManagers) * 100) : null);

    // ── Live stats ───────────────────────────────────────────────────────
    const { count: playerCount } = await supabase.from("players").select("*",{count:"exact",head:true});
    const { count: teamCount }   = await supabase.from("teams").select("*",{count:"exact",head:true});

    setStats([
      { label: "Managers",       value: totalManagers,    sub: "fantasy teams",          href: "/admin/fantasy" },
      { label: "Submitted",      value: submittedManagers, sub: "squads finalised",       href: "/admin/fantasy" },
      { label: "Matches played", value: completed,         sub: `of ${total} this week`,  href: "/admin/fixtures" },
      { label: "Players",        value: playerCount ?? 0,  sub: "registered",             href: "/admin/players" },
      { label: "Teams",          value: teamCount ?? 0,    sub: "total clubs",            href: "/admin/teams" },
      {
        label: "Pending media",
        value: pendingMedia?.length ?? 0,
        sub: "need approval",
        href: "/admin/media",
        alert: (pendingMedia?.length ?? 0) > 0,
      },
    ]);

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const phase = gw?.phase ?? "setup";
  const phaseCfg = PHASE_CONFIG[phase];

  function deadlineUrgent() {
    if (!gw?.deadlineAt) return false;
    const diff = new Date(gw.deadlineAt).getTime() - Date.now();
    return diff > 0 && diff < 2 * 3600000; // within 2 hours
  }

  const criticalCount = queue.filter((q) => q.severity === "critical").length;
  const warningCount  = queue.filter((q) => q.severity === "warning").length;

  // ── Quick actions (phase-aware) ───────────────────────────────────────────

  const primaryAction = phase === "setup"
    ? { label: "Import Fixtures", icon: "📅", href: "/admin/fixtures" }
    : phase === "lockout"
    ? { label: "Broadcast Deadline Reminder", icon: "📣", href: "/admin/fantasy" }
    : phase === "live"
    ? { label: "Open Live Console", icon: "📺", href: "/admin/live" }
    : phase === "scoring"
    ? { label: "Execute Scoring Run", icon: "⚡", href: "/admin/fantasy" }
    : { label: "Set Up Next Match Week", icon: "📅", href: "/admin/fixtures" };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ══ PULSE BAR ══════════════════════════════════════════════════════ */}
      <div className="admin-card px-4 py-3 flex flex-wrap items-center gap-4">

        {/* Greeting + GW label */}
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-sm">{greeting} — {gw?.label ?? "Loading…"}</div>
          <div className="text-[11px] text-[#0B3363]/40 dark:text-white/40 mt-0.5">
            {now.toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long" })} · {now.toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit", second:"2-digit" })}
          </div>
        </div>

        {/* Gameweek lifecycle stepper */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {PHASES.map((p, i) => {
            const cfg   = PHASE_CONFIG[p];
            const active = p === phase;
            const past   = PHASES.indexOf(p) < PHASES.indexOf(phase);
            return (
              <div key={p} className="flex items-center gap-1">
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                  active ? `${cfg.bg} ${cfg.color} ring-1 ring-current` :
                  past   ? "bg-[#0B3363]/5 text-[#0B3363]/30 dark:text-white/30" :
                           "bg-transparent text-[#0B3363]/20 dark:text-white/20"
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${active ? cfg.dot : past ? "bg-[#0B3363]/20" : "bg-[#0B3363]/10"}`} />
                  {cfg.label}
                </div>
                {i < PHASES.length - 1 && <div className="w-3 h-px bg-[#0B3363]/10 dark:bg-white/10" />}
              </div>
            );
          })}
        </div>

        {/* Countdown */}
        {countdown && (
          <div className={`flex-shrink-0 text-sm font-bold px-3 py-1 rounded-lg ${
            deadlineUrgent() ? "bg-red-50 text-red-600 animate-pulse" :
            phase === "live"  ? "bg-green-50 text-green-700" :
                                "bg-[#0B3363]/5 text-[#0B3363] dark:text-white"
          }`}>
            {phase === "lockout" ? "⏳" : phase === "live" ? "🔴" : "⏱"} {countdown}
          </div>
        )}

        {/* System pings */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {pings.map((p, i) => (
            p.href ? (
              <Link key={i} href={p.href} title={`${p.label}: ${p.detail}`}
                className="flex items-center gap-1 text-[10px] font-medium hover:opacity-80">
                <div className={`w-2 h-2 rounded-full ${p.status === "ok" ? "bg-green-500" : p.status === "warn" ? "bg-amber-400" : "bg-red-500"}`} />
                <span className="hidden sm:inline text-[#0B3363]/50 dark:text-white/50">{p.label}</span>
              </Link>
            ) : (
              <div key={i} title={`${p.label}: ${p.detail}`}
                className="flex items-center gap-1 text-[10px] font-medium">
                <div className={`w-2 h-2 rounded-full ${p.status === "ok" ? "bg-green-500" : p.status === "warn" ? "bg-amber-400" : "bg-red-500"}`} />
                <span className="hidden sm:inline text-[#0B3363]/50 dark:text-white/50">{p.label}</span>
              </div>
            )
          ))}
        </div>
      </div>

      {/* ══ MAIN GRID ══════════════════════════════════════════════════════ */}
      <div className="grid lg:grid-cols-[1fr_320px] gap-5 items-start">

        {/* Left column */}
        <div className="space-y-5">

          {/* ── Exception Queue ─────────────────────────────────────────── */}
          <div className="admin-card overflow-hidden">
            <div className="px-4 py-3 border-b border-[#0B3363]/8 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold text-sm">Action Queue</h2>
                {criticalCount > 0 && (
                  <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                    {criticalCount} critical
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">
                    {warningCount} warning
                  </span>
                )}
              </div>
              {!loading && queue.length === 0 && (
                <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">All clear ✓</span>
              )}
            </div>

            {loading ? (
              <div className="p-6 text-center text-sm text-[#0B3363]/30">Loading…</div>
            ) : queue.length === 0 ? (
              <div className="px-4 py-5 text-center">
                <div className="text-2xl mb-1">✅</div>
                <div className="text-sm font-semibold text-[#0B3363]/60 dark:text-white/60">Nothing needs your attention right now.</div>
                <div className="text-xs text-[#0B3363]/30 dark:text-white/30 mt-1">Queue will populate when action is required.</div>
              </div>
            ) : (
              <div className="divide-y divide-[#0B3363]/5">
                {queue.map((item, i) => (
                  <div key={i} className={`px-4 py-3 flex items-start gap-3 ${
                    item.severity === "critical" ? "bg-red-50/50 dark:bg-red-900/10" :
                    item.severity === "warning"  ? "bg-amber-50/50 dark:bg-amber-900/10" : ""
                  }`}>
                    <span className="text-lg flex-shrink-0 mt-0.5">
                      {item.severity === "critical" ? "🔴" : item.severity === "warning" ? "🟡" : "🔵"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{item.label}</div>
                      <div className="text-xs text-[#0B3363]/50 dark:text-white/50 mt-0.5">{item.detail}</div>
                    </div>
                    <Link href={item.href}
                      className="flex-shrink-0 text-xs font-semibold text-[#3EA0D9] hover:underline whitespace-nowrap mt-0.5">
                      {item.actionLabel}
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Phase-Aware Quick Action Dock ────────────────────────────── */}
          <div className="admin-card overflow-hidden">
            <div className="px-4 py-3 border-b border-[#0B3363]/8">
              <h2 className="font-display font-bold text-sm">Quick actions</h2>
            </div>
            <div className="p-4 space-y-3">
              {/* Primary CTA — phase-aware */}
              <Link href={primaryAction.href}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0B3363] dark:bg-[#3EA0D9] text-white hover:opacity-90 transition-opacity">
                <span className="text-xl">{primaryAction.icon}</span>
                <div>
                  <div className="text-sm font-bold">{primaryAction.label}</div>
                  <div className="text-[10px] opacity-70 capitalize">Recommended for {phaseCfg.label.toLowerCase()} phase</div>
                </div>
                <svg className="ml-auto w-4 h-4 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              </Link>

              {/* Secondary actions grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Enter results", icon: "⚽", href: "/admin/fixtures" },
                  { label: "Generate graphics", icon: "🎨", href: "/admin/media" },
                  { label: "Select TOTW", icon: "🏆", href: "/admin/totw" },
                  { label: "Live console", icon: "📺", href: "/admin/live" },
                  { label: "Add players", icon: "👤", href: "/admin/players" },
                  { label: "Manage fixtures", icon: "📅", href: "/admin/fixtures" },
                  { label: "Fantasy settings", icon: "⚙️", href: "/admin/fantasy" },
                  { label: "Media assets", icon: "🖼️", href: "/admin/media" },
                ].map((a, i) => (
                  <Link key={i} href={a.href}
                    className="flex flex-col items-center gap-1 p-2.5 rounded-xl border border-[#0B3363]/8 hover:border-[#3EA0D9] hover:bg-[#3EA0D9]/5 transition-colors text-center group">
                    <span className="text-lg">{a.icon}</span>
                    <span className="text-[10px] font-semibold text-[#0B3363]/70 dark:text-white/70 group-hover:text-[#3EA0D9] transition-colors leading-tight">{a.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">

          {/* ── Deadline Adoption Rate ───────────────────────────────────── */}
          <div className="admin-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-bold text-sm">Deadline Adoption</h2>
              <Link href="/admin/fantasy" className="text-xs text-[#3EA0D9] hover:underline">View →</Link>
            </div>
            {adoptionRate === null ? (
              <div className="text-sm text-[#0B3363]/30">Loading…</div>
            ) : (
              <>
                <div className="flex items-end gap-2 mb-2">
                  <span className="font-display font-bold text-3xl">{adoptionRate}%</span>
                  <span className="text-xs text-[#0B3363]/40 dark:text-white/40 mb-1">of managers submitted</span>
                </div>
                <div className="w-full bg-[#0B3363]/8 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      adoptionRate >= 80 ? "bg-green-500" :
                      adoptionRate >= 50 ? "bg-amber-400" : "bg-red-400"
                    }`}
                    style={{ width: `${adoptionRate}%` }}
                  />
                </div>
                <div className="text-[10px] text-[#0B3363]/30 dark:text-white/30 mt-1.5">
                  {adoptionRate >= 80 ? "Great adoption rate" :
                   adoptionRate >= 50 ? "Some managers haven't submitted yet" :
                   "Most managers haven't set their squad"}
                </div>
              </>
            )}
          </div>

          {/* ── Live stat cards ──────────────────────────────────────────── */}
          <div className="space-y-2">
            {loading ? (
              <div className="admin-card p-4 text-center text-sm text-[#0B3363]/30">Loading…</div>
            ) : stats.map((s, i) => (
              <Link key={i} href={s.href ?? "#"}
                className={`admin-card flex items-center gap-3 px-4 py-2.5 hover:border-[#3EA0D9] transition-colors ${s.alert ? "border-amber-200 bg-amber-50/50" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-[#0B3363]/70 dark:text-white/70">{s.label}</div>
                  {s.sub && <div className="text-[10px] text-[#0B3363]/30 dark:text-white/30">{s.sub}</div>}
                </div>
                <div className={`font-display font-bold text-lg flex-shrink-0 ${
                  s.alert && Number(s.value) > 0 ? "text-amber-600" : "text-[#0B3363] dark:text-white"
                }`}>{s.value}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
