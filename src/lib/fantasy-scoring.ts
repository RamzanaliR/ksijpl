// Fantasy scoring rules engine.
// Pure functions — no I/O — so they're easy to test and reuse from any
// context (an admin "compute gameweek" action, a scheduled job, etc).

export type Position = "GK" | "DEF" | "MID" | "FWD";

export type PlayerMatchStats = {
  position: Position;
  played: boolean; // from match_attendance
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  penaltySaves: number; // GK only, but harmless if non-zero elsewhere
  penaltyMisses: number;
  goalsConceded: number; // by the player's own team in this match (GK/DEF only matters)
  cleanSheet: boolean; // player's team conceded 0
  isManOfTheMatch: boolean;
};

export type ScoreBreakdown = {
  appearance: number;
  goals: number;
  assists: number;
  cleanSheet: number;
  penaltySaves: number;
  penaltyMisses: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  goalsConceded: number;
  manOfTheMatch: number;
  base: number; // sum of all of the above, before captain multiplier
  final: number; // base, or base * 2 if captained
};

const GOAL_POINTS: Record<Position, number> = { GK: 10, DEF: 6, MID: 5, FWD: 4 };

/**
 * Scores a single player's single-match contribution.
 * A player who didn't play scores 0 regardless of any stats passed in
 * (defensive: real data shouldn't have events for a non-appearance, but
 * we don't want a data-entry mistake to silently award points).
 */
export function scorePlayerMatch(stats: PlayerMatchStats, isCaptain: boolean): ScoreBreakdown {
  if (!stats.played) {
    const zero: ScoreBreakdown = {
      appearance: 0, goals: 0, assists: 0, cleanSheet: 0, penaltySaves: 0,
      penaltyMisses: 0, yellowCards: 0, redCards: 0, ownGoals: 0, goalsConceded: 0,
      manOfTheMatch: 0, base: 0, final: 0,
    };
    return zero;
  }

  const appearance = 1;
  const goals = stats.goals * GOAL_POINTS[stats.position];
  const assists = stats.assists * 3;
  const cleanSheet = (stats.position === "GK" || stats.position === "DEF") && stats.cleanSheet ? 4 : 0;
  const penaltySaves = stats.position === "GK" ? stats.penaltySaves * 5 : 0;
  const penaltyMisses = stats.penaltyMisses * -2;
  const yellowCards = stats.yellowCards * -1;
  const redCards = stats.redCards * -2;
  const ownGoals = stats.ownGoals * -2;
  const goalsConceded =
    stats.position === "GK" || stats.position === "DEF"
      ? Math.floor(stats.goalsConceded / 3) * -3
      : 0;
  const manOfTheMatch = stats.isManOfTheMatch ? 3 : 0;

  const base =
    appearance + goals + assists + cleanSheet + penaltySaves + penaltyMisses +
    yellowCards + redCards + ownGoals + goalsConceded + manOfTheMatch;

  const final = isCaptain ? base * 2 : base;

  return {
    appearance, goals, assists, cleanSheet, penaltySaves, penaltyMisses,
    yellowCards, redCards, ownGoals, goalsConceded, manOfTheMatch, base, final,
  };
}
