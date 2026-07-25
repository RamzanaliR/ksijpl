"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-blue-900 mb-1">KSIJ Admin</h1>
        <p className="text-sm text-slate-500 mb-6">Sign in to manage teams, players and scores.</p>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded px-3 py-2 mb-4">{error}</div>
        )}

        <label className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded px-3 py-2 text-sm w-full mb-4"
        />

        <label className="block text-xs font-semibold text-slate-500 mb-1">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded px-3 py-2 text-sm w-full mb-6"
        />

        <button
          disabled={loading}
          className="bg-blue-700 text-white w-full py-2.5 rounded text-sm font-semibold disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
