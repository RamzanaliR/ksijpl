import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Canva OAuth 2.0 - Authorization initiation
// Admin visits /api/canva/auth to start the flow

const CANVA_AUTH_URL = "https://www.canva.com/api/oauth/authorize";
const SCOPES = [
  "asset:read",
  "asset:write",
  "brandtemplate:content:read",
  "brandtemplate:meta:read",
  "design:content:read",
  "design:content:write",
  "design:meta:read",
].join(" ");

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Client ID from env var (not sensitive)
  const clientId = process.env.CANVA_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "CANVA_CLIENT_ID env var not set on Vercel." }, { status: 500 });
  }

  // Generate PKCE code verifier + challenge
  const codeVerifier = crypto.randomBytes(64).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  // Generate state for CSRF protection
  const state = crypto.randomBytes(32).toString("hex");

  // Store verifier + state temporarily (expires in 10 mins)
  await supabase.from("admin_settings").upsert([
    { key: "canva_oauth_state",    value: state,        updated_at: new Date().toISOString() },
    { key: "canva_code_verifier",  value: codeVerifier, updated_at: new Date().toISOString() },
  ]);

  const callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://ksij-league.vercel.app"}/api/canva/callback`;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return NextResponse.redirect(`${CANVA_AUTH_URL}?${params.toString()}`);
}
