import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";

const DIVISION_LABELS: Record<string, string> = {
  juniors: "Care & Cure KSIJ Juniors PL",
  seniors: "gofiber KSIJ Premier League",
};

export const metadata = { title: "Teams — KSIJ DAR PL" };

export default async function TeamsIndex() {
  const [{ data: divisions }, { data: teams }] = await Promise.all([
    supabase.from("divisions").select("id,name,slug").order("name"),
    supabase.from("teams").select("id,name,short_name,slug,division_id").order("name"),
  ]);

  const orderedDivisions = [...(divisions ?? [])].sort(
    (a, b) => ["seniors", "juniors"].indexOf(a.slug) - ["seniors", "juniors"].indexOf(b.slug)
  );

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
      <nav className="border-b border-[#0B3363]/10 dark:border-white/10 sticky top-0 z-20 bg-white/95 dark:bg-[#0B1220]/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-display font-bold text-lg">
            <Image src="/logos/gofiber-pl-badge.png" alt="gofiber KSIJ PL" width={32} height={32} className="object-contain" />
            <Image src="/logos/care-cure-pl-badge.png" alt="Care & Cure KSIJ PL" width={32} height={32} className="object-contain" />
            KSIJ DAR PL
          </Link>
          <Link href="/" className="text-sm font-semibold text-[#3EA0D9] hover:underline">← Back home</Link>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10 flex-1 w-full">
        <h1 className="font-display font-bold text-3xl mb-1">Teams</h1>
        <p className="text-[#0B3363]/60 dark:text-white/60 mb-8">All clubs competing across both divisions this season.</p>

        {orderedDivisions.map((d) => {
          const divisionTeams = (teams ?? []).filter((t) => t.division_id === d.id);
          return (
            <section key={d.id} className="mb-10">
              <h2 className="font-display font-bold text-lg mb-4">{DIVISION_LABELS[d.slug] ?? d.name}</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {divisionTeams.map((t) => (
                  <Link
                    key={t.id}
                    href={`/teams/${t.id}`}
                    className="flex items-center gap-3 rounded-2xl p-4 border border-[#0B3363]/10 dark:border-white/10 hover:border-[#3EA0D9]/50 hover:-translate-y-0.5 transition-all duration-150"
                  >
                    <div className="w-12 h-12 rounded-lg bg-white border-2 border-[#0B3363] flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {t.slug ? (
                        <Image src={`/sponsors/${t.slug}.png`} alt={t.name} width={40} height={40} className="object-contain w-full h-full" />
                      ) : (
                        <span className="font-display font-bold text-[#0B3363] text-sm">
                          {t.short_name || t.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{t.name}</div>
                      {t.short_name && <div className="text-xs text-[#0B3363]/50 dark:text-white/50">{t.short_name}</div>}
                    </div>
                  </Link>
                ))}
                {divisionTeams.length === 0 && (
                  <div className="text-sm text-[#0B3363]/40 dark:text-white/40">No teams yet.</div>
                )}
              </div>
            </section>
          );
        })}
      </main>

      <footer className="mt-auto bg-[#0B3363] dark:bg-[#060B14] text-white">
        <div className="text-center text-xs opacity-40 py-4">© 2026 KSIJ League</div>
      </footer>
    </div>
  );
}
