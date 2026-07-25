import Image from "next/image";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export default function SiteHeader({ active }: { active?: "seasons" | "teams" | "stats" | "news" | "fantasy" }) {
  const linkClass = (key: string) =>
    active === key
      ? "text-[#3EA0D9] border-b-2 border-[#3EA0D9] pb-4 -mb-4"
      : "hover:text-[#3EA0D9]";

  return (
    <>
      {/* Utility bar */}
      <div className="bg-[#0B3363] text-white text-xs">
        <div className="max-w-6xl mx-auto px-6 flex gap-6 overflow-x-auto py-2">
          <Link href="#" className="whitespace-nowrap font-semibold hover:text-[#F4B400]">gofiber KSIJ PL</Link>
          <span className="text-white/30">/</span>
          <Link href="/cup" className="whitespace-nowrap font-semibold hover:text-[#F4B400]">gofiber KSIJ Cup</Link>
          <span className="text-white/30">/</span>
          <Link href="#" className="whitespace-nowrap font-semibold hover:text-[#F4B400]">Care & Cure KSIJ PL</Link>
          <span className="text-white/30">/</span>
          <Link href="/cup" className="whitespace-nowrap font-semibold hover:text-[#F4B400]">Care & Cure KSIJ Cup</Link>
        </div>
      </div>

      {/* Nav */}
      <nav className="border-b border-[#0B3363]/10 dark:border-white/10 sticky top-0 z-20 bg-white/95 dark:bg-[#0B1220]/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-display font-bold text-lg">
            <Image src="/logos/gofiber-pl-badge.png" alt="gofiber KSIJ PL" width={36} height={36} className="object-contain" />
            <Image src="/logos/care-cure-pl-badge.png" alt="Care & Cure KSIJ PL" width={36} height={36} className="object-contain" />
            KSIJ DAR PL
          </Link>
          <ul className="hidden md:flex gap-7 text-sm font-semibold">
            <li><Link href="/" className={linkClass("seasons")}>Seasons</Link></li>
            <li><Link href="/teams" className={linkClass("teams")}>Teams</Link></li>
            <li><Link href="#" className={linkClass("stats")}>Stats</Link></li>
            <li><Link href="#" className={linkClass("news")}>Latest News</Link></li>
            <li><Link href="#" className={linkClass("fantasy")}>Fantasy</Link></li>
          </ul>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/admin" className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#0B3363] text-white hover:bg-[#0B3363]/90 dark:bg-[#3EA0D9] dark:hover:bg-[#3EA0D9]/90">
              Sign In
            </Link>
          </div>
        </div>
      </nav>
    </>
  );
}
