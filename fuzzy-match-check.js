const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] ? match[2].trim() : '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Let's load the raw Season 01 and Season 02 records from season_player_stats
  const { data: stats } = await supabase.from('season_player_stats').select('*');
  const { data: seasons } = await supabase.from('seasons').select('id, label');
  const { data: activePlayers } = await supabase.from('players').select('id, full_name, position, nickname, fpl_name');

  const seasonMap = {};
  seasons.forEach(s => {
    seasonMap[s.id] = s.label;
  });

  const playerByExactName = {};
  activePlayers.forEach(p => {
    playerByExactName[p.full_name.trim().toLowerCase()] = p;
  });

  // Since many names might have small spelling differences (e.g., Abbas Mohamed Dewji vs Abbas Dewji),
  // let's build a simple helper to match by nickname or parts of full name if exact match fails
  function findAssignedPosition(fullName) {
    const name = fullName.trim().toLowerCase();

    // Exact match
    if (playerByExactName[name]) {
      return playerByExactName[name].position;
    }

    // Try finding if active player is a substring
    for (const activeName in playerByExactName) {
      if (activeName.includes(name) || name.includes(activeName)) {
        return playerByExactName[activeName].position;
      }
    }

    // Default heuristics based on common name/team stats or patterns if not resolved
    // If goals > 5 and assists > 5, likely MID or FWD
    // We'll leave it as 'MID' by default, but let's see how many match.
    return null;
  }

  let matchedCount = 0;
  stats.forEach(s => {
    const pos = findAssignedPosition(s.player_name);
    if (pos) matchedCount++;
  });

  console.log(`Matched ${matchedCount} out of ${stats.length} historical records to an active player.`);
}

main();
