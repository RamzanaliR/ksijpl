"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

const NAV = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/admin/teams",
    label: "Teams",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="7" r="3.2" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
        <circle cx="18" cy="8" r="2.6" /><path d="M15.8 13.3A5.2 5.2 0 0 1 21.5 18" />
      </svg>
    ),
  },
  {
    href: "/admin/players",
    label: "Players",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    ),
  },
  {
    href: "/admin/fixtures",
    label: "Fixtures & Scores",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18" /><path d="M8 3v3M16 3v3" />
        <path d="M7.5 13.5h2M7.5 17h2M14.5 13.5h2M14.5 17h2" />
      </svg>
    ),
  },
  {
    href: "/admin/media",
    label: "Media",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="14" rx="2" /><circle cx="8.5" cy="9.5" r="1.6" />
        <path d="M21 15.5l-5.5-5-9.5 8" />
      </svg>
    ),
  },
  {
    href: "/admin/account",
    label: "Account",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.35a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.65 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.65a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.65a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.35 9a1.7 1.7 0 0 0 1.56 1.04H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15z" />
      </svg>
    ),
  },
  {
    href: "/admin/admins",
    label: "Admins",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l7 3.2v5.3c0 4.6-3 8.7-7 9.9-4-1.2-7-5.3-7-9.9V6.2L12 3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  const initials = (user?.email ?? "?")
    .split("@")[0]
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="admin-shell min-h-screen flex">
      <aside className="w-64 flex-shrink-0 flex flex-col p-4 sticky top-0 h-screen" style={{ background: "linear-gradient(180deg, #0B3363 0%, #0a2b54 100%)" }}>
        <div className="flex items-center gap-2.5 px-2 pt-2 pb-6">
          <div className="w-8 h-8 rounded-lg bg-[#F4B400] flex items-center justify-center flex-shrink-0">
            <span className="font-display font-bold text-[#0B3363] text-sm">K</span>
          </div>
          <div>
            <div className="font-display font-bold text-white text-sm leading-tight">KSIJ Admin</div>
            <div className="text-[11px] text-white/45 leading-tight">KSIJ DAR PL</div>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            const isActive = item.href === "/admin" ? pathname === "/admin" : pathname?.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={`admin-nav-link ${isActive ? "active" : ""}`}>
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 border-t border-white/10">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              {user?.email && (
                <div className="text-xs text-white/70 truncate">{user.email}</div>
              )}
              <button onClick={signOut} className="text-[11px] text-white/45 hover:text-white transition-colors">
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>
      <main className="flex-1 p-8 max-w-6xl">{children}</main>
    </div>
  );
}
