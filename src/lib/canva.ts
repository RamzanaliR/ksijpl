/**
 * Canva Connect API helper
 * Handles: token refresh, autofill job creation, polling for completion, PNG export
 */

import { createClient } from "@supabase/supabase-js";

const CANVA_API = "https://api.canva.com/rest/v1";

// ─── Template IDs (fill in as each design is published as Brand Template) ─────
export const CANVA_TEMPLATE_IDS: Record<string, string> = {
  fixtures:         "EAHQ2Xq4Gb0",
  individual_match: "",
  results:          "",
  league_table:     "",
  motm:             "",
  "totw-1-3-3-2":  "",
  "totw-1-2-4-1":  "",
  "totw-1-2-2-2":  "",
  "totw-1-3-2-1":  "",
  "totw-1-4-1-1":  "",
};

// ─── Token management ─────────────────────────────────────────────────────────

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

async function getAccessToken(): Promise<string | null> {
  const sb = getSupabase();
  const { data } = await sb
    .from("admin_settings")
    .select("key,value")
    .in("key", ["canva_access_token", "canva_refresh_token", "canva_token_expires_at"]);

  const byKey = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
  const accessToken  = byKey["canva_access_token"];
  const refreshToken = byKey["canva_refresh_token"];
  const expiresAt    = byKey["canva_token_expires_at"];

  if (!accessToken) return null;

  // If token expires within 5 minutes, refresh it
  const isExpiringSoon = expiresAt && new Date(expiresAt) < new Date(Date.now() + 5 * 60 * 1000);

  if (isExpiringSoon && refreshToken) {
    const clientId     = process.env.CANVA_CLIENT_ID!;
    const clientSecret = process.env.CANVA_CLIENT_SECRET!;

    const res = await fetch(`${CANVA_API}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type:    "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (res.ok) {
      const tokens = await res.json();
      const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
      await sb.from("admin_settings").upsert([
        { key: "canva_access_token",     value: tokens.access_token,  updated_at: new Date().toISOString() },
        { key: "canva_refresh_token",    value: tokens.refresh_token, updated_at: new Date().toISOString() },
        { key: "canva_token_expires_at", value: newExpiry,            updated_at: new Date().toISOString() },
      ]);
      return tokens.access_token;
    }
  }

  return accessToken;
}

// ─── Autofill types ───────────────────────────────────────────────────────────

type CanvaTextField  = { type: "text";  text: string };
type CanvaImageField = { type: "image"; asset_id: string };
type CanvaDataField  = CanvaTextField | CanvaImageField;

export type CanvaAutofillData = Record<string, CanvaDataField>;

// ─── Upload image asset to Canva ──────────────────────────────────────────────

export async function uploadImageToCanva(imageUrl: string, name: string): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;

  // Fetch the image bytes
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) return null;
  const imgBuffer = await imgRes.arrayBuffer();
  const contentType = imgRes.headers.get("content-type") ?? "image/png";

  // Create upload job
  const uploadRes = await fetch(`${CANVA_API}/assets/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType,
      "Asset-Upload-Metadata": JSON.stringify({ name_base64: Buffer.from(name).toString("base64") }),
    },
    body: imgBuffer,
  });

  if (!uploadRes.ok) {
    console.error("[canva] upload failed:", await uploadRes.text());
    return null;
  }

  const { job } = await uploadRes.json();

  // Poll until asset is ready
  for (let i = 0; i < 20; i++) {
    await sleep(1500);
    const pollRes = await fetch(`${CANVA_API}/assets/upload/${job.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const pollData = await pollRes.json();
    if (pollData.job?.status === "success") return pollData.job.asset?.id ?? null;
    if (pollData.job?.status === "failed") return null;
  }

  return null;
}

// ─── Create autofill job ──────────────────────────────────────────────────────

export async function createAutofillJob(
  templateId: string,
  data: CanvaAutofillData,
  title: string
): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) {
    console.error("[canva] no access token");
    return null;
  }

  const res = await fetch(`${CANVA_API}/autofills`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      brand_template_id: templateId,
      title,
      data,
    }),
  });

  if (!res.ok) {
    console.error("[canva] autofill job failed:", await res.text());
    return null;
  }

  const { job } = await res.json();
  return job?.id ?? null;
}

// ─── Poll autofill job ────────────────────────────────────────────────────────

export async function pollAutofillJob(jobId: string): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;

  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    const res = await fetch(`${CANVA_API}/autofills/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { job } = await res.json();

    if (job?.status === "success") return job.result?.design?.id ?? null;
    if (job?.status === "failed") {
      console.error("[canva] autofill job failed:", job.error);
      return null;
    }
  }

  console.error("[canva] autofill job timed out");
  return null;
}

// ─── Export design to PNG ─────────────────────────────────────────────────────

export async function exportDesignToPng(designId: string): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;

  // Create export job
  const res = await fetch(`${CANVA_API}/exports`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      design_id: designId,
      format: {
        type: "png",
        export_quality: "pro",
      },
    }),
  });

  if (!res.ok) {
    console.error("[canva] export job failed:", await res.text());
    return null;
  }

  const { job } = await res.json();
  const exportJobId = job?.id;
  if (!exportJobId) return null;

  // Poll export job
  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    const pollRes = await fetch(`${CANVA_API}/exports/${exportJobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const pollData = await pollRes.json();

    if (pollData.job?.status === "success") {
      return pollData.job.result?.urls?.[0] ?? pollData.job.urls?.[0] ?? null;
    }
    if (pollData.job?.status === "failed") {
      console.error("[canva] export failed:", pollData.job.error);
      return null;
    }
  }

  console.error("[canva] export timed out");
  return null;
}

// ─── Full pipeline: autofill → export → return PNG URL ───────────────────────

export async function generateGraphicFromTemplate(
  templateType: string,
  data: CanvaAutofillData,
  title: string,
  formation?: string
): Promise<string | null> {
  const templateKey = formation ? `totw-${formation}` : templateType;
  const templateId  = CANVA_TEMPLATE_IDS[templateKey];

  if (!templateId) {
    console.warn(`[canva] no template ID configured for: ${templateKey}`);
    return null;
  }

  const jobId = await createAutofillJob(templateId, data, title);
  if (!jobId) return null;

  const designId = await pollAutofillJob(jobId);
  if (!designId) return null;

  return exportDesignToPng(designId);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function textField(text: string): CanvaTextField {
  return { type: "text", text };
}

export function imageField(assetId: string): CanvaImageField {
  return { type: "image", asset_id: assetId };
}
