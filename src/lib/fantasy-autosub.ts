import type { Position } from "@/lib/fantasy-scoring";

export type SquadPlayer = {
  playerId: string;
  position: Position;
  played: boolean;
  benchOrder: number | null; // 1-4 for bench players, null for starters
};

export type FormationRule = {
  startingGkCount: number; // exact number of GKs required in the final lineup (default 1)
};

export type AutoSubResult = {
  finalLineup: string[]; // player IDs that actually count for scoring this gameweek
  substitutions: { outPlayerId: string; inPlayerId: string }[];
};

/**
 * Applies auto-substitutions: any starter who didn't play is swapped for the
 * first bench player (in bench-order 1→4) who did play, as long as the swap
 * keeps the lineup formation-legal. Each bench player can only be used once.
 */
export function applyAutoSubs(
  starters: SquadPlayer[],
  bench: SquadPlayer[],
  rule: FormationRule = { startingGkCount: 1 }
): AutoSubResult {
  const orderedBench = [...bench].sort((a, b) => (a.benchOrder ?? 99) - (b.benchOrder ?? 99));
  const usedBenchIds = new Set<string>();
  const substitutions: { outPlayerId: string; inPlayerId: string }[] = [];

  // Working lineup: starts as the nominal starting 8, positions get replaced as subs land
  const lineup = [...starters];

  function isLegal(candidateLineup: SquadPlayer[]): boolean {
    const gkCount = candidateLineup.filter((p) => p.position === "GK").length;
    return gkCount === rule.startingGkCount;
  }

  for (let i = 0; i < lineup.length; i++) {
    const starter = lineup[i];
    if (starter.played) continue; // no sub needed

    for (const sub of orderedBench) {
      if (usedBenchIds.has(sub.playerId)) continue;
      if (!sub.played) continue; // this sub didn't play either — try the next one in priority order

      const trialLineup = [...lineup];
      trialLineup[i] = sub;

      if (isLegal(trialLineup)) {
        lineup[i] = sub;
        usedBenchIds.add(sub.playerId);
        substitutions.push({ outPlayerId: starter.playerId, inPlayerId: sub.playerId });
        break;
      }
      // Illegal swap (would break formation) — skip to the next bench priority
    }
  }

  return {
    finalLineup: lineup.map((p) => p.playerId),
    substitutions,
  };
}

/**
 * Determines who actually wears the captain's armband for scoring purposes:
 * the designated captain if they ended up in the final (post-sub) lineup and played,
 * otherwise the vice-captain if they qualify, otherwise nobody gets the multiplier.
 */
export function resolveCaptain(
  finalLineupIds: string[],
  playedMap: Record<string, boolean>,
  captainId: string | null,
  viceCaptainId: string | null
): string | null {
  if (captainId && finalLineupIds.includes(captainId) && playedMap[captainId]) {
    return captainId;
  }
  if (viceCaptainId && finalLineupIds.includes(viceCaptainId) && playedMap[viceCaptainId]) {
    return viceCaptainId;
  }
  return null;
}
