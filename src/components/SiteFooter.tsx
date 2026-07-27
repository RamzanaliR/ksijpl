"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function SiteFooter() {
  const [cupVisible, setCupVisible] = useState(false);

  useEffect(() => {
    supabase
      .from("seasons")
      .select("id,competitions!inner(type)")
      .eq("is_public", true)
      .eq("competitions.type", "cup")
      .limit(1)
      .then(({ data }) => setCupVisible(!!data && data.length > 0));
  }, []);

  return (
    <footer className="mt-auto bg-[#0B3363] dark:bg-[#060B14] text-white">
      <div className="max-w-6xl mx-auto px-6 pt-10">
        <h5 className="font-display font-bold text-xs uppercase tracking-wide opacity-70 mb-4">Our Partners</h5>
        <div className="flex flex-wrap gap-4 pb-8 border-b border-white/10">
          <a href="#" className="w-32 h-20 bg-white rounded-lg flex items-center justify-center p-2 hover:opacity-90 transition-opacity">
            <img src="/logos/gofiber-pl-badge.png" alt="gofiber" className="object-contain w-full h-full" />
          </a>
          <a href="#" className="w-32 h-20 bg-white rounded-lg flex items-center justify-center p-2 hover:opacity-90 transition-opacity">
            <img src="/logos/care-cure-pl-badge.png" alt="Care & Cure" className="object-contain w-full h-full" />
          </a>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-3 gap-8">
        <div>
          <h5 className="font-display font-bold text-xs uppercase tracking-wide mb-3 opacity-70">League</h5>
          <div className="space-y-2 text-base sm:text-sm font-semibold sm:font-normal">
            <Link href="/seasons" className="block hover:text-[#F4B400]">Seasons</Link>
            <Link href="/" className="block hover:text-[#F4B400]">Table</Link>
            <Link href="#" className="block hover:text-[#F4B400]">Fixtures &amp; Results</Link>
            {cupVisible && <Link href="/cup" className="block hover:text-[#F4B400]">Cup</Link>}
          </div>
        </div>
        <div>
          <h5 className="font-display font-bold text-xs uppercase tracking-wide mb-3 opacity-70">Fantasy</h5>
          <div className="space-y-2 text-base sm:text-sm font-semibold sm:font-normal">
            <Link href="/fantasy" className="block hover:text-[#F4B400]">Create Squad</Link>
            <Link href="/fantasy" className="block hover:text-[#F4B400]">Leaderboard</Link>
            <Link href="/fantasy" className="block hover:text-[#F4B400]">Rules</Link>
          </div>
        </div>
        <div className="col-span-2 md:col-span-1 pt-2 md:pt-0 border-t md:border-t-0 border-white/10">
          <h5 className="font-display font-bold text-xs uppercase tracking-wide mb-3 opacity-70 mt-4 md:mt-0">More</h5>
          <div className="flex gap-6 text-base sm:text-sm font-semibold sm:font-normal">
            <Link href="#" className="hover:text-[#F4B400]">Latest News</Link>
            <Link href="/teams" className="hover:text-[#F4B400]">Teams</Link>
            <Link href="/teams" className="hover:text-[#F4B400]">Players</Link>
          </div>
        </div>
      </div>
      <div className="text-center text-xs opacity-40 py-4 border-t border-white/10">© 2026 KSIJ League</div>
    </footer>
  );
}
