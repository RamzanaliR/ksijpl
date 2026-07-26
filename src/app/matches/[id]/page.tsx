import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import TeamBadge from "@/components/TeamBadge";

const EVENT_META: Record<string, { label: string; icon: string }> = {
  goal: { label: "Goal", icon: "⚽" },
  assist: { label: "Assist", icon: "🅰️" },
  yellow_card: { label: "Yellow Card", icon: "🟨" },
  red_card: { label: "Red Card", icon: "🟥" },
  own_goal: { label: "Own Goal", icon: "🔴" },
  penalty_save: { label: "Penalty Save", icon: "🧤" },
  penalty_miss: { label: "Penalty Miss", icon: "❌" },
};

export default async function MatchResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: match } = await supabase
    .from("matches")
    .select(
      "id,home_team_id,away_team_id,home_score,away_score,home_pens,away_pens,status,kickoff_at,venue,gameweek_id,season_id,home_motm_player_id,away_motm_player_id"
    )
    .eq("id", id)
    .maybeSingle();

  if (!match) notFound();

  const [{ data: homeTeam }, { data: awayTeam }, { data: gameweek }, { data: season }, { data: events }, { data: attendance }, { data: motmPlayers }] =
    await Promise.all([
      supabase.from("teams").select("id,name,slug").eq("id", match.home_team_id).maybeSingle(),
      supabase.from("teams").select("id,name,slug").eq("id", match.away_team_id).maybeSingle(),
      match.gameweek_id ? supabase.from("gameweeks").select("number,round_name").eq("id", match.gameweek_id).maybeSingle() : Promise.resolve({ data: null }),
      match.season_id ? supabase.from("seasons").select("label,competitions(name)").eq("id", match.season_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase
        .from("match_events")
        .select("id,team_id,player_id,type,created_at,players(full_name,nickname)")
        .eq("match_id", id)
        .order("created_at", { ascending: true }),
      supabase.from("match_attendance").select("team_id,player_id,players(full_name,nickname,position,squad_number)").eq("match_id", id),
      supabase
        .from("players")
        .select("id,full_name,nickname")
        .in("id", [match.home_motm_player_id, match.away_motm_player_id].filter(Boolean) as string[]),
    ]);

  const roundLabel = (gameweek as any)?.round_name ?? (gameweek ? `Match Week ${(gameweek as any).number}` : null);
  const competitionName = (season as any)?.competitions?.name ?? "";
  const seasonLabel = (season as any)?.label ?? "";

  const homeAttendance = (attendance ?? []).filter((a: any) => a.team_id === match.home_team_id);
  const awayAttendance = (attendance ?? []).filter((a: any) => a.team_id === match.away_team_id);

  const homeMotm = motmPlayers?.find((p) => p.id === match.home_motm_player_id);
  const awayMotm = motmPlayers?.find((p) => p.id === match.away_motm_player_id);

  const hasPens = match.home_pens !== null && match.away_pens !== null;

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
      <SiteHeader />
      <main className="max-w-4xl mx-auto px-6 py-10 flex-1 w-full">
        <div className="text-center mb-6">
          <div className="text-xs font-bold uppercase tracking-wider text-[#3EA0D9]">
            {competitionName} {seasonLabel && `— ${seasonLabel}`} {roundLabel && `· ${roundLabel}`}
          </div>
          <div className="text-xs text-[#0B3363]/40 dark:text-white/40 mt-1">
            {match.kickoff_at
              ? new Date(match.kickoff_at).toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })
              : "Time TBD"}
            {match.venue ? ` · ${match.venue}` : ""}
          </div>
        </div>

        {/* Scoreboard */}
        <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 p-6 mb-8">
          <div className="flex items-center justify-between gap-4">
            <a href={homeTeam ? `/teams/${homeTeam.id}` : "#"} className="flex-1 flex flex-col items-center gap-2 min-w-0 hover:opacity-80 transition-opacity">
              <div className="w-16 h-16 rounded-xl bg-white border-2 border-[#0B3363] flex items-center justify-center overflow-hidden flex-shrink-0">
                {homeTeam?.slug ? (
                  <img src={`/sponsors/${homeTeam.slug}.png`} alt={homeTeam.name} className="w-full h-full object-contain p-1" />
                ) : (
                  <span className="font-display font-bold text-[#0B3363] text-sm">{homeTeam?.name.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <span className="font-semibold text-sm text-center truncate w-full">{homeTeam?.name ?? "—"}</span>
            </a>

            <div className="flex flex-col items-center flex-shrink-0 px-4">
              {match.status === "completed" || match.status === "live" ? (
                <div className="flex items-center gap-3">
                  <span className="font-display font-bold text-4xl">{match.home_score ?? 0}</span>
                  <span className="text-[#0B3363]/30 dark:text-white/30">–</span>
                  <span className="font-display font-bold text-4xl">{match.away_score ?? 0}</span>
                </div>
              ) : (
                <span className="font-display font-bold text-lg text-[#0B3363]/50 dark:text-white/50">vs</span>
              )}
              {hasPens && <div className="text-xs text-[#0B3363]/50 dark:text-white/50 mt-1">Pens {match.home_pens}–{match.away_pens}</div>}
              <span
                className={`mt-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  match.status === "live" ? "bg-red-500/15 text-red-600" : match.status === "completed" ? "bg-green-500/15 text-green-700" : "bg-[#0B3363]/5 dark:bg-white/10 text-[#0B3363]/50 dark:text-white/50"
                }`}
              >
                {match.status}
              </span>
            </div>

            <a href={awayTeam ? `/teams/${awayTeam.id}` : "#"} className="flex-1 flex flex-col items-center gap-2 min-w-0 hover:opacity-80 transition-opacity">
              <div className="w-16 h-16 rounded-xl bg-white border-2 border-[#0B3363] flex items-center justify-center overflow-hidden flex-shrink-0">
                {awayTeam?.slug ? (
                  <img src={`/sponsors/${awayTeam.slug}.png`} alt={awayTeam.name} className="w-full h-full object-contain p-1" />
                ) : (
                  <span className="font-display font-bold text-[#0B3363] text-sm">{awayTeam?.name.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <span className="font-semibold text-sm text-center truncate w-full">{awayTeam?.name ?? "—"}</span>
            </a>
          </div>
        </div>

        {(homeMotm || awayMotm) && (
          <div className="rounded-2xl bg-[#F4B400]/15 p-4 mb-8 flex flex-wrap gap-4 justify-center text-center">
            {homeMotm && (
              <div className="text-sm">
                <span className="font-bold">🏅 Man of the Match ({homeTeam?.name})</span>: {homeMotm.nickname || homeMotm.full_name}
              </div>
            )}
            {awayMotm && (
              <div className="text-sm">
                <span className="font-bold">🏅 Man of the Match ({awayTeam?.name})</span>: {awayMotm.nickname || awayMotm.full_name}
              </div>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          {/* Match Events */}
          <section>
            <h2 className="font-display font-bold text-lg mb-4">Match Events</h2>
            <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 divide-y divide-[#0B3363]/5 dark:divide-white/5">
              {(events ?? []).map((e: any) => {
                const meta = EVENT_META[e.type];
                const isHomeSide = e.team_id === match.home_team_id;
                return (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <span className="flex-shrink-0">{meta?.icon ?? "•"}</span>
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{meta?.label ?? e.type}</span> — {e.players?.nickname || e.players?.full_name}
                    </span>
                    <span className="ml-auto text-[10px] font-bold uppercase text-[#3EA0D9] flex-shrink-0">
                      {isHomeSide ? homeTeam?.name : awayTeam?.name}
                    </span>
                  </div>
                );
              })}
              {(events ?? []).length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-[#0B3363]/40 dark:text-white/40">No events recorded for this match.</div>
              )}
            </div>
          </section>

          {/* Featured Players */}
          <section>
            <h2 className="font-display font-bold text-lg mb-4">Featured Players</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <TeamBadge name={homeTeam?.name ?? "Home"} slug={homeTeam?.slug} size={18} className="mb-2 text-xs font-bold" />
                <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 divide-y divide-[#0B3363]/5 dark:divide-white/5">
                  {homeAttendance.map((a: any) => (
                    <div key={a.player_id} className="px-3 py-2 text-xs truncate">{a.players?.nickname || a.players?.full_name}</div>
                  ))}
                  {homeAttendance.length === 0 && <div className="px-3 py-4 text-center text-xs text-[#0B3363]/40 dark:text-white/40">Not recorded</div>}
                </div>
              </div>
              <div>
                <TeamBadge name={awayTeam?.name ?? "Away"} slug={awayTeam?.slug} size={18} className="mb-2 text-xs font-bold" />
                <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 divide-y divide-[#0B3363]/5 dark:divide-white/5">
                  {awayAttendance.map((a: any) => (
                    <div key={a.player_id} className="px-3 py-2 text-xs truncate">{a.players?.nickname || a.players?.full_name}</div>
                  ))}
                  {awayAttendance.length === 0 && <div className="px-3 py-4 text-center text-xs text-[#0B3363]/40 dark:text-white/40">Not recorded</div>}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
