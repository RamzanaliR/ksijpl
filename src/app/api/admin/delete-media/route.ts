import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function DELETE(req: NextRequest) {
  const { id, storage_path } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const sb = getSupabase();

  // Delete from storage if path provided
  if (storage_path) {
    await sb.storage.from("generated-graphics").remove([storage_path]);
  }

  // Delete DB record
  const { error } = await sb.from("generated_media").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
