import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Temporary diagnostic endpoint — lists brand templates with new-format IDs
// Remove after template IDs are confirmed

export async function GET() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data } = await sb.from("admin_settings").select("value").eq("key", "canva_access_token").maybeSingle();
  const token = data?.value;
  if (!token || token.length < 20) return NextResponse.json({ error: "No token" }, { status: 401 });

  const res = await fetch("https://api.canva.com/rest/v1/brand-templates?limit=20", {
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await res.json();
  return NextResponse.json({ status: res.status, body });
}
