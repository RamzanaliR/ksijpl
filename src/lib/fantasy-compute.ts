import { supabase } from "@/lib/supabase";
import { scorePlayerMatch, type PlayerMatchStats, type Position } from "@/lib/fantasy-scoring";
import { applyAutoSubs, resolveCaptain, type SquadPlayer } from "@/lib/fantasy-autosub";

export type ComputeResult = {
  playersScored: number;
  teamsScored: number;
  teamResults: { teamId: string; teamName: string; points: number }[];
};

/**
 * Runs the full Fantasy pipeline for one gameweek within one pool:
 *  1. Scores every real player's contribution from that gameweek's completed
 *     matches (shared, captain-agnostic — stored in fantasy_player_gameweek_points).
 *  2. For every fantasy team in the pool, applies auto-subs, resolves the
 *     captain (falling back to vice if needed), and writes the team's total
 *     (fantasy_gameweek_points) plus a locked-in squad snapshot
 *     (fantasy_gameweek_squads).
 *
 * Safe to re-run for the same gameweek — everything is upserted.
 */
export async function computeGameweekPoints(fantasySettingsId: string, gameweekId: string): Promise<ComputeResult> {
  const { data: settings } = await supabase
    .from("fantasy_settings")
    .select("id,season_id,seasons(competitions(division_id))")
    .eq("id", fantasySettingsId)
    .maybeSingle();
  if (!settings) throw new Error("Fantasy pool not found");
  const divisionId = (settings as any).seasons?.competitions?.division_id;
  const seasonId = (settings as any).season_id;

  const { data: teamsRaw } = await supabase.from("teams").select("id,name").eq("division_id", divisionId);
  const teamIds = (teamsRaw ?? []).map((t: any) => t.id);
  const teamNameById: Record<string, string> = {};
  (teamsRaw ?? []).forEach((t: any) => (teamNameById[t.id] = t.name));

  const { data: matches } = await supabase
    .from("matches")
    .select("id,home_team_id,away_team_id,home_score,away_score,status,home_motm_player_id,away_motm_player_id")
    .eq("gameweek_id", gameweekId)
    .eq("season_id", seasonId);

  const incomplete = (matches ?? []).filter((m: any) => m.status !== "completed");
  if (!matches || matches.length === 0) throw new Error("No matches found for this match week");
  if (incomplete.length > 0) {
    throw new Error(`${incomplete.length} match(es) in this match week aren't marked completed yet — finish those first.`);
  }

  const { data: players } = await supabase
    .from("players")
    .select("id,position,team_id")
    .in("team_id", teamIds.length ? teamIds : ["00000000-0000-0000-0000-000000000000"])
    .not("position", "is", null);

  const matchIds = matches.map((m: any) => m.id);
  const [{ data: attendance }, { data: events }] = await Promise.all([
    supabase.from("match_attendance").select("player_id,team_id,match_id").in("match_id", matchIds),
    supabase.from("match_events").select("player_id,team_id,type").in("match_id", matchIds),
  ]);

  // Map each team to its match this gameweek, and the goals conceded / clean sheet outcome
  const teamMatch: Record<string, { matchId: string; goalsConceded: number; cleanSheet: boolean }> = {};
  matches.forEach((m: any) => {
    teamMatch[m.home_team_id] = { matchId: m.id, goalsConceded: m.away_score ?? 0, cleanSheet: (m.away_score ?? 0) === 0 };
    teamMatch[m.away_team_id] = { matchId: m.id, goalsConceded: m.home_score ?? 0, cleanSheet: (m.home_score ?? 0) === 0 };
  });

  const motmIds = new Set<string>();
  matches.forEach((m: any) => {
    if (m.home_motm_player_id) motmIds.add(m.home_motm_player_id);
    if (m.away_motm_player_id) motmIds.add(m.away_motm_player_id);
  });

  const attendedPlayerIds = new Set((attendance ?? []).map((a: any) => a.player_id));
  const eventsByPlayer: Record<string, Record<string, number>> = {};
  (events ?? []).forEach((e: any) => {
    if (!eventsByPlayer[e.player_id]) eventsByPlayer[e.player_id] = {};
    eventsByPlayer[e.player_id][e.type] = (eventsByPlayer[e.player_id][e.type] ?? 0) + 1;
  });

  // Step 1: score every real player who has a match this gameweek
  const pointsRows: { fantasy_settings_id: string; player_id: string; gameweek_id: string; points: number; breakdown: any }[] = [];
  const basePointsByPlayer: Record<string, number> = {};

  for (const p of players ?? []) {
    const tm = teamMatch[p.team_id];
    if (!tm) continue; // this player's team didn't play in this gameweek

    const played = attendedPlayerIds.has(p.id);
    const ev = eventsByPlayer[p.id] ?? {};
    const stats: PlayerMatchStats = {
      position: p.position as Position,
      played,
      goals: ev.goal ?? 0,
      assists: ev.assist ?? 0,
      yellowCards: ev.yellow_card ?? 0,
      redCards: ev.red_card ?? 0,
      ownGoals: ev.own_goal ?? 0,
      penaltySaves: ev.penalty_save ?? 0,
      penaltyMisses: ev.penalty_miss ?? 0,
      goalsConceded: tm.goalsConceded,
      cleanSheet: tm.cleanSheet,
      isManOfTheMatch: motmIds.has(p.id),
    };
    const score = scorePlayerMatch(stats, false); // captain multiplier applied later, per fantasy team
    basePointsByPlayer[p.id] = score.final;
    pointsRows.push({
      fantasy_settings_id: fantasySettingsId,
      player_id: p.id,
      gameweek_id: gameweekId,
      points: score.final,
      breakdown: score,
    });
  }

  if (pointsRows.length > 0) {
    const { error } = await supabase
      .from("fantasy_player_gameweek_points")
      .upsert(pointsRows, { onConflict: "fantasy_settings_id,player_id,gameweek_id" });
    if (error) throw new Error(`Could not save player points: ${error.message}`);
  }

  // Step 2: score every fantasy team in this pool
  const { data: fantasyTeams } = await supabase.from("fantasy_teams").select("id,team_name").eq("fantasy_settings_id", fantasySettingsId);
  const teamResults: ComputeResult["teamResults"] = [];

  for (const team of fantasyTeams ?? []) {
    const { data: squadRows } = await supabase
      .from("fantasy_team_players")
      .select("player_id,is_starting,is_captain,is_vice_captain,bench_order,players(position)")
      .eq("fantasy_team_id", team.id);

    if (!squadRows || squadRows.length === 0) continue;

    const captainId = squadRows.find((r: any) => r.is_captain)?.player_id ?? null;
    const viceCaptainId = squadRows.find((r: any) => r.is_vice_captain)?.player_id ?? null;

    const { data: chipRow } = await supabase
      .from("fantasy_chip_usage")
      .select("chip_type")
      .eq("fantasy_team_id", team.id)
      .eq("gameweek_id", gameweekId)
      .maybeSingle();
    const activeChip = chipRow?.chip_type ?? null;

    const toSquadPlayer = (r: any): SquadPlayer => ({
      playerId: r.player_id,
      position: r.players.position,
      played: attendedPlayerIds.has(r.player_id),
      benchOrder: r.bench_order,
    });

    const starters = squadRows.filter((r: any) => r.is_starting).map(toSquadPlayer);
    const bench = squadRows.filter((r: any) => !r.is_starting).map(toSquadPlayer);

    // Bench Boost: every squad member counts, no auto-subs needed
    const finalLineup =
      activeChip === "bench_boost" ? squadRows.map((r: any) => r.player_id) : applyAutoSubs(starters, bench, { startingGkCount: 1 }).finalLineup;
    const playedMap: Record<string, boolean> = {};
    squadRows.forEach((r: any) => (playedMap[r.player_id] = attendedPlayerIds.has(r.player_id)));
    const finalCaptainId = resolveCaptain(finalLineup, playedMap, captainId, viceCaptainId);

    let total = 0;
    const squadSnapshotRows: any[] = [];
    finalLineup.forEach((playerId) => {
      const base = basePointsByPlayer[playerId] ?? 0;
      const multiplier = playerId === finalCaptainId ? (activeChip === "triple_captain" ? 3 : 2) : 1;
      total += base * multiplier;
      squadSnapshotRows.push({
        fantasy_team_id: team.id,
        gameweek_id: gameweekId,
        player_id: playerId,
        is_starting: true,
        multiplier,
      });
    });
    // Bench players who didn't come on still get a snapshot row for history (0 contribution)
    squadRows
      .filter((r: any) => !finalLineup.includes(r.player_id))
      .forEach((r: any) => {
        squadSnapshotRows.push({
          fantasy_team_id: team.id,
          gameweek_id: gameweekId,
          player_id: r.player_id,
          is_starting: false,
          multiplier: 1,
        });
      });

    await supabase.from("fantasy_gameweek_squads").delete().eq("fantasy_team_id", team.id).eq("gameweek_id", gameweekId);
    if (squadSnapshotRows.length > 0) {
      await supabase.from("fantasy_gameweek_squads").insert(squadSnapshotRows);
    }

    const { data: settingsRow } = await supabase.from("fantasy_settings").select("transfer_cost_points").eq("id", fantasySettingsId).maybeSingle();
    const costPerTransfer = settingsRow?.transfer_cost_points ?? 4;
    const { data: paidTransfers } = await supabase
      .from("fantasy_transfers")
      .select("id")
      .eq("fantasy_team_id", team.id)
      .eq("gameweek_id", gameweekId)
      .eq("was_free", false);
    const transferCost = activeChip === "free_hit" ? 0 : (paidTransfers?.length ?? 0) * costPerTransfer;
    const netPoints = total - transferCost;

    const { error: pointsError } = await supabase
      .from("fantasy_gameweek_points")
      .upsert(
        { fantasy_team_id: team.id, gameweek_id: gameweekId, raw_points: total, transfer_cost: transferCost, net_points: netPoints },
        { onConflict: "fantasy_team_id,gameweek_id" }
      );
    if (pointsError) throw new Error(`Could not save team points for ${team.team_name}: ${pointsError.message}`);

    teamResults.push({ teamId: team.id, teamName: team.team_name, points: netPoints });

    if (activeChip === "free_hit") {
      const { data: snapshot } = await supabase
        .from("fantasy_free_hit_snapshots")
        .select("id,squad,restored")
        .eq("fantasy_team_id", team.id)
        .maybeSingle();
      if (snapshot && !snapshot.restored) {
        await supabase.from("fantasy_team_players").delete().eq("fantasy_team_id", team.id);
        const restoredRows = (snapshot.squad as any[]).map((p) => ({ ...p, fantasy_team_id: team.id }));
        if (restoredRows.length > 0) await supabase.from("fantasy_team_players").insert(restoredRows);
        await supabase.from("fantasy_free_hit_snapshots").update({ restored: true }).eq("id", snapshot.id);
      }
    }
  }

  teamResults.sort((a, b) => b.points - a.points);

  return {
    playersScored: pointsRows.length,
    teamsScored: teamResults.length,
    teamResults,
  };
}
