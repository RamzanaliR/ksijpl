import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Canva OAuth 2.0 - Callback handler
// Canva redirects here after user approves the integration

const CANVA_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ksij-league.vercel.app";

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle user denial
  if (error) {
    return NextResponse.redirect(`${SITE_URL}/admin/media?canva_error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${SITE_URL}/admin/media?canva_error=missing_params`);
  }

  // Verify state (CSRF)
  const { data: stateRow } = await supabase
    .from("admin_settings").select("value").eq("key", "canva_oauth_state").maybeSingle();
  if (stateRow?.value !== state) {
    return NextResponse.redirect(`${SITE_URL}/admin/media?canva_error=state_mismatch`);
  }

  // Get stored PKCE verifier
  const { data: verifierRow } = await supabase
    .from("admin_settings").select("value").eq("key", "canva_code_verifier").maybeSingle();
  const codeVerifier = verifierRow?.value;
  if (!codeVerifier) {
    return NextResponse.redirect(`${SITE_URL}/admin/media?canva_error=missing_verifier`);
  }

  // Get credentials
  const [{ data: clientIdRow }, { data: clientSecretRow }] = await Promise.all([
    supabase.from("admin_settings").select("value").eq("key", "canva_client_id").maybeSingle(),
    supabase.from("admin_settings").select("value").eq("key", "canva_client_secret").maybeSingle(),
  ]);

  const clientId     = clientIdRow?.value;
  const clientSecret = clientSecretRow?.value;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${SITE_URL}/admin/media?canva_error=missing_credentials`);
  }

  const callbackUrl = `${SITE_URL}/api/canva/callback`;

  // Exchange code for tokens
  const tokenRes = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type:    "authorization_code",
      code,
      redirect_uri:  callbackUrl,
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    console.error("[canva/callback] token exchange failed:", errBody);
    return NextResponse.redirect(`${SITE_URL}/admin/media?canva_error=token_exchange_failed`);
  }

  const tokens = await tokenRes.json();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  // Store tokens in admin_settings
  await supabase.from("admin_settings").upsert([
    { key: "canva_access_token",      value: tokens.access_token,  updated_at: new Date().toISOString() },
    { key: "canva_refresh_token",     value: tokens.refresh_token, updated_at: new Date().toISOString() },
    { key: "canva_token_expires_at",  value: expiresAt,            updated_at: new Date().toISOString() },
    // Clear temp OAuth state
    { key: "canva_oauth_state",       value: "",                   updated_at: new Date().toISOString() },
    { key: "canva_code_verifier",     value: "",                   updated_at: new Date().toISOString() },
  ]);

  // Redirect back to Media admin with success
  return NextResponse.redirect(`${SITE_URL}/admin/media?canva_connected=1`);
}
