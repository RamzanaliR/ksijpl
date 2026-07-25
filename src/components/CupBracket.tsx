"use client";

import { useState } from "react";

type Match = {
  id: string;
  gameweek_id: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  home_pens: number | null;
  away_pens: number | null;
  status: string;
};
type Gameweek = { id: string; number: number; round_name: string | null };
type CupData = {
  competition: { id: string; name: string };
  season: { id: string; label: string } | null;
  gameweeks: Gameweek[];
  matches: Match[];
  teamMap: Record<string, string>;
};

export default function CupBracket({ cups }: { cups: CupData[] }) {
  const [active, setActive] = useState(0);
  const cup = cups[active];
  if (!cup) return null;

  const finalRound = cup.gameweeks.length ? Math.max(...cup.gameweeks.map((g) => g.number)) : 0;
  const finalMatch = cup.matches.find((m) => cup.gameweeks.find((g) => g.id === m.gameweek_id)?.number === finalRound);
  const champion = (() => {
    if (!finalMatch || finalMatch.status !== "completed") return null;
    if (finalMatch.home_score !== finalMatch.away_score) {
      const id = finalMatch.home_score! > finalMatch.away_score! ? finalMatch.home_team_id : finalMatch.away_team_id;
      return id ? cup.teamMap[id] : null;
    }
    if (finalMatch.home_pens !== null && finalMatch.away_pens !== null) {
      const id = finalMatch.home_pens > finalMatch.away_pens ? finalMatch.home_team_id : finalMatch.away_team_id;
      return id ? cup.teamMap[id] : null;
    }
    return null;
  })();

  return (
    <div>
      <div className="flex items-center gap-2 mb-8">
        {cups.map((c, i) => (
          <button
            key={c.competition.id}
            onClick={() => setActive(i)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              i === active
                ? "bg-[#0B3363] text-white dark:bg-[#3EA0D9] dark:text-[#0B1220]"
                : "bg-[#0B3363]/5 dark:bg-white/10 hover:bg-[#0B3363]/10 dark:hover:bg-white/15"
            }`}
          >
            {c.competition.name}
          </button>
        ))}
      </div>

      {!cup.season ? (
        <div className="text-sm text-[#0B3363]/40 dark:text-white/40 rounded-2xl border border-dashed border-[#0B3363]/15 dark:border-white/15 p-8 text-center">
          No cup season has been set up yet.
        </div>
      ) : (
        <>
          <div className="text-xs font-bold uppercase tracking-wider text-[#3EA0D9] mb-4">{cup.season.label}</div>

          {champion && (
            <div className="rounded-2xl p-4 mb-6 bg-[#F4B400]/15 text-[#0B3363] dark:text-white font-display font-bold text-lg flex items-center gap-2">
              🏆 {champion} — Champions
            </div>
          )}

          <div className="flex gap-6 overflow-x-auto pb-2">
            {cup.gameweeks
              .slice()
              .sort((a, b) => a.number - b.number)
              .map((gw) => (
                <div key={gw.id} className="w-60 flex-shrink-0">
                  <h2 className="font-display font-bold text-sm mb-3">{gw.round_name ?? `Round ${gw.number}`}</h2>
                  <div className="flex flex-col gap-4">
                    {cup.matches
                      .filter((m) => m.gameweek_id === gw.id)
                      .map((m) => {
                        const homeName = m.home_team_id ? cup.teamMap[m.home_team_id] : null;
                        const awayName = m.away_team_id ? cup.teamMap[m.away_team_id] : null;
                        return (
                          <div key={m.id} className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 p-3">
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="truncate">{homeName ?? <span className="italic opacity-40">TBD</span>}</span>
                              {m.status === "completed" && (
                                <span className="font-display font-bold text-xs bg-[#0B3363]/5 dark:bg-white/10 px-2 py-0.5 rounded ml-2">
                                  {m.home_score}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="truncate">{awayName ?? <span className="italic opacity-40">TBD</span>}</span>
                              {m.status === "completed" && (
                                <span className="font-display font-bold text-xs bg-[#0B3363]/5 dark:bg-white/10 px-2 py-0.5 rounded ml-2">
                                  {m.away_score}
                                </span>
                              )}
                            </div>
                            {m.status === "completed" && m.home_score === m.away_score && m.home_pens !== null && (
                              <div className="text-[10px] opacity-50 mt-1">Pens {m.home_pens}–{m.away_pens}</div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            {cup.gameweeks.length === 0 && (
              <div className="text-sm text-[#0B3363]/40 dark:text-white/40 rounded-2xl border border-dashed border-[#0B3363]/15 dark:border-white/15 p-8 text-center w-full">
                The bracket hasn't been set yet.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
