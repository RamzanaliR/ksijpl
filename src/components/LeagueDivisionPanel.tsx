"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export type DivisionPanelData = {
  key: string;
  label: string;
  competitionName: string;
  seasonLabel: string;
  standings: any[];
  teamMap: Record<string, string>;
  results: any[];
  fixtures: any[];
  matchWeekInProgress: boolean;
};

export default function LeagueDivisionPanel({ divisions }: { divisions: DivisionPanelData[] }) {
  const [active, setActive] = useState(0);
  const router = useRouter();
  const d = divisions[active];

  const anyLive = divisions.some((dv) => dv.fixtures.some((m) => m.status === "live"));

  useEffect(() => {
    if (!anyLive) return;
    const id = setInterval(() => router.refresh(), 30000);
    return () => clearInterval(id);
  }, [anyLive, router]);

  if (!d) return null;

  return (
    <section className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center gap-2 mb-5">
        {divisions.map((dv, i) => (
          <button
            key={dv.key}
            onClick={() => setActive(i)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              i === active
                ? "bg-[#0B3363] text-white dark:bg-[#3EA0D9] dark:text-[#0B1220]"
                : "bg-[#0B3363]/5 dark:bg-white/10 hover:bg-[#0B3363]/10 dark:hover:bg-white/15"
            }`}
          >
            {dv.label}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {/* Table */}
        <div className="rounded-2xl p-5 bg-[#0B3363] text-white dark:bg-white dark:text-[#0B3363]">
          <h3 className="font-display font-bold text-sm uppercase tracking-wide mb-4 opacity-80">
            Table — {d.competitionName}
          </h3>
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase opacity-60">
                  <th className="text-left pb-2">#</th>
                  <th className="text-left pb-2">Team</th>
                  <th className="text-right pb-2">P</th>
                  <th className="text-right pb-2">Pts</th>
                </tr>
              </thead>
              <tbody>
                {d.standings.map((row: any, i: number) => (
                  <tr key={row.team_id} className="border-t border-white/10 dark:border-[#0B3363]/10">
                    <td className="py-1.5">{i + 1}</td>
                    <td className="py-1.5">
                      <Link href={`/teams/${row.team_id}`} className="hover:text-[#F4B400] transition-colors">
                        {d.teamMap[row.team_id]}
                      </Link>
                    </td>
                    <td className="py-1.5 text-right opacity-70">{row.played}</td>
                    <td className="py-1.5 text-right font-bold text-[#F4B400]">{row.points}</td>
                  </tr>
                ))}
                {d.standings.length === 0 && (
                  <tr><td colSpan={4} className="py-4 text-center opacity-60 text-xs">No completed matches yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Results */}
        <div className="rounded-2xl p-5 border border-[#0B3363]/10 dark:border-white/10">
          <h3 className="font-display font-bold text-sm uppercase tracking-wide mb-4 opacity-70 flex items-center gap-2">
            {d.matchWeekInProgress ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-red-600 dark:text-red-400">Live Results</span>
              </>
            ) : (
              "Latest Results"
            )}
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory -mx-1 px-1">
            {d.results.map((m: any) => (
              <div
                key={m.id}
                className="w-32 flex-shrink-0 snap-start rounded-xl border border-[#0B3363]/10 dark:border-white/10 p-3 text-center"
              >
                <div className="text-xs font-medium leading-tight line-clamp-2 min-h-[2rem]">{d.teamMap[m.home_team_id]}</div>
                <div className="font-display font-bold text-base my-1.5 bg-[#0B3363]/5 dark:bg-white/10 rounded px-2 py-1 inline-block">
                  {m.home_score}–{m.away_score}
                </div>
                <div className="text-xs font-medium leading-tight line-clamp-2 min-h-[2rem]">{d.teamMap[m.away_team_id]}</div>
              </div>
            ))}
            {d.results.length === 0 && <div className="py-4 text-center opacity-50 text-xs w-full">No results yet</div>}
          </div>
        </div>

        {/* Fixtures */}
        <div className="rounded-2xl p-5 border border-[#0B3363]/10 dark:border-white/10">
          <h3 className="font-display font-bold text-sm uppercase tracking-wide mb-4 opacity-70">Upcoming Fixtures</h3>
          <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory -mx-1 px-1">
            {d.fixtures.map((m: any) => (
              <div
                key={m.id}
                className="w-32 flex-shrink-0 snap-start rounded-xl border border-[#0B3363]/10 dark:border-white/10 p-3 text-center"
              >
                <div className="text-xs font-medium leading-tight line-clamp-2 min-h-[2rem]">{d.teamMap[m.home_team_id]}</div>
                {m.status === "live" ? (
                  <div className="font-display font-bold text-base my-1.5 bg-red-500/10 text-red-600 rounded px-2 py-1 inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    {m.home_score ?? 0}–{m.away_score ?? 0}
                  </div>
                ) : (
                  <div className="text-[10px] opacity-50 my-1.5">
                    {m.kickoff_at ? new Date(m.kickoff_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "TBD"}
                  </div>
                )}
                <div className="text-xs font-medium leading-tight line-clamp-2 min-h-[2rem]">{d.teamMap[m.away_team_id]}</div>
              </div>
            ))}
            {d.fixtures.length === 0 && <div className="py-4 text-center opacity-50 text-xs w-full">No fixtures scheduled</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
