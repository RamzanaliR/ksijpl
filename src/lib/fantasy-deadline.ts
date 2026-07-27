// Squad/lineup changes lock 4 hours before the first kickoff of the match week.
export function computeDeadline(fixtures: { kickoff_at: string | null }[]): Date | null {
  const times = fixtures.map((f) => f.kickoff_at).filter((t): t is string => !!t).map((t) => new Date(t).getTime());
  if (times.length === 0) return null;
  const earliest = Math.min(...times);
  return new Date(earliest - 4 * 60 * 60 * 1000);
}

export function formatDeadline(deadline: Date): string {
  return deadline.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatDeadlineCompact(deadline: Date): string {
  const day = String(deadline.getDate()).padStart(2, "0");
  const month = deadline.toLocaleString(undefined, { month: "short" });
  const year = deadline.getFullYear();
  const time = deadline.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${day}/${month}/${year} | ${time}`;
}
