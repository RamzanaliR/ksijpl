"use client";

import { useState } from "react";
import TeamBadge from "@/components/TeamBadge";

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
  next_match_id: string | null;
  next_match_slot: "home" | "away" | null;
};
type Gameweek = { id: string; number: number; round_name: string | null };
type CupData = {
  competition: { id: string; name: string };
  season: { id: string; label: string } | null;
  gameweeks: Gameweek[];
  matches: Match[];
  teamMap: Record<string, string>;
  teamSlugs: Record<string, string | null>;
};

type TreeNode = { match: Match; home: TreeNode | null; away: TreeNode | null };

function buildTree(matches: Match[]): TreeNode | null {
  const finalMatch = matches.find((m) => !m.next_match_id);
  if (!finalMatch) return null;
  function build(match: Match): TreeNode {
    const homeFeeder = matches.find((m) => m.next_match_id === match.id && m.next_match_slot === "home") ?? null;
    const awayFeeder = matches.find((m) => m.next_match_id === match.id && m.next_match_slot === "away") ?? null;
    return {
      match,
      home: homeFeeder ? build(homeFeeder) : null,
      away: awayFeeder ? build(awayFeeder) : null,
    };
  }
  return build(finalMatch);
}

function MatchBox({ match, teamMap, teamSlugs }: { match: Match; teamMap: Record<string, string>; teamSlugs: Record<string, string | null> }) {
  const homeName = match.home_team_id ? teamMap[match.home_team_id] : null;
  const awayName = match.away_team_id ? teamMap[match.away_team_id] : null;
  return (
    <div className="w-52 flex-shrink-0 rounded-xl border border-[#0B3363]/10 dark:border-white/10 bg-white dark:bg-white/5 shadow-sm p-2.5">
      <div className="flex items-center justify-between text-sm mb-1">
        {homeName ? (
          <TeamBadge name={homeName} slug={match.home_team_id ? teamSlugs[match.home_team_id] : null} size={18} className="min-w-0" />
        ) : (
          <span className="italic text-[#0B3363]/30 dark:text-white/30 text-xs">TBD</span>
        )}
        {match.status === "completed" && (
          <span className="font-display font-bold text-xs bg-[#0B3363]/5 dark:bg-white/10 px-1.5 py-0.5 rounded ml-2 flex-shrink-0">{match.home_score}</span>
        )}
      </div>
      <div className="flex items-center justify-between text-sm">
        {awayName ? (
          <TeamBadge name={awayName} slug={match.away_team_id ? teamSlugs[match.away_team_id] : null} size={18} className="min-w-0" />
        ) : (
          <span className="italic text-[#0B3363]/30 dark:text-white/30 text-xs">TBD</span>
        )}
        {match.status === "completed" && (
          <span className="font-display font-bold text-xs bg-[#0B3363]/5 dark:bg-white/10 px-1.5 py-0.5 rounded ml-2 flex-shrink-0">{match.away_score}</span>
        )}
      </div>
      {match.status === "completed" && match.home_score === match.away_score && match.home_pens !== null && (
        <div className="text-[10px] opacity-50 mt-1 text-center">Pens {match.home_pens}–{match.away_pens}</div>
      )}
    </div>
  );
}

function BracketBranch({
  node,
  side,
  teamMap,
  teamSlugs,
}: {
  node: TreeNode;
  side: "left" | "right";
  teamMap: Record<string, string>;
  teamSlugs: Record<string, string | null>;
}) {
  const hasChildren = !!(node.home || node.away);
  const children = (
    <div className={`flex flex-col gap-6 ${side === "left" ? "border-r-2 pr-4" : "border-l-2 pl-4"} border-[#0B3363]/15 dark:border-white/15`}>
      {node.home && <BracketBranch node={node.home} side={side} teamMap={teamMap} teamSlugs={teamSlugs} />}
      {node.away && <BracketBranch node={node.away} side={side} teamMap={teamMap} teamSlugs={teamSlugs} />}
    </div>
  );
  const box = <MatchBox match={node.match} teamMap={teamMap} teamSlugs={teamSlugs} />;
  return (
    <div className={`flex items-center gap-4 ${side === "right" ? "flex-row-reverse" : ""}`}>
      {hasChildren && children}
      {box}
    </div>
  );
}

function DesktopBracket({ cup, champion }: { cup: CupData; champion: string | null }) {
  const tree = buildTree(cup.matches);
  if (!tree) {
    return <div className="text-sm text-[#0B3363]/40 dark:text-white/40 p-8 text-center">The bracket hasn't been set yet.</div>;
  }
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex items-center justify-center gap-6 min-w-max px-4 py-6">
        {tree.home && <BracketBranch node={tree.home} side="left" teamMap={cup.teamMap} teamSlugs={cup.teamSlugs} />}
        <div className="flex flex-col items-center gap-2 flex-shrink-0">
          {champion && <span className="text-2xl">🏆</span>}
          <MatchBox match={tree.match} teamMap={cup.teamMap} teamSlugs={cup.teamSlugs} />
          <span className="text-[10px] font-bold uppercase text-[#3EA0D9]">Final</span>
        </div>
        {tree.away && <BracketBranch node={tree.away} side="right" teamMap={cup.teamMap} teamSlugs={cup.teamSlugs} />}
      </div>
    </div>
  );
}

function MobileBracket({ cup }: { cup: CupData }) {
  return (
    <div className="flex gap-6 overflow-x-auto pb-2">
      {cup.gameweeks
        .slice()
        .sort((a, b) => a.number - b.number)
        .map((gw) => (
          <div key={gw.id} className="w-56 flex-shrink-0">
            <h2 className="font-display font-bold text-sm mb-3">{gw.round_name ?? `Round ${gw.number}`}</h2>
            <div className="flex flex-col gap-4">
              {cup.matches
                .filter((m) => m.gameweek_id === gw.id)
                .map((m) => (
                  <MatchBox key={m.id} match={m} teamMap={cup.teamMap} teamSlugs={cup.teamSlugs} />
                ))}
            </div>
          </div>
        ))}
      {cup.gameweeks.length === 0 && (
        <div className="text-sm text-[#0B3363]/40 dark:text-white/40 rounded-2xl border border-dashed border-[#0B3363]/15 dark:border-white/15 p-8 text-center w-full">
          The bracket hasn't been set yet.
        </div>
      )}
    </div>
  );
}

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

          <div className="hidden md:block">
            <DesktopBracket cup={cup} champion={champion} />
          </div>
          <div className="md:hidden">
            <MobileBracket cup={cup} />
          </div>
        </>
      )}
    </div>
  );
}
