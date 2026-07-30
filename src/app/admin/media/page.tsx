"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────

type Division = "seniors" | "juniors";
type TemplateType = "fixtures" | "individual_match" | "results" | "league_table" | "motm" | "totw";

type Gameweek = { id: string; number: number; label: string };
type GeneratedMedia = {
  id: string;
  gameweek_id: string | null;
  match_id: string | null;
  template_type: TemplateType;
  division: Division;
  formation: string | null;
  storage_url: string | null;
  status: string;
  caption_generated: string | null;
  caption_manual: string | null;
  caption_final: string | null;
  instagram_posted_at: string | null;
  generation_error: string | null;
  generated_at: string | null;
  approved_at: string | null;
  created_at: string;
};

type Team = { id: string; name: string };
type MediaAsset = {
  id: string; category: string; team_id: string | null;
  label: string | null; storage_path: string; url: string; created_at: string;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const SENIORS_COMPETITION_ID = "e0eee160-729a-4cbd-a29a-20d36115db31";
const JUNIORS_COMPETITION_ID = "544019cb-0615-4b38-b9b8-03e71dfe1706";

const TEMPLATE_TYPES: { value: TemplateType; label: string; icon: string }[] = [
  { value: "fixtures",         label: "Fixtures",           icon: "📅" },
  { value: "individual_match", label: "Jersey Fixtures",    icon: "👕" },
  { value: "results",          label: "Results",            icon: "🏁" },
  { value: "league_table",     label: "League Table",       icon: "📊" },
  { value: "motm",             label: "Man of the Matches", icon: "⭐" },
  { value: "totw",             label: "Team of the Week",   icon: "🏆" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending_generation: { label: "Pending",    color: "bg-slate-100 text-slate-500" },
  generating:         { label: "Generating…",color: "bg-blue-50 text-blue-600" },
  generated:          { label: "Generated",  color: "bg-yellow-50 text-yellow-700" },
  pending_approval:   { label: "Review",     color: "bg-amber-50 text-amber-700" },
  approved:           { label: "Approved",   color: "bg-green-50 text-green-700" },
  rejected:           { label: "Rejected",   color: "bg-red-50 text-red-600" },
  posted:             { label: "Posted ✓",   color: "bg-[#0B3363]/10 text-[#0B3363]" },
};

const UPLOAD_CATEGORIES = [
  { value: "league_logo",        label: "League Logos",        teamScoped: false },
  { value: "main_sponsor_logo",  label: "Main Sponsor Logos",  teamScoped: false },
  { value: "hero_banner",        label: "Hero Banner / Image", teamScoped: false },
  { value: "hero_icon",          label: "Hero Icons",          teamScoped: false },
  { value: "team_sponsor_logo",  label: "Team Sponsor Logos",  teamScoped: true  },
  { value: "team_icon",          label: "Team Icons / Crests", teamScoped: true  },
  { value: "team_jersey",        label: "Team Jerseys",        teamScoped: true  },
  { value: "other",              label: "Other",               teamScoped: false },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function MediaAdmin() {
  // Division toggle
  const [division, setDivision] = useState<Division>("seniors");

  // Gameweek selector
  const [gameweeks, setGameweeks]   = useState<Gameweek[]>([]);
  const [selectedGw, setSelectedGw] = useState<string>("");

  // Template selection (for generation)
  const [selectedTypes, setSelectedTypes] = useState<Set<TemplateType>>(new Set());

  // Generated media
  const [allMedia, setAllMedia]       = useState<GeneratedMedia[]>([]);
  const [generating, setGenerating]   = useState(false);
  const [generateError, setGenerateError] = useState("");

  // Preview pane
  const [preview, setPreview] = useState<GeneratedMedia | null>(null);
  const [captionDraft, setCaptionDraft] = useState("");
  const [approving, setApproving] = useState(false);

  // Status filter
  const [statusFilter, setStatusFilter] = useState("all");

  // Upload section (collapsed by default)
  const [uploadOpen, setUploadOpen]   = useState(false);
  const [teams, setTeams]             = useState<Team[]>([]);
  const [assets, setAssets]           = useState<MediaAsset[]>([]);
  const [uploadCategory, setUploadCategory] = useState("league_logo");
  const [uploadTeamId, setUploadTeamId]     = useState("");
  const [uploadLabel, setUploadLabel]       = useState("");
  const [uploadFiles, setUploadFiles]       = useState<File[]>([]);
  const [uploading, setUploading]           = useState(false);
  const [uploadError, setUploadError]       = useState("");
  const [filterCategory, setFilterCategory] = useState("all");

  // ─── Load ──────────────────────────────────────────────────────────────────

  const loadGameweeks = useCallback(async (div: Division) => {
    const compId = div === "seniors" ? SENIORS_COMPETITION_ID : JUNIORS_COMPETITION_ID;
    const { data: seasons } = await supabase
      .from("seasons").select("id").eq("competition_id", compId);
    if (!seasons?.length) { setGameweeks([]); return; }
    const seasonIds = seasons.map((s: any) => s.id);
    const { data: gws } = await supabase
      .from("gameweeks").select("id,number,round_name")
      .in("season_id", seasonIds)
      .order("number", { ascending: false });
    const mapped = (gws ?? []).map((g: any) => ({
      id: g.id, number: g.number,
      label: g.round_name ?? `Match Week ${g.number}`,
    }));
    setGameweeks(mapped);
    if (mapped.length) setSelectedGw(mapped[0].id);
  }, []);

  const loadMedia = useCallback(async () => {
    const { data } = await supabase
      .from("generated_media")
      .select("*")
      .eq("division", division)
      .order("created_at", { ascending: false });
    setAllMedia((data ?? []) as GeneratedMedia[]);
  }, [division]);

  const loadUploadData = useCallback(async () => {
    const [{ data: t }, { data: a }] = await Promise.all([
      supabase.from("teams").select("id,name").order("name"),
      supabase.from("media_assets").select("*").order("created_at", { ascending: false }),
    ]);
    setTeams(t ?? []);
    setAssets(a ?? []);
  }, []);

  useEffect(() => {
    loadGameweeks(division);
    loadMedia();
  }, [division, loadGameweeks, loadMedia]);

  useEffect(() => {
    if (uploadOpen) loadUploadData();
  }, [uploadOpen, loadUploadData]);

  // ─── Generate ──────────────────────────────────────────────────────────────

  async function triggerGeneration() {
    if (!selectedGw || selectedTypes.size === 0) return;
    setGenerating(true);
    setGenerateError("");
    try {
      const res = await fetch("/api/admin/generate-graphic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameweek_id: selectedGw,
          division,
          template_types: Array.from(selectedTypes),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setGenerateError(err.error ?? "Generation failed.");
      }
    } catch (e: any) {
      setGenerateError(e.message);
    }
    setGenerating(false);
    await loadMedia();
  }

  function toggleType(t: TemplateType) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  }

  // ─── Approve / Reject ──────────────────────────────────────────────────────

  async function approveMedia(m: GeneratedMedia) {
    setApproving(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("generated_media").update({
      status: "approved",
      caption_final: captionDraft || m.caption_generated,
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", m.id);
    setApproving(false);
    setPreview(null);
    await loadMedia();
  }

  async function rejectMedia(m: GeneratedMedia) {
    await supabase.from("generated_media").update({
      status: "rejected", updated_at: new Date().toISOString(),
    }).eq("id", m.id);
    setPreview(null);
    await loadMedia();
  }

  // ─── Download ──────────────────────────────────────────────────────────────

  function downloadSingle(m: GeneratedMedia) {
    if (!m.storage_url) return;
    const a = document.createElement("a");
    a.href = m.storage_url;
    a.download = `${m.template_type}-${m.division}-${m.id.slice(0, 8)}.png`;
    a.click();
  }

  async function downloadBatchZip() {
    const gwMedia = filteredMedia.filter((m) => m.storage_url && m.gameweek_id === selectedGw);
    if (!gwMedia.length) return;
    // Create a simple list of URLs for admin to download individually (ZIP requires server-side)
    const urls = gwMedia.map((m) => m.storage_url).join("\n");
    const blob = new Blob([urls], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `MW-graphics-urls.txt`;
    a.click();
  }

  // ─── Upload (legacy section) ───────────────────────────────────────────────

  const activeCategoryDef = UPLOAD_CATEGORIES.find((c) => c.value === uploadCategory)!;

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setUploadError("");
    if (!uploadFiles.length) { setUploadError("Choose at least one file first."); return; }
    if (activeCategoryDef.teamScoped && !uploadTeamId) { setUploadError("Pick a team for this category."); return; }
    setUploading(true);
    for (const f of uploadFiles) {
      const ext = f.name.split(".").pop();
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const path = `${uploadCategory}/${uploadTeamId ? uploadTeamId + "/" : ""}${safeName}`;
      const { error: uploadErr } = await supabase.storage.from("media").upload(path, f, { cacheControl: "31536000", upsert: false });
      if (uploadErr) { setUploadError(`${f.name}: ${uploadErr.message}`); continue; }
      const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
      await supabase.from("media_assets").insert({
        category: uploadCategory,
        team_id: activeCategoryDef.teamScoped ? uploadTeamId : null,
        label: uploadLabel || (uploadFiles.length > 1 ? f.name : null),
        storage_path: path, url: pub.publicUrl,
      });
      if (uploadCategory === "team_sponsor_logo" && uploadTeamId) {
        await supabase.from("teams").update({ sponsor_logo_url: pub.publicUrl }).eq("id", uploadTeamId);
      }
    }
    setUploading(false);
    setUploadFiles([]);
    setUploadLabel("");
    loadUploadData();
  }

  async function deleteAsset(asset: MediaAsset) {
    if (!confirm("Delete this file? This can't be undone.")) return;
    await supabase.storage.from("media").remove([asset.storage_path]);
    await supabase.from("media_assets").delete().eq("id", asset.id);
    loadUploadData();
  }

  // ─── Derived ───────────────────────────────────────────────────────────────

  const filteredMedia = allMedia.filter((m) =>
    statusFilter === "all" ? true : m.status === statusFilter
  );

  const gwMedia = filteredMedia.filter((m) => m.gameweek_id === selectedGw);

  const selectedGwLabel = gameweeks.find((g) => g.id === selectedGw)?.label ?? "";

  const pendingCount = allMedia.filter((m) => m.status === "pending_approval" || m.status === "generated").length;

  const visibleUploadAssets = filterCategory === "all" ? assets : assets.filter((a) => a.category === filterCategory);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="admin-page-title mb-0.5">Media</h1>
          <p className="admin-subtitle">Generate, review, and publish weekly match graphics.</p>
        </div>
        {pendingCount > 0 && (
          <div className="rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold px-3 py-1">
            {pendingCount} graphic{pendingCount > 1 ? "s" : ""} awaiting review
          </div>
        )}
      </div>

      {/* ── Division Toggle ── */}
      <div className="flex gap-1 p-1 bg-[#0B3363]/5 rounded-xl w-fit">
        {(["seniors", "juniors"] as Division[]).map((d) => (
          <button
            key={d}
            onClick={() => setDivision(d)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              division === d
                ? "bg-[#0B3363] text-white"
                : "text-[#0B3363]/60 hover:text-[#0B3363]"
            }`}
          >
            {d === "seniors" ? "goFiber PL" : "Care & Cure PL"}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          GENERATE GRAPHICS (full width top)
      ══════════════════════════════════════════════════════ */}
      <div className="admin-card p-5">
        <h2 className="font-display font-bold text-sm mb-4">Generate Graphics</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="admin-label">Match Week</label>
            <select
              value={selectedGw}
              onChange={(e) => setSelectedGw(e.target.value)}
              className="admin-select w-48"
            >
              {gameweeks.map((g) => (
                <option key={g.id} value={g.id}>{g.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="admin-label mb-2 block">Select Templates</label>
            <div className="flex flex-wrap gap-2">
              {TEMPLATE_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => toggleType(t.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    selectedTypes.has(t.value)
                      ? "bg-[#0B3363] text-white border-[#0B3363]"
                      : "bg-white border-[#0B3363]/15 text-[#0B3363]/60 hover:border-[#0B3363]/30"
                  }`}
                >
                  <span>{t.icon}</span> {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setSelectedTypes(new Set(TEMPLATE_TYPES.map((t) => t.value)))}
              className="text-xs text-[#3EA0D9] hover:underline whitespace-nowrap"
            >
              Select all
            </button>
            <button
              onClick={triggerGeneration}
              disabled={generating || !selectedGw || selectedTypes.size === 0}
              className="admin-btn admin-btn-primary whitespace-nowrap"
            >
              {generating ? "Generating…" : `🚀 Generate ${selectedTypes.size > 0 ? selectedTypes.size : ""} Graphic${selectedTypes.size !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
        {generateError && (
          <div className="mt-3 rounded-lg bg-red-50 text-red-700 text-xs px-3 py-2">{generateError}</div>
        )}
        <div className="mt-3 rounded-lg bg-blue-50 text-blue-700 text-xs px-3 py-2">
          ⚙️ Canva API credentials not yet configured — generation will queue graphics for when credentials are added. <a href="#" className="underline font-semibold">Set up credentials →</a>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          STATUS LIST (350px) + PREVIEW PANE (730px)
      ══════════════════════════════════════════════════════ */}
      <div className="grid lg:grid-cols-[350px_1fr] gap-6 items-start">

        {/* ── Left: Status List ── */}
        <div className="admin-card overflow-hidden">
          <div className="p-4 border-b border-[#0B3363]/8 flex items-center justify-between">
            <h2 className="font-display font-bold text-sm">Graphics Status</h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border border-[#0B3363]/15 rounded-lg px-2 py-1"
            >
              <option value="all">All</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          {/* Grouped by match week */}
          {gameweeks.slice(0, 5).map((gw) => {
            const gwItems = filteredMedia.filter((m) => m.gameweek_id === gw.id);
            if (!gwItems.length) return null;
            return (
              <div key={gw.id}>
                <div className="px-4 py-2 bg-[#0B3363]/3 text-[10px] font-bold uppercase text-[#0B3363]/50 tracking-wide">
                  {gw.label}
                </div>
                {gwItems.map((m) => {
                  const tDef = TEMPLATE_TYPES.find((t) => t.value === m.template_type);
                  const sDef = STATUS_CONFIG[m.status] ?? STATUS_CONFIG.pending_generation;
                  return (
                    <button
                      key={m.id}
                      onClick={() => { setPreview(m); setCaptionDraft(m.caption_manual ?? m.caption_generated ?? ""); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left border-b border-[#0B3363]/5 last:border-0 hover:bg-[#0B3363]/3 transition-colors ${preview?.id === m.id ? "bg-[#0B3363]/5" : ""}`}
                    >
                      <span className="text-base">{tDef?.icon}</span>
                      <span className="flex-1 min-w-0">
                        <span className="text-xs font-semibold block truncate">{tDef?.label}</span>
                        {m.formation && <span className="text-[10px] text-[#0B3363]/40">{m.formation}</span>}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${sDef.color}`}>
                        {sDef.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}

          {filteredMedia.length === 0 && (
            <div className="p-6 text-center text-xs text-[#0B3363]/30">
              No graphics yet for {division === "seniors" ? "goFiber PL" : "Care & Cure PL"}.
              <br />Select a match week above and generate.
            </div>
          )}

          {/* Batch download */}
          {gwMedia.some((m) => m.storage_url) && (
            <div className="p-3 border-t border-[#0B3363]/8">
              <button onClick={downloadBatchZip} className="w-full text-xs text-[#3EA0D9] hover:underline font-semibold">
                ↓ Download {selectedGwLabel} graphics URLs
              </button>
            </div>
          )}
        </div>

        {/* ── Right: Preview & Approve ── */}
        <div className="min-w-0">
          {!preview ? (
            <div className="admin-card p-8 text-center text-sm text-[#0B3363]/30">
              Select a graphic from the list to preview and approve.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="admin-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="font-display font-bold text-sm">
                      {TEMPLATE_TYPES.find((t) => t.value === preview.template_type)?.icon}{" "}
                      {TEMPLATE_TYPES.find((t) => t.value === preview.template_type)?.label}
                    </h2>
                    <div className="text-xs text-[#0B3363]/40">
                      {gameweeks.find((g) => g.id === preview.gameweek_id)?.label} · {division === "seniors" ? "goFiber PL" : "Care & Cure PL"}
                      {preview.formation && ` · ${preview.formation}`}
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_CONFIG[preview.status]?.color}`}>
                    {STATUS_CONFIG[preview.status]?.label}
                  </span>
                </div>

                {/* Image preview */}
                {preview.storage_url ? (
                  <div className="rounded-xl overflow-hidden bg-slate-50 mb-3 flex items-center justify-center min-h-[200px]">
                    <img src={preview.storage_url} alt="Generated graphic" className="max-w-full max-h-[500px] object-contain" />
                  </div>
                ) : (
                  <div className={`rounded-xl min-h-[200px] mb-3 flex items-center justify-center text-sm ${
                    preview.status === "generating" ? "bg-blue-50 text-blue-500" : "bg-slate-50 text-[#0B3363]/30"
                  }`}>
                    {preview.status === "generating" ? "⏳ Generating…" :
                     preview.generation_error ? `❌ ${preview.generation_error}` :
                     "🎨 Awaiting generation"}
                  </div>
                )}

                {/* Caption editor */}
                {preview.storage_url && (
                  <div className="mb-3">
                    <label className="admin-label mb-1.5 block">Caption</label>
                    <textarea
                      value={captionDraft}
                      onChange={(e) => setCaptionDraft(e.target.value)}
                      rows={5}
                      className="w-full border border-[#0B3363]/15 rounded-lg px-3 py-2 text-xs font-mono resize-y"
                      placeholder="Caption will appear here once generated…"
                    />
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => setCaptionDraft(preview.caption_generated ?? "")}
                        className="text-[11px] text-[#3EA0D9] hover:underline"
                      >
                        ↺ Reset to generated
                      </button>
                      <span className="text-[11px] text-[#0B3363]/30">·</span>
                      <span className="text-[11px] text-[#0B3363]/30">{captionDraft.length} chars</span>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  {preview.storage_url && preview.status !== "posted" && (
                    <>
                      <button
                        onClick={() => approveMedia(preview)}
                        disabled={approving || preview.status === "approved"}
                        className="admin-btn admin-btn-primary text-xs"
                      >
                        {approving ? "Approving…" : preview.status === "approved" ? "✓ Approved" : "✓ Approve"}
                      </button>
                      <button
                        onClick={() => rejectMedia(preview)}
                        className="admin-btn text-xs border border-red-200 text-red-600 hover:bg-red-50"
                      >
                        ✗ Reject
                      </button>
                    </>
                  )}
                  {preview.status === "approved" && (
                    <button
                      disabled
                      className="admin-btn text-xs border border-[#E1306C]/20 text-[#E1306C]/50 cursor-not-allowed"
                      title="Instagram integration coming soon"
                    >
                      📸 Post to Instagram
                    </button>
                  )}
                  {preview.storage_url && (
                    <button
                      onClick={() => downloadSingle(preview)}
                      className="admin-btn text-xs border border-[#0B3363]/15"
                    >
                      ↓ Download PNG
                    </button>
                  )}
                </div>
              </div>

              {/* Other graphics in the same match week (carousel row) */}
              {gwMedia.filter((m) => m.id !== preview.id && m.storage_url).length > 0 && (
                <div className="admin-card p-4">
                  <h3 className="text-xs font-bold mb-3 text-[#0B3363]/50 uppercase tracking-wide">
                    Other {selectedGwLabel} Graphics
                  </h3>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {gwMedia.filter((m) => m.id !== preview.id && m.storage_url).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => { setPreview(m); setCaptionDraft(m.caption_manual ?? m.caption_generated ?? ""); }}
                        className="flex-shrink-0 w-28 rounded-lg overflow-hidden border border-[#0B3363]/10 hover:border-[#3EA0D9] transition-colors"
                      >
                        <img src={m.storage_url!} alt={m.template_type} className="w-full h-20 object-cover" />
                        <div className="p-1.5 text-center">
                          <div className="text-[10px] font-semibold truncate">
                            {TEMPLATE_TYPES.find((t) => t.value === m.template_type)?.icon}{" "}
                            {TEMPLATE_TYPES.find((t) => t.value === m.template_type)?.label}
                          </div>
                          <div className={`text-[9px] mt-0.5 px-1 rounded-full ${STATUS_CONFIG[m.status]?.color}`}>
                            {STATUS_CONFIG[m.status]?.label}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          FILE UPLOAD (collapsible legacy section)
      ══════════════════════════════════════════════════════ */}
      <div className="admin-card overflow-hidden">
        <button
          onClick={() => setUploadOpen((v) => !v)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-[#0B3363]/3 transition-colors"
        >
          <div>
            <span className="font-semibold text-sm">Asset Uploads</span>
            <span className="text-xs text-[#0B3363]/40 ml-2">Logos, jerseys, crests</span>
          </div>
          <span className="text-[#0B3363]/40 text-sm">{uploadOpen ? "▲" : "▼"}</span>
        </button>

        {uploadOpen && (
          <div className="border-t border-[#0B3363]/8 p-4 space-y-4">
            <form onSubmit={handleUpload} className="flex gap-3 items-end flex-wrap">
              <div>
                <label className="admin-label">Category</label>
                <select value={uploadCategory} onChange={(e) => { setUploadCategory(e.target.value); setUploadTeamId(""); }} className="admin-select w-52">
                  {UPLOAD_CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
                </select>
              </div>
              {activeCategoryDef.teamScoped && (
                <div>
                  <label className="admin-label">Team</label>
                  <select value={uploadTeamId} onChange={(e) => setUploadTeamId(e.target.value)} className="admin-select w-52">
                    <option value="">Select team…</option>
                    {teams.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                  </select>
                </div>
              )}
              <div>
                <label className="admin-label">Label (optional)</label>
                <input value={uploadLabel} onChange={(e) => setUploadLabel(e.target.value)} className="admin-input w-44" placeholder="e.g. Home jersey 2026" />
              </div>
              <div>
                <label className="admin-label">File</label>
                <input type="file" accept="image/*" multiple onChange={(e) => setUploadFiles(Array.from(e.target.files ?? []))} className="text-sm w-52 text-[#0B3363]" />
              </div>
              <button disabled={uploading} className="admin-btn admin-btn-primary">
                {uploading ? "Uploading…" : uploadFiles.length > 1 ? `Upload ${uploadFiles.length} files` : "Upload"}
              </button>
            </form>
            {uploadError && <div className="admin-alert admin-alert-error">{uploadError}</div>}
            <div className="max-w-xs">
              <label className="admin-label">Filter</label>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="admin-select">
                <option value="all">All categories</option>
                {UPLOAD_CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
              </select>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {visibleUploadAssets.map((a) => (
                <div key={a.id} className="admin-card p-3 flex flex-col">
                  <div className="h-24 flex items-center justify-center bg-slate-50 rounded-lg mb-2 overflow-hidden">
                    <img src={a.url} alt={a.label ?? a.category} className="max-h-24 max-w-full object-contain" />
                  </div>
                  <div className="text-[10px] font-bold uppercase text-[#3EA0D9]">{UPLOAD_CATEGORIES.find((c) => c.value === a.category)?.label}</div>
                  {a.label && <div className="text-xs text-slate-400 truncate">{a.label}</div>}
                  <div className="flex items-center justify-between mt-2">
                    <button onClick={() => navigator.clipboard.writeText(a.url)} className="text-[11px] text-[#3EA0D9] hover:underline">Copy URL</button>
                    <button onClick={() => deleteAsset(a)} className="text-[11px] text-red-600 hover:underline">Delete</button>
                  </div>
                </div>
              ))}
              {visibleUploadAssets.length === 0 && <div className="col-span-full admin-empty">No files uploaded yet.</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
