import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mt-auto bg-[#0B3363] dark:bg-[#060B14] text-white">
      <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-3 gap-8">
        <div>
          <h5 className="font-display font-bold text-xs uppercase tracking-wide mb-3 opacity-70">League</h5>
          <div className="space-y-2 text-base sm:text-sm font-semibold sm:font-normal">
            <Link href="/" className="block hover:text-[#F4B400]">Seasons</Link>
            <Link href="/" className="block hover:text-[#F4B400]">Table</Link>
            <Link href="#" className="block hover:text-[#F4B400]">Fixtures &amp; Results</Link>
            <Link href="/cup" className="block hover:text-[#F4B400]">Cup</Link>
            <Link href="#" className="block hover:text-[#F4B400]">Stats</Link>
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
