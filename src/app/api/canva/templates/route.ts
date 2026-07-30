import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data } = await sb
    .from("admin_settings")
    .select("key,value")
    .in("key", ["canva_access_token"]);

  const token = data?.find((r: any) => r.key === "canva_access_token")?.value;
  if (!token) return NextResponse.json({ error: "No Canva access token" }, { status: 401 });

  // List all brand templates
  const res = await fetch("https://api.canva.com/rest/v1/brand-templates?dataset=true", {
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await res.json();

  if (!res.ok) {
    return NextResponse.json({ error: body }, { status: res.status });
  }

  // Return simplified list: id, title, url
  const templates = (body.items ?? []).map((t: any) => ({
    id: t.id,
    title: t.title,
    view_url: t.view_url,
  }));

  return NextResponse.json({ templates, raw: body });
}
