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
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(160deg, #0B3363 0%, #0a2b54 55%, #082246 100%)" }}
    >
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl shadow-black/20">
        <div className="w-10 h-10 rounded-xl bg-[#F4B400] flex items-center justify-center mb-4">
          <span className="font-display font-bold text-[#0B3363] text-base">K</span>
        </div>
        <h1 className="admin-page-title mb-1">KSIJ Admin</h1>
        <p className="admin-subtitle mb-6">Sign in to manage teams, players and scores.</p>

        {error && <div className="admin-alert admin-alert-error mb-4">{error}</div>}

        <label className="admin-label">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="admin-input mb-4"
        />

        <label className="admin-label">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="admin-input mb-6"
        />

        <button disabled={loading} className="admin-btn admin-btn-primary w-full py-2.5">
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
