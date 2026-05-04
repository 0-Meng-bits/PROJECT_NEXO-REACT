require('dotenv').config();
const https = require('https');

const options = {
  hostname: 'iuqszidudascwlverzgj.supabase.co',
  path: '/rest/v1/communities?select=cover_url&limit=1',
  method: 'GET',
  headers: {
    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', body);
    if (res.statusCode === 400) {
      console.log('\n❌ cover_url column does NOT exist in communities table');
    } else {
      console.log('\n✅ cover_url column EXISTS');
    }
  });
});
req.on('error', e => console.error(e));
req.end();
