import { supabase } from "@/lib/supabase";
import Image from "next/image";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import TeamBadge from "@/components/TeamBadge";

const DIVISION_LABELS: Record<string, string> = {
  juniors: "Care & Cure KSIJ Juniors PL",
  seniors: "gofiber KSIJ Premier League",
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

  const [{ data: players }, { data: homeMatches }, { data: awayMatches }, { data: allTeamsRaw }, { data: attendance }, { data: events }] =
    await Promise.all([
      supabase.from("players").select("id,full_name,nickname,position,squad_number").eq("team_id", id).order("squad_number"),
      supabase
        .from("matches")
        .select("id,kickoff_at,venue,status,home_score,away_score,home_pens,away_pens,away_team_id,home_team_id,home_motm_player_id,away_motm_player_id")
        .eq("home_team_id", id),
      supabase
        .from("matches")
        .select("id,kickoff_at,venue,status,home_score,away_score,home_pens,away_pens,away_team_id,home_team_id,home_motm_player_id,away_motm_player_id")
        .eq("away_team_id", id),
      supabase.from("teams").select("id,name,slug"),
      supabase.from("match_attendance").select("player_id").eq("team_id", id),
      supabase.from("match_events").select("player_id,type").eq("team_id", id),
    ]);

  const teamName = (tid: string) => allTeamsRaw?.find((t) => t.id === tid)?.name ?? "—";
  const teamSlug = (tid: string) => allTeamsRaw?.find((t) => t.id === tid)?.slug ?? null;

  const allMatches = [...(homeMatches ?? []), ...(awayMatches ?? [])];
  const results = allMatches
    .filter((m) => m.status === "completed")
    .sort((a, b) => new Date(b.kickoff_at ?? 0).getTime() - new Date(a.kickoff_at ?? 0).getTime());
  const fixtures = allMatches
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => new Date(a.kickoff_at ?? 0).getTime() - new Date(a.kickoff_at ?? 0).getTime());

  // Points: 3 for a regulation win, 0 for a regulation loss.
  // A regulation draw is decided by penalties once entered: 2 pts for the shootout winner, 1 for the loser.
  // A still-undecided draw (no penalties recorded yet) earns 1 pt each, as usual.
  function resultLine(m: any) {
    const isHome = m.home_team_id === id;
    const opponent = teamName(isHome ? m.away_team_id : m.home_team_id);
    const opponentId = isHome ? m.away_team_id : m.home_team_id;
    const us = isHome ? m.home_score : m.away_score;
    const them = isHome ? m.away_score : m.home_score;
    const pensDecided = m.home_pens !== null && m.away_pens !== null && m.home_pens !== m.away_pens;
    const usPens = isHome ? m.home_pens : m.away_pens;
    const themPens = isHome ? m.away_pens : m.home_pens;

    let outcome: "W" | "D" | "L";
    let points: number;
    if (us > them) {
      outcome = "W";
      points = 3;
    } else if (us < them) {
      outcome = "L";
      points = 0;
    } else if (pensDecided) {
      outcome = usPens > themPens ? "W" : "L";
      points = usPens > themPens ? 2 : 1;
    } else {
      outcome = "D";
      points = 1;
    }
    return { opponent, opponentId, us, them, outcome, isHome, pensDecided, usPens, themPens, points };
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
      acc.pts += r.points;
      return acc;
    },
    { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 }
  );
  const points = stats.pts;

  // Per-player stats: appearances, goals, assists, cards, MOTM — all from real recorded data
  const appearanceCount: Record<string, number> = {};
  (attendance ?? []).forEach((a: any) => {
    appearanceCount[a.player_id] = (appearanceCount[a.player_id] ?? 0) + 1;
  });
  const eventCount: Record<string, Record<string, number>> = {};
  (events ?? []).forEach((e: any) => {
    if (!eventCount[e.player_id]) eventCount[e.player_id] = {};
    eventCount[e.player_id][e.type] = (eventCount[e.player_id][e.type] ?? 0) + 1;
  });
  const motmCount: Record<string, number> = {};
  allMatches.forEach((m: any) => {
    const motmId = m.home_team_id === id ? m.home_motm_player_id : m.away_motm_player_id;
    if (motmId) motmCount[motmId] = (motmCount[motmId] ?? 0) + 1;
  });

  const sortedPlayers = [...(players ?? [])].sort((a, b) => {
    const posA = POSITION_ORDER.indexOf(a.position ?? "");
    const posB = POSITION_ORDER.indexOf(b.position ?? "");
    if (posA !== posB) return (posA === -1 ? 99 : posA) - (posB === -1 ? 99 : posB);
    return (a.squad_number ?? 999) - (b.squad_number ?? 999);
  });

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
        <div className="grid lg:grid-cols-[180px_1fr_300px] gap-8 min-w-0">
          {/* Left: Kit */}
          <section className="min-w-0">
            <h2 className="font-display font-bold text-lg mb-4">Kit</h2>
            {team.slug ? (
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 lg:gap-4">
                <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 p-3 text-center">
                  <Image
                    src={`/jerseys/${team.slug}-home.jpg`}
                    alt={`${team.name} home jersey`}
                    width={160}
                    height={160}
                    className="object-contain w-full h-auto rounded-lg mb-2"
                  />
                  <div className="text-xs font-bold uppercase text-[#0B3363]/50 dark:text-white/50">Home</div>
                </div>
                <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 p-3 text-center">
                  <Image
                    src={`/jerseys/${team.slug}-away.jpg`}
                    alt={`${team.name} away jersey`}
                    width={160}
                    height={160}
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

          {/* Middle: Squad + Stats — one table */}
          <section className="min-w-0">
            <h2 className="font-display font-bold text-lg mb-4">Squad &amp; Stats</h2>

            {/* Season stats row — white boxes */}
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
                <div key={label as string} className="rounded-xl bg-white border border-[#0B3363]/10 shadow-sm py-2 text-center">
                  <div className="text-[10px] font-bold uppercase text-[#0B3363]/40">{label}</div>
                  <div className="font-display font-bold text-lg text-[#0B3363]">{value}</div>
                </div>
              ))}
            </div>

            {sortedPlayers.length === 0 ? (
              <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 p-6 text-center text-sm text-[#0B3363]/40 dark:text-white/40">
                No players registered yet.
              </div>
            ) : (
              <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase text-[#0B3363]/40 dark:text-white/40 border-b border-[#0B3363]/10 dark:border-white/10">
                        <th className="text-left py-2 px-3">#</th>
                        <th className="text-left py-2 px-3">Name</th>
                        <th className="text-left py-2 px-3">Pos</th>
                        <th className="text-right py-2 px-2">GP</th>
                        <th className="text-right py-2 px-2">G</th>
                        <th className="text-right py-2 px-2">A</th>
                        <th className="text-right py-2 px-2">YC</th>
                        <th className="text-right py-2 px-2">RC</th>
                        <th className="text-right py-2 px-3">MM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPlayers.map((p) => {
                        const ev = eventCount[p.id] ?? {};
                        return (
                          <tr key={p.id} className="border-b border-[#0B3363]/5 dark:border-white/5 last:border-0">
                            <td className="py-2 px-3 text-[#0B3363]/40 dark:text-white/40">{p.squad_number ?? "—"}</td>
                            <td className="py-2 px-3 truncate max-w-[160px]">
                              {p.full_name}
                              {p.nickname && <span className="text-xs text-[#0B3363]/40 dark:text-white/40"> "{p.nickname}"</span>}
                            </td>
                            <td className="py-2 px-3 text-xs font-bold text-[#3EA0D9]">{p.position ?? "—"}</td>
                            <td className="py-2 px-2 text-right">{appearanceCount[p.id] ?? 0}</td>
                            <td className="py-2 px-2 text-right">{ev.goal ?? 0}</td>
                            <td className="py-2 px-2 text-right">{ev.assist ?? 0}</td>
                            <td className="py-2 px-2 text-right">{ev.yellow_card ?? 0}</td>
                            <td className="py-2 px-2 text-right">{ev.red_card ?? 0}</td>
                            <td className="py-2 px-3 text-right">{motmCount[p.id] ?? 0}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* Right: Last Result (small) + Upcoming Fixtures — white boxes */}
          <div className="flex flex-col gap-6 min-w-0">
            <section>
              <h2 className="font-display font-bold text-base mb-3">Last Result</h2>
              {lastResult ? (
                (() => {
                  const r = resultLine(lastResult);
                  const badgeColor =
                    r.outcome === "W" ? "bg-green-500/15 text-green-700"
                    : r.outcome === "L" ? "bg-red-500/15 text-red-600"
                    : "bg-slate-500/15 text-slate-500";
                  return (
                    <div className="rounded-2xl bg-white text-[#0B3363] border border-[#0B3363]/10 shadow-sm px-4 py-4 flex items-center justify-between text-sm">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${badgeColor}`}>
                        {r.outcome}
                      </span>
                      <span className="flex-1 px-3 min-w-0">
                        <TeamBadge name={r.opponent} slug={teamSlug(r.opponentId)} size={20} />
                      </span>
                      <span className="font-display font-bold text-sm bg-[#0B3363]/5 px-3 py-1.5 rounded">
                        {r.us}–{r.them}
                      </span>
                    </div>
                  );
                })()
              ) : (
                <div className="rounded-2xl bg-white border border-[#0B3363]/10 shadow-sm px-4 py-6 text-center text-sm text-[#0B3363]/40">
                  No results yet.
                </div>
              )}
            </section>

            <section>
              <h2 className="font-display font-bold text-base mb-3">Upcoming Fixtures</h2>
              <div className="rounded-2xl bg-white text-[#0B3363] border border-[#0B3363]/10 shadow-sm divide-y divide-[#0B3363]/5">
                {nextFixtures.map((m) => {
                  const isHome = m.home_team_id === id;
                  const opponentId = isHome ? m.away_team_id : m.home_team_id;
                  return (
                    <div key={m.id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <TeamBadge name={teamName(opponentId)} slug={teamSlug(opponentId)} size={20} className="min-w-0" />
                      <span className="text-xs text-[#0B3363]/50 flex-shrink-0 ml-3">
                        {m.kickoff_at ? new Date(m.kickoff_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "TBD"}
                      </span>
                    </div>
                  );
                })}
                {nextFixtures.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-[#0B3363]/40">No fixtures scheduled.</div>
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
