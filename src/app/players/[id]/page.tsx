"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { supabase } from "@/lib/supabase";

type Player = {
  id: string;
  full_name: string;
  fpl_name: string | null;
  nickname: string | null;
  position: string;
  team_id: string;
  team_name: string;
  team_slug: string | null;
  team_logo_url: string | null;
  headshot_url: string | null;
};

type SeasonStat = {
  season_label: string;
  team_name: string;
  played: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  motm: number;
  clean_sheets: number;
};

type FantasyStat = {
  price: number | null;
  total_pts: number;
  pts_per_game: number;
  ownership_pct: number | null;
};

const POS_COLORS: Record<string, string> = {
  GK: "bg-yellow-400 text-yellow-900",
  DEF: "bg-blue-500 text-white",
  MID: "bg-green-500 text-white",
  FWD: "bg-red-500 text-white",
};

export default function PlayerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [player, setPlayer] = useState<Player | null>(null);
  const [seasonStats, setSeasonStats] = useState<SeasonStat[]>([]);
  const [allTimeStats, setAllTimeStats] = useState<SeasonStat | null>(null);
  const [fantasyStats, setFantasyStats] = useState<FantasyStat | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"stats" | "fantasy" | "history">("stats");

  useEffect(() => {
    if (!id) return;
    (async () => {
      // Load player
      const { data: p } = await supabase.from("players")
        .select("id,full_name,fpl_name,nickname,position,team_id,headshot_url,teams(name,slug,sponsor_logo_url)")
        .eq("id", id).single();

      if (!p) { setLoading(false); return; }
      setPlayer({
        id: p.id,
        full_name: p.full_name,
        fpl_name: p.fpl_name,
        nickname: p.nickname,
        position: p.position,
        team_id: p.team_id,
        team_name: (p as any).teams?.name ?? "—",
        team_slug: (p as any).teams?.slug ?? null,
        team_logo_url: (p as any).teams?.sponsor_logo_url ?? null,
        headshot_url: p.headshot_url,
      });

      // Load match events across all seasons
      const { data: events } = await supabase.from("match_events")
        .select("type,matches(season_id,home_motm_player_id,away_motm_player_id,seasons(label,competitions(id)),home_team_id,away_team_id)")
        .eq("player_id", id);

      // Load all-time archived stats (season_player_stats)
      const { data: archivedStats } = await supabase.from("season_player_stats")
        .select("season_id,goals,assists,yellow_cards,red_cards,motm_awards,clean_sheets,appearances,seasons(label,competitions(id)),team_name")
        .eq("player_id", id);

      // Load MOTM from matches
      const { data: motmMatches } = await supabase.from("matches")
        .select("season_id,home_motm_player_id,away_motm_player_id")
        .or(`home_motm_player_id.eq.${id},away_motm_player_id.eq.${id}`);

      // Aggregate per season from archived data
      const statMap: Record<string, SeasonStat> = {};
      (archivedStats ?? []).forEach((s: any) => {
        const label = s.seasons?.label ?? "Unknown";
        statMap[label] = {
          season_label: label,
          team_name: s.team_name ?? "—",
          played: s.appearances ?? 0,
          goals: s.goals ?? 0,
          assists: s.assists ?? 0,
          yellow_cards: s.yellow_cards ?? 0,
          red_cards: s.red_cards ?? 0,
          motm: s.motm_awards ?? 0,
          clean_sheets: s.clean_sheets ?? 0,
        };
      });

      // Also tally from live match_events for current season
      const liveGoals: Record<string, number> = {};
      const liveAssists: Record<string, number> = {};
      const liveYC: Record<string, number> = {};
      const liveRC: Record<string, number> = {};
      (events ?? []).forEach((e: any) => {
        const label = e.matches?.seasons?.label ?? "Unknown";
        if (e.type === "goal")        liveGoals[label]   = (liveGoals[label]   ?? 0) + 1;
        if (e.type === "assist")      liveAssists[label] = (liveAssists[label] ?? 0) + 1;
        if (e.type === "yellow_card") liveYC[label]      = (liveYC[label]      ?? 0) + 1;
        if (e.type === "red_card")    liveRC[label]      = (liveRC[label]      ?? 0) + 1;
      });

      // Merge live data into statMap
      const allLabels = new Set([...Object.keys(statMap), ...Object.keys(liveGoals)]);
      allLabels.forEach((label) => {
        if (!statMap[label]) {
          statMap[label] = { season_label: label, team_name: "—", played: 0, goals: 0, assists: 0, yellow_cards: 0, red_cards: 0, motm: 0, clean_sheets: 0 };
        }
        if (liveGoals[label])   statMap[label].goals        += liveGoals[label];
        if (liveAssists[label]) statMap[label].assists       += liveAssists[label];
        if (liveYC[label])      statMap[label].yellow_cards  += liveYC[label];
        if (liveRC[label])      statMap[label].red_cards     += liveRC[label];
      });

      // Add MOTM from matches
      (motmMatches ?? []).forEach((m: any) => {
        // We don't have season label here easily, skip for now — covered by archived data
      });

      const seasonStatsArr = Object.values(statMap).sort((a, b) => b.season_label.localeCompare(a.season_label));
      setSeasonStats(seasonStatsArr);

      // All-time totals
      if (seasonStatsArr.length) {
        setAllTimeStats(seasonStatsArr.reduce((acc, s) => ({
          season_label: "All Time",
          team_name: "—",
          played: acc.played + s.played,
          goals: acc.goals + s.goals,
          assists: acc.assists + s.assists,
          yellow_cards: acc.yellow_cards + s.yellow_cards,
          red_cards: acc.red_cards + s.red_cards,
          motm: acc.motm + s.motm,
          clean_sheets: acc.clean_sheets + s.clean_sheets,
        })));
      }

      // Fantasy stats
      const { data: fantasyPrices } = await supabase.from("fantasy_player_prices")
        .select("price").eq("player_id", id).limit(1);
      const { data: fantasyPts } = await supabase.from("fantasy_player_gameweek_points")
        .select("total_points").eq("player_id", id);
      const { count: totalManagers } = await supabase.from("fantasy_team_players")
        .select("*", { count: "exact", head: true });
      const { count: ownedBy } = await supabase.from("fantasy_team_players")
        .select("*", { count: "exact", head: true }).eq("player_id", id);

      const totalPts = (fantasyPts ?? []).reduce((s: number, r: any) => s + (r.total_points ?? 0), 0);
      const gamesPlayed = (fantasyPts ?? []).length;
      setFantasyStats({
        price: (fantasyPrices as any)?.[0]?.price ?? null,
        total_pts: totalPts,
        pts_per_game: gamesPlayed > 0 ? Math.round((totalPts / gamesPlayed) * 10) / 10 : 0,
        ownership_pct: totalManagers && ownedBy ? Math.round((ownedBy / totalManagers) * 100) : null,
      });

      setLoading(false);
    })();
  }, [id]);

  if (loading) return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220]">
      <SiteHeader />
      <div className="flex-1 flex items-center justify-center text-sm text-[#0B3363]/30">Loading…</div>
      <SiteFooter />
    </div>
  );

  if (!player) return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220]">
      <SiteHeader />
      <div className="flex-1 flex items-center justify-center text-sm text-[#0B3363]/30">Player not found.</div>
      <SiteFooter />
    </div>
  );

  const displayName = player.fpl_name || player.full_name;
  const jerseyPath = player.team_slug ? `/jerseys/${player.team_slug}-home.png` : "/jerseys/placeholder.png";
  const gkJerseyPath = player.team_slug ? `/jerseys/${player.team_slug}-gk-home.png` : "/jerseys/placeholder.png";
  const isGK = player.position === "GK";

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white">
      <SiteHeader />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">

        {/* Back */}
        <Link href="/seasons" className="text-xs text-[#3EA0D9] hover:underline mb-4 inline-block">← Back to seasons</Link>

        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-r from-[#0B3363] to-[#1a5a9e] p-6 mb-6 flex items-center gap-6 text-white">
          {/* Jersey or headshot */}
          <div className="flex-shrink-0">
            {player.headshot_url ? (
              <img src={player.headshot_url} alt={displayName} className="w-24 h-24 rounded-full object-cover border-4 border-white/20" />
            ) : (
              <img src={isGK ? gkJerseyPath : jerseyPath} alt="Jersey"
                className="w-20 h-20 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).src = "/jerseys/placeholder.png"; }} />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${POS_COLORS[player.position] ?? "bg-white/20"}`}>
                {player.position}
              </span>
              {player.nickname && <span className="text-white/50 text-xs">&ldquo;{player.nickname}&rdquo;</span>}
            </div>
            <h1 className="font-display font-bold text-2xl sm:text-3xl leading-tight">{displayName}</h1>
            {player.fpl_name && player.fpl_name !== player.full_name && (
              <div className="text-white/50 text-xs mt-0.5">{player.full_name}</div>
            )}
            <div className="flex items-center gap-2 mt-2">
              {player.team_logo_url && (
                <img src={player.team_logo_url} alt={player.team_name} className="w-5 h-5 object-contain rounded bg-white p-0.5" />
              )}
              <span className="text-white/70 text-sm font-medium">{player.team_name}</span>
            </div>
          </div>

          {/* All-time headline stats */}
          {allTimeStats && (
            <div className="hidden sm:grid grid-cols-3 gap-4 text-center flex-shrink-0">
              {[
                { label: "Goals", value: allTimeStats.goals },
                { label: "Assists", value: allTimeStats.assists },
                { label: "MOTM", value: allTimeStats.motm },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="font-display font-bold text-2xl">{value}</div>
                  <div className="text-white/50 text-[10px] uppercase">{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fantasy strip */}
        {fantasyStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="rounded-xl border border-[#0B3363]/10 p-3 text-center">
              <div className="font-display font-bold text-xl">{fantasyStats.price != null ? `${fantasyStats.price}m` : "—"}</div>
              <div className="text-[10px] uppercase text-[#0B3363]/40">Price</div>
            </div>
            <div className="rounded-xl border border-[#0B3363]/10 p-3 text-center">
              <div className="font-display font-bold text-xl">{fantasyStats.total_pts}</div>
              <div className="text-[10px] uppercase text-[#0B3363]/40">Fantasy Pts</div>
            </div>
            <div className="rounded-xl border border-[#0B3363]/10 p-3 text-center">
              <div className="font-display font-bold text-xl">{fantasyStats.pts_per_game}</div>
              <div className="text-[10px] uppercase text-[#0B3363]/40">Pts / Game</div>
            </div>
            <div className="rounded-xl border border-[#0B3363]/10 p-3 text-center">
              <div className="font-display font-bold text-xl">{fantasyStats.ownership_pct != null ? `${fantasyStats.ownership_pct}%` : "—"}</div>
              <div className="text-[10px] uppercase text-[#0B3363]/40">Owned By</div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-0 border-b border-[#0B3363]/10 mb-5">
          {(["stats", "fantasy", "history"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors capitalize ${
                tab === t ? "border-[#0B3363] text-[#0B3363] dark:border-[#3EA0D9] dark:text-white" : "border-transparent text-[#0B3363]/40 hover:text-[#0B3363]"
              }`}>
              {t === "stats" ? "Season Stats" : t === "fantasy" ? "Fantasy" : "Career History"}
            </button>
          ))}
        </div>

        {/* Season Stats tab */}
        {tab === "stats" && (
          <div className="space-y-4">
            {allTimeStats && (
              <div className="rounded-2xl bg-[#0B3363]/5 dark:bg-white/5 p-4">
                <div className="text-xs font-bold uppercase text-[#0B3363]/40 mb-3">All-time totals</div>
                <StatRow stat={allTimeStats} highlight />
              </div>
            )}
            {seasonStats.length === 0 ? (
              <div className="text-center text-sm text-[#0B3363]/30 py-8">No stats recorded yet.</div>
            ) : (
              <div className="admin-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase text-[#0B3363]/40 border-b border-[#0B3363]/10">
                        <th className="text-left py-2 px-4">Season</th>
                        <th className="text-left py-2 px-2">Team</th>
                        <th className="text-center py-2 px-2">PLD</th>
                        <th className="text-center py-2 px-2">G</th>
                        <th className="text-center py-2 px-2">A</th>
                        <th className="text-center py-2 px-2">YC</th>
                        <th className="text-center py-2 px-2">RC</th>
                        <th className="text-center py-2 px-2">MM</th>
                        {player.position === "GK" && <th className="text-center py-2 px-2">CS</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {seasonStats.map((s) => (
                        <tr key={s.season_label} className="h-10 border-b border-[#0B3363]/5 last:border-0">
                          <td className="px-4 font-semibold">{s.season_label}</td>
                          <td className="px-2 text-xs text-[#0B3363]/50">{s.team_name}</td>
                          <td className="px-2 text-center">{s.played}</td>
                          <td className="px-2 text-center font-bold text-[#3EA0D9]">{s.goals}</td>
                          <td className="px-2 text-center">{s.assists}</td>
                          <td className="px-2 text-center text-amber-600">{s.yellow_cards || "—"}</td>
                          <td className="px-2 text-center text-red-600">{s.red_cards || "—"}</td>
                          <td className="px-2 text-center text-[#F4B400]">{s.motm || "—"}</td>
                          {player.position === "GK" && <td className="px-2 text-center">{s.clean_sheets || "—"}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Fantasy tab */}
        {tab === "fantasy" && (
          <div className="space-y-4">
            {fantasyStats ? (
              <div className="admin-card p-5">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {[
                    { label: "Current Price", value: fantasyStats.price != null ? `${fantasyStats.price}m` : "—" },
                    { label: "Total Fantasy Points", value: fantasyStats.total_pts },
                    { label: "Points per Game", value: fantasyStats.pts_per_game || "—" },
                    { label: "Owned By", value: fantasyStats.ownership_pct != null ? `${fantasyStats.ownership_pct}% of managers` : "—" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div className="text-xs text-[#0B3363]/40 mb-0.5">{label}</div>
                      <div className="font-display font-bold text-lg">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center text-sm text-[#0B3363]/30 py-8">No fantasy data yet. Stats will appear after Match Week 1.</div>
            )}
          </div>
        )}

        {/* Career History tab */}
        {tab === "history" && (
          <div>
            {seasonStats.length === 0 ? (
              <div className="text-center text-sm text-[#0B3363]/30 py-8">No career history recorded yet.</div>
            ) : (
              <div className="space-y-2">
                {seasonStats.map((s) => (
                  <div key={s.season_label} className="admin-card px-4 py-3 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{s.season_label}</div>
                      <div className="text-xs text-[#0B3363]/40">{s.team_name}</div>
                    </div>
                    <div className="flex gap-4 text-xs text-[#0B3363]/60">
                      <span>⚽ {s.goals}</span>
                      <span>🅰️ {s.assists}</span>
                      <span>⭐ {s.motm}</span>
                      {s.played > 0 && <span className="text-[#0B3363]/30">{s.played} games</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function StatRow({ stat, highlight }: { stat: SeasonStat; highlight?: boolean }) {
  return (
    <div className={`grid grid-cols-4 sm:grid-cols-7 gap-3 text-center ${highlight ? "" : ""}`}>
      {[
        { label: "Goals", value: stat.goals, color: "text-[#3EA0D9]" },
        { label: "Assists", value: stat.assists },
        { label: "MOTM", value: stat.motm, color: "text-[#F4B400]" },
        { label: "Games", value: stat.played },
        { label: "YC", value: stat.yellow_cards, color: stat.yellow_cards > 0 ? "text-amber-600" : "" },
        { label: "RC", value: stat.red_cards, color: stat.red_cards > 0 ? "text-red-600" : "" },
        { label: "CS", value: stat.clean_sheets },
      ].map(({ label, value, color }) => (
        <div key={label}>
          <div className={`font-display font-bold text-xl ${color ?? "text-[#0B3363] dark:text-white"}`}>{value}</div>
          <div className="text-[10px] uppercase text-[#0B3363]/40">{label}</div>
        </div>
      ))}
    </div>
  );
}
