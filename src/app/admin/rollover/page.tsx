"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Season = { id: string; label: string; competition_id: string; competition_name: string };
type Team = { id: string; name: string; slug: string | null; sponsor_logo_url: string | null; carry: boolean; isNew: boolean };
type Competition = { id: string; name: string; sponsor_name: string };

const SENIORS_ID = "e0eee160-729a-4cbd-a29a-20d36115db31";
const JUNIORS_ID = "544019cb-0615-4b38-b9b8-03e71dfe1706";
const DIVISION_SENIORS = "dba72834-447c-4728-a0e6-9aaa6ebc1038";
const DIVISION_JUNIORS = "becd0dd1-d292-4533-8039-6d80e2bf192a";

type Step = "select_season" | "select_teams" | "configure" | "confirm" | "done";

export default function RolloverAdminPage() {
  const [step, setStep] = useState<Step>("select_season");
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedComp, setSelectedComp] = useState(SENIORS_ID);
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [newSeasonLabel, setNewSeasonLabel] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [allTeams, setAllTeams] = useState<{ id: string; name: string; slug: string | null; sponsor_logo_url: string | null }[]>([]);
  const [resetFantasy, setResetFantasy] = useState(true);
  const [resetPrices, setResetPrices] = useState(true);
  const [hasGauntlet, setHasGauntlet] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [msg, setMsg] = useState("");
  const [log, setLog] = useState<Season[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: comps }, { data: allTeamsData }] = await Promise.all([
        supabase.from("competitions").select("id,name,sponsor_name").in("id", [SENIORS_ID, JUNIORS_ID]),
        supabase.from("teams").select("id,name,slug,sponsor_logo_url").order("name"),
      ]);
      setCompetitions((comps as Competition[]) ?? []);
      setAllTeams(allTeamsData ?? []);
      loadCurrentSeason(selectedComp);
      loadLog();
    })();
  }, []);

  async function loadCurrentSeason(compId: string) {
    const { data } = await supabase.from("seasons")
      .select("id,label,competition_id,competitions(name)")
      .eq("competition_id", compId)
      .order("created_at", { ascending: false })
      .limit(1);
    const s = (data as any)?.[0];
    if (s) {
      setCurrentSeason({ id: s.id, label: s.label, competition_id: s.competition_id, competition_name: s.competitions?.name ?? "" });
      // Suggest next label
      const match = s.label.match(/(\d+)/);
      const num = match ? parseInt(match[1]) + 1 : 2;
      setNewSeasonLabel(`Season ${String(num).padStart(2, "0")}`);
      // Load current season teams
      const { data: stData } = await supabase.from("season_teams").select("team_id").eq("season_id", s.id);
      const currentTeamIds = new Set((stData ?? []).map((r: any) => r.team_id));
      setTeams(
        (allTeams.length ? allTeams : (await supabase.from("teams").select("id,name,slug,sponsor_logo_url").order("name")).data ?? [])
          .map((t: any) => ({ ...t, carry: currentTeamIds.has(t.id), isNew: false }))
      );
    }
  }

  async function loadLog() {
    const { data } = await supabase.from("seasons")
      .select("id,label,competition_id,competitions(name)")
      .order("created_at", { ascending: false })
      .limit(10);
    setLog((data as any) ?? []);
  }

  async function executeRollover() {
    if (!currentSeason || !newSeasonLabel.trim()) return;
    setRolling(true); setMsg("");

    try {
      const carryTeamIds = teams.filter((t) => t.carry).map((t) => t.id);
      if (carryTeamIds.length < 2) { setMsg("Select at least 2 teams to carry forward."); setRolling(false); return; }

      // 1. Mark current season as not current
      await supabase.from("seasons").update({ is_current: false }).eq("id", currentSeason.id);

      // 2. Create new season
      const { data: newSeason, error: seasonErr } = await supabase.from("seasons").insert({
        competition_id: currentSeason.competition_id,
        label: newSeasonLabel.trim(),
        is_current: true,
        is_public: true,
        has_gauntlet: hasGauntlet,
      }).select("id").single();

      if (seasonErr || !newSeason) { setMsg(`Error creating season: ${seasonErr?.message}`); setRolling(false); return; }
      const newSeasonId = newSeason.id;

      // 3. Create season_teams for carried teams
      const stRows = carryTeamIds.map((tid) => ({ season_id: newSeasonId, team_id: tid }));
      await supabase.from("season_teams").insert(stRows);

      // 4. Create gameweeks (MW1-MW19 as default)
      const gwRows = Array.from({ length: 19 }, (_, i) => ({
        season_id: newSeasonId,
        number: i + 1,
        round_name: null,
      }));
      await supabase.from("gameweeks").insert(gwRows);

      // 5. Reset fantasy if enabled
      if (resetFantasy) {
        // Get old fantasy settings
        const { data: oldSettings } = await supabase.from("fantasy_settings")
          .select("*").eq("season_id", currentSeason.id).maybeSingle();

        if (oldSettings) {
          // Create new fantasy settings for new season
          const { data: newSettings } = await supabase.from("fantasy_settings").insert({
            season_id: newSeasonId,
            budget: oldSettings.budget,
            squad_size: oldSettings.squad_size,
            starting_xi_size: oldSettings.starting_xi_size,
            min_gk: oldSettings.min_gk,
            min_def: oldSettings.min_def,
            min_mid: oldSettings.min_mid,
            min_fwd: oldSettings.min_fwd,
            starting_gk_count: oldSettings.starting_gk_count,
            free_transfers_per_gw: oldSettings.free_transfers_per_gw,
            max_banked_transfers: oldSettings.max_banked_transfers,
            transfer_cost_points: oldSettings.transfer_cost_points,
            wildcards_per_half: oldSettings.wildcards_per_half,
            max_players_per_team: oldSettings.max_players_per_team,
            is_active: true,
          }).select("id").single();

          // Copy player prices to new pool if not resetting
          if (!resetPrices && newSettings) {
            const { data: oldPrices } = await supabase.from("fantasy_player_prices")
              .select("player_id,price").eq("fantasy_settings_id", oldSettings.id);
            if (oldPrices?.length) {
              await supabase.from("fantasy_player_prices").insert(
                oldPrices.map((p: any) => ({ fantasy_settings_id: newSettings.id, player_id: p.player_id, price: p.price }))
              );
            }
          }
        }
      }

      // 6. Log the rollover
      await supabase.from("season_rollover_log").insert({
        from_season_id: currentSeason.id,
        to_season_id: newSeasonId,
        teams_carried: carryTeamIds.length,
        teams_removed: teams.filter((t) => !t.carry && !t.isNew).length,
        teams_added: teams.filter((t) => t.isNew && t.carry).length,
        notes: `Rolled over to ${newSeasonLabel}. Fantasy ${resetFantasy ? "reset" : "kept"}. Prices ${resetPrices ? "reset" : "carried forward"}.`,
      });

      setMsg(`✓ Season ${newSeasonLabel} created successfully with ${carryTeamIds.length} teams and ${gwRows.length} gameweeks.`);
      setStep("done");
      await loadLog();
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    }
    setRolling(false);
  }

  const comp = competitions.find((c) => c.id === selectedComp);

  return (
    <div>
      <h1 className="admin-page-title mb-1">Season Rollover</h1>
      <p className="admin-subtitle mb-6">Create a new season, carry forward teams, and reset fantasy.</p>

      {/* Competition selector */}
      <div className="flex gap-2 mb-6">
        {competitions.map((c) => (
          <button key={c.id} onClick={() => { setSelectedComp(c.id); loadCurrentSeason(c.id); setStep("select_season"); }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${c.id === selectedComp ? "admin-btn-primary" : "bg-[#0B3363]/5 text-[#0B3363]"}`}>
            {c.sponsor_name || c.name}
          </button>
        ))}
      </div>

      {msg && (
        <div className={`admin-card px-4 py-3 mb-5 text-sm font-semibold ${msg.startsWith("Error") ? "text-red-600 bg-red-50 border-red-200" : "text-green-700 bg-green-50 border-green-200"}`}>
          {msg}
        </div>
      )}

      {step === "done" ? (
        <div className="admin-card p-6 text-center">
          <div className="text-3xl mb-2">🎉</div>
          <div className="font-display font-bold text-lg mb-1">{newSeasonLabel} is live!</div>
          <div className="text-sm text-[#0B3363]/50 mb-4">The new season has been created and is marked as current.</div>
          <button onClick={() => { setStep("select_season"); setMsg(""); }} className="admin-btn admin-btn-secondary">Start another rollover</button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_320px] gap-5 items-start">
          <div className="space-y-4">

            {/* Step 1 — Season info */}
            <div className="admin-card p-5">
              <h2 className="font-display font-bold text-sm mb-3">Step 1 — New season details</h2>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="admin-label">Current season</label>
                  <div className="admin-input bg-[#0B3363]/5 text-[#0B3363]/60">{currentSeason?.label ?? "—"}</div>
                </div>
                <div>
                  <label className="admin-label">New season label</label>
                  <input value={newSeasonLabel} onChange={(e) => setNewSeasonLabel(e.target.value)} className="admin-input" placeholder="e.g. Season 04" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={hasGauntlet} onChange={(e) => setHasGauntlet(e.target.checked)} />
                <span>Enable Gauntlet for this season</span>
                <span className="text-xs text-[#0B3363]/40">(top 16 knockout, winner = champion)</span>
              </label>
            </div>

            {/* Step 2 — Teams */}
            <div className="admin-card overflow-hidden">
              <div className="px-5 py-3 border-b border-[#0B3363]/8 flex items-center justify-between">
                <h2 className="font-display font-bold text-sm">Step 2 — Teams ({teams.filter((t) => t.carry).length} selected)</h2>
                <div className="flex gap-2">
                  <button onClick={() => setTeams((prev) => prev.map((t) => ({ ...t, carry: true })))} className="text-xs text-[#3EA0D9] hover:underline">All</button>
                  <button onClick={() => setTeams((prev) => prev.map((t) => ({ ...t, carry: false })))} className="text-xs text-[#3EA0D9] hover:underline">None</button>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-[#0B3363]/5">
                {teams.map((t) => (
                  <label key={t.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#0B3363]/3 cursor-pointer">
                    <input type="checkbox" checked={t.carry} onChange={(e) => setTeams((prev) => prev.map((x) => x.id === t.id ? { ...x, carry: e.target.checked } : x))} />
                    <span className="text-sm font-medium flex-1">{t.name}</span>
                    {!t.carry && <span className="text-[10px] text-red-400 font-semibold">Not carrying forward</span>}
                  </label>
                ))}
              </div>
            </div>

            {/* Step 3 — Fantasy */}
            <div className="admin-card p-5">
              <h2 className="font-display font-bold text-sm mb-3">Step 3 — Fantasy League</h2>
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={resetFantasy} onChange={(e) => setResetFantasy(e.target.checked)} className="mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold">Reset Fantasy League</div>
                    <div className="text-xs text-[#0B3363]/50">Managers start fresh — new squads, new budget. Their historical records from the previous season are preserved in their profile.</div>
                  </div>
                </label>
                {resetFantasy && (
                  <label className="flex items-start gap-3 cursor-pointer ml-6">
                    <input type="checkbox" checked={resetPrices} onChange={(e) => setResetPrices(e.target.checked)} className="mt-0.5" />
                    <div>
                      <div className="text-sm font-semibold">Reset player prices</div>
                      <div className="text-xs text-[#0B3363]/50">Start from scratch with new prices (Elite & Premium reset). Uncheck to carry forward current prices.</div>
                    </div>
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Right — summary + execute */}
          <div className="space-y-4">
            <div className="admin-card p-4">
              <h3 className="font-display font-bold text-sm mb-3">Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-[#0B3363]/50">From</span><span className="font-semibold">{currentSeason?.label}</span></div>
                <div className="flex justify-between"><span className="text-[#0B3363]/50">To</span><span className="font-semibold">{newSeasonLabel || "—"}</span></div>
                <div className="flex justify-between"><span className="text-[#0B3363]/50">Teams</span><span className="font-semibold">{teams.filter((t) => t.carry).length} teams</span></div>
                <div className="flex justify-between"><span className="text-[#0B3363]/50">Gameweeks</span><span className="font-semibold">MW1–MW19 created</span></div>
                <div className="flex justify-between"><span className="text-[#0B3363]/50">Fantasy</span><span className="font-semibold">{resetFantasy ? "Reset" : "Kept"}</span></div>
                <div className="flex justify-between"><span className="text-[#0B3363]/50">Prices</span><span className="font-semibold">{resetFantasy && resetPrices ? "Reset" : "Carried"}</span></div>
                <div className="flex justify-between"><span className="text-[#0B3363]/50">Gauntlet</span><span className="font-semibold">{hasGauntlet ? "Enabled" : "Off"}</span></div>
              </div>
            </div>

            <div className="admin-card p-4 bg-amber-50/50 border-amber-200">
              <p className="text-xs text-amber-700 mb-3">⚠️ This will mark the current season as ended and create a new one. This cannot be undone.</p>
              <button onClick={executeRollover} disabled={rolling || !newSeasonLabel.trim() || teams.filter((t) => t.carry).length < 2}
                className="admin-btn admin-btn-primary w-full">
                {rolling ? "Creating new season…" : "🚀 Execute Rollover"}
              </button>
            </div>

            {/* Log */}
            {log.length > 0 && (
              <div className="admin-card p-4">
                <h3 className="font-display font-bold text-xs mb-2 text-[#0B3363]/50 uppercase">Season history</h3>
                <div className="space-y-1">
                  {log.map((s: any) => (
                    <div key={s.id} className="text-xs flex justify-between">
                      <span className="text-[#0B3363]/60">{s.label}</span>
                      <span className={`font-semibold ${s.is_current ? "text-green-600" : "text-[#0B3363]/30"}`}>{s.is_current ? "Current" : "Ended"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
