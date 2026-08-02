const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  const { data: seasons } = await supabase.from('seasons').select('id, label');
  const seasonLabels = {};
  seasons.forEach(s => seasonLabels[s.id] = s.label);

  const { data: stats } = await supabase.from('season_player_stats').select('*');
  const { data: players } = await supabase.from('players').select('full_name, position');
  const posMap = {};
  players.forEach(p => posMap[p.full_name.trim().toLowerCase()] = p.position);

  const reports = stats.map(row => {
    const sLabel = seasonLabels[row.season_id] || row.season_id;
    const normalizedName = row.player_name.trim().toLowerCase();
    const position = posMap[normalizedName] || 'MID';

    const appearance = row.pld * 1;
    const goalMult = { GK: 10, DEF: 6, MID: 5, FWD: 4 }[position] || 5;
    const goals = row.goals * goalMult;
    const assists = row.assists * 3;
    const motm = row.motm * 3;
    const yc = row.yellow * -1;
    const rc = row.red * -2;
    const cs = (position === 'GK' || position === 'DEF') ? (row.clean_sheets || 0) * 4 : 0;
    const total = appearance + goals + assists + motm + yc + rc + cs;

    return {
      'Player Name': row.player_name,
      'Season': sLabel,
      'Position': position,
      'Matches Played': row.pld,
      'Goals': row.goals,
      'Assists': row.assists,
      'Yellow Cards': row.yellow,
      'Red Cards': row.red,
      'MOTM Awards': row.motm,
      'Clean Sheets': row.clean_sheets || 0,
      'Computed Fantasy Points': total,
    };
  });

  reports.sort((a, b) => b['Computed Fantasy Points'] - a['Computed Fantasy Points']);

  const headers = Object.keys(reports[0]);
  const csv = [
    'WARNING: Season 01 Clean Sheet data is unavailable (CS data marked as 0).',
    headers.join(','),
    ...reports.map(r => Object.values(r).map(v => typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v).join(','))
  ].join('\n');

  if (!fs.existsSync(path.join(__dirname, 'tmp'))) fs.mkdirSync(path.join(__dirname, 'tmp'));
  fs.writeFileSync(path.join(__dirname, 'tmp', 'historical_fantasy_points.csv'), csv, 'utf8');
  console.log('Done!');
}

main();
