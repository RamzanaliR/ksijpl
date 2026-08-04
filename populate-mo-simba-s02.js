const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split("\n")
    .filter(l => l.includes("="))
    .map(l => l.split("=").map(s => s.trim()))
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const SEASON_02_ID = "7b61cb81-a9e0-4e25-aede-82d0db26e2a6";

const rosterData = `
Arif Abdulnasser Okera,MO Simba
Hashim Ally Mohamed,MO Simba
Mahdi Nasrullah Hussein,MO Simba
Mohamed Abbas Iqbal Esmail,MO Simba
Mohamedabbas Hasnein Rajani,MO Simba
Rizwan Aliakber Sheriff,MO Simba
Salman Mehboob Karmali,MO Simba
Gulam Abdallah Okera,MO Simba
Mohamed Rizwan Dhalla,MO Simba
Mohammed Hassan Jaffer,MO Simba
Zainali Hussein Hasham,MO Simba
Hasnein Rizwan Esmail,MO Simba
Mohamedabbas Rizwan Manji,MO Simba
`;

async function populateRoster() {
  const lines = rosterData.trim().split("\n");

  // 1. Get all players to match names
  const { data: players } = await supabase.from("players").select("id, full_name");

  // 2. Get team IDs
  const { data: teams } = await supabase.from("teams").select("id, name");

  for (const line of lines) {
    const [name, teamName] = line.split(",");
    const player = players.find(p => p.full_name.toLowerCase().trim() === name.toLowerCase().trim());
    const team = teams.find(t => t.name.toLowerCase().trim() === teamName.toLowerCase().trim());

    if (player && team) {
      console.log(`Inserting ${player.full_name} for ${team.name}`);
      const { error } = await supabase.from("season_players").insert({
        season_id: SEASON_02_ID,
        team_id: team.id,
        player_id: player.id
      });
      if (error) console.error(`Error inserting ${name}:`, error.message);
    } else {
      console.error(`Missing match for: ${name} (${teamName})`);
    }
  }
}

populateRoster();
