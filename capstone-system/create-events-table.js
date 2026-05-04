require('dotenv').config();
const https = require('https');

// Use Supabase's REST API to execute SQL via a stored procedure workaround
// We'll create the table by inserting via the management API approach

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const host = new URL(SUPABASE_URL).hostname;

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: host,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Length': Buffer.byteLength(data),
        'Prefer': 'return=representation',
      }
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('Creating campus_events table via Supabase...');

  // Insert a test row — if table doesn't exist this will fail with a specific error
  // We need to use the SQL endpoint
  // Try the /rest/v1/ with a raw query via pg_net or similar
  
  // Actually let's try creating via the REST API by calling a function
  // First check if we can call version()
  const versionRes = await post('/rest/v1/rpc/version', {});
  console.log('RPC version:', versionRes.status, versionRes.body.substring(0, 100));
  
  // The table needs to be created via SQL. Since we can't run DDL via REST,
  // let's output the exact SQL for the user to run
  console.log('\n========================================');
  console.log('PLEASE RUN THIS SQL IN SUPABASE DASHBOARD:');
  console.log('https://supabase.com/dashboard/project/iuqszidudascwlverzgj/sql/new');
  console.log('========================================\n');
  
  const sql = require('fs').readFileSync('../supabase/migrations/20260503100000_campus_events_table.sql', 'utf8');
  console.log(sql);
}

main().catch(console.error);
