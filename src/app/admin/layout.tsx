"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

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

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-56 bg-blue-900 text-white flex-shrink-0 p-5 flex flex-col">
        <div className="font-bold text-lg mb-8">KSIJ Admin</div>
        <nav className="flex flex-col gap-1 text-sm">
          <Link href="/admin" className="px-3 py-2 rounded hover:bg-blue-800">Dashboard</Link>
          <Link href="/admin/teams" className="px-3 py-2 rounded hover:bg-blue-800">Teams</Link>
          <Link href="/admin/players" className="px-3 py-2 rounded hover:bg-blue-800">Players</Link>
          <Link href="/admin/fixtures" className="px-3 py-2 rounded hover:bg-blue-800">Fixtures &amp; Scores</Link>
          <Link href="/admin/media" className="px-3 py-2 rounded hover:bg-blue-800">Media</Link>
          <Link href="/admin/account" className="px-3 py-2 rounded hover:bg-blue-800">Account</Link>
          <Link href="/admin/admins" className="px-3 py-2 rounded hover:bg-blue-800">Admins</Link>
        </nav>
        <div className="mt-auto pt-4 border-t border-blue-800 text-xs text-blue-200">
          {user?.email && <div className="mb-2 truncate">{user.email}</div>}
          <button onClick={signOut} className="text-blue-200 hover:text-white underline">
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
