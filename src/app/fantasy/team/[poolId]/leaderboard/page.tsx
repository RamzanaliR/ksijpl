"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import FantasySubNav from "@/components/FantasySubNav";

type Row = { teamId: string; teamName: string; total: number; gwPoints: number };
type League = { id: string; name: string; join_code: string };

function randomCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default function LeaguesPage() {
  const params = useParams();
  const router = useRouter();
  const poolId = params.poolId as string;

  const [loading, setLoading] = useState(true);
  const [poolLabel, setPoolLabel] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [latestGwNumber, setLatestGwNumber] = useState<number | null>(null);
  const [allPointsByTeam, setAllPointsByTeam] = useState<{ total: Record<string, number>; latest: Record<string, number> }>({ total: {}, latest: {} });
  const [allTeamNames, setAllTeamNames] = useState<Record<string, string>>({});

  const [myLeagues, setMyLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [leagueNameInput, setLeagueNameInput] = useState("");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [leagueError, setLeagueError] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadLeagues(teamId: string) {
    const { data: memberships } = await supabase.from("fantasy_league_members").select("league_id").eq("fantasy_team_id", teamId);
    const leagueIds = (memberships ?? []).map((m: any) => m.league_id);
    if (leagueIds.length === 0) {
      setMyLeagues([]);
      return;
    }
    const { data: leagues } = await supabase.from("fantasy_leagues").select("id,name,join_code").in("id", leagueIds);
    setMyLeagues(leagues ?? []);
  }

  useEffect(() => {
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.push("/fantasy/login");
        return;
      }

      const { data: settingsRow } = await supabase
        .from("fantasy_settings")
        .select("id,season_id,seasons(label,competitions(name))")
        .eq("id", poolId)
        .maybeSingle();
      if (!settingsRow) {
        setLoading(false);
        return;
      }
      setPoolLabel(`${(settingsRow as any).seasons?.competitions?.name ?? "Fantasy"} — ${(settingsRow as any).seasons?.label ?? ""}`);

      const { data: myTeam } = await supabase
        .from("fantasy_teams")
        .select("id")
        .eq("fantasy_settings_id", poolId)
        .eq("user_id", authData.user.id)
        .maybeSingle();
      setMyTeamId(myTeam?.id ?? null);
      if (myTeam) await loadLeagues(myTeam.id);

      const { data: teams } = await supabase.from("fantasy_teams").select("id,team_name").eq("fantasy_settings_id", poolId);
      const nameMap: Record<string, string> = {};
      (teams ?? []).forEach((t: any) => (nameMap[t.id] = t.team_name));
      setAllTeamNames(nameMap);

      const seasonId = (settingsRow as any).season_id;
      const { data: gws } = await supabase.from("gameweeks").select("id,number").eq("season_id", seasonId).order("number", { ascending: false });
      const latestGw = gws?.[0];
      setLatestGwNumber(latestGw?.number ?? null);

      const teamIds = (teams ?? []).map((t: any) => t.id);
      const { data: pointsRows } = await supabase
        .from("fantasy_gameweek_points")
        .select("fantasy_team_id,gameweek_id,net_points")
        .in("fantasy_team_id", teamIds.length ? teamIds : ["00000000-0000-0000-0000-000000000000"]);

      const totalByTeam: Record<string, number> = {};
      const latestByTeam: Record<string, number> = {};
      (pointsRows ?? []).forEach((p: any) => {
        totalByTeam[p.fantasy_team_id] = (totalByTeam[p.fantasy_team_id] ?? 0) + p.net_points;
        if (latestGw && p.gameweek_id === latestGw.id) latestByTeam[p.fantasy_team_id] = p.net_points;
      });
      setAllPointsByTeam({ total: totalByTeam, latest: latestByTeam });

      const list: Row[] = (teams ?? []).map((t: any) => ({
        teamId: t.id,
        teamName: t.team_name,
        total: totalByTeam[t.id] ?? 0,
        gwPoints: latestByTeam[t.id] ?? 0,
      }));
      list.sort((a, b) => b.total - a.total);
      setRows(list);

      setLoading(false);
    })();
  }, [poolId, router]);

  const [leagueMemberRows, setLeagueMemberRows] = useState<Row[]>([]);
  useEffect(() => {
    if (!selectedLeagueId) return;
    (async () => {
      const { data: members } = await supabase.from("fantasy_league_members").select("fantasy_team_id").eq("league_id", selectedLeagueId);
      const memberIds = (members ?? []).map((m: any) => m.fantasy_team_id);
      const list: Row[] = memberIds.map((id: string) => ({
        teamId: id,
        teamName: allTeamNames[id] ?? "—",
        total: allPointsByTeam.total[id] ?? 0,
        gwPoints: allPointsByTeam.latest[id] ?? 0,
      }));
      list.sort((a, b) => b.total - a.total);
      setLeagueMemberRows(list);
    })();
  }, [selectedLeagueId, allTeamNames, allPointsByTeam]);

  async function createLeague(e: React.FormEvent) {
    e.preventDefault();
    if (!myTeamId || !leagueNameInput.trim()) return;
    setSaving(true);
    setLeagueError("");
    const code = randomCode();
    const { data, error } = await supabase
      .from("fantasy_leagues")
      .insert({ fantasy_settings_id: poolId, name: leagueNameInput.trim(), join_code: code, created_by_team_id: myTeamId })
      .select("id")
      .single();
    if (error || !data) {
      setLeagueError(error?.message ?? "Could not create league");
      setSaving(false);
      return;
    }
    await supabase.from("fantasy_league_members").insert({ league_id: data.id, fantasy_team_id: myTeamId });
    setSaving(false);
    setCreateOpen(false);
    setLeagueNameInput("");
    await loadLeagues(myTeamId);
  }

  async function joinLeague(e: React.FormEvent) {
    e.preventDefault();
    if (!myTeamId || !joinCodeInput.trim()) return;
    setSaving(true);
    setLeagueError("");
    const { data: league } = await supabase.from("fantasy_leagues").select("id").eq("join_code", joinCodeInput.trim().toUpperCase()).maybeSingle();
    if (!league) {
      setLeagueError("No league found with that code.");
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("fantasy_league_members").insert({ league_id: league.id, fantasy_team_id: myTeamId });
    setSaving(false);
    if (error) {
      setLeagueError(error.message.includes("duplicate") ? "You're already in this league." : error.message);
      return;
    }
    setJoinOpen(false);
    setJoinCodeInput("");
    await loadLeagues(myTeamId);
  }

  const activeRows = selectedLeagueId ? leagueMemberRows : rows;
  const activeLeague = myLeagues.find((l) => l.id === selectedLeagueId);

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
      <SiteHeader active="fantasy" />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        <FantasySubNav poolId={poolId} />
        <div className="mb-6">
          <div className="text-xs font-bold uppercase tracking-wider text-[#3EA0D9]">{poolLabel}</div>
          <h1 className="font-display font-bold text-2xl">Leagues</h1>
        </div>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setSelectedLeagueId(null)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${!selectedLeagueId ? "bg-[#0B3363] text-white dark:bg-[#3EA0D9]" : "bg-[#0B3363]/5 dark:bg-white/10"}`}
          >
            Overall
          </button>
          {myLeagues.map((l) => (
            <button
              key={l.id}
              onClick={() => setSelectedLeagueId(l.id)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${selectedLeagueId === l.id ? "bg-[#0B3363] text-white dark:bg-[#3EA0D9]" : "bg-[#0B3363]/5 dark:bg-white/10"}`}
            >
              {l.name}
            </button>
          ))}
          <button onClick={() => { setCreateOpen(true); setJoinOpen(false); setLeagueError(""); }} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#0B3363]/15 dark:border-white/15">
            + Create League
          </button>
          <button onClick={() => { setJoinOpen(true); setCreateOpen(false); setLeagueError(""); }} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#0B3363]/15 dark:border-white/15">
            Join League
          </button>
        </div>

        {activeLeague && (
          <div className="text-xs text-[#0B3363]/50 dark:text-white/50 mb-4">
            Join code: <span className="font-bold font-mono">{activeLeague.join_code}</span> — share this with friends to invite them.
          </div>
        )}

        {createOpen && (
          <form onSubmit={createLeague} className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 p-4 mb-4 flex flex-col gap-2">
            <label className="text-xs font-semibold">League name</label>
            <input value={leagueNameInput} onChange={(e) => setLeagueNameInput(e.target.value)} required className="border border-[#0B3363]/15 dark:border-white/15 dark:bg-white/5 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Office League" />
            <button disabled={saving} className="py-2 rounded-lg bg-[#0B3363] text-white dark:bg-[#3EA0D9] font-semibold text-sm disabled:opacity-50">{saving ? "Creating…" : "Create"}</button>
          </form>
        )}
        {joinOpen && (
          <form onSubmit={joinLeague} className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 p-4 mb-4 flex flex-col gap-2">
            <label className="text-xs font-semibold">Join code</label>
            <input value={joinCodeInput} onChange={(e) => setJoinCodeInput(e.target.value)} required className="border border-[#0B3363]/15 dark:border-white/15 dark:bg-white/5 rounded-lg px-3 py-2 text-sm uppercase" placeholder="e.g. AB12CD" />
            <button disabled={saving} className="py-2 rounded-lg bg-[#0B3363] text-white dark:bg-[#3EA0D9] font-semibold text-sm disabled:opacity-50">{saving ? "Joining…" : "Join"}</button>
          </form>
        )}
        {leagueError && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 mb-4">{leagueError}</div>}

        {loading ? (
          <div className="text-sm opacity-50 py-10 text-center">Loading…</div>
        ) : (
          <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase text-[#0B3363]/40 dark:text-white/40 border-b border-[#0B3363]/10 dark:border-white/10">
                  <th className="text-left py-2.5 px-4">Rank</th>
                  <th className="text-left py-2.5 px-2">Team</th>
                  <th className="text-right py-2.5 px-2">{latestGwNumber ? `MW${latestGwNumber}` : "GW"}</th>
                  <th className="text-right py-2.5 px-4">Total</th>
                </tr>
              </thead>
              <tbody>
                {activeRows.map((r, i) => (
                  <tr
                    key={r.teamId}
                    className={`border-b border-[#0B3363]/5 dark:border-white/5 last:border-0 ${
                      r.teamId === myTeamId ? "bg-[#F4B400]/10" : ""
                    }`}
                  >
                    <td className="py-2.5 px-4 text-[#0B3363]/40 dark:text-white/40">{i + 1}</td>
                    <td className="py-2.5 px-2 font-medium">
                      {r.teamName}
                      {r.teamId === myTeamId && <span className="text-[10px] text-[#3EA0D9] font-bold ml-1.5">YOU</span>}
                    </td>
                    <td className="py-2.5 px-2 text-right">{r.gwPoints}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-[#3EA0D9]">{r.total}</td>
                  </tr>
                ))}
                {activeRows.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-xs text-[#0B3363]/40 dark:text-white/40">No teams here yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
