"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

type Team = { id: string; name: string; short_name: string | null; slug: string | null; division_id: string };
type Division = { id: string; name: string; slug: string; label: string };

export default function TeamsGrid({ divisions, teams }: { divisions: Division[]; teams: Team[] }) {
  const [active, setActive] = useState(0);
  const division = divisions[active];
  const divisionTeams = teams.filter((t) => t.division_id === division?.id);

  return (
    <div>
      <div className="flex items-center gap-2 mb-8">
        {divisions.map((d, i) => (
          <button
            key={d.id}
            onClick={() => setActive(i)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              i === active
                ? "bg-[#0B3363] text-white dark:bg-[#3EA0D9] dark:text-[#0B1220]"
                : "bg-[#0B3363]/5 dark:bg-white/10 hover:bg-[#0B3363]/10 dark:hover:bg-white/15"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {divisionTeams.map((t) => (
          <Link
            key={t.id}
            href={`/teams/${t.id}`}
            className="flex flex-col items-center text-center gap-3 rounded-2xl p-6 border border-[#0B3363]/10 dark:border-white/10 hover:border-[#3EA0D9]/50 hover:-translate-y-1 hover:shadow-lg hover:shadow-[#0B3363]/5 transition-all duration-150"
          >
            <div className="w-20 h-20 rounded-2xl bg-white border-2 border-[#0B3363] flex items-center justify-center flex-shrink-0 overflow-hidden">
              {t.slug ? (
                <Image src={`/sponsors/${t.slug}.png`} alt={t.name} width={64} height={64} className="object-contain w-full h-full" />
              ) : (
                <span className="font-display font-bold text-[#0B3363] text-xl">
                  {t.short_name || t.name.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="font-semibold">{t.name}</div>
              {t.short_name && <div className="text-xs text-[#0B3363]/50 dark:text-white/50">{t.short_name}</div>}
            </div>
          </Link>
        ))}
        {divisionTeams.length === 0 && (
          <div className="col-span-full text-sm text-[#0B3363]/40 dark:text-white/40 text-center py-10">No teams yet.</div>
        )}
      </div>
    </div>
  );
}
