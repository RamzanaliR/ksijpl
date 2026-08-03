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
    scope: "all",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/admin/live",
    label: "Live Match Console",
    scope: "matchday",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </svg>
    ),
  },
  {
    href: "/admin/teams",
    label: "Teams",
    scope: "league",
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
    scope: "league",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    ),
  },
  {
    href: "/admin/fixtures",
    label: "Fixtures",
    scope: "league",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18" /><path d="M8 3v3M16 3v3" />
        <path d="M7.5 13.5h2M7.5 17h2M14.5 13.5h2M14.5 17h2" />
      </svg>
    ),
  },
  {
    href: "/admin/cup",
    label: "Cup",
    scope: "league",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4z" />
        <path d="M7 5H4a3 3 0 0 0 3 5M17 5h3a3 3 0 0 1-3 5" />
      </svg>
    ),
  },
  {
    href: "/admin/totw",
    label: "Team of Week",
    scope: "league",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.1 6.6-5.8-3.1-5.8 3.1 1.1-6.6-4.8-4.6 6.6-.9z" />
      </svg>
    ),
  },
  {
    href: "/admin/prices",
    label: "Player Prices",
    scope: "fantasy",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 6v2m0 8v2M9 9h4.5a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3H15"/>
      </svg>
    ),
  },
  {
    href: "/admin/fantasy",
    label: "Fantasy",
    scope: "fantasy",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.1 6.6-5.8-3.1-5.8 3.1 1.1-6.6-4.8-4.6 6.6-.9z" />
      </svg>
    ),
  },
  {
    href: "/admin/media",
    label: "Media",
    scope: "league",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="14" rx="2" /><circle cx="8.5" cy="9.5" r="1.6" />
        <path d="M21 15.5l-5.5-5-9.5 8" />
      </svg>
    ),
  },
  {
    href: "/admin/partners",
    label: "Partners",
    scope: "league",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="7" width="7" height="5" rx="1" /><rect x="14" y="7" width="7" height="5" rx="1" /><path d="M10 9.5h4" />
      </svg>
    ),
  },
  {
    href: "/admin/account",
    label: "Account",
    scope: "all",
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
    scope: "super",
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
  const [role, setRole] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user) {
        const { data: adminRow } = await supabase.from("admin_users").select("role").eq("id", data.user.id).maybeSingle();
        setRole(adminRow?.role ?? null);
      }
    });
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  function canSee(scope: string) {
    if (!role) return false;
    if (role === "super_admin") return true;
    if (role === "matchday_admin") return scope === "matchday";
    if (scope === "all") return true;
    if (scope === "super") return false;
    if (scope === "league") return false;
    if (scope === "fantasy") return role === "fantasy_admin";
    return false;
  }

  const visibleNav = NAV.filter((item) => canSee(item.scope));

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  const initials = (user?.email ?? "?")
    .split("@")[0]
    .slice(0, 2)
    .toUpperCase();

  const sidebarContent = (
    <>
      <div className="flex items-center gap-2.5 px-2 pt-2 pb-6">
        <div className="w-8 h-8 rounded-lg bg-[#F4B400] flex items-center justify-center flex-shrink-0">
          <span className="font-display font-bold text-[#0B3363] text-sm">K</span>
        </div>
        <div>
          <div className="font-display font-bold text-white text-sm leading-tight">KSIJ Admin</div>
          <div className="text-[11px] text-white/45 leading-tight">KSIJ DAR PL</div>
        </div>
        <button onClick={() => setDrawerOpen(false)} className="ml-auto md:hidden text-white/60 hover:text-white p-1" aria-label="Close menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <nav className="flex flex-col gap-0.5">
        {visibleNav.map((item) => {
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
    </>
  );

  return (
    <div className="admin-shell min-h-screen flex flex-col md:flex-row">
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center gap-3 px-4 py-3 sticky top-0 z-30" style={{ background: "linear-gradient(180deg, #0B3363 0%, #0a2b54 100%)" }}>
        <button onClick={() => setDrawerOpen(true)} className="text-white p-1 -ml-1" aria-label="Open menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
        <div className="w-6 h-6 rounded bg-[#F4B400] flex items-center justify-center flex-shrink-0">
          <span className="font-display font-bold text-[#0B3363] text-xs">K</span>
        </div>
        <div className="font-display font-bold text-white text-sm">KSIJ Admin</div>
      </div>

      {/* Mobile drawer backdrop */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setDrawerOpen(false)} />
      )}

      {/* Sidebar: fixed on desktop, slide-in drawer on mobile */}
      <aside
        className={`w-64 flex-shrink-0 flex flex-col p-4 fixed md:sticky top-0 h-screen z-50 transition-transform duration-200 ease-out md:translate-x-0 ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "linear-gradient(180deg, #0B3363 0%, #0a2b54 100%)" }}
      >
        {sidebarContent}
      </aside>

      <main className="flex-1 p-4 md:p-8 max-w-6xl min-w-0 overflow-x-hidden">{children}</main>
    </div>
  );
}
