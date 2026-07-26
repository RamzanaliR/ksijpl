"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const TABS = [
  { key: "my-team", label: "My Team", path: "/points" },
  { key: "pick-team", label: "Pick Team", path: "/pick-team" },
  { key: "transfers", label: "Transfers", path: "/transfers" },
  { key: "leagues", label: "Leagues", path: "/leaderboard" },
  { key: "fixtures", label: "Fixtures", path: "/fixtures" },
];

export default function FantasySubNav({ poolId }: { poolId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/fantasy/team/${poolId}`;

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1 mb-6 overflow-x-auto border-b border-[#0B3363]/10 dark:border-white/10">
      {TABS.map((tab) => {
        const href = `${base}${tab.path}`;
        const isActive = pathname === href;
        return (
          <Link
            key={tab.key}
            href={href}
            className={`px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
              isActive
                ? "border-[#3EA0D9] text-[#3EA0D9]"
                : "border-transparent text-[#0B3363]/50 dark:text-white/50 hover:text-[#0B3363] dark:hover:text-white"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
      <button
        onClick={signOut}
        className="px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 border-transparent text-[#0B3363]/50 dark:text-white/50 hover:text-red-600 transition-colors ml-auto"
      >
        Sign Out
      </button>
    </div>
  );
}
