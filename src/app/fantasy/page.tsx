"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import type { User } from "@supabase/supabase-js";

type Pool = {
  id: string;
  budget: number;
  seasonLabel: string;
  competitionName: string;
  divisionLabel: string;
  hasTeam: boolean;
};

const DIVISION_LABELS: Record<string, string> = {
  gofiber: "gofiber KSIJ PL Fantasy",
  "Care & Cure": "Care & Cure KSIJ PL Fantasy",
};

export default function FantasyDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [pools, setPools] = useState<Pool[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/fantasy/login");
        return;
      }
      setUser(data.user);

      const { data: profile } = await supabase.from("fantasy_profiles").select("id,display_name").eq("id", data.user.id).maybeSingle();
      if (!profile) {
        setNeedsProfile(true);
        setLoading(false);
        return;
      }

      await loadPools(data.user.id);
      setLoading(false);
    })();
  }, [router]);

  async function loadPools(userId: string) {
    const { data: settings } = await supabase
      .from("fantasy_settings")
      .select("id,budget,seasons(label,competitions(name,sponsor_name))")
      .eq("is_active", true);

    const { data: teams } = await supabase.from("fantasy_teams").select("fantasy_settings_id").eq("user_id", userId);
    const teamPoolIds = new Set((teams ?? []).map((t: any) => t.fantasy_settings_id));

    const list: Pool[] = (settings ?? [])
      .map((s: any) => ({
        id: s.id,
        budget: s.budget,
        seasonLabel: s.seasons?.label ?? "",
        competitionName: s.seasons?.competitions?.name ?? "",
        divisionLabel: DIVISION_LABELS[s.seasons?.competitions?.sponsor_name] ?? s.seasons?.competitions?.name ?? "Fantasy",
        hasTeam: teamPoolIds.has(s.id),
      }))
      .sort((a: any, b: any) => ["gofiber", "Care & Cure"].indexOf(a.divisionLabel) - ["gofiber", "Care & Cure"].indexOf(b.divisionLabel));
    setPools(list);
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !displayName.trim()) return;
    setSavingProfile(true);
    const { error } = await supabase.from("fantasy_profiles").insert({ id: user.id, display_name: displayName.trim() });
    setSavingProfile(false);
    if (error) {
      alert(error.message);
      return;
    }
    setNeedsProfile(false);
    setLoading(true);
    await loadPools(user.id);
    setLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
        <SiteHeader active="fantasy" />
        <div className="flex-1 flex items-center justify-center text-sm opacity-50">Loading…</div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
      <SiteHeader active="fantasy" />
      <main className="max-w-4xl mx-auto px-6 py-10 flex-1 w-full">
        {needsProfile ? (
          <div className="max-w-sm mx-auto mt-10">
            <h1 className="font-display font-bold text-2xl mb-1">Welcome!</h1>
            <p className="text-[#0B3363]/60 dark:text-white/60 mb-6 text-sm">Pick a display name for your fantasy team leaderboard.</p>
            <form onSubmit={saveProfile} className="flex flex-col gap-3">
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Ali R"
                required
                className="border border-[#0B3363]/15 dark:border-white/15 dark:bg-white/5 rounded-lg px-3 py-2.5 text-sm"
              />
              <button disabled={savingProfile} className="py-2.5 rounded-lg bg-[#0B3363] text-white dark:bg-[#3EA0D9] font-semibold text-sm disabled:opacity-50">
                {savingProfile ? "Saving…" : "Continue"}
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="font-display font-bold text-3xl mb-1">Fantasy</h1>
                <p className="text-[#0B3363]/60 dark:text-white/60 text-sm">{user?.email}</p>
              </div>
              <button onClick={signOut} className="text-sm font-semibold text-[#3EA0D9] hover:underline">Sign out</button>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              {pools.map((p) => (
                <div key={p.id} className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 p-6">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#3EA0D9] mb-1">{p.divisionLabel}</div>
                  <div className="font-display font-bold text-lg mb-1">{p.competitionName}</div>
                  <div className="text-sm text-[#0B3363]/50 dark:text-white/50 mb-4">{p.seasonLabel} · £{p.budget}m budget</div>
                  {p.hasTeam ? (
                    <span className="inline-block text-sm font-semibold px-4 py-2 rounded-lg bg-[#0B3363]/5 dark:bg-white/10 text-[#0B3363] dark:text-white">
                      Team created — squad builder coming soon
                    </span>
                  ) : (
                    <span className="inline-block text-sm font-semibold px-4 py-2 rounded-lg bg-[#F4B400]/20 text-[#0B3363] dark:text-white">
                      Squad builder coming soon
                    </span>
                  )}
                </div>
              ))}
              {pools.length === 0 && (
                <div className="col-span-full text-sm text-[#0B3363]/40 dark:text-white/40 text-center py-10">
                  No fantasy pools are open yet.
                </div>
              )}
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
