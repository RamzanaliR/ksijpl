import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import LeagueDivisionPanel, { type DivisionPanelData } from "@/components/LeagueDivisionPanel";

const SPONSOR_SLUGS = [
  "care-and-cure", "dar-glass", "dot-syndicate", "double-click", "fidahussein-and-co",
  "fragrance-world", "gf-trucks", "growing-tree", "irh", "masumin", "mo",
  "murji-sundries", "power-computers", "rafiki", "rungu", "safiri",
  "smiles-cars", "stepping-stones", "tiba", "u-world",
];

const DIVISION_LABELS: Record<string, string> = {
  gofiber: "gofiber KSIJ PL",
  "Care & Cure": "Care & Cure KSIJ PL",
};

async function getSeasonData(): Promise<DivisionPanelData[]> {
  const { data: seasons } = await supabase
    .from("seasons")
    .select("id,label,is_active,competitions(name,sponsor_name,division_id,type)")
    .eq("is_active", true);

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

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
      <SiteHeader active="seasons" />

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
          {[...SPONSOR_SLUGS, ...SPONSOR_SLUGS].map((slug, i) => (
            <div key={i} className="w-40 h-24 bg-white rounded-xl border-2 border-[#0B3363] flex items-center justify-center flex-shrink-0 p-3">
              <Image
                src={`/sponsors/${slug}.png`}
                alt={slug.replace(/-/g, " ")}
                width={140}
                height={80}
                className="object-contain w-full h-full"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Fantasy CTA */}
      <section className="max-w-6xl mx-auto px-6 py-10">
        <div className="rounded-2xl p-6 bg-[#0B3363] dark:bg-white text-white dark:text-[#0B3363] flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#F4B400] flex items-center justify-center text-xl">⚽</div>
            <div>
              <div className="font-display font-bold text-lg">Fantasy League</div>
              <div className="text-sm opacity-70">Pick your squad and compete with the community.</div>
            </div>
          </div>
          <Link href="/fantasy" className="px-5 py-2.5 rounded-lg bg-[#F4B400] text-[#0B3363] font-bold text-sm">Sign Up</Link>
        </div>
      </section>

      {/* Partners — league-level sponsors, static, no scroll */}
      <section className="max-w-6xl mx-auto px-6 pb-10">
        <h2 className="font-display font-bold text-xl mb-4">Our Partners</h2>
        <div className="flex flex-wrap gap-6">
          <div className="w-40 h-24 bg-white rounded-xl border-2 border-[#0B3363] flex items-center justify-center p-3">
            <Image src="/logos/gofiber-pl-badge.png" alt="gofiber" width={140} height={80} className="object-contain w-full h-full" />
          </div>
          <div className="w-40 h-24 bg-white rounded-xl border-2 border-[#0B3363] flex items-center justify-center p-3">
            <Image src="/logos/care-cure-pl-badge.png" alt="Care & Cure" width={140} height={80} className="object-contain w-full h-full" />
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
