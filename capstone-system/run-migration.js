/**
 * Run this ONCE to add the cover_url column to the communities table.
 * Usage: node run-migration.js
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function migrate() {
  console.log('Running migration: add cover_url to communities...');

  // Insert a dummy row with cover_url to force the column to be recognized,
  // then immediately delete it — this won't work for DDL.
  // Instead, use the Supabase SQL API endpoint directly.
  const url = `${process.env.SUPABASE_URL}/rest/v1/`;

  // Use pg via the service role to run raw SQL
  // Supabase exposes a SQL endpoint at /pg endpoint for service role
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_ddl`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ sql: 'ALTER TABLE communities ADD COLUMN IF NOT EXISTS cover_url TEXT;' }),
  });

  if (!res.ok) {
    // Try alternative: check if column already exists by doing a select
    const { data, error } = await supabaseAdmin
      .from('communities')
      .select('cover_url')
      .limit(1);

    if (error && error.message.includes('cover_url')) {
      console.error('❌ cover_url column does not exist and could not be added automatically.');
      console.error('Please run this SQL in your Supabase SQL Editor:');
      console.error('  ALTER TABLE communities ADD COLUMN IF NOT EXISTS cover_url TEXT;');
      process.exit(1);
    } else {
      console.log('✅ cover_url column already exists — no migration needed.');
    }
  } else {
    console.log('✅ Migration complete: cover_url column added to communities.');
  }
}

migrate().catch(console.error);
