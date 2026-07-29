import { supabase } from "@/lib/supabase";

/**
 * Sponsor logos uploaded via Admin → Media (category: team_sponsor_logo) are the
 * source of truth going forward — no GitHub access needed to add/change one.
 * Returns a map of team_id -> public URL. Teams with no upload yet simply won't
 * appear in the map, and callers should fall back to the legacy /sponsors/{slug}.png
 * static file convention while that transition is in progress.
 */
export async function getSponsorLogoMap(): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("media_assets")
    .select("team_id,url,created_at")
    .eq("category", "team_sponsor_logo")
    .not("team_id", "is", null)
    .order("created_at", { ascending: false });

  const map: Record<string, string> = {};
  (data ?? []).forEach((row: any) => {
    // created_at is already sorted newest-first, so the first hit per team wins
    if (!map[row.team_id]) map[row.team_id] = row.url;
  });
  return map;
}
