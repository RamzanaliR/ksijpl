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

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: competitions, error: compError } = await supabase
    .from('competitions')
    .select('id, name, sponsor_name, division_id');

  if (compError) {
    console.error('Error fetching competitions:', compError);
    return;
  }

  console.log('Competitions:');
  console.log(competitions);

  const { data: seasons, error: seasonError } = await supabase
    .from('seasons')
    .select('id, label, competition_id, created_at')
    .order('created_at', { ascending: false });

  if (seasonError) {
    console.error('Error fetching seasons:', seasonError);
    return;
  }

  console.log('\nSeasons:');
  console.log(seasons);
}

main();
