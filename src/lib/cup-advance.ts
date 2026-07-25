import { supabase } from "@/lib/supabase";

/**
 * After a cup match is completed (score, and penalties if it was drawn),
 * writes the winner into the next match's home/away slot. No-ops for
 * matches that aren't part of a bracket (next_match_id is null) — safe
 * to call after saving any match's score.
 */
export async function advanceCupWinner(matchId: string): Promise<{ error?: string }> {
  const { data: match, error: fetchError } = await supabase
    .from("matches")
    .select("home_team_id,away_team_id,home_score,away_score,home_pens,away_pens,next_match_id,next_match_slot")
    .eq("id", matchId)
    .maybeSingle();

  if (fetchError || !match) return { error: fetchError?.message ?? "Match not found" };
  if (!match.next_match_id || !match.next_match_slot) return {};
  if (match.home_score === null || match.away_score === null) return {};

  let winnerId: string | null = null;
  if (match.home_score !== match.away_score) {
    winnerId = match.home_score > match.away_score ? match.home_team_id : match.away_team_id;
  } else if (match.home_pens !== null && match.away_pens !== null && match.home_pens !== match.away_pens) {
    winnerId = match.home_pens > match.away_pens ? match.home_team_id : match.away_team_id;
  } else {
    // Still drawn with no decisive penalties recorded — can't advance a knockout tie yet.
    return { error: "Match is drawn — enter a penalty shootout result to decide the winner before advancing." };
  }

  const field = match.next_match_slot === "home" ? "home_team_id" : "away_team_id";
  const { error: updateError } = await supabase
    .from("matches")
    .update({ [field]: winnerId })
    .eq("id", match.next_match_id);

  return updateError ? { error: updateError.message } : {};
}
