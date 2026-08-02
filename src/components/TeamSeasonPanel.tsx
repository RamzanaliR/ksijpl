"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type SeasonOption = { id: string; label: string };
type CurrentPlayer = {
  id: string;
  squad_number: number | null;
  full_name: string;
  nickname: string | null;
  position: string | null;
  gp: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  motm: number;
};
type Stats = { played: number; won: number; drawn: number; lost: number; gf: number; ga: number; pts: number };
type ArchivedPlayer = { id: string; full_name: string; position: string | null };

export default function TeamSeasonPanel({
  teamId,
  seasons,
  currentSeasonId,
  currentPlayers,
  currentStats,
}: {
  teamId: string;
  seasons: SeasonOption[];
  currentSeasonId: string;
  currentPlayers: CurrentPlayer[];
  currentStats: Stats;
}) {
  const [seasonId, setSeasonId] = useState(currentSeasonId);
  const [loading, setLoading] = useState(false);
  const [archivedPlayers, setArchivedPlayers] = useState<ArchivedPlayer[]>([]);
  const [archivedStats, setArchivedStats] = useState<Stats | null>(null);

  const isCurrent = seasonId === currentSeasonId;

  useEffect(() => {
    if (isCurrent) return;
    setLoading(true);
    (async () => {
      const [{ data: squad }, { data: standingsRow }, { data: archivedRow }] = await Promise.all([
        supabase
          .from("season_players")
          .select("id,players(id,full_name,position)")
          .eq("season_id", seasonId)
          .eq("team_id", teamId),
        supabase
          .from("standings")
          .select("played,won,drawn,lost,goals_for,goals_against,points")
          .eq("season_id", seasonId)
          .eq("team_id", teamId)
          .maybeSingle(),
        supabase
          .from("season_standings")
          .select("played,won,drawn,lost,goals_for,goals_against,points")
          .eq("season_id", seasonId)
          .eq("team_id", teamId)
          .maybeSingle(),
      ]);

      setArchivedPlayers(
        (squad ?? []).map((r: any) => ({ id: r.players?.id, full_name: r.players?.full_name ?? "—", position: r.players?.position ?? null }))
      );

      const row = standingsRow && (standingsRow.played ?? 0) > 0 ? standingsRow : archivedRow;
      setArchivedStats(
        row
          ? {
              played: row.played ?? 0,
              won: row.won ?? 0,
              drawn: row.drawn ?? 0,
              lost: row.lost ?? 0,
              gf: row.goals_for ?? 0,
              ga: row.goals_against ?? 0,
              pts: row.points ?? 0,
            }
          : null
      );
      setLoading(false);
    })();
  }, [seasonId, isCurrent, teamId]);

  const stats = isCurrent ? currentStats : archivedStats;

  return (
    <section className="min-w-0">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h2 className="font-display font-bold text-lg">Squad &amp; Stats</h2>
        <select
          value={seasonId}
          onChange={(e) => setSeasonId(e.target.value)}
          className="rounded-lg text-sm font-semibold px-3 py-1.5 bg-[#0B3363]/5 dark:bg-white/10 text-[#0B3363] dark:text-white border-none outline-none"
        >
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-6">
        {[
          ["P", stats?.played ?? "—"],
          ["W", stats?.won ?? "—"],
          ["D", stats?.drawn ?? "—"],
          ["L", stats?.lost ?? "—"],
          ["GF", stats?.gf ?? "—"],
          ["GA", stats?.ga ?? "—"],
          ["PTS", stats?.pts ?? "—"],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-xl bg-white border border-[#0B3363]/10 shadow-sm py-2 text-center">
            <div className="text-[10px] font-bold uppercase text-[#0B3363]/40">{label}</div>
            <div className="font-display font-bold text-lg text-[#0B3363]">{value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 p-6 text-center text-sm text-[#0B3363]/40 dark:text-white/40">
          Loading…
        </div>
      ) : isCurrent ? (
        currentPlayers.length === 0 ? (
          <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 p-6 text-center text-sm text-[#0B3363]/40 dark:text-white/40">
            No players registered yet.
          </div>
        ) : (
          <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase text-[#0B3363]/40 dark:text-white/40 border-b border-[#0B3363]/10 dark:border-white/10">
                    <th className="text-left py-2 px-3">#</th>
                    <th className="text-left py-2 px-3">Name</th>
                    <th className="text-left py-2 px-3">Pos</th>
                    <th className="text-right py-2 px-2">GP</th>
                    <th className="text-right py-2 px-2">G</th>
                    <th className="text-right py-2 px-2">A</th>
                    <th className="text-right py-2 px-2">YC</th>
                    <th className="text-right py-2 px-2">RC</th>
                    <th className="text-right py-2 px-3">MM</th>
                  </tr>
                </thead>
                <tbody>
                  {currentPlayers.map((p) => (
                    <tr key={p.id} className="border-b border-[#0B3363]/5 dark:border-white/5 last:border-0">
                      <td className="py-2 px-3 text-[#0B3363]/40 dark:text-white/40">{p.squad_number ?? "—"}</td>
                      <td className="py-2 px-3 truncate max-w-[160px]">
                        {p.full_name}
                        {p.nickname && <span className="text-xs text-[#0B3363]/40 dark:text-white/40"> "{p.nickname}"</span>}
                      </td>
                      <td className="py-2 px-3 text-xs font-bold text-[#3EA0D9]">{p.position ?? "—"}</td>
                      <td className="py-2 px-2 text-right">{p.gp}</td>
                      <td className="py-2 px-2 text-right">{p.goals}</td>
                      <td className="py-2 px-2 text-right">{p.assists}</td>
                      <td className="py-2 px-2 text-right">{p.yellow}</td>
                      <td className="py-2 px-2 text-right">{p.red}</td>
                      <td className="py-2 px-3 text-right">{p.motm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : archivedPlayers.length === 0 ? (
        <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 p-6 text-center text-sm text-[#0B3363]/40 dark:text-white/40">
          Squad not recorded for this season yet.
        </div>
      ) : (
        <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase text-[#0B3363]/40 dark:text-white/40 border-b border-[#0B3363]/10 dark:border-white/10">
                  <th className="text-left py-2 px-3">Name</th>
                  <th className="text-left py-2 px-3">Pos</th>
                </tr>
              </thead>
              <tbody>
                {archivedPlayers.map((p) => (
                  <tr key={p.id} className="border-b border-[#0B3363]/5 dark:border-white/5 last:border-0">
                    <td className="py-2 px-3">{p.full_name}</td>
                    <td className="py-2 px-3 text-xs font-bold text-[#3EA0D9]">{p.position ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
