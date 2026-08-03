"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TeamBadge from "@/components/TeamBadge";

export type DivisionPanelData = {
  key: string;
  label: string;
  competitionName: string;
  seasonLabel: string;
  standings: any[];
  teamMap: Record<string, string>;
  teamSlugs: Record<string, string | null>;
  teamLogoUrls: Record<string, string>;
  results: any[];
  fixtures: any[];
  matchWeekInProgress: boolean;
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function Carousel<T>({
  items,
  pageSize,
  renderItem,
  emptyText,
}: {
  items: T[];
  pageSize: number;
  renderItem: (item: T) => React.ReactNode;
  emptyText: string;
}) {
  const pages = chunk(items, pageSize);
  const [page, setPage] = useState(0);
  const touchStartX = useRef<number | null>(null);

  if (items.length === 0) {
    return <div className="py-4 text-center opacity-50 text-xs">{emptyText}</div>;
  }

  const canPrev = page > 0;
  const canNext = page < pages.length - 1;

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta > 40 && canPrev) setPage((p) => p - 1);
    else if (delta < -40 && canNext) setPage((p) => p + 1);
    touchStartX.current = null;
  }

  return (
    <div>
      <div className="overflow-hidden w-full min-w-0" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="flex transition-transform duration-300 ease-out" style={{ transform: `translateX(-${page * 100}%)` }}>
          {pages.map((pageItems, i) => (
            <div key={i} className="w-full flex-shrink-0 space-y-1">
              {pageItems.map((item) => renderItem(item))}
            </div>
          ))}
        </div>
      </div>
      {pages.length > 1 && (
        <div className="flex items-center justify-center gap-3 mt-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={!canPrev}
            aria-label="Previous"
            className="w-6 h-6 rounded-full flex items-center justify-center text-[#0B3363]/50 dark:text-white/50 hover:text-[#0B3363] dark:hover:text-white disabled:opacity-25 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div className="flex items-center gap-1.5">
            {pages.map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                aria-label={`Page ${i + 1}`}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === page ? "bg-[#3EA0D9]" : "bg-[#0B3363]/15 dark:bg-white/20"}`}
              />
            ))}
          </div>
          <button
            onClick={() => setPage((p) => Math.min(pages.length - 1, p + 1))}
            disabled={!canNext}
            aria-label="Next"
            className="w-6 h-6 rounded-full flex items-center justify-center text-[#0B3363]/50 dark:text-white/50 hover:text-[#0B3363] dark:hover:text-white disabled:opacity-25 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}

function ResponsiveList<T>({
  items,
  pageSize,
  renderItem,
  emptyText,
}: {
  items: T[];
  pageSize: number;
  renderItem: (item: T) => React.ReactNode;
  emptyText: string;
}) {
  if (items.length === 0) {
    return <div className="py-4 text-center opacity-50 text-xs">{emptyText}</div>;
  }
  return (
    <>
      <div className="md:hidden">
        <Carousel items={items} pageSize={pageSize} renderItem={renderItem} emptyText={emptyText} />
      </div>
      <div className="hidden md:block space-y-1">{items.map((item) => renderItem(item))}</div>
    </>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-block bg-white text-[#0B3363] font-display font-bold text-lg px-3 py-1.5 rounded-lg mb-4">
      {children}
    </div>
  );
}

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

      <div className="grid md:grid-cols-3 gap-5 items-start">
        {/* Table */}
        <div className="rounded-2xl p-5 bg-[#0B3363] text-white dark:bg-white dark:text-[#0B3363] flex flex-col">
          <CardTitle>League Table</CardTitle>
          <div className="flex-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase opacity-60">
                  <th className="text-left pb-2">#</th>
                  <th className="text-left pb-2">Team</th>
                  <th className="text-right pb-2">GP</th>
                  <th className="text-right pb-2">W</th>
                  <th className="text-right pb-2">PTS</th>
                </tr>
              </thead>
              <tbody>
                {d.standings.map((row: any, i: number) => (
                  <tr key={row.team_id} className="border-t border-white/10 dark:border-[#0B3363]/10">
                    <td className="py-1.5">{i + 1}</td>
                    <td className="py-1.5">
                      <Link href={`/teams/${row.team_id}`} className="hover:text-[#F4B400] transition-colors">
                        <TeamBadge name={d.teamMap[row.team_id]} slug={d.teamSlugs[row.team_id]} logoUrl={d.teamLogoUrls[row.team_id]} size={20} />
                      </Link>
                    </td>
                    <td className="py-1.5 text-right opacity-70">{row.played}</td>
                    <td className="py-1.5 text-right opacity-70">{row.won}</td>
                    <td className="py-1.5 text-right font-bold text-[#F4B400]">{row.points}</td>
                  </tr>
                ))}
                {d.standings.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-center opacity-60 text-xs">No completed matches yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Results */}
        <div className="rounded-2xl p-5 border border-[#0B3363]/10 dark:border-white/10 min-w-0 flex flex-col">
          <CardTitle>
            {d.matchWeekInProgress ? (
              <span className="flex items-center gap-2 text-red-600">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                Live Results
              </span>
            ) : (
              "Latest Results"
            )}
          </CardTitle>
          <div className="flex-1">
            <ResponsiveList
              items={d.results}
              pageSize={5}
              emptyText="No results yet"
              renderItem={(m: any) => (
                <a
                  href={`/matches/${m.id}`}
                  key={m.id}
                  className="flex items-center justify-between py-5 border-t border-[#0B3363]/10 dark:border-white/10 first:border-0 hover:opacity-80 transition-opacity"
                >
                  <TeamBadge name={d.teamMap[m.home_team_id]} slug={d.teamSlugs[m.home_team_id]} logoUrl={d.teamLogoUrls[m.home_team_id]} size={36} className="w-2/5 font-bold text-sm" />
                  <span className="font-display font-bold text-lg flex-shrink-0 px-2">
                    {m.home_score}–{m.away_score}
                  </span>
                  <TeamBadge name={d.teamMap[m.away_team_id]} slug={d.teamSlugs[m.away_team_id]} logoUrl={d.teamLogoUrls[m.away_team_id]} size={36} className="w-2/5 flex-row-reverse text-right font-bold text-sm" />
                </a>
              )}
            />
          </div>
        </div>

        {/* Fixtures */}
        <div className="rounded-2xl p-5 border border-[#0B3363]/10 dark:border-white/10 min-w-0 flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <CardTitle>Upcoming Fixtures</CardTitle>
            <a href="/fixtures" className="text-xs font-semibold text-[#3EA0D9] hover:underline">View all →</a>
          </div>
          <div className="flex-1">
            <ResponsiveList
              items={d.fixtures}
              pageSize={5}
              emptyText="No fixtures scheduled"
              renderItem={(m: any) =>
                m.status === "live" ? (
                  <a
                    href={`/matches/${m.id}`}
                    key={m.id}
                    className="flex items-center justify-between py-1.5 border-t border-[#0B3363]/10 dark:border-white/10 first:border-0 hover:opacity-80 transition-opacity"
                  >
                    <TeamBadge name={d.teamMap[m.home_team_id]} slug={d.teamSlugs[m.home_team_id]} logoUrl={d.teamLogoUrls[m.home_team_id]} size={36} className="w-2/5 font-bold text-sm" />
                    <span className="font-display font-bold text-xs bg-red-500/10 text-red-600 px-2 py-0.5 rounded flex items-center gap-1 flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      {m.home_score ?? 0}–{m.away_score ?? 0}
                    </span>
                    <TeamBadge name={d.teamMap[m.away_team_id]} slug={d.teamSlugs[m.away_team_id]} logoUrl={d.teamLogoUrls[m.away_team_id]} size={36} className="w-2/5 flex-row-reverse text-right font-bold text-sm" />
                  </a>
                ) : (
                  <a
                    href={`/matches/${m.id}`}
                    key={m.id}
                    className="flex items-center justify-between py-1.5 border-t border-[#0B3363]/10 dark:border-white/10 first:border-0 hover:opacity-80 transition-opacity"
                  >
                    <TeamBadge name={d.teamMap[m.home_team_id]} slug={d.teamSlugs[m.home_team_id]} logoUrl={d.teamLogoUrls[m.home_team_id]} size={36} className="w-2/5 font-bold text-sm" />
                    <span className="font-display font-bold text-xs flex-shrink-0 px-2 text-center">
                      {m.kickoff_at ? new Date(m.kickoff_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "TBD"}
                    </span>
                    <TeamBadge name={d.teamMap[m.away_team_id]} slug={d.teamSlugs[m.away_team_id]} logoUrl={d.teamLogoUrls[m.away_team_id]} size={36} className="w-2/5 flex-row-reverse text-right font-bold text-sm" />
                  </a>
                )
              }
            />
          </div>
        </div>
      </div>
    </section>
  );
}
