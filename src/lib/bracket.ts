// Single-elimination bracket generation with automatic bye handling
// for entrant counts that aren't a power of two.

export type BracketMatchSpec = {
  round: number; // 1-indexed, round 1 = first round played
  roundName: string;
  position: number; // 0-indexed position within the round
  home: string | null; // team id, or null if TBD (waiting on a bye/earlier winner)
  away: string | null;
  isBye: boolean; // true if `home` gets a walkover (no match needed)
};

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function roundName(teamsRemaining: number): string {
  if (teamsRemaining <= 2) return "Final";
  if (teamsRemaining <= 4) return "Semifinal";
  if (teamsRemaining <= 8) return "Quarterfinal";
  return `Round of ${teamsRemaining}`;
}

/**
 * Builds the full bracket skeleton for a knockout cup.
 * Returns rounds in order, each a list of match specs. Round 1 includes
 * byes (a "match" with only a home team, no away, isBye=true) for entrants
 * that skip straight to round 2 when the entrant count isn't a power of two.
 * Every later round is fully populated with TBD (null/null) placeholders,
 * to be filled in as earlier rounds are decided.
 */
export function generateBracket(entrantTeamIds: string[]): BracketMatchSpec[][] {
  const n = entrantTeamIds.length;
  const bracketSize = nextPowerOfTwo(n);
  const byeCount = bracketSize - n;

  // Shuffle entrants for random seeding
  const shuffled = [...entrantTeamIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const totalRounds = Math.log2(bracketSize);
  const rounds: BracketMatchSpec[][] = [];

  // Round 1: byes get a walkover slot, everyone else pairs up
  const byeTeams = shuffled.slice(0, byeCount);
  const playingTeams = shuffled.slice(byeCount);

  const round1: BracketMatchSpec[] = [];
  byeTeams.forEach((teamId, i) => {
    round1.push({
      round: 1,
      roundName: roundName(bracketSize),
      position: i,
      home: teamId,
      away: null,
      isBye: true,
    });
  });
  for (let i = 0; i < playingTeams.length; i += 2) {
    round1.push({
      round: 1,
      roundName: roundName(bracketSize),
      position: byeTeams.length + i / 2,
      home: playingTeams[i],
      away: playingTeams[i + 1] ?? null,
      isBye: false,
    });
  }
  // Sort by position so round1 aligns with round2 pairing (position i and i+1 feed into round2 position i/2)
  round1.sort((a, b) => a.position - b.position);
  rounds.push(round1);

  // Remaining rounds: all TBD, sized bracketSize/2, bracketSize/4, ... down to 1 (the Final)
  let matchesInRound = bracketSize / 4;
  for (let r = 2; r <= totalRounds; r++) {
    const teamsRemainingAtThisRound = bracketSize / Math.pow(2, r - 1);
    const roundMatches: BracketMatchSpec[] = [];
    for (let i = 0; i < matchesInRound; i++) {
      roundMatches.push({
        round: r,
        roundName: roundName(teamsRemainingAtThisRound),
        position: i,
        home: null,
        away: null,
        isBye: false,
      });
    }
    rounds.push(roundMatches);
    matchesInRound = matchesInRound / 2;
  }

  return rounds;
}
