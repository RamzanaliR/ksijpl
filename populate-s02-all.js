const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split("\n")
    .filter(l => l.includes("="))
    .map(l => l.split("=").map(s => s.trim()))
);

// Use service role key from env if available, fallback to anon key (which might fail if RLS is tight)
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const SEASON_02_ID = "7b61cb81-a9e0-4e25-aede-82d0db26e2a6";

const rawData = `
Abbas Zulfiqar Rashid,Care & Cure
Hussein Ladha,Care & Cure
Mohamed Abbasally Moledina,Care & Cure
Mohsin Khalfan,Care & Cure
Qayam Jaffer,Care & Cure
Salmaan Najafali Dhala,Care & Cure
Zahirabbas Abdulrasul,Care & Cure
Azherabbas Jivraj,Care & Cure
Zoheib Kanji,Care & Cure
Arif Rashid Khalfan,Care & Cure
Qaisali Karim,Care & Cure
Mohamed Shabbir Mohamedhussein,Care & Cure
Shaneabbas Dharamsi,Care & Cure
Muhammad Nasir Panjwani,Care & Cure
Ali Hussein Bhalloo,Chem & Co.
Aliridha Amir Abdulrasul,Chem & Co.
Hassan Abbas Mazaher,Chem & Co.
Hussain Abbas Mazaher,Chem & Co.
Mohammedabbas Bhimji,Chem & Co.
Mohammedabbas S. Manji,Chem & Co.
Nadeem Khimji,Chem & Co.
Taaha Abbas Kermalli,Chem & Co.
Zohail Hassanali,Chem & Co.
Yussuf Mahmood Fazal,Chem & Co.
Hassan Shivji Marungu,Chem & Co.
Hussein Akil Ahmed,Chem & Co.
Ali Mohamed Pardhan (Jandulo),Chem & Co.
Ali Akbar Syed,Chem & Co.
Hassan Hadi Mohammedali,Dar Glass
Maisam Ali Chandoo,Dar Glass
Mohamed Hassan Somji,Dar Glass
Sameer Mohamed Visram,Dar Glass
Mustafa Mohamed Rashid,Dar Glass
Mahdi Abbas Dinani,Dar Glass
Mohammed Adil Zulfikar Dewji,Dar Glass
Hussein Nooraly Fazel Pacha,Dar Glass
Alihaider Kermalli,Dar Glass
Alijawad M Sumar,Dar Glass
Hussein Mohamed Somji,Dar Glass
Maysam Mohamed Shamji,Dar Glass
Aliraza Sadikali,Dot Syndicate FC
Haadi Abbas Satchu,Dot Syndicate FC
Shaan Ali Momin,Dot Syndicate FC
Aliabid Mamdani,Dot Syndicate FC
Anwar Shivji,Dot Syndicate FC
Aliabbas Ahmedhussein Bandali,Dot Syndicate FC
Kadhim Hassan Hussein,Dot Syndicate FC
Shaneabbas Kanji,Dot Syndicate FC
Imran Khimji,Dot Syndicate FC
Mazahir Baliram,Dot Syndicate FC
Aliabbas M Nasser,Dot Syndicate FC
Sajjadali Riyaz Dewji,Dot Syndicate FC
Ali Mujtaba Khimji,Fragrance World
Hassan Mawji,Fragrance World
Saqalain Shabbir Virjee,Fragrance World
Maisamali Khalfan,Fragrance World
Waseem Alidina,Fragrance World
Sameer Haidershah,Fragrance World
Mahdi Manekia,Fragrance World
Akil Mohamed Somji,Fragrance World
Hussein Abbas Virjee,Fragrance World
Abbasali H. Meghji,Fragrance World
Ayaan Ashik Shariff,Fragrance World
Mohammed Shabbir Manji,Fragrance World
Aliasgher M. Nagji,GF Trucks
Farhan Elias Ramin,GF Trucks
Hassan Nooraly Fazel Pacha,GF Trucks
Mohammedraza Moosa Muraj,GF Trucks
Shaneabbas Naushad Mohamed,GF Trucks
Juzer Karim Abdullah,GF Trucks
Mustafa Aliraza Ganji,GF Trucks
Hasnain Moti,GF Trucks
Nazirally Akhtar Kara,GF Trucks
Abbas Akil Bhaloo,GF Trucks
Abbas Inayat Gangji,GF Trucks
Rehaan Mehboob Versi,GF Trucks
Ahmed Aziz Salim Riyami,IRH
Ali Mehdi Pirmohamed,IRH
Fayaz M. Kanji,IRH
Hasan Mohamedali Bhalloo,IRH
Husein Sachoo,IRH
Mahdi Akber Manji,IRH
Ramzan Mahdi,IRH
Salmanali Shirazali Alibhai,IRH
Hussein Mehdi Hasham,IRH
Imran Datoo,IRH
Zulfikar Shawkat Okera,IRH
Hassanabbas Hussein Rattansi,IRH
Hussein Abbas Azad,IRH
Abbasali M. Tejani,Masumin
Imran Mahmood Damji,Masumin
Muhammad Hadi,Masumin
Muhammadmahdi Chandoo,Masumin
Sameer Mussa,Masumin
Saqlain Rattansi,Masumin
Syed Atta Abbas,Masumin
Zainali Abbas Haji,Masumin
Rizwan Datoo,Masumin
Haider Muntazir Aziz,Masumin
Alihussein Mamdani,Masumin
Muhammad Abdulrasul,Masumin
Mohammed Moti,Masumin
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
Aliasgher A Rajani,Murji Sundries
Ayaan S. Jaffer,Murji Sundries
Hilaal Asif Jeraj,Murji Sundries
Murtada Mohammed Rashid,Murji Sundries
Ali M Merali,Murji Sundries
Aliasgher Naushad Manji,Murji Sundries
Ally Hassan Jaffer,Murji Sundries
Hassan Hussein Abbas Maalim,Murji Sundries
Suleiman Haroon Suleiman,Murji Sundries
Zamanabbas Kanji,Murji Sundries
Hasnain Bashir Abdulkarim,Murji Sundries
Syed Mustafa Imami,Murji Sundries
Alyhusayn Mahmood Manji,Murji Sundries
Alijawad Elias Ramin,Murji Sundries
Mazahir Dewji,Power Computers
Meisumabbas Basharat Mawji,Power Computers
Mohammad Sajjad Hussein,Power Computers
Rehaan Arif Bhalloo,Power Computers
Ali Mohammed Dewji,Power Computers
Arifhussein Hasnain Shamji,Power Computers
Mohammedmohsin Versi,Power Computers
Salman Hasnain Shamji,Power Computers
Alihassan Nathani,Power Computers
Asif Ibrahim Okera,Power Computers
Aliraza Mohamed Manji,Power Computers
Shaneabbas Ally Chandoo,Power Computers
Farhaad Abbas Satchu,RDD
Kassim Bharwani,RDD
Mustafa Shahid Murji,RDD
Qaim Zaffar Shakur,RDD
Mohamed Abbas Mohamed,RDD
Sajid Kermali,RDD
Imran Jaffer Jaffer,RDD
Hassan Mohamed Hussein,RDD
Shoaib Shiraz Visram,RDD
Zainabbas Ladha,RDD
Zamin Elias Ramin,RDD
Hussein Murtaza Chagani,RDD
Hadee Mohamedfayyaz Jaffer,RDD
Mohamedali Fazleabbas Dhirani,RDD
Ali Rehemtulla,RUNGU FC
Aliakber Mubarak Bandali,RUNGU FC
Imran Jacksi,RUNGU FC
Mahdi Ali Nasser,RUNGU FC
Mohammed Velani,RUNGU FC
Zaheed Rajani,RUNGU FC
Sajjad Mussa,RUNGU FC
Shaheed Rattansi,RUNGU FC
Salman Mohamed Dewji,RUNGU FC
Abbas Mohamed Dewji,RUNGU FC
Mohamedabbas S Sumar,RUNGU FC
Ali Murtaza Chandoo,RUNGU FC
Hassan Mehdi Hasham Bakalo,RUNGU FC
Aliabbas Hasnain Shamji,Salima Oxygen
Hasnein Rashid Mohamedali,Salima Oxygen
Hassan Mohamedhussein Ramji,Salima Oxygen
Kazim Mustafa Ladha,Salima Oxygen
Mehdi Gulamhussein Bhanji,Salima Oxygen
Mudathir M Jaffer,Salima Oxygen
Mohamedhussein Akber Khimji,Salima Oxygen
Ali Mohamdraza Meralli,Salima Oxygen
Ammar Ali Khaki,Salima Oxygen
Husseinali Sharrif,Salima Oxygen
Mujtaba Murtaza Somji,Salima Oxygen
Raza Abbas Bharvani,Salima Oxygen
Ali Roshanali Sumar,Salima Oxygen
Ayaanali Shabbirhussein Khalfan,SS Leopards
Husayn S Moledina,SS Leopards
Mahdi Imtiyaz Gulamhussein,SS Leopards
Mohamedraza Husseinabbas Lalji,SS Leopards
Mohammed Fazal Datoo,SS Leopards
Sibtain Aliraza Karim,SS Leopards
Abbas Shabbir Sikiladha,SS Leopards
Ali Hasnein Dharamsi,SS Leopards
Alihassan Fazleali Kassam,SS Leopards
Kumeil Hanif Abdulrasul,SS Leopards
Minhaal Riyaz Khatau,SS Leopards
Aliasgher Mohdraza Jivraj,SS Leopards
Sibtain Abbas Moledina,SS Leopards
Aliasgher Safdar,TIBA
Alihussein Naushad Mohamed,TIBA
Hussein Hassan Mawji,TIBA
Mohamed S Jessa,TIBA
Mujahid Bharwani,TIBA
Mustafa Naushad Baliram,TIBA
Ali Abbas Dinani,TIBA
Aliasgher Gangji,TIBA
Mujtaba Bharwani,TIBA
Maisam Fidahussein Bharwani,TIBA
Fida Hussein Aziz Okera,TIBA
Aliasgher Rizwan Manji,TIBA
Ali Jawad Mussa,TIBA
Alihassan Hussein Versi,TIBA
`;

async function main() {
  const lines = rawData.trim().split("\n");

  console.log(`Processing ${lines.length} entries...`);

  // 1. Load players and teams
  const [{ data: players }, { data: teams }] = await Promise.all([
    supabase.from("players").select("id, full_name"),
    supabase.from("teams").select("id, name")
  ]);

  const playerMap = new Map(players.map(p => [p.full_name.toLowerCase().trim(), p.id]));
  const teamMap = new Map(teams.map(t => [t.name.toLowerCase().trim(), t.id]));

  const updates = [];
  const missingPlayers = [];
  const missingTeams = [];

  for (const line of lines) {
    const [playerName, teamName] = line.split(",").map(s => s.trim());
    if (!playerName || !teamName) continue;

    const playerId = playerMap.get(playerName.toLowerCase());
    const teamId = teamMap.get(teamName.toLowerCase());

    if (!playerId) {
      missingPlayers.push(playerName);
      continue;
    }
    if (!teamId) {
      missingTeams.push(teamName);
      continue;
    }

    updates.push({
      season_id: SEASON_02_ID,
      player_id: playerId,
      team_id: teamId
    });
  }

  if (missingPlayers.length > 0) {
    console.warn(`Missing players (${new Set(missingPlayers).size} unique):`, [...new Set(missingPlayers)]);
  }
  if (missingTeams.length > 0) {
    console.warn(`Missing teams (${new Set(missingTeams).size} unique):`, [...new Set(missingTeams)]);
  }

  console.log(`Ready to insert ${updates.length} records.`);

  // Perform insertion in batches
  const batchSize = 50;
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    const { error } = await supabase.from("season_players").upsert(batch, { onConflict: "season_id,player_id" });
    if (error) {
      console.error(`Error in batch ${i / batchSize}:`, error.message);
    } else {
      console.log(`Inserted batch ${i / batchSize + 1}`);
    }
  }

  console.log("Done.");
}

main();
