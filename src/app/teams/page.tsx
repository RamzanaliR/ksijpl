import { supabase } from "@/lib/supabase";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import TeamsGrid from "@/components/TeamsGrid";

const DIVISION_LABELS: Record<string, string> = {
  seniors: "gofiber KSIJ PL",
  juniors: "Care & Cure KSIJ PL",
};

export const metadata = { title: "Teams — KSIJ DAR PL" };

export default async function TeamsIndex() {
  const [{ data: divisions }, { data: teams }, { data: seasonsRaw }, { data: seasonTeamsRaw }] = await Promise.all([
    supabase.from("divisions").select("id,name,slug").order("name"),
    supabase.from("teams").select("id,name,short_name,slug,division_id").order("name"),
    supabase
      .from("seasons")
      .select("id,label,created_at,competitions(division_id,type)")
      .order("created_at", { ascending: false }),
    supabase.from("season_teams").select("season_id,team_id"),
  ]);

  const orderedDivisions = [...(divisions ?? [])]
    .sort((a, b) => ["seniors", "juniors"].indexOf(a.slug) - ["seniors", "juniors"].indexOf(b.slug))
    .map((d) => ({ ...d, label: DIVISION_LABELS[d.slug] ?? d.name }));

  const seasonNum = (label: string) => parseInt(label.match(/\d+/)?.[0] ?? "0", 10);
  const seasons = (seasonsRaw ?? [])
    .filter((s: any) => s.competitions?.type === "league")
    .map((s: any) => ({ id: s.id, label: s.label, division_id: s.competitions.division_id as string }))
    .sort((a, b) => seasonNum(b.label) - seasonNum(a.label));

  const seasonTeamMap: Record<string, string[]> = {};
  (seasonTeamsRaw ?? []).forEach((r: any) => {
    if (!seasonTeamMap[r.season_id]) seasonTeamMap[r.season_id] = [];
    seasonTeamMap[r.season_id].push(r.team_id);
  });

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
      <SiteHeader active="teams" />

      <main className="max-w-6xl mx-auto px-6 py-10 flex-1 w-full">
        <h1 className="font-display font-bold text-3xl mb-1">Teams</h1>
        <p className="text-[#0B3363]/60 dark:text-white/60 mb-8">All clubs competing across both divisions this season.</p>

        <TeamsGrid divisions={orderedDivisions} teams={teams ?? []} seasons={seasons} seasonTeamMap={seasonTeamMap} />
      </main>

      <SiteFooter />
    </div>
  );
}
