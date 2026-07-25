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
      <h1 className="admin-page-title mb-6">Account</h1>
      <form onSubmit={updatePassword} className="admin-card p-6 max-w-sm">
        <h2 className="font-semibold text-[#0B3363] mb-1">Change password</h2>
        <p className="admin-subtitle mb-4">
          If you're using the shared placeholder password, please change it now.
        </p>

        {error && <div className="admin-alert admin-alert-error mb-3">{error}</div>}
        {message && <div className="admin-alert admin-alert-success mb-3">{message}</div>}

        <label className="admin-label">New password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="admin-input mb-3"
        />
        <label className="admin-label">Confirm password</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="admin-input mb-4"
        />
        <button disabled={loading} className="admin-btn admin-btn-primary w-full">
          {loading ? "Updating…" : "Update Password"}
        </button>
      </form>
    </div>
  );
}
