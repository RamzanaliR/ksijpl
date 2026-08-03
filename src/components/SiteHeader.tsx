"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { supabase } from "@/lib/supabase";

const NAV_ITEMS: { key: "home" | "seasons" | "teams" | "cup" | "news" | "fantasy" | "stats"; label: string; href: string }[] = [
  { key: "home", label: "Home", href: "/" },
  { key: "seasons", label: "Seasons", href: "/seasons" },
  { key: "stats", label: "Stats", href: "/stats" },
  { key: "teams", label: "Teams", href: "/teams" },
  { key: "cup", label: "Cup", href: "/cup" },
  { key: "news", label: "Latest News", href: "#" },
  { key: "fantasy", label: "Fantasy", href: "/fantasy" },
];

export default function SiteHeader({ active }: { active?: "home" | "seasons" | "teams" | "cup" | "news" | "fantasy" | "stats" }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [cupVisible, setCupVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function checkAdmin(userId: string | undefined) {
      if (!userId) {
        setIsAdmin(false);
        return;
      }
      const { data } = await supabase.from("admin_users").select("id").eq("id", userId).maybeSingle();
      setIsAdmin(!!data);
    }
    supabase.auth.getUser().then(({ data }) => {
      setSignedIn(!!data.user);
      checkAdmin(data.user?.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session?.user);
      checkAdmin(session?.user?.id);
    });
    supabase
      .from("seasons")
      .select("id,competitions!inner(type)")
      .eq("is_public", true)
      .eq("competitions.type", "cup")
      .limit(1)
      .then(({ data }) => setCupVisible(!!data && data.length > 0));
    return () => sub.subscription.unsubscribe();
  }, []);

  const visibleNavItems = NAV_ITEMS.filter((item) => item.key !== "cup" || cupVisible);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  }

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
          {cupVisible && <><span className="text-white/30">/</span>
          <Link href="/cup" className="whitespace-nowrap font-semibold hover:text-[#F4B400]">gofiber KSIJ Cup</Link></>}
          <span className="text-white/30">/</span>
          <Link href="#" className="whitespace-nowrap font-semibold hover:text-[#F4B400]">Care & Cure KSIJ PL</Link>
          {cupVisible && <><span className="text-white/30">/</span>
          <Link href="/cup" className="whitespace-nowrap font-semibold hover:text-[#F4B400]">Care & Cure KSIJ Cup</Link></>}
        </div>
      </div>

      {/* Nav */}
      <nav className="border-b border-[#0B3363]/10 dark:border-white/10 sticky top-0 z-20 bg-white/95 dark:bg-[#0B1220]/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-display font-bold text-lg" onClick={() => setMenuOpen(false)}>
            <Image src="/logos/gofiber-pl-badge.png" alt="gofiber KSIJ PL" width={36} height={36} className="object-contain" />
            <Image src="/logos/care-cure-pl-badge.png" alt="Care & Cure KSIJ PL" width={36} height={36} className="object-contain" />
            KSIJ DAR PL
          </Link>
          <ul className="hidden md:flex gap-7 text-sm font-semibold">
            {visibleNavItems.map((item) => (
              <li key={item.key}><Link href={item.href} className={linkClass(item.key)}>{item.label}</Link></li>
            ))}
          </ul>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {isAdmin && (
              <Link href="/admin" className="hidden sm:inline-block text-sm font-semibold px-4 py-2 rounded-lg border border-[#0B3363]/20 dark:border-white/20 text-[#0B3363] dark:text-white hover:bg-[#0B3363]/5 dark:hover:bg-white/10">
                Admin
              </Link>
            )}
            {signedIn ? (
              <button
                onClick={handleSignOut}
                className="hidden sm:inline-block text-sm font-semibold px-4 py-2 rounded-lg bg-[#0B3363] text-white hover:bg-[#0B3363]/90 dark:bg-[#3EA0D9] dark:hover:bg-[#3EA0D9]/90"
              >
                Sign Out
              </button>
            ) : (
              <Link href="/fantasy/login" className="hidden sm:inline-block text-sm font-semibold px-4 py-2 rounded-lg bg-[#0B3363] text-white hover:bg-[#0B3363]/90 dark:bg-[#3EA0D9] dark:hover:bg-[#3EA0D9]/90">
                Sign In
              </Link>
            )}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              className="md:hidden p-2 -mr-2 text-[#0B3363] dark:text-white"
            >
              {menuOpen ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu panel */}
        {menuOpen && (
          <div className="md:hidden border-t border-[#0B3363]/10 dark:border-white/10 px-6 py-4">
            <ul className="flex flex-col gap-1 text-sm font-semibold">
              {visibleNavItems.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={`block py-2.5 ${active === item.key ? "text-[#3EA0D9]" : "text-[#0B3363] dark:text-white"}`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li className="sm:hidden pt-1">
                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="block text-center py-2.5 rounded-lg border border-[#0B3363]/20 dark:border-white/20 mb-2"
                  >
                    Admin
                  </Link>
                )}
                {signedIn ? (
                  <button
                    onClick={handleSignOut}
                    className="w-full text-center py-2.5 rounded-lg bg-[#0B3363] text-white dark:bg-[#3EA0D9]"
                  >
                    Sign Out
                  </button>
                ) : (
                  <Link
                    href="/fantasy/login"
                    onClick={() => setMenuOpen(false)}
                    className="block text-center py-2.5 rounded-lg bg-[#0B3363] text-white dark:bg-[#3EA0D9]"
                  >
                    Sign In
                  </Link>
                )}
              </li>
            </ul>
          </div>
        )}
      </nav>
    </>
  );
}
