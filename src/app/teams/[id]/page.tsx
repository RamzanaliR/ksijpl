import { supabase } from "@/lib/supabase";
import Image from "next/image";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const DIVISION_LABELS: Record<string, string> = {
  juniors: "Care & Cure KSIJ Juniors PL",
  seniors: "gofiber KSIJ Premier League",
};

const POSITION_LABELS: Record<string, string> = {
  GK: "Goalkeepers",
  DEF: "Defenders",
  MID: "Midfielders",
  FWD: "Forwards",
};
const POSITION_ORDER = ["GK", "DEF", "MID", "FWD"];

export default async function TeamProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: team } = await supabase
    .from("teams")
    .select("id,name,short_name,slug,division_id,divisions(name,slug)")
    .eq("id", id)
    .maybeSingle();

  if (!team) notFound();

  const division = (team as any).divisions as { name: string; slug: string } | null;

  const [{ data: players }, { data: homeMatches }, { data: awayMatches }, { data: allTeams }] = await Promise.all([
    supabase.from("players").select("id,full_name,nickname,position,squad_number").eq("team_id", id).order("squad_number"),
    supabase
      .from("matches")
      .select("id,kickoff_at,venue,status,home_score,away_score,away_team_id,home_team_id")
      .eq("home_team_id", id),
    supabase
      .from("matches")
      .select("id,kickoff_at,venue,status,home_score,away_score,away_team_id,home_team_id")
      .eq("away_team_id", id),
    supabase.from("teams").select("id,name"),
  ]);

  const teamName = (tid: string) => allTeams?.find((t) => t.id === tid)?.name ?? "—";

  const allMatches = [...(homeMatches ?? []), ...(awayMatches ?? [])];
  const results = allMatches
    .filter((m) => m.status === "completed")
    .sort((a, b) => new Date(b.kickoff_at ?? 0).getTime() - new Date(a.kickoff_at ?? 0).getTime());
  const fixtures = allMatches
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => new Date(a.kickoff_at ?? 0).getTime() - new Date(a.kickoff_at ?? 0).getTime());

  function resultLine(m: any) {
    const isHome = m.home_team_id === id;
    const opponent = teamName(isHome ? m.away_team_id : m.home_team_id);
    const us = isHome ? m.home_score : m.away_score;
    const them = isHome ? m.away_score : m.home_score;
    const outcome = us > them ? "W" : us < them ? "L" : "D";
    return { opponent, us, them, outcome, isHome };
  }

  // Season stats derived from completed results — real numbers, no fabricated per-player data
  const stats = results.reduce(
    (acc, m) => {
      const r = resultLine(m);
      acc.played++;
      if (r.outcome === "W") acc.won++;
      else if (r.outcome === "D") acc.drawn++;
      else acc.lost++;
      acc.gf += r.us ?? 0;
      acc.ga += r.them ?? 0;
      return acc;
    },
    { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0 }
  );
  const points = stats.won * 3 + stats.drawn;

  const groupedPlayers = POSITION_ORDER.map((pos) => ({
    pos,
    label: POSITION_LABELS[pos],
    players: (players ?? []).filter((p) => p.position === pos),
  })).filter((g) => g.players.length > 0);
  const unassigned = (players ?? []).filter((p) => !p.position);

  const lastResult = results[0];
  const nextFixtures = fixtures.slice(0, 5);

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
      <SiteHeader active="teams" />

      <main className="max-w-6xl mx-auto px-6 py-10 flex-1 w-full">
        {/* Header */}
        <div className="flex items-center gap-5 mb-10 flex-wrap">
          <div className="w-20 h-20 rounded-2xl bg-white border-2 border-[#0B3363] flex items-center justify-center flex-shrink-0 overflow-hidden">
            {team.slug ? (
              <Image src={`/sponsors/${team.slug}.png`} alt={team.name} width={68} height={68} className="object-contain w-full h-full" />
            ) : (
              <span className="font-display font-bold text-[#0B3363] text-xl">
                {team.short_name || team.name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#3EA0D9] mb-1">
              {division ? DIVISION_LABELS[division.slug] ?? division.name : ""}
            </div>
            <h1 className="font-display font-bold text-3xl">{team.name}</h1>
            {team.short_name && <div className="text-sm text-[#0B3363]/50 dark:text-white/50">{team.short_name}</div>}
          </div>
        </div>

        {/* 3-column layout: Kit | Squad + Stats | Last Result + Upcoming */}
        <div className="grid lg:grid-cols-[260px_1fr_280px] gap-8">
          {/* Left: Kit */}
          <section>
            <h2 className="font-display font-bold text-lg mb-4">Kit</h2>
            {team.slug ? (
              <div className="flex flex-col gap-4">
                <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 p-4 text-center">
                  <Image
                    src={`/jerseys/${team.slug}-home.jpg`}
                    alt={`${team.name} home jersey`}
                    width={300}
                    height={300}
                    className="object-contain w-full h-auto rounded-lg mb-2"
                  />
                  <div className="text-xs font-bold uppercase text-[#0B3363]/50 dark:text-white/50">Home</div>
                </div>
                <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 p-4 text-center">
                  <Image
                    src={`/jerseys/${team.slug}-away.jpg`}
                    alt={`${team.name} away jersey`}
                    width={300}
                    height={300}
                    className="object-contain w-full h-auto rounded-lg mb-2"
                  />
                  <div className="text-xs font-bold uppercase text-[#0B3363]/50 dark:text-white/50">Away</div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-[#0B3363]/40 dark:text-white/40 rounded-2xl border border-dashed border-[#0B3363]/15 dark:border-white/15 p-6">
                Kit images coming soon for this team.
              </div>
            )}
          </section>

          {/* Middle: Squad + Stats */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-lg">Squad &amp; Stats</h2>
            </div>

            {/* Season stats row — derived from real completed results */}
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-6">
              {[
                ["P", stats.played],
                ["W", stats.won],
                ["D", stats.drawn],
                ["L", stats.lost],
                ["GF", stats.gf],
                ["GA", stats.ga],
                ["PTS", points],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-xl border border-[#0B3363]/10 dark:border-white/10 py-2 text-center">
                  <div className="text-[10px] font-bold uppercase text-[#0B3363]/40 dark:text-white/40">{label}</div>
                  <div className="font-display font-bold text-lg">{value}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#0B3363]/40 dark:text-white/40 mb-6">
              Season stats are calculated from completed results. Per-player stats (goals, appearances) aren't tracked yet.
            </p>

            {(players ?? []).length === 0 ? (
              <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 p-6 text-center text-sm text-[#0B3363]/40 dark:text-white/40">
                No players registered yet.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-6">
                {[...groupedPlayers, ...(unassigned.length ? [{ pos: "—", label: "Unassigned", players: unassigned }] : [])].map((g) => (
                  <div key={g.pos}>
                    <div className="text-xs font-bold uppercase tracking-wide text-[#3EA0D9] mb-2">{g.label}</div>
                    <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 divide-y divide-[#0B3363]/5 dark:divide-white/5">
                      {g.players.map((p) => (
                        <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                          <span className="w-6 text-[#0B3363]/40 dark:text-white/40 flex-shrink-0">{p.squad_number ?? "—"}</span>
                          <span className="truncate">{p.full_name}</span>
                          {p.nickname && <span className="text-xs text-[#0B3363]/40 dark:text-white/40 ml-auto flex-shrink-0">"{p.nickname}"</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Right: Last Result (small) + Upcoming Fixtures */}
          <div className="flex flex-col gap-6">
            <section>
              <h2 className="font-display font-bold text-base mb-3">Last Result</h2>
              {lastResult ? (
                (() => {
                  const r = resultLine(lastResult);
                  const badgeColor =
                    r.outcome === "W" ? "bg-green-500/15 text-green-700 dark:text-green-400"
                    : r.outcome === "L" ? "bg-red-500/15 text-red-600 dark:text-red-400"
                    : "bg-slate-500/15 text-slate-500";
                  return (
                    <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 px-4 py-3 flex items-center justify-between text-sm">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${badgeColor}`}>
                        {r.outcome}
                      </span>
                      <span className="flex-1 px-3 truncate">{r.isHome ? "vs" : "@"} {r.opponent}</span>
                      <span className="font-display font-bold text-xs bg-[#0B3363]/5 dark:bg-white/10 px-2.5 py-1 rounded">
                        {r.us}–{r.them}
                      </span>
                    </div>
                  );
                })()
              ) : (
                <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 px-4 py-5 text-center text-sm text-[#0B3363]/40 dark:text-white/40">
                  No results yet.
                </div>
              )}
            </section>

            <section>
              <h2 className="font-display font-bold text-base mb-3">Upcoming Fixtures</h2>
              <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 divide-y divide-[#0B3363]/5 dark:divide-white/5">
                {nextFixtures.map((m) => {
                  const isHome = m.home_team_id === id;
                  const opponent = teamName(isHome ? m.away_team_id : m.home_team_id);
                  return (
                    <div key={m.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="truncate">{isHome ? "vs" : "@"} {opponent}</span>
                      <span className="text-xs text-[#0B3363]/50 dark:text-white/50 flex-shrink-0 ml-3">
                        {m.kickoff_at ? new Date(m.kickoff_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "TBD"}
                      </span>
                    </div>
                  );
                })}
                {nextFixtures.length === 0 && (
                  <div className="px-4 py-5 text-center text-sm text-[#0B3363]/40 dark:text-white/40">No fixtures scheduled.</div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
