"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const DIVISION_ORDER = ["gofiber", "Care & Cure"];

export default function FantasyGateway() {
  const router = useRouter();
  const [needsProfile, setNeedsProfile] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/fantasy/login");
        return;
      }
      setUserId(data.user.id);

      const { data: profile } = await supabase.from("fantasy_profiles").select("id,display_name").eq("id", data.user.id).maybeSingle();
      if (!profile) {
        setNeedsProfile(true);
        return;
      }

      await routeToDefaultPool(data.user.id);
    })();
  }, [router]);

  async function routeToDefaultPool(uid: string) {
    const { data: settings } = await supabase
      .from("fantasy_settings")
      .select("id,seasons(competitions(sponsor_name))")
      .eq("is_active", true);

    const ordered = [...(settings ?? [])].sort(
      (a: any, b: any) => DIVISION_ORDER.indexOf(a.seasons?.competitions?.sponsor_name) - DIVISION_ORDER.indexOf(b.seasons?.competitions?.sponsor_name)
    );
    const defaultPool = ordered[0];
    if (!defaultPool) return;

    const { data: team } = await supabase
      .from("fantasy_teams")
      .select("id")
      .eq("fantasy_settings_id", defaultPool.id)
      .eq("user_id", uid)
      .maybeSingle();

    router.push(team ? `/fantasy/team/${defaultPool.id}/points` : `/fantasy/team/${defaultPool.id}`);
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !displayName.trim()) return;
    setSavingProfile(true);
    const { error } = await supabase.from("fantasy_profiles").insert({ id: userId, display_name: displayName.trim() });
    setSavingProfile(false);
    if (error) {
      alert(error.message);
      return;
    }
    setNeedsProfile(false);
    await routeToDefaultPool(userId);
  }

  if (needsProfile) {
    return (
      <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
        <SiteHeader active="fantasy" />
        <main className="max-w-4xl mx-auto px-6 py-10 flex-1 w-full">
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
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
      <SiteHeader active="fantasy" />
      <div className="flex-1 flex items-center justify-center text-sm opacity-50">Loading…</div>
      <SiteFooter />
    </div>
  );
}
