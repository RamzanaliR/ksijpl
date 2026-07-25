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
  const [{ data: divisions }, { data: teams }] = await Promise.all([
    supabase.from("divisions").select("id,name,slug").order("name"),
    supabase.from("teams").select("id,name,short_name,slug,division_id").order("name"),
  ]);

  const orderedDivisions = [...(divisions ?? [])]
    .sort((a, b) => ["seniors", "juniors"].indexOf(a.slug) - ["seniors", "juniors"].indexOf(b.slug))
    .map((d) => ({ ...d, label: DIVISION_LABELS[d.slug] ?? d.name }));

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
      <SiteHeader active="teams" />

      <main className="max-w-6xl mx-auto px-6 py-10 flex-1 w-full">
        <h1 className="font-display font-bold text-3xl mb-1">Teams</h1>
        <p className="text-[#0B3363]/60 dark:text-white/60 mb-8">All clubs competing across both divisions this season.</p>

        <TeamsGrid divisions={orderedDivisions} teams={teams ?? []} />
      </main>

      <SiteFooter />
    </div>
  );
}
