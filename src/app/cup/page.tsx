import { supabase } from "@/lib/supabase";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import CupBracket from "@/components/CupBracket";

export const metadata = { title: "Cup — KSIJ DAR PL" };

async function getCupData() {
  const { data: competitions } = await supabase
    .from("competitions")
    .select("id,name,division_id")
    .eq("type", "cup")
    .order("name");

  return Promise.all(
    (competitions ?? []).map(async (c: any) => {
      const { data: seasons } = await supabase
        .from("seasons")
        .select("id,label")
        .eq("competition_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1);
      const season = seasons?.[0];
      if (!season) return { competition: c, season: null, gameweeks: [], matches: [], teamMap: {}, teamSlugs: {} };

      const [{ data: gameweeks }, { data: matches }, { data: teams }] = await Promise.all([
        supabase.from("gameweeks").select("id,number,round_name").eq("season_id", season.id).order("number"),
        supabase
          .from("matches")
          .select("id,gameweek_id,home_team_id,away_team_id,home_score,away_score,home_pens,away_pens,status,next_match_id,next_match_slot")
          .eq("season_id", season.id),
        supabase.from("teams").select("id,name,slug").eq("division_id", c.division_id),
      ]);
      const teamMap: Record<string, string> = {};
      const teamSlugs: Record<string, string | null> = {};
      (teams ?? []).forEach((t: any) => {
        teamMap[t.id] = t.name;
        teamSlugs[t.id] = t.slug;
      });

      return { competition: c, season, gameweeks: gameweeks ?? [], matches: matches ?? [], teamMap, teamSlugs };
    })
  );
}

export default async function CupPage() {
  const cups = await getCupData();

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
      <SiteHeader active="cup" />
      <main className="max-w-6xl mx-auto px-6 py-10 flex-1 w-full">
        <h1 className="font-display font-bold text-3xl mb-1">Cup</h1>
        <p className="text-[#0B3363]/60 dark:text-white/60 mb-8">Knockout brackets for both divisions.</p>
        <CupBracket cups={cups} />
      </main>
      <SiteFooter />
    </div>
  );
}
