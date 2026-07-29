"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Team = { id: string; name: string };
type MediaAsset = {
  id: string;
  category: string;
  team_id: string | null;
  label: string | null;
  storage_path: string;
  url: string;
  created_at: string;
};

const CATEGORIES = [
  { value: "league_logo", label: "League Logos", teamScoped: false },
  { value: "main_sponsor_logo", label: "Main Sponsor Logos", teamScoped: false },
  { value: "hero_banner", label: "Hero Banner / Image", teamScoped: false },
  { value: "hero_icon", label: "Hero Icons", teamScoped: false },
  { value: "team_sponsor_logo", label: "Team Sponsor Logos", teamScoped: true },
  { value: "team_icon", label: "Team Icons / Crests", teamScoped: true },
  { value: "team_jersey", label: "Team Jerseys", teamScoped: true },
  { value: "other", label: "Other", teamScoped: false },
];

export default function MediaAdmin() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [category, setCategory] = useState("league_logo");
  const [teamId, setTeamId] = useState("");
  const [label, setLabel] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");

  const activeCategoryDef = CATEGORIES.find((c) => c.value === category)!;

  async function load() {
    const [{ data: t }, { data: a }] = await Promise.all([
      supabase.from("teams").select("id,name").order("name"),
      supabase.from("media_assets").select("*").order("created_at", { ascending: false }),
    ]);
    setTeams(t ?? []);
    setAssets(a ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (files.length === 0) {
      setError("Choose at least one file first.");
      return;
    }
    if (activeCategoryDef.teamScoped && !teamId) {
      setError("Pick a team for this category.");
      return;
    }
    setUploading(true);

    for (const f of files) {
      const ext = f.name.split(".").pop();
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const path = `${category}/${teamId ? teamId + "/" : ""}${safeName}`;

      const { error: uploadError } = await supabase.storage.from("media").upload(path, f, {
        cacheControl: "31536000",
        upsert: false,
      });

      if (uploadError) {
        setError(`${f.name}: ${uploadError.message}`);
        continue;
      }

      const { data: pub } = supabase.storage.from("media").getPublicUrl(path);

      const { error: insertError } = await supabase.from("media_assets").insert({
        category,
        team_id: activeCategoryDef.teamScoped ? teamId : null,
        label: label || (files.length > 1 ? f.name : null),
        storage_path: path,
        url: pub.publicUrl,
      });
      if (insertError) setError(`${f.name}: ${insertError.message}`);

      // Wire straight into the live site: a team sponsor logo upload updates the team record
      // so every sponsor badge across the site picks it up immediately, no code change needed.
      if (category === "team_sponsor_logo" && teamId) {
        const { error: teamUpdateError } = await supabase.from("teams").update({ sponsor_logo_url: pub.publicUrl }).eq("id", teamId);
        if (teamUpdateError) setError(`Uploaded, but couldn't link it to the team: ${teamUpdateError.message}`);
      }
    }

    setUploading(false);
    setFiles([]);
    setLabel("");
    load();
  }

  async function deleteAsset(asset: MediaAsset) {
    if (!confirm("Delete this file? This can't be undone.")) return;
    await supabase.storage.from("media").remove([asset.storage_path]);
    await supabase.from("media_assets").delete().eq("id", asset.id);
    load();
  }

  function teamName(id: string | null) {
    if (!id) return null;
    return teams.find((t) => t.id === id)?.name ?? "Unknown team";
  }

  const visibleAssets = filterCategory === "all" ? assets : assets.filter((a) => a.category === filterCategory);

  return (
    <div>
      <h1 className="admin-page-title mb-1">Media</h1>
      <p className="admin-subtitle mb-6 max-w-2xl">
        Upload league logos, sponsor logos, team crests, jerseys, and hero images here. Files are stored
        in Supabase Storage and served publicly — copy the URL to use anywhere on the site.
      </p>

      <form onSubmit={upload} className="admin-card p-5 mb-8 flex gap-3 items-end flex-wrap">
        <div>
          <label className="admin-label">Category</label>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setTeamId("");
            }}
            className="admin-select w-56"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {activeCategoryDef.teamScoped && (
          <div>
            <label className="admin-label">Team</label>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="admin-select w-56">
              <option value="">Select team…</option>
              {teams.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
            </select>
          </div>
        )}

        <div>
          <label className="admin-label">Label (optional)</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} className="admin-input w-48" placeholder="e.g. Home jersey 2026" />
        </div>

        <div>
          <label className="admin-label">File{files.length > 1 ? "s" : ""}</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="text-sm w-56 text-[#0B3363]"
          />
          {files.length > 1 && <p className="text-[11px] text-slate-400 mt-1">{files.length} files selected — label applied to all if set.</p>}
        </div>

        <button disabled={uploading} className="admin-btn admin-btn-primary">
          {uploading ? "Uploading…" : files.length > 1 ? `Upload ${files.length} files` : "Upload"}
        </button>
      </form>

      {error && <div className="admin-alert admin-alert-error mb-4 max-w-lg">{error}</div>}

      <div className="mb-4 max-w-xs">
        <label className="admin-label">Filter</label>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="admin-select">
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {visibleAssets.map((a) => (
          <div key={a.id} className="admin-card p-3 flex flex-col">
            <div className="h-24 flex items-center justify-center bg-slate-50 rounded-lg mb-2 overflow-hidden">
              <img src={a.url} alt={a.label ?? a.category} className="max-h-24 max-w-full object-contain" />
            </div>
            <div className="text-[10px] font-bold uppercase text-[#3EA0D9]">{CATEGORIES.find((c) => c.value === a.category)?.label}</div>
            {teamName(a.team_id) && <div className="text-xs text-slate-500 truncate">{teamName(a.team_id)}</div>}
            {a.label && <div className="text-xs text-slate-400 truncate">{a.label}</div>}
            <div className="flex items-center justify-between mt-2">
              <button
                onClick={() => navigator.clipboard.writeText(a.url)}
                className="text-[11px] text-[#3EA0D9] hover:underline"
              >
                Copy URL
              </button>
              <button onClick={() => deleteAsset(a)} className="text-[11px] text-red-600 hover:underline">
                Delete
              </button>
            </div>
          </div>
        ))}
        {visibleAssets.length === 0 && (
          <div className="col-span-full admin-empty">No files uploaded yet for this filter.</div>
        )}
      </div>
    </div>
  );
}
