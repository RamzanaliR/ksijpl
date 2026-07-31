import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import LeagueDivisionPanel, { type DivisionPanelData } from "@/components/LeagueDivisionPanel";
import StatsWidget from "@/components/StatsWidget";
import { getSponsorLogoMap } from "@/lib/sponsor-logos";



const DIVISION_LABELS: Record<string, string> = {
  gofiber: "gofiber KSIJ PL",
  "Care & Cure": "Care & Cure KSIJ PL",
};

async function getSeasonData(): Promise<DivisionPanelData[]> {
  const [{ data: seasons }, sponsorLogos] = await Promise.all([
    supabase
      .from("seasons")
      .select("id,label,is_active,competitions(name,sponsor_name,division_id,type)")
      .eq("is_active", true),
    getSponsorLogoMap(),
  ]);

  const ordered = [...(seasons ?? [])]
    .filter((s: any) => s.competitions?.type === "league")
    .sort(
    (a: any, b: any) =>
      ["gofiber", "Care & Cure"].indexOf(a.competitions?.sponsor_name) -
      ["gofiber", "Care & Cure"].indexOf(b.competitions?.sponsor_name)
  );

  return Promise.all(
    ordered.map(async (s: any) => {
      const [{ data: standings }, { data: matches }, { data: teams }] = await Promise.all([
        supabase.from("standings").select("*").eq("season_id", s.id)
          .order("points", { ascending: false }).order("goal_difference", { ascending: false }),
        supabase.from("matches").select("*").eq("season_id", s.id).order("kickoff_at", { ascending: true }),
        supabase.from("teams").select("id,name,slug").eq("division_id", s.competitions?.division_id),
      ]);
      const teamMap: Record<string, string> = {};
      const teamSlugs: Record<string, string | null> = {};
      (teams ?? []).forEach((t: any) => {
        teamMap[t.id] = t.name;
        teamSlugs[t.id] = t.slug;
      });
      const results = (matches ?? []).filter((m: any) => m.status === "completed").slice(-10).reverse();
      const live = (matches ?? []).filter((m: any) => m.status === "live");
      const scheduled = (matches ?? []).filter((m: any) => m.status === "scheduled").slice(0, 10 - live.length);
      const fixtures = [...live, ...scheduled];

      // Is the current match week in progress? (at least one match started, but not all finished yet)
      const byGameweek = new Map<string, { total: number; completed: number; started: number }>();
      (matches ?? []).forEach((m: any) => {
        if (!m.gameweek_id) return;
        const g = byGameweek.get(m.gameweek_id) ?? { total: 0, completed: 0, started: 0 };
        g.total++;
        if (m.status === "completed") g.completed++;
        if (m.status === "completed" || m.status === "live") g.started++;
        byGameweek.set(m.gameweek_id, g);
      });
      const matchWeekInProgress = [...byGameweek.values()].some((g) => g.started > 0 && g.completed < g.total);

      return {
        key: s.competitions?.sponsor_name ?? s.id,
        label: DIVISION_LABELS[s.competitions?.sponsor_name] ?? s.competitions?.name ?? "League",
        competitionName: s.competitions?.name ?? "",
        seasonLabel: s.label,
        standings: standings ?? [],
        teamMap,
        teamSlugs,
        teamLogoUrls: sponsorLogos,
        results,
        fixtures,
        matchWeekInProgress,
      };
    })
  );
}

export default async function Home() {
  const seasonData = await getSeasonData();
  const senior = seasonData.find((d) => d.key === "gofiber") ?? seasonData[0];
  const [{ data: teamsWithLinks }, sponsorLogoMap] = await Promise.all([
    supabase.from("teams").select("id,slug,name,website_url").not("slug", "is", null),
    getSponsorLogoMap(),
  ]);
  const scrollerTeams = teamsWithLinks ?? [];

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
      <SiteHeader active="home" />

      {/* Hero */}
      <section className="bg-gradient-to-b from-[#3EA0D9]/10 to-transparent dark:from-[#3EA0D9]/10 border-b border-[#0B3363]/10 dark:border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-12 flex items-center justify-between gap-8 flex-wrap">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border border-[#F4B400] text-[#F4B400] mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F4B400]" /> Season Live
            </span>
            <h1 className="font-display font-bold text-4xl md:text-5xl leading-tight max-w-xl">
              {senior?.competitionName ?? "KSIJ League"}
              <span className="text-[#3EA0D9]"> {senior?.seasonLabel}</span>
            </h1>
            <p className="text-[#0B3363]/60 dark:text-white/60 mt-3 max-w-md">
              Follow live standings, results and fixtures across the Seniors and Juniors divisions.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Image src="/logos/gofiber-pl-badge.png" alt="gofiber KSIJ PL" width={90} height={112} className="object-contain" />
            <Image src="/logos/care-cure-pl-badge.png" alt="Care & Cure KSIJ PL" width={90} height={112} className="object-contain" />
          </div>
        </div>
      </section>

      {/* Table / Results / Fixtures */}
      <LeagueDivisionPanel divisions={seasonData} />

      {/* Sponsor scroller — all team sponsors, auto-scrolling */}
      <section className="border-y border-[#0B3363]/10 dark:border-white/10 bg-[#3EA0D9]/5 dark:bg-white/5 py-8 overflow-hidden">
        <div className="flex gap-6 w-max animate-scroll-x">
          {[...scrollerTeams, ...scrollerTeams].map((team, i) => {
            const url = team.website_url;
            const Wrapper = url ? "a" : "div";
            const logoSrc = sponsorLogoMap[team.id] || `/sponsors/${team.slug}.png`;
            return (
              <Wrapper
                key={i}
                {...(url ? { href: url, target: "_blank", rel: "noopener noreferrer" } : {})}
                className="w-40 h-24 bg-white rounded-xl border-2 border-[#0B3363] flex items-center justify-center flex-shrink-0 p-1.5 hover:opacity-90 transition-opacity"
              >
                <img src={logoSrc} alt={team.name} className="object-contain w-full h-full" />
              </Wrapper>
            );
          })}
        </div>
      </section>

      {/* News + Fantasy Banner (right 750px) + Stats Widget (left 360px) */}
      <section className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid lg:grid-cols-[360px_1fr] gap-6 items-start">

          {/* Left: Stats Widget — Goals, Assists, Clean Sheets */}
          <div className="lg:sticky lg:top-6">
            <StatsWidget compact />
          </div>

          {/* Right: Latest News 2x2 + Fantasy Banner */}
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-xl">Latest News</h2>
              <Link href="#" className="text-xs font-bold uppercase text-[#3EA0D9]">View all →</Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { tag: "Match Report", title: "Season 03 kicks off with five-goal thriller" },
                { tag: "Fantasy", title: "Fantasy League launching soon — get ready" },
                { tag: "Juniors", title: "Care & Cure Juniors PL: season preview" },
                { tag: "League", title: "Meet the 12 teams of Season 03" },
              ].map((n, i) => (
                <div key={i} className="rounded-2xl overflow-hidden border border-[#0B3363]/10 dark:border-white/10 cursor-pointer hover:border-[#3EA0D9]/40 transition-colors">
                  <div className="h-28 bg-gradient-to-br from-[#3EA0D9]/20 to-[#0B3363]/10" />
                  <div className="p-3">
                    <div className="text-[10px] font-bold uppercase text-[#3EA0D9]">{n.tag}</div>
                    <div className="font-semibold text-sm mt-1 leading-snug">{n.title}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Fantasy Banner */}
            <div className="rounded-2xl p-5 bg-[#0B3363] dark:bg-white/10 text-white flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-[#F4B400] flex items-center justify-center text-lg flex-shrink-0">⚽</div>
                <div>
                  <div className="font-display font-bold text-base">Fantasy League</div>
                  <div className="text-sm opacity-70">Pick your squad and compete with the community.</div>
                </div>
              </div>
              <Link href="/fantasy" className="px-5 py-2 rounded-lg bg-[#F4B400] text-[#0B3363] font-bold text-sm whitespace-nowrap">Sign Up</Link>
            </div>
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
