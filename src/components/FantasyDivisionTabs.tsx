"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

type SiblingPool = { id: string; label: string; hasTeam: boolean };

const DIVISION_LABELS: Record<string, string> = {
  gofiber: "gofiber KSIJ PL",
  "Care & Cure": "Care & Cure KSIJ PL",
};

export default function FantasyDivisionTabs({ poolId }: { poolId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pools, setPools] = useState<SiblingPool[]>([]);

  useEffect(() => {
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;

      const { data: settings } = await supabase
        .from("fantasy_settings")
        .select("id,seasons(competitions(sponsor_name))")
        .eq("is_active", true);

      const { data: teams } = await supabase.from("fantasy_teams").select("fantasy_settings_id").eq("user_id", authData.user.id);
      const teamPoolIds = new Set((teams ?? []).map((t: any) => t.fantasy_settings_id));

      const list: SiblingPool[] = (settings ?? [])
        .map((s: any) => ({
          id: s.id,
          label: DIVISION_LABELS[s.seasons?.competitions?.sponsor_name] ?? "Fantasy",
          hasTeam: teamPoolIds.has(s.id),
        }))
        .sort((a: any, b: any) => ["gofiber KSIJ PL", "Care & Cure KSIJ PL"].indexOf(a.label) - ["gofiber KSIJ PL", "Care & Cure KSIJ PL"].indexOf(b.label));
      setPools(list);
    })();
  }, [poolId]);

  function switchTo(pool: SiblingPool) {
    if (pool.id === poolId) return;
    // Preserve the current sub-page (points, pick-team, transfers, etc.) when switching divisions
    const suffix = pathname.split(`/team/${poolId}`)[1] ?? "";
    if (pool.hasTeam) {
      router.push(`/fantasy/team/${pool.id}${suffix}`);
    } else {
      router.push(`/fantasy/team/${pool.id}`);
    }
  }

  if (pools.length < 2) return null;

  return (
    <div className="flex items-center gap-2 mb-4">
      {pools.map((p) => (
        <button
          key={p.id}
          onClick={() => switchTo(p)}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            p.id === poolId
              ? "bg-[#0B3363] text-white dark:bg-[#3EA0D9] dark:text-[#0B1220]"
              : "bg-[#0B3363]/5 dark:bg-white/10 hover:bg-[#0B3363]/10 dark:hover:bg-white/15"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
