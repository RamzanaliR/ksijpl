"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AccountPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setMessage("Password updated.");
      setPassword("");
      setConfirm("");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Account</h1>
      <form onSubmit={updatePassword} className="bg-white border rounded-xl p-6 max-w-sm">
        <h2 className="font-semibold text-slate-800 mb-1">Change password</h2>
        <p className="text-sm text-slate-500 mb-4">
          If you're using the shared placeholder password, please change it now.
        </p>

        {error && <div className="bg-red-50 text-red-700 text-sm rounded px-3 py-2 mb-3">{error}</div>}
        {message && <div className="bg-green-50 text-green-700 text-sm rounded px-3 py-2 mb-3">{message}</div>}

        <label className="block text-xs font-semibold text-slate-500 mb-1">New password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded px-3 py-2 text-sm w-full mb-3"
        />
        <label className="block text-xs font-semibold text-slate-500 mb-1">Confirm password</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="border rounded px-3 py-2 text-sm w-full mb-4"
        />
        <button
          disabled={loading}
          className="bg-blue-700 text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-50"
        >
          {loading ? "Updating…" : "Update Password"}
        </button>
      </form>
    </div>
  );
}
