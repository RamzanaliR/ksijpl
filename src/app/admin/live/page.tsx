"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Season = { id: string; label: string; competitions: { name: string; division_id: string; sponsor_name: string } | null };
type Team = { id: string; name: string; division_id: string };
type Gameweek = { id: string; number: number };
type Match = {
  id: string;
  gameweek_id: string | null;
  home_team_id: string;
  away_team_id: string;
  kickoff_at: string | null;
  venue: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
};

const DIVISION_LABELS: Record<string, string> = {
  gofiber: "gofiber KSIJ PL",
  "Care & Cure": "Care & Cure KSIJ PL",
};

export default function LiveMatchPicker() {
  const router = useRouter();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [gwIndex, setGwIndex] = useState(0);
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("seasons")
        .select("id,label,competitions(name,division_id,sponsor_name)")
        .order("label");
      const ordered = [...((data as any) ?? [])].sort(
        (a: any, b: any) =>
          ["gofiber", "Care & Cure"].indexOf(a.competitions?.sponsor_name) -
          ["gofiber", "Care & Cure"].indexOf(b.competitions?.sponsor_name)
      );
      setSeasons(ordered);
      if (ordered.length) setSelectedSeason(ordered[0].id);
      const { data: tms } = await supabase.from("teams").select("id,name,division_id").order("name");
      setTeams(tms ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!selectedSeason) return;
    (async () => {
      const [{ data: gws }, { data: ms }] = await Promise.all([
        supabase.from("gameweeks").select("id,number").eq("season_id", selectedSeason).order("number"),
        supabase
          .from("matches")
          .select("id,gameweek_id,home_team_id,away_team_id,kickoff_at,venue,status,home_score,away_score")
          .eq("season_id", selectedSeason)
          .order("kickoff_at", { ascending: true }),
      ]);
      setGameweeks(gws ?? []);
      setMatches(ms ?? []);
      // default to the first match week that has a live or upcoming/today match, else week 1
      setGwIndex(0);
    })();
  }, [selectedSeason]);

  function teamName(id: string) {
    return teams.find((t) => t.id === id)?.name ?? "—";
  }

  const currentGw = gameweeks[gwIndex];
  const gwMatches = currentGw ? matches.filter((m) => m.gameweek_id === currentGw.id) : matches.filter((m) => !m.gameweek_id);

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <div className="sticky top-0 z-10 bg-[#0B3363] text-white px-4 py-3 flex items-center justify-between">
        <div className="font-display font-bold">Live Match Console</div>
        <a href="/admin" className="text-xs text-white/60 hover:text-white">Exit</a>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {seasons.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSeason(s.id)}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                s.id === selectedSeason ? "admin-btn-primary" : "bg-white text-[#0B3363] border border-[#0B3363]/10"
              }`}
            >
              {DIVISION_LABELS[s.competitions?.sponsor_name ?? ""] ?? s.competitions?.name}
            </button>
          ))}
        </div>

        {gameweeks.length > 0 && (
          <div className="admin-card px-4 py-3 mb-4 flex items-center justify-between">
            <button onClick={() => setGwIndex((i) => Math.max(0, i - 1))} disabled={gwIndex === 0} className="admin-icon-btn" aria-label="Previous">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <div className="font-display font-bold text-sm text-[#0B3363]">Match Week {currentGw?.number}</div>
            <button
              onClick={() => setGwIndex((i) => Math.min(gameweeks.length - 1, i + 1))}
              disabled={gwIndex === gameweeks.length - 1}
              className="admin-icon-btn"
              aria-label="Next"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {gwMatches.map((m) => (
            <button
              key={m.id}
              onClick={() => router.push(`/admin/live/${m.id}`)}
              className="admin-card p-4 text-left flex items-center justify-between hover:border-[#3EA0D9]/50 transition-colors"
            >
              <div className="min-w-0">
                <div className="font-semibold text-[#0B3363] truncate">
                  {teamName(m.home_team_id)} <span className="text-slate-400 font-normal">vs</span> {teamName(m.away_team_id)}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {m.kickoff_at ? new Date(m.kickoff_at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "TBD"}
                  {m.venue ? ` · ${m.venue}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                {(m.status === "completed" || m.status === "live") && (
                  <span className="font-display font-bold text-sm bg-[#0B3363]/5 px-2 py-1 rounded">
                    {m.home_score ?? 0}–{m.away_score ?? 0}
                  </span>
                )}
                <span className={`admin-pill ${m.status === "live" ? "admin-pill-warning" : m.status === "completed" ? "admin-pill-success" : "admin-pill-neutral"}`}>
                  {m.status}
                </span>
              </div>
            </button>
          ))}
          {gwMatches.length === 0 && <div className="admin-empty">No matches in this match week.</div>}
        </div>
      </div>
    </div>
  );
}
