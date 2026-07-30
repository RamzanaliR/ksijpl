import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

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
      id, kickoff_time, pitch,
      home_team:teams!matches_home_team_id_fkey(name,sponsor_logo_url),
      away_team:teams!matches_away_team_id_fkey(name,sponsor_logo_url)
    `)
    .eq("gameweek_id", gameweekId)
    .order("kickoff_time");

  const mw = (gw as any)?.round_name ?? `Match Week ${(gw as any)?.number}`;
  const fixtureLines = (matches ?? []).map((m: any) => {
    const time = m.kickoff_time
      ? new Date(m.kickoff_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Dar_es_Salaam" })
      : "TBC";
    return `${m.home_team?.name} vs ${m.away_team?.name} | ${time} | Pitch ${m.pitch ?? "TBC"}`;
  });

  return {
    canvaData: { matches: matches ?? [], matchWeek: mw },
    captionVars: {
      match_week: mw,
      date: matches?.[0]?.kickoff_time
        ? new Date((matches[0] as any).kickoff_time).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Dar_es_Salaam" })
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
      id, home_score, away_score, home_pen_score, away_pen_score,
      home_team:teams!matches_home_team_id_fkey(name,sponsor_logo_url),
      away_team:teams!matches_away_team_id_fkey(name,sponsor_logo_url),
      man_of_the_match_id,
      match_events(event_type, minute, player:players(full_name,fpl_name,nickname))
    `)
    .eq("gameweek_id", gameweekId)
    .not("home_score", "is", null);

  const mw = (gw as any)?.round_name ?? `Match Week ${(gw as any)?.number}`;
  const resultLines = (matches ?? []).map((m: any) => {
    const score = `${m.home_team?.name} ${m.home_score ?? 0} – ${m.away_score ?? 0} ${m.away_team?.name}`;
    const pen = m.home_pen_score != null ? ` (${m.home_pen_score}–${m.away_pen_score} pens)` : "";
    return `${score}${pen}`;
  });

  return {
    canvaData: { matches: matches ?? [], matchWeek: mw },
    captionVars: {
      match_week: mw,
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
      match_week: mw,
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
      motm:players!matches_man_of_the_match_id_fkey(full_name,fpl_name,nickname,headshot_url)
    `)
    .eq("gameweek_id", gameweekId)
    .not("man_of_the_match_id", "is", null);

  const mw = (gw as any)?.round_name ?? `Match Week ${(gw as any)?.number}`;
  const motmLines = (matches ?? []).map((m: any, i: number) => {
    const name = m.motm?.fpl_name ?? m.motm?.nickname ?? m.motm?.full_name ?? "—";
    return `${name} vs ${m.away_team?.name ?? "—"}`;
  });

  return {
    canvaData: { matches: matches ?? [], matchWeek: mw },
    captionVars: {
      match_week: mw,
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
      id, kickoff_time, pitch,
      home_team:teams!matches_home_team_id_fkey(name,home_jersey_url,gk_jersey_url),
      away_team:teams!matches_away_team_id_fkey(name,home_jersey_url,gk_jersey_url)
    `)
    .eq("gameweek_id", gameweekId)
    .order("kickoff_time");

  const mw = (gw as any)?.round_name ?? `Match Week ${(gw as any)?.number}`;
  return {
    canvaData: { matches: matches ?? [], matchWeek: mw },
    captionVars: { match_week: mw },
    matchIds: (matches ?? []).map((m: any) => m.id),
  };
}

// ─── Canva integration (skeleton — wires up when credentials exist) ───────────

async function callCanvaAPI(sb: ReturnType<typeof getSupabase>, _templateType: TemplateType, _canvaData: any): Promise<string | null> {
  const supabase = getSupabase();
  const { data: tokenRow } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", "canva_access_token")
    .maybeSingle();

  const token = tokenRow?.value;
  if (!token) return null; // No credentials yet — return null, UI shows "awaiting Canva setup"

  // TODO: implement Canva Connect API call once credentials are configured
  // const designId = CANVA_TEMPLATE_IDS[templateType];
  // const res = await fetch(`https://api.canva.com/rest/v1/autofills`, { ... });
  // const exportUrl = await pollCanvaExport(jobId, token);
  // return exportUrl;

  return null;
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

        // Attempt Canva generation (returns null if no credentials)
        await supabase.from("generated_media").update({
          status: "generating", updated_at: new Date().toISOString(),
        }).eq("gameweek_id", gameweek_id).eq("template_type", templateType).eq("division", division);

        const storageUrl = await callCanvaAPI(supabase, templateType, canvaData);

        const { data: inserted } = await supabase.from("generated_media").insert({
          gameweek_id: gameweek_id,
          match_id: record.match_id,
          template_type: templateType,
          division,
          status: storageUrl ? "pending_approval" : "pending_generation",
          caption_generated: caption,
          storage_url: storageUrl,
          generated_at: storageUrl ? new Date().toISOString() : null,
        }).select("id").single();

        if (inserted?.id) created.push(inserted.id);
      }
    }

    return NextResponse.json({ success: true, created });
  } catch (err: any) {
    console.error("[generate-graphic]", err);
    return NextResponse.json({ error: err.message ?? "Internal error." }, { status: 500 });
  }
}
