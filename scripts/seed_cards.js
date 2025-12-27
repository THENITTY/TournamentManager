
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
// We need SERVICE_ROLE_KEY to bypass RLS for seeding if we run this locally without admin login,
// BUT since we setup "Admins can manage cards", we can use the regular key IF we login as admin, 
// OR we can just use the Service Key for scripts.
// ideally user provides service key. 
// For this environment, we reused the ANON key in previous scripts but that only works if policies allow anon (which we didn't set).
// We set "Admins can manage cards".
// SO to run this script successfully, we either need:
// 1. Service Role Key (User has likely not provided this in env yet, checking .env)
// 2. Login as Admin in the script.

// Let's try to grab keys from .env. Assuming user might put SERVICE_KEY there or we Login.
// We'll stick to the "Login as Admin" pattern we used before, as it's safer than asking for Service Key if not needed.

/* 
  Usage: node scripts/seed_cards.js
*/

const supabaseUrl = 'https://mttbzlcehmrmfjrtljkn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10dGJ6bGNlaG1ybWZqcnRsamtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NzEwMzQsImV4cCI6MjA4MjM0NzAzNH0.MuDNvK3I6I0s4kvfL4_tj6idi8Rvg7xBcTEk66wd4p4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedCards() {
    console.log('🚀 Starting Card Seeding Process...');

    // 1. Login as Admin
    console.log('🔑 Authenticating as Super Admin...');
    const { error: authError } = await supabase.auth.signInWithPassword({
        email: 'marcogranieri@libero.it',
        password: 'password123'
    });

    if (authError) {
        console.error('❌ Authentication failed:', authError.message);
        return;
    }
    console.log('✅ Authenticated.');

    // 2. Fetch Data from API
    console.log('🌍 Fetching cards from YGOPRODeck API...');
    const response = await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php');
    const data = await response.json();

    if (!data.data) {
        console.error('❌ API returned no data.');
        return;
    }

    const allCards = data.data;
    console.log(`📦 Fetched ${allCards.length} cards.`);

    // 3. Transform and Batch Insert
    // We'll process in chunks of 500 to avoid request size limits.
    const CHUNK_SIZE = 500;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < allCards.length; i += CHUNK_SIZE) {
        const chunk = allCards.slice(i, i + CHUNK_SIZE);

        const updates = chunk.map(card => ({
            id: card.id.toString(),
            name: card.name,
            type: card.type,
            frame_type: card.frameType,
            description: card.desc,
            atk: card.atk,
            def: card.def,
            level: card.level,
            race: card.race,
            attribute: card.attribute,
            image_url: card.card_images[0].image_url,
            small_image_url: card.card_images[0].image_url_small
        }));

        const { error } = await supabase
            .from('cards')
            .upsert(updates, { onConflict: 'id' });

        if (error) {
            console.error(`❌ Error inserting chunk ${i / CHUNK_SIZE}:`, error.message);
            failCount += chunk.length;
        } else {
            successCount += chunk.length;
            process.stdout.write(`\r✅ Processed: ${successCount} / ${allCards.length} cards...`);
        }
    }

    console.log('\n\n🎉 Seeding Complete!');
    console.log(`✅ Successfully inserted/updated: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
}

seedCards();
