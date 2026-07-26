"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { key: "squad", label: "Squad", path: "" },
  { key: "pick-team", label: "Pick Team", path: "/pick-team" },
  { key: "points", label: "Points", path: "/points" },
  { key: "leaderboard", label: "Leaderboard", path: "/leaderboard" },
  { key: "transfers", label: "Transfers", path: "/transfers" },
];

export default function FantasySubNav({ poolId }: { poolId: string }) {
  const pathname = usePathname();
  const base = `/fantasy/team/${poolId}`;

  return (
    <div className="flex items-center gap-1 mb-6 overflow-x-auto border-b border-[#0B3363]/10 dark:border-white/10">
      {TABS.map((tab) => {
        const href = `${base}${tab.path}`;
        const isActive = pathname === href || (tab.path === "" && pathname === base);
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
    </div>
  );
}
