/**
 * Adds cover_url column to communities table via Supabase.
 * Run once: node add-cover-column.js
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Step 1: Create a helper function in the DB using the REST API
// We POST to /rest/v1/rpc/... but first we need to create the function.
// Supabase allows creating functions via the SQL API if we use the correct endpoint.

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers,
      },
    };
    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', d => responseBody += d);
      res.on('end', () => resolve({ status: res.statusCode, body: responseBody }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const host = new URL(SUPABASE_URL).hostname;
  const authHeaders = {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
  };

  // Try to call the SQL endpoint (Supabase exposes this for service role)
  console.log('Attempting to add cover_url column via SQL API...');

  // Supabase SQL endpoint
  const result = await httpsPost(host, '/rest/v1/rpc/exec_sql', authHeaders, {
    sql: 'ALTER TABLE communities ADD COLUMN IF NOT EXISTS cover_url TEXT;'
  });

  if (result.status === 200 || result.status === 204) {
    console.log('✅ Column added successfully!');
    return;
  }

  console.log('SQL API not available, trying alternative...');

  // Alternative: use the Supabase admin API
  // Create a temporary function, call it, then drop it
  const createFuncSQL = `
    CREATE OR REPLACE FUNCTION _temp_add_cover_url()
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
    BEGIN
      ALTER TABLE communities ADD COLUMN IF NOT EXISTS cover_url TEXT;
    END;
    $$;
  `;

  // We can't run DDL directly via PostgREST.
  // The only way without the DB password is through the Supabase dashboard.
  console.log('\n❌ Cannot add column automatically without DB password.');
  console.log('\n📋 Please run this SQL in your Supabase Dashboard → SQL Editor:');
  console.log('\n  ALTER TABLE communities ADD COLUMN IF NOT EXISTS cover_url TEXT;\n');
  console.log('Then restart the server and try again.');
  process.exit(1);
}

main().catch(console.error);
