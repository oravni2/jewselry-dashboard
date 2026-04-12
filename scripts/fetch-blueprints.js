const fs = require('fs');
const path = require('path');

// Load .env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const i = t.indexOf('=');
    if (i > 0 && !process.env[t.slice(0,i).trim()]) process.env[t.slice(0,i).trim()] = t.slice(i+1).trim();
  });
}

const token = process.env.PRINTIFY_API_TOKEN;
if (!token) { console.error('PRINTIFY_API_TOKEN not found in .env'); process.exit(1); }

async function main() {
  const res = await fetch('https://api.printify.com/v1/catalog/blueprints.json', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  if (!res.ok) { console.error('API error:', res.status, res.statusText); process.exit(1); }
  const data = await res.json();
  console.log(`Found ${data.length} blueprints:\n`);
  data.forEach(bp => console.log(`ID: ${bp.id} | ${bp.title}`));
}

main().catch(err => { console.error(err.message); process.exit(1); });
