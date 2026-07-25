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
    .select("id,label,is_active,competitions(name,sponsor_name,division_id)")
    .eq("is_active", true);

  const ordered = [...(seasons ?? [])].sort(
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
        supabase.from("teams").select("id,name").eq("division_id", s.competitions?.division_id),
      ]);
      const teamMap: Record<string, string> = {};
      (teams ?? []).forEach((t: any) => (teamMap[t.id] = t.name));
      const results = (matches ?? []).filter((m: any) => m.status === "completed").slice(-5).reverse();
      const fixtures = (matches ?? []).filter((m: any) => m.status === "scheduled").slice(0, 5);
      return {
        key: s.competitions?.sponsor_name ?? s.id,
        label: DIVISION_LABELS[s.competitions?.sponsor_name] ?? s.competitions?.name ?? "League",
        competitionName: s.competitions?.name ?? "",
        seasonLabel: s.label,
        standings: standings ?? [],
        teamMap,
        results,
        fixtures,
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

      {/* News (placeholder) */}
      <section className="max-w-6xl mx-auto px-6 pb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-xl">Latest News</h2>
          <Link href="#" className="text-xs font-bold uppercase text-[#3EA0D9]">View all →</Link>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { tag: "Match Report", title: "Season 03 kicks off with five-goal thriller" },
            { tag: "Fantasy", title: "Fantasy League launching soon — get ready" },
            { tag: "Juniors", title: "Care & Cure Juniors PL: season preview" },
          ].map((n, i) => (
            <div key={i} className="rounded-2xl overflow-hidden border border-[#0B3363]/10 dark:border-white/10">
              <div className="h-32 bg-gradient-to-br from-[#3EA0D9]/20 to-[#0B3363]/10" />
              <div className="p-4">
                <div className="text-[10px] font-bold uppercase text-[#3EA0D9]">{n.tag}</div>
                <div className="font-semibold text-sm mt-1.5 leading-snug">{n.title}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Fantasy CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-10">
        <div className="rounded-2xl p-6 bg-[#0B3363] dark:bg-white text-white dark:text-[#0B3363] flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#F4B400] flex items-center justify-center text-xl">⚽</div>
            <div>
              <div className="font-display font-bold text-lg">Fantasy League — Coming Soon</div>
              <div className="text-sm opacity-70">Pick your squad and compete with the community.</div>
            </div>
          </div>
          <button className="px-5 py-2.5 rounded-lg bg-[#F4B400] text-[#0B3363] font-bold text-sm">Get Notified</button>
        </div>
      </section>

      {/* Sponsor scroller */}
      <section className="border-y border-[#0B3363]/10 dark:border-white/10 bg-[#3EA0D9]/5 dark:bg-white/5 py-6 overflow-hidden">
        <div className="flex gap-6 w-max animate-scroll-x">
          {[...SPONSOR_SLUGS, ...SPONSOR_SLUGS].map((slug, i) => (
            <div key={i} className="w-28 h-16 bg-white rounded-lg border-2 border-[#0B3363] flex items-center justify-center flex-shrink-0 p-2">
              <Image
                src={`/sponsors/${slug}.png`}
                alt={slug.replace(/-/g, " ")}
                width={96}
                height={48}
                className="object-contain w-full h-full"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-[#0B3363] dark:bg-[#060B14] text-white">
        <div className="max-w-6xl mx-auto px-6 py-10 grid md:grid-cols-3 gap-8">
          <div>
            <h5 className="font-display font-bold text-xs uppercase tracking-wide mb-3 opacity-70">League</h5>
            <div className="space-y-2 text-sm">
              <Link href="#" className="block hover:text-[#F4B400]">Seasons</Link>
              <Link href="#" className="block hover:text-[#F4B400]">Table</Link>
              <Link href="#" className="block hover:text-[#F4B400]">Fixtures &amp; Results</Link>
              <Link href="#" className="block hover:text-[#F4B400]">Stats</Link>
            </div>
          </div>
          <div>
            <h5 className="font-display font-bold text-xs uppercase tracking-wide mb-3 opacity-70">Fantasy</h5>
            <div className="space-y-2 text-sm">
              <Link href="#" className="block hover:text-[#F4B400]">Create Squad</Link>
              <Link href="#" className="block hover:text-[#F4B400]">Leaderboard</Link>
              <Link href="#" className="block hover:text-[#F4B400]">Rules</Link>
            </div>
          </div>
          <div>
            <h5 className="font-display font-bold text-xs uppercase tracking-wide mb-3 opacity-70">More</h5>
            <div className="space-y-2 text-sm">
              <Link href="#" className="block hover:text-[#F4B400]">Latest News</Link>
              <Link href="/teams" className="block hover:text-[#F4B400]">Teams</Link>
              <Link href="/teams" className="block hover:text-[#F4B400]">Players</Link>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-6xl mx-auto px-6 py-6 flex flex-wrap gap-4 items-center">
            {SPONSOR_SLUGS.slice(0, 8).map((slug) => (
              <div key={slug} className="w-20 h-11 bg-white rounded-md border-2 border-[#0B3363] flex items-center justify-center p-1">
                <Image
                  src={`/sponsors/${slug}.png`}
                  alt={slug.replace(/-/g, " ")}
                  width={70}
                  height={35}
                  className="object-contain w-full h-full"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="text-center text-xs opacity-40 py-4">© 2026 KSIJ League</div>
      </footer>
    </div>
  );
}
