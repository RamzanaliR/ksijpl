"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export default function FantasyLogin() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    setError("");
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/fantasy` },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/fantasy` },
      });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      if (data.session) {
        router.push("/fantasy");
        router.refresh();
      } else {
        setMessage("Check your email to confirm your account, then sign in.");
        setMode("signin");
      }
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/fantasy");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
      <SiteHeader active="fantasy" />
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="w-10 h-10 rounded-xl bg-[#F4B400] flex items-center justify-center mb-4 mx-auto">
            <span className="font-display font-bold text-[#0B3363] text-base">⚽</span>
          </div>
          <h1 className="font-display font-bold text-2xl text-center mb-1">KSIJ Fantasy</h1>
          <p className="text-center text-[#0B3363]/60 dark:text-white/60 mb-8 text-sm">
            {mode === "signin" ? "Sign in to manage your fantasy team." : "Create an account to build your fantasy team."}
          </p>

          {error && <div className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3 mb-4">{error}</div>}
          {message && <div className="rounded-xl bg-green-50 text-green-700 text-sm px-4 py-3 mb-4">{message}</div>}

          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-2 border border-[#0B3363]/15 dark:border-white/15 rounded-lg py-2.5 font-semibold text-sm mb-4 hover:bg-[#0B3363]/5 dark:hover:bg-white/5 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z"/><path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54v-3.1H1.27a12 12 0 0 0 0 10.74z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.63l4 3.1C6.22 6.86 8.87 4.75 12 4.75z"/></svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="h-px bg-[#0B3363]/10 dark:bg-white/10 flex-1" />
            <span className="text-xs text-[#0B3363]/40 dark:text-white/40">or</span>
            <div className="h-px bg-[#0B3363]/10 dark:bg-white/10 flex-1" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#0B3363]/60 dark:text-white/60 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-[#0B3363]/15 dark:border-white/15 dark:bg-white/5 rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0B3363]/60 dark:text-white/60 mb-1">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-[#0B3363]/15 dark:border-white/15 dark:bg-white/5 rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
            <button
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-[#0B3363] text-white dark:bg-[#3EA0D9] font-semibold text-sm mt-1 disabled:opacity-50"
            >
              {loading ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <p className="text-center text-sm mt-6 text-[#0B3363]/60 dark:text-white/60">
            {mode === "signin" ? (
              <>Don&apos;t have an account?{" "}
                <button onClick={() => setMode("signup")} className="font-semibold text-[#3EA0D9] hover:underline">Sign up</button>
              </>
            ) : (
              <>Already have an account?{" "}
                <button onClick={() => setMode("signin")} className="font-semibold text-[#3EA0D9] hover:underline">Sign in</button>
              </>
            )}
          </p>
          <p className="text-center text-xs mt-3">
            <Link href="/" className="text-[#0B3363]/40 dark:text-white/40 hover:text-[#3EA0D9]">← Back to KSIJ DAR PL</Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
