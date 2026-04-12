const fs = require('fs');
const path = require('path');

// Load .env
const envPath = path.join(__dirname, '..', '.env');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const t = line.trim();
  if (!t || t.startsWith('#')) return;
  const i = t.indexOf('=');
  if (i > 0 && !process.env[t.slice(0,i).trim()]) process.env[t.slice(0,i).trim()] = t.slice(i+1).trim();
});

const token = process.env.PRINTIFY_API_TOKEN;
if (!token) { console.error('PRINTIFY_API_TOKEN not found'); process.exit(1); }

// Load blueprint names from blueprints.txt
const bpLines = fs.readFileSync(path.join(__dirname, '..', 'blueprints.txt'), 'utf8').split('\n');
const bpNames = {};
bpLines.forEach(line => {
  const m = line.match(/^(\d+)\s*\|\s*(.+)$/);
  if (m) bpNames[m[1]] = m[2].trim();
});

const IDS = [6,33,66,74,77,81,147,157,229,400,421,459,478,485,488,538,561,580,635,759,938,944,1002,1048,1159,1206,1208,1220,1313,1389,1447,1468,1498,1521,1530,1997,1305];

async function main() {
  const results = [];

  for (const id of IDS) {
    const bpName = bpNames[id] || '(unknown)';
    process.stdout.write(`Fetching blueprint ${id}...`);

    try {
      const res = await fetch(`https://api.printify.com/v1/catalog/blueprints/${id}/print_providers.json`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });

      if (!res.ok) {
        console.log(` ERROR ${res.status}`);
        results.push(`${id} | ${bpName} | ERROR | ${res.status} | -`);
        continue;
      }

      const providers = await res.json();
      console.log(` ${providers.length} providers`);

      if (!providers.length) {
        results.push(`${id} | ${bpName} | - | No providers | -`);
      } else {
        providers.forEach(p => {
          const location = p.location?.country || p.location?.address1 || '-';
          results.push(`${id} | ${bpName} | ${p.id} | ${p.title} | ${location}`);
        });
      }
    } catch (err) {
      console.log(` FAILED: ${err.message}`);
      results.push(`${id} | ${bpName} | ERROR | ${err.message} | -`);
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  const outPath = path.join(__dirname, '..', 'providers.txt');
  fs.writeFileSync(outPath, 'Blueprint ID | Blueprint Name | Provider ID | Provider Name | Location\n' + results.join('\n'));
  console.log(`\nWritten ${results.length} rows to providers.txt`);
}

main();
