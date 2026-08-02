const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envBuffer = fs.readFileSync(envPath, 'utf8');
const envLines = envBuffer.split('\n');
const envObj = {};
envLines.forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim();
    // Remove quotes if present
    const cleaned = value.replace(/^['"]|['"]$/g, '');
    envObj[key] = cleaned;
  }
});

const supabaseUrl = envObj.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = envObj.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function getSeasonPlayerStats() {
  try {
    // First, get season ids for season numbers 1 and 2
    const { data: seasonsData, error: seasonsError } = await supabase
      .from('seasons')
      .select('id, season_number, competition_id')
      .in('season_number', [1, 2]);

    if (seasonsError) {
      console.error('Error fetching seasons:', seasonsError);
      return;
    }

    if (!seasonsData || seasonsData.length === 0) {
      console.log('No seasons found for season numbers 1 and 2');
      return;
    }

    const seasonIds = seasonsData.map(s => s.id);
    console.log('Season IDs for season 1 and 2:', seasonIds);

    // Now fetch season_player_stats with joins to players and teams
    const { data: statsData, error: statsError } = await supabase
      .from('season_player_stats')
      .select(`
        id,
        season_id,
        player_id,
        team_id,
        goals,
        assists,
        yellow_cards,
        red_cards,
        motm,
        clean_sheets,
        players (full_name, fpl_name, nickname),
        teams (name, slug)
      `)
      .in('season_id', seasonIds);

    if (statsError) {
      console.error('Error fetching season player stats:', statsError);
      return;
    }

    if (!statsData || statsData.length === 0) {
      console.log('No season player stats found for seasons 1 and 2');
      return;
    }

    // Format output
    console.log(`Found ${statsData.length} player stat records for seasons 1 and 2:`);
    console.log('-------------------------------------------------------------------');
    statsData.forEach(stat => {
      const player = stat.players;
      const team = stat.teams;
      const playerName = player.full_name || player.fpl_name || player.nickname || 'Unknown';
      const teamName = team ? team.name : 'Unknown';
      console.log(`
        Season ID: ${stat.season_id}
        Player: ${playerName} (${player.fpl_name || 'N/A'})
        Team: ${teamName}
        Goals: ${stat.goals || 0}
        Assists: ${stat.assists || 0}
        Yellow Cards: ${stat.yellow_cards || 0}
        Red Cards: ${stat.red_cards || 0}
        MOTM: ${stat.motm || 0}
        Clean Sheets: ${stat.clean_sheets || 0}
      `);
    });

    // Also output as CSV for easy copying
    console.log('\nCSV Output:');
    console.log('Season ID,Player Name,Team Name,Goals,Assists,Yellow Cards,Red Cards,MOTM,Clean Sheets');
    statsData.forEach(stat => {
      const player = stat.players;
      const team = stat.teams;
      const playerName = player.full_name || player.fpl_name || player.nickname || 'Unknown';
      const teamName = team ? team.name : 'Unknown';
      console.log(`${stat.season_id},"${playerName}","${teamName}",${stat.goals || 0},${stat.assists || 0},${stat.yellow_cards || 0},${stat.red_cards || 0},${stat.motm || 0},${stat.clean_sheets || 0}`);
    });

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

getSeasonPlayerStats();