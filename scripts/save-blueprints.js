const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const t = line.trim();
  if (!t || t.startsWith('#')) return;
  const i = t.indexOf('=');
  if (i > 0 && !process.env[t.slice(0,i).trim()]) process.env[t.slice(0,i).trim()] = t.slice(i+1).trim();
});

async function main() {
  const res = await fetch('https://api.printify.com/v1/catalog/blueprints.json', {
    headers: { 'Authorization': 'Bearer ' + process.env.PRINTIFY_API_TOKEN }
  });
  const data = await res.json();
  const lines = data.map(bp => bp.id + ' | ' + bp.title).join('\n');
  const outPath = path.join(__dirname, '..', 'blueprints.txt');
  fs.writeFileSync(outPath, lines);
  console.log('Written ' + data.length + ' blueprints to blueprints.txt');
}

main();
