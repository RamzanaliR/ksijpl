import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  generateGraphicFromTemplate,
  uploadImageToCanva,
  textField,
  imageField,
  type CanvaAutofillData,
} from "@/lib/canva";

function getSupabase(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

type TemplateType = "fixtures" | "individual_match" | "results" | "league_table" | "motm" | "totw";

// ─── Caption generation ───────────────────────────────────────────────────────

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

async function buildCaption(
  sb: ReturnType<typeof getSupabase>,
  templateType: TemplateType,
  division: string,
  vars: Record<string, string>
): Promise<string> {
  const { data } = await sb
    .from("caption_templates")
    .select("template_body")
    .eq("template_type", templateType)
    .eq("division", division)
    .maybeSingle();
  if (!data) return "";
  return interpolate(data.template_body, vars);
}

// ─── Data fetchers (one per template type) ────────────────────────────────────

async function fetchFixturesData(sb: ReturnType<typeof getSupabase>, gameweekId: string) {
  const { data: gw } = await sb
    .from("gameweeks")
    .select("number,round_name,seasons(label)")
    .eq("id", gameweekId)
    .maybeSingle();

  const { data: matches } = await sb
    .from("matches")
    .select(`
      id, kickoff_at, venue,
      home_team:teams!matches_home_team_id_fkey(id,name,sponsor_logo_url),
      away_team:teams!matches_away_team_id_fkey(id,name,sponsor_logo_url)
    `)
    .eq("gameweek_id", gameweekId)
    .order("kickoff_at")
    .order("id");

  const gwNum = (gw as any)?.number ?? 1;
  const mw = (gw as any)?.round_name ?? `MATCH WEEK ${String(gwNum).padStart(2, "0")} FIXTURES`;
  const fixtureLines = (matches ?? []).map((m: any) => {
    const time = m.kickoff_at
      ? new Date(m.kickoff_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Dar_es_Salaam" })
      : "TBC";
    return `${m.home_team?.name} vs ${m.away_team?.name} | ${time} | ${m.venue ?? "TBC"}`;
  });

  return {
    canvaData: { matches: matches ?? [], matchWeek: mw },
    captionVars: {
      match_week: mw.replace(" FIXTURES", ""),
      date: matches?.[0]?.kickoff_at
        ? new Date((matches[0] as any).kickoff_at).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Dar_es_Salaam" })
        : "TBC",
      fixture_list: fixtureLines.join("\n"),
    },
  };
}

async function fetchResultsData(sb: ReturnType<typeof getSupabase>, gameweekId: string) {
  const { data: gw } = await sb
    .from("gameweeks")
    .select("number,round_name")
    .eq("id", gameweekId)
    .maybeSingle();

  const { data: matches } = await sb
    .from("matches")
    .select(`
      id, home_score, away_score, home_pens, away_pens,
      home_team:teams!matches_home_team_id_fkey(name,sponsor_logo_url),
      away_team:teams!matches_away_team_id_fkey(name,sponsor_logo_url),
      home_motm_player_id,
      match_events(event_type, minute, player:players(full_name,fpl_name,nickname))
    `)
    .eq("gameweek_id", gameweekId)
    .not("home_score", "is", null);

  const mw = (gw as any)?.round_name ?? `Match Week ${(gw as any)?.number}`;
  const resultLines = (matches ?? []).map((m: any) => {
    const score = `${m.home_team?.name} ${m.home_score ?? 0} – ${m.away_score ?? 0} ${m.away_team?.name}`;
    const pen = m.home_pens != null ? ` (${m.home_pens}–${m.away_pens} pens)` : "";
    return `${score}${pen}`;
  });

  return {
    canvaData: { matches: matches ?? [], matchWeek: mw },
    captionVars: {
      match_week: mw.replace(" FIXTURES", ""),
      results_summary: resultLines.join("\n"),
    },
    // Return individual match IDs so we create one record per match
    matchIds: (matches ?? []).map((m: any) => m.id),
  };
}

async function fetchLeagueTableData(sb: ReturnType<typeof getSupabase>, gameweekId: string, division: string) {
  const { data: gw } = await sb
    .from("gameweeks")
    .select("number,round_name,season_id")
    .eq("id", gameweekId)
    .maybeSingle();

  const { data: standings } = await sb
    .from("league_standings")
    .select("position,played,goal_difference,points,team:teams(name,sponsor_logo_url)")
    .eq("season_id", (gw as any)?.season_id)
    .order("position");

  const mw = (gw as any)?.round_name ?? `Match Week ${(gw as any)?.number}`;
  const top3 = (standings ?? []).slice(0, 3);

  return {
    canvaData: { standings: standings ?? [], matchWeek: mw },
    captionVars: {
      match_week: mw.replace(" FIXTURES", ""),
      pos1_team: (top3[0] as any)?.team?.name ?? "—",
      pos1_pts:  String((top3[0] as any)?.points ?? 0),
      pos2_team: (top3[1] as any)?.team?.name ?? "—",
      pos2_pts:  String((top3[1] as any)?.points ?? 0),
      pos3_team: (top3[2] as any)?.team?.name ?? "—",
      pos3_pts:  String((top3[2] as any)?.points ?? 0),
    },
  };
}

async function fetchMotmData(sb: ReturnType<typeof getSupabase>, gameweekId: string) {
  const { data: gw } = await sb
    .from("gameweeks")
    .select("number,round_name")
    .eq("id", gameweekId)
    .maybeSingle();

  const { data: matches } = await sb
    .from("matches")
    .select(`
      id,
      home_team:teams!matches_home_team_id_fkey(name),
      away_team:teams!matches_away_team_id_fkey(name),
      motm:players!matches_home_motm_player_id_fkey(full_name,fpl_name,nickname,headshot_url)
    `)
    .eq("gameweek_id", gameweekId)
    .not("home_motm_player_id", "is", null);

  const mw = (gw as any)?.round_name ?? `Match Week ${(gw as any)?.number}`;
  const motmLines = (matches ?? []).map((m: any, i: number) => {
    const name = m.motm?.fpl_name ?? m.motm?.nickname ?? m.motm?.full_name ?? "—";
    return `${name} vs ${m.away_team?.name ?? "—"}`;
  });

  return {
    canvaData: { matches: matches ?? [], matchWeek: mw },
    captionVars: {
      match_week: mw.replace(" FIXTURES", ""),
      motm_list: motmLines.join("\n"),
    },
  };
}

async function fetchIndividualMatchData(sb: ReturnType<typeof getSupabase>, gameweekId: string) {
  const { data: gw } = await sb
    .from("gameweeks")
    .select("number,round_name")
    .eq("id", gameweekId)
    .maybeSingle();

  const { data: matches } = await sb
    .from("matches")
    .select(`
      id, kickoff_at, venue,
      home_team:teams!matches_home_team_id_fkey(name,home_jersey_url,gk_jersey_url),
      away_team:teams!matches_away_team_id_fkey(name,home_jersey_url,gk_jersey_url)
    `)
    .eq("gameweek_id", gameweekId)
    .order("kickoff_at");

  const mw = (gw as any)?.round_name ?? `Match Week ${(gw as any)?.number}`;
  return {
    canvaData: { matches: matches ?? [], matchWeek: mw },
    captionVars: { match_week: mw },
    matchIds: (matches ?? []).map((m: any) => m.id),
  };
}

// ─── Canva autofill data builders (one per template type) ────────────────────

async function buildFixturesAutofill(canvaData: any): Promise<CanvaAutofillData> {
  const d: CanvaAutofillData = {
    match_week_label: textField(canvaData.matchWeek ?? ""),
    fixture_date: textField(canvaData.matches?.[0]?.kickoff_at
      ? new Date(canvaData.matches[0].kickoff_at).toLocaleDateString("en-GB", {
          weekday: "long", day: "numeric", month: "long",
          timeZone: "Africa/Dar_es_Salaam"
        }).toUpperCase()
      : ""),
  };

  for (let i = 0; i < (canvaData.matches ?? []).length; i++) {
    const m = canvaData.matches[i];
    const n = i + 1;
    const time = m.kickoff_at
      ? new Date(m.kickoff_at).toLocaleTimeString("en-GB", {
          hour: "2-digit", minute: "2-digit", timeZone: "Africa/Dar_es_Salaam"
        })
      : "TBC";

    d[`match_${n}_home_name`] = textField(m.home_team?.name ?? "");
    d[`match_${n}_away_name`] = textField(m.away_team?.name ?? "");
    d[`match_${n}_time`]      = textField(time);
    d[`match_${n}_pitch`]     = textField(m.venue ?? "TBC");

    // Upload logos to Canva assets and get asset IDs
    if (m.home_team?.sponsor_logo_url) {
      const homeName = (m.home_team.name ?? "home").replace(/\s+/g, "_").toLowerCase();
      const assetId = await uploadImageToCanva(m.home_team.sponsor_logo_url, `logo_${homeName}`);
      if (assetId) d[`match_${n}_home_logo`] = imageField(assetId);
    }
    if (m.away_team?.sponsor_logo_url) {
      const awayName = (m.away_team.name ?? "away").replace(/\s+/g, "_").toLowerCase();
      const assetId = await uploadImageToCanva(m.away_team.sponsor_logo_url, `logo_${awayName}`);
      if (assetId) d[`match_${n}_away_logo`] = imageField(assetId);
    }
  }

  return d;
}

async function buildLeagueTableAutofill(canvaData: any): Promise<CanvaAutofillData> {
  const d: CanvaAutofillData = {
    match_week_label: textField(canvaData.matchWeek ?? ""),
  };
  for (let i = 0; i < (canvaData.standings ?? []).length; i++) {
    const s = canvaData.standings[i];
    const n = i + 1;
    d[`row_${n}_pos`]    = textField(String(s.position ?? n));
    d[`row_${n}_name`]   = textField(s.team?.name ?? "");
    d[`row_${n}_played`] = textField(String(s.played ?? 0));
    d[`row_${n}_gd`]     = textField(String(s.goal_difference ?? 0));
    d[`row_${n}_pts`]    = textField(String(s.points ?? 0));
    if (s.team?.sponsor_logo_url) {
      const assetId = await uploadImageToCanva(s.team.sponsor_logo_url, `team_logo_${n}`);
      if (assetId) d[`row_${n}_logo`] = imageField(assetId);
    }
  }
  return d;
}

async function buildResultsAutofill(match: any): Promise<CanvaAutofillData> {
  const d: CanvaAutofillData = {
    home_score:   textField(String(match.home_score ?? 0)),
    away_score:   textField(String(match.away_score ?? 0)),
    penalty_line: textField(
      match.home_pens != null
        ? `AFTER PENALTIES ${match.home_pens}–${match.away_pens}`
        : ""
    ),
  };

  // Goal scorers
  const homeGoals = (match.match_events ?? [])
    .filter((e: any) => e.event_type === "goal" && e.is_home)
    .map((e: any) => e.player?.fpl_name ?? e.player?.full_name ?? "")
    .filter(Boolean).join("\n");
  const awayGoals = (match.match_events ?? [])
    .filter((e: any) => e.event_type === "goal" && !e.is_home)
    .map((e: any) => e.player?.fpl_name ?? e.player?.full_name ?? "")
    .filter(Boolean).join("\n");

  d["home_scorers"] = textField(homeGoals);
  d["away_scorers"] = textField(awayGoals);

  if (match.home_motm?.fpl_name ?? match.home_motm?.full_name ?? match.away_motm?.fpl_name) {
    d["motm_name"] = textField(match.home_motm?.fpl_name ?? match.home_motm?.full_name ?? match.away_motm?.fpl_name ?? match.away_motm?.full_name ?? "");
  }

  if (match.home_team?.sponsor_logo_url) {
    const assetId = await uploadImageToCanva(match.home_team.sponsor_logo_url, "home_logo");
    if (assetId) d["home_logo"] = imageField(assetId);
  }
  if (match.away_team?.sponsor_logo_url) {
    const assetId = await uploadImageToCanva(match.away_team.sponsor_logo_url, "away_logo");
    if (assetId) d["away_logo"] = imageField(assetId);
  }

  return d;
}

async function buildMotmAutofill(canvaData: any): Promise<CanvaAutofillData> {
  const d: CanvaAutofillData = {
    match_week_label: textField(canvaData.matchWeek ?? ""),
  };
  for (let i = 0; i < (canvaData.matches ?? []).length; i++) {
    const m = canvaData.matches[i];
    const n = i + 1;
    const name = m.motm?.fpl_name ?? m.motm?.nickname ?? m.motm?.full_name ?? "";
    const vs   = m.away_team?.name ?? "";
    d[`player_${n}_name`] = textField(name);
    d[`player_${n}_vs`]   = textField(`VS ${vs}`);
    if (m.motm?.headshot_url) {
      const assetId = await uploadImageToCanva(m.motm.headshot_url, `motm_photo_${n}`);
      if (assetId) d[`player_${n}_photo`] = imageField(assetId);
    }
  }
  return d;
}

async function buildIndividualMatchAutofill(match: any, matchWeek: string): Promise<CanvaAutofillData> {
  const d: CanvaAutofillData = {
    match_week_label: textField(matchWeek),
    home_team_name:   textField(match.home_team?.name ?? ""),
    away_team_name:   textField(match.away_team?.name ?? ""),
    match_date: textField(match.kickoff_at
      ? new Date(match.kickoff_at).toLocaleDateString("en-GB", {
          day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Dar_es_Salaam"
        }).toUpperCase()
      : ""),
    match_time: textField(match.kickoff_at
      ? new Date(match.kickoff_at).toLocaleTimeString("en-GB", {
          hour: "2-digit", minute: "2-digit", timeZone: "Africa/Dar_es_Salaam"
        })
      : ""),
    pitch_number: textField(`Pitch ${match.venue ?? "TBC"}`),
  };

  const jerseyFields: [string, string | undefined][] = [
    ["home_jersey_image", match.home_team?.home_jersey_url],
    ["home_gk_jersey_image", match.home_team?.gk_jersey_url],
    ["away_jersey_image", match.away_team?.home_jersey_url],
    ["away_gk_jersey_image", match.away_team?.gk_jersey_url],
  ];
  for (const [fieldName, url] of jerseyFields) {
    if (url) {
      const assetId = await uploadImageToCanva(url, fieldName);
      if (assetId) d[fieldName] = imageField(assetId);
    }
  }

  return d;
}

// ─── Route data to correct autofill builder → Canva → Supabase Storage ───────

async function callCanvaAndStore(
  templateType: TemplateType,
  canvaData: any,
  title: string,
  formation?: string
): Promise<string | null> {
  let autofillData: CanvaAutofillData = {};

  if (templateType === "fixtures") {
    autofillData = await buildFixturesAutofill(canvaData);
  } else if (templateType === "league_table") {
    autofillData = await buildLeagueTableAutofill(canvaData);
  } else if (templateType === "motm") {
    autofillData = await buildMotmAutofill(canvaData);
  } else if (templateType === "results") {
    // Results: canvaData is a single match object
    autofillData = await buildResultsAutofill(canvaData);
  } else if (templateType === "individual_match") {
    autofillData = await buildIndividualMatchAutofill(canvaData, canvaData.matchWeek ?? "");
  } else {
    // TOTW — handled separately with formation
    return null;
  }

  // Generate via Canva (autofill → export PNG URL)
  const pngUrl = await generateGraphicFromTemplate(templateType, autofillData, title, formation);
  if (!pngUrl) return null;

  // Download PNG and store in Supabase Storage
  const sb = getSupabase();
  const pngRes = await fetch(pngUrl);
  if (!pngRes.ok) return null;
  const pngBuffer = await pngRes.arrayBuffer();
  const fileName  = `${templateType}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;

  const { error: uploadErr } = await sb.storage
    .from("generated-graphics")
    .upload(fileName, pngBuffer, { contentType: "image/png", upsert: false });

  if (uploadErr) {
    console.error("[canva] storage upload failed:", uploadErr);
    return null;
  }

  const { data: pub } = sb.storage.from("generated-graphics").getPublicUrl(fileName);
  return pub.publicUrl;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const { gameweek_id, division, template_types } = body as {
      gameweek_id: string;
      division: string;
      template_types: TemplateType[];
    };

    if (!gameweek_id || !division || !template_types?.length) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const created: string[] = [];

    for (const templateType of template_types) {
      let canvaData: any = {};
      let captionVars: Record<string, string> = {};
      let matchIds: string[] = [];

      // Fetch data for this template type
      if (templateType === "fixtures") {
        ({ canvaData, captionVars } = await fetchFixturesData(supabase, gameweek_id));
      } else if (templateType === "results") {
        const d = await fetchResultsData(supabase, gameweek_id);
        canvaData = d.canvaData; captionVars = d.captionVars; matchIds = d.matchIds ?? [];
      } else if (templateType === "league_table") {
        ({ canvaData, captionVars } = await fetchLeagueTableData(supabase, gameweek_id, division));
      } else if (templateType === "motm") {
        ({ canvaData, captionVars } = await fetchMotmData(supabase, gameweek_id));
      } else if (templateType === "individual_match") {
        const d = await fetchIndividualMatchData(supabase, gameweek_id);
        canvaData = d.canvaData; captionVars = d.captionVars; matchIds = d.matchIds ?? [];
      } else if (templateType === "totw") {
        // TOTW data is entered manually by admin (player selections)
        // For now: create a pending record for admin to fill formation + players
        canvaData = {}; captionVars = { match_week: String(gameweek_id) };
      }

      // Results & Individual Match = one record per match
      const recordsToCreate = matchIds.length > 0
        ? matchIds.map((mId) => ({ match_id: mId, captionVars }))
        : [{ match_id: null, captionVars }];

      for (const record of recordsToCreate) {
        // Generate caption from template
        const caption = await buildCaption(supabase, templateType, division, record.captionVars);

        // Insert record immediately so UI shows "Generating" status
        const { data: inserted } = await supabase.from("generated_media").insert({
          gameweek_id: gameweek_id,
          match_id: record.match_id,
          template_type: templateType,
          division,
          status: "generating",
          caption_generated: caption,
        }).select("id").single();

        if (!inserted?.id) continue;
        created.push(inserted.id);
        const recordId = inserted.id;

        // For results/individual_match, resolve per-match canva data
        const matchCanvaData = record.match_id && canvaData.matches
          ? canvaData.matches.find((m: any) => m.id === record.match_id) ?? canvaData
          : canvaData;

        // Run Canva pipeline — update record when done
        try {
          const storageUrl = await callCanvaAndStore(
            templateType, matchCanvaData,
            `${templateType} - ${division} - ${new Date().toISOString().slice(0, 10)}`
          );
          await supabase.from("generated_media").update({
            status: storageUrl ? "pending_approval" : "pending_generation",
            storage_url: storageUrl ?? null,
            generated_at: storageUrl ? new Date().toISOString() : null,
            generation_error: storageUrl ? null : "Canva generation failed — check template ID and token.",
            updated_at: new Date().toISOString(),
          }).eq("id", recordId);
        } catch (canvaErr: any) {
          console.error("[generate-graphic] Canva error:", canvaErr);
          await supabase.from("generated_media").update({
            status: "pending_generation",
            generation_error: canvaErr?.message ?? "Unknown Canva error",
            updated_at: new Date().toISOString(),
          }).eq("id", recordId);
        }
      }
    }

    return NextResponse.json({ success: true, created });
  } catch (err: any) {
    console.error("[generate-graphic]", err);
    return NextResponse.json({ error: err.message ?? "Internal error." }, { status: 500 });
  }
}
