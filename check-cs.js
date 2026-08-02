const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) env[match[1]] = match[2].trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  const { data: stats } = await supabase.from('season_player_stats').select('*');
  const counts = {};
  stats.forEach(s => {
    const sId = s.season_id;
    if (!counts[sId]) counts[sId] = { total: 0, nonNullCS: 0, sumCS: 0 };
    counts[sId].total++;
    if (s.clean_sheets !== null) {
      counts[sId].nonNullCS++;
      counts[sId].sumCS += s.clean_sheets;
    }
  });

  const { data: seasons } = await supabase.from('seasons').select('id, label');
  const sMap = {};
  seasons.forEach(s => sMap[s.id] = s.label);

  console.log('Clean sheet stats per season:');
  Object.keys(counts).forEach(sId => {
    console.log(`Season: ${sMap[sId] || sId}`);
    console.log(counts[sId]);
  });
}

main();
