// Round-robin fixture generation (circle method) with greedy home/away balancing.
// For n teams, produces n-1 rounds (or n rounds if n is odd, with one bye per round),
// each team playing every other team exactly once, and each team's home-game count
// kept as close to n/2 as possible (e.g. 20 teams -> 19 games -> 10 home / 9 away).

export type RoundRobinPairing = { home: string; away: string };

export function generateRoundRobin(teamIds: string[]) {
  const BYE = "__BYE__";
  let arr = [...teamIds];
  if (arr.length % 2 !== 0) arr.push(BYE);
  const n = arr.length;

  const homeCount: Record<string, number> = {};
  teamIds.forEach((t) => (homeCount[t] = 0));

  const rounds: RoundRobinPairing[][] = [];

  for (let r = 0; r < n - 1; r++) {
    const pairings: RoundRobinPairing[] = [];
    for (let i = 0; i < n / 2; i++) {
      const t1 = arr[i];
      const t2 = arr[n - 1 - i];
      if (t1 === BYE || t2 === BYE) continue;

      let home = t1;
      let away = t2;
      if (homeCount[t2] < homeCount[t1]) {
        home = t2;
        away = t1;
      } else if (homeCount[t1] === homeCount[t2] && (r + i) % 2 === 1) {
        home = t2;
        away = t1;
      }
      homeCount[home]++;
      pairings.push({ home, away });
    }
    rounds.push(pairings);
    // rotate, keeping arr[0] fixed
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }

  return { rounds, homeCount };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function nextAllowedDate(date: Date, allowedDows: Set<number>): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  let guard = 0;
  while (!allowedDows.has(d.getDay()) && guard < 30) {
    d.setTime(d.getTime() + DAY_MS);
    guard++;
  }
  return d;
}

export type ScheduledMatch = RoundRobinPairing & {
  roundIndex: number;
  kickoffAt: Date;
  venue: string;
};

/**
 * Flattens rounds (in round order) into matchday sessions of `gamesPerMatchday`,
 * assigning each session the next allowed calendar date, and within a session
 * distributing games across time slots (parallel capacity = number of pitches).
 */
export function scheduleMatchdays(
  rounds: RoundRobinPairing[][],
  opts: {
    startDate: Date;
    allowedDows: Set<number>;
    gamesPerMatchday: number;
    startTimeMinutes: number; // minutes from midnight
    durationMinutes: number;
    gapMinutes: number;
    pitches: string[];
  }
): ScheduledMatch[] {
  const flat: (RoundRobinPairing & { roundIndex: number })[] = [];
  rounds.forEach((pairings, roundIndex) => {
    pairings.forEach((p) => flat.push({ ...p, roundIndex }));
  });

  const scheduled: ScheduledMatch[] = [];
  const pitches = opts.pitches.length > 0 ? opts.pitches : ["Pitch 1"];
  let cursor = nextAllowedDate(opts.startDate, opts.allowedDows);
  let first = true;

  for (let i = 0; i < flat.length; i += opts.gamesPerMatchday) {
    const session = flat.slice(i, i + opts.gamesPerMatchday);
    if (!first) {
      cursor = nextAllowedDate(new Date(cursor.getTime() + DAY_MS), opts.allowedDows);
    }
    first = false;

    session.forEach((game, idx) => {
      const timeSlot = Math.floor(idx / pitches.length);
      const pitchIdx = idx % pitches.length;
      const minutesOffset = timeSlot * (opts.durationMinutes + opts.gapMinutes);
      const kickoff = new Date(cursor);
      kickoff.setMinutes(opts.startTimeMinutes + minutesOffset);

      scheduled.push({
        home: game.home,
        away: game.away,
        roundIndex: game.roundIndex,
        kickoffAt: kickoff,
        venue: pitches[pitchIdx],
      });
    });
  }

  return scheduled;
}
