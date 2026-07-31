"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function SiteFooter() {
  const [partners, setPartners] = useState<{ id: string; name: string; logo_url: string; website_url: string | null }[]>([]);

  useEffect(() => {
    supabase.from("partners").select("id,name,logo_url,website_url").order("display_order")
      .then(({ data }) => setPartners(data ?? []));
  }, []);

  return (
    <footer className="mt-auto bg-[#0B3363] dark:bg-[#060B14] text-white">
      {partners.length > 0 && (
        <div className="max-w-6xl mx-auto px-6 pt-10">
          <h5 className="font-display font-bold text-xs uppercase tracking-wide opacity-70 mb-4">Our Partners</h5>
          <div className="flex flex-wrap gap-4 pb-8 border-b border-white/10">
            {partners.map((p) => (
              <a key={p.id} href={p.website_url || "#"} target={p.website_url ? "_blank" : undefined}
                rel={p.website_url ? "noopener noreferrer" : undefined}
                className="w-32 h-20 bg-white rounded-lg flex items-center justify-center p-2 hover:opacity-90 transition-opacity">
                <img src={p.logo_url} alt={p.name} className="object-contain w-full h-full" />
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* Column 1: League */}
          <div>
            <h5 className="font-display font-bold text-xs uppercase tracking-wide mb-3 opacity-70">League</h5>
            <div className="space-y-2 text-sm">
              <Link href="/seasons"  className="block hover:text-[#F4B400] transition-colors">Seasons</Link>
              <Link href="/stats"    className="block hover:text-[#F4B400] transition-colors">Stats</Link>
              <Link href="/seasons"  className="block hover:text-[#F4B400] transition-colors">Fixtures</Link>
            </div>
          </div>

          {/* Column 2: Fantasy */}
          <div>
            <h5 className="font-display font-bold text-xs uppercase tracking-wide mb-3 opacity-70">Fantasy</h5>
            <div className="space-y-2 text-sm">
              <Link href="/fantasy"  className="block hover:text-[#F4B400] transition-colors">Create Squad</Link>
              <Link href="/fantasy"  className="block hover:text-[#F4B400] transition-colors">Leaderboard</Link>
              <Link href="/fantasy"  className="block hover:text-[#F4B400] transition-colors">Rules</Link>
            </div>
          </div>

          {/* Column 3: More — 3 rows on desktop (grid 3×1), 1 column on mobile */}
          <div>
            <h5 className="font-display font-bold text-xs uppercase tracking-wide mb-3 opacity-70">More</h5>
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-1 gap-y-2 gap-x-4 text-sm">
              <Link href="#"       className="hover:text-[#F4B400] transition-colors">Latest News</Link>
              <Link href="/teams"  className="hover:text-[#F4B400] transition-colors">Teams</Link>
              <Link href="/teams"  className="hover:text-[#F4B400] transition-colors">Players</Link>
            </div>
          </div>

        </div>
      </div>

      <div className="text-center text-xs opacity-40 py-4 border-t border-white/10">
        © 2026 KSIJ DAR League
      </div>
    </footer>
  );
}
