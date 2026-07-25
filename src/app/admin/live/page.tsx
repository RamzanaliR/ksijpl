"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

type Season = { id: string; label: string; competitions: { name: string; division_id: string; sponsor_name: string } | null };
type Team = { id: string; name: string; slug: string | null; short_name: string | null; division_id: string };
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
        .select("id,label,competitions(name,division_id,sponsor_name,type)")
        .order("label");
      const ordered = [...((data as any) ?? [])]
        .filter((s: any) => s.competitions?.type === "league")
        .sort(
          (a: any, b: any) =>
            ["gofiber", "Care & Cure"].indexOf(a.competitions?.sponsor_name) -
            ["gofiber", "Care & Cure"].indexOf(b.competitions?.sponsor_name)
        );
      setSeasons(ordered);
      if (ordered.length) setSelectedSeason(ordered[0].id);
      const { data: tms } = await supabase.from("teams").select("id,name,slug,short_name,division_id").order("name");
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
      setGwIndex(0);
    })();
  }, [selectedSeason]);

  function team(id: string) {
    return teams.find((t) => t.id === id);
  }

  const currentGw = gameweeks[gwIndex];
  const gwMatches = currentGw ? matches.filter((m) => m.gameweek_id === currentGw.id) : matches.filter((m) => !m.gameweek_id);

  const gwDates = gwMatches
    .map((m) => (m.kickoff_at ? new Date(m.kickoff_at) : null))
    .filter((d): d is Date => !!d)
    .sort((a, b) => a.getTime() - b.getTime());
  const gwDateRange =
    gwDates.length === 0
      ? null
      : gwDates[0].toDateString() === gwDates[gwDates.length - 1].toDateString()
      ? gwDates[0].toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })
      : `${gwDates[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${gwDates[gwDates.length - 1].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

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
            <div className="text-center">
              <div className="font-display font-bold text-sm text-[#0B3363]">Match Week {currentGw?.number}</div>
              {gwDateRange && <div className="text-xs text-slate-400">{gwDateRange}</div>}
            </div>
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
          {gwMatches.map((m) => {
            const home = team(m.home_team_id);
            const away = team(m.away_team_id);
            return (
              <button
                key={m.id}
                onClick={() => router.push(`/admin/live/${m.id}`)}
                className="admin-card p-4 text-left hover:border-[#3EA0D9]/50 transition-colors"
              >
                {/* venue + time */}
                <div className="text-center mb-3">
                  <span className="text-xs font-semibold text-red-600 bg-red-500/8 px-2.5 py-1 rounded-lg">
                    {m.kickoff_at
                      ? new Date(m.kickoff_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
                      : "Time TBD"}
                    {m.venue ? ` · ${m.venue}` : ""}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  {/* Home */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <TeamCrest team={home} />
                    <span className="font-semibold text-[#0B3363] text-sm leading-tight line-clamp-2">{home?.name ?? "—"}</span>
                  </div>

                  {/* Score */}
                  <div className="flex flex-col items-center flex-shrink-0 px-2">
                    {m.status === "scheduled" ? (
                      <span className="text-xs font-semibold text-[#0B3363] bg-[#3EA0D9]/10 px-3 py-1.5 rounded-lg">vs</span>
                    ) : (
                      <span className="font-display font-bold text-lg text-[#0B3363] bg-[#3EA0D9]/10 px-3 py-1 rounded-lg">
                        {m.home_score ?? 0}–{m.away_score ?? 0}
                      </span>
                    )}
                    <span className={`text-[10px] font-bold uppercase mt-1 ${m.status === "live" ? "text-red-600" : m.status === "completed" ? "text-green-600" : "text-slate-400"}`}>
                      {m.status === "live" ? "● Live" : m.status === "completed" ? "FT" : "Scheduled"}
                    </span>
                  </div>

                  {/* Away */}
                  <div className="flex items-center gap-2 flex-1 min-w-0 justify-end text-right">
                    <span className="font-semibold text-[#0B3363] text-sm leading-tight line-clamp-2">{away?.name ?? "—"}</span>
                    <TeamCrest team={away} />
                  </div>
                </div>
              </button>
            );
          })}
          {gwMatches.length === 0 && <div className="admin-empty">No matches in this match week.</div>}
        </div>
      </div>
    </div>
  );
}

function TeamCrest({ team }: { team: Team | undefined }) {
  return (
    <div className="w-11 h-11 rounded-lg bg-white border-2 border-[#0B3363] flex items-center justify-center flex-shrink-0 overflow-hidden">
      {team?.slug ? (
        <Image src={`/sponsors/${team.slug}.png`} alt={team.name} width={36} height={36} className="object-contain w-full h-full" />
      ) : (
        <span className="font-display font-bold text-[#0B3363] text-xs">
          {team?.short_name || team?.name?.slice(0, 2).toUpperCase() || "—"}
        </span>
      )}
    </div>
  );
}
