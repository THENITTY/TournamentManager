
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mttbzlcehmrmfjrtljkn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10dGJ6bGNlaG1ybWZqcnRsamtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NzEwMzQsImV4cCI6MjA4MjM0NzAzNH0.MuDNvK3I6I0s4kvfL4_tj6idi8Rvg7xBcTEk66wd4p4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLeagueCreation() {
    console.log('🧪 Testing League Creation...');

    // 1. Need to login as Admin to bypass RLS
    const { error: authError } = await supabase.auth.signInWithPassword({
        email: 'marcogranieri@libero.it',
        password: 'password123'
    });

    if (authError) {
        console.error('❌ Login failed:', authError.message);
        return;
    }

    // 2. Insert League
    const testName = 'Automated Test League ' + Date.now();
    const { data, error } = await supabase
        .from('leagues')
        .insert({
            name: testName,
            status: 'ongoing'
        })
        .select()
        .single();

    if (error) {
        console.error('❌ Creation failed:', error.message);
    } else {
        console.log('✅ League Created Successfully:', data);
    }
}

testLeagueCreation();
