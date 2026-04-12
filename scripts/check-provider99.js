const fs = require('fs');
const path = require('path');

const lines = fs.readFileSync(path.join(__dirname, '..', 'providers.txt'), 'utf8').split('\n').slice(1).filter(l => l.trim());

const IDS = [6,33,66,74,77,81,147,157,229,400,421,459,478,485,488,538,561,580,635,759,938,944,1002,1048,1159,1206,1208,1220,1313,1389,1447,1468,1498,1521,1530,1997,1305];

// Group by blueprint ID
const byBp = {};
lines.forEach(line => {
  const parts = line.split('|').map(s => s.trim());
  const bpId = parseInt(parts[0], 10);
  if (!byBp[bpId]) byBp[bpId] = { name: parts[1], providers: [] };
  byBp[bpId].providers.push({ id: parseInt(parts[2], 10), name: parts[3] });
});

console.log('Blueprint ID | Blueprint Name | Provider 99 | Alternative');
console.log('-'.repeat(90));

IDS.forEach(id => {
  const bp = byBp[id];
  if (!bp) { console.log(`${id} | (not found) | - | -`); return; }
  const has99 = bp.providers.some(p => p.id === 99);
  if (has99) {
    console.log(`${id} | ${bp.name} | YES | -`);
  } else {
    const alt = bp.providers[0];
    console.log(`${id} | ${bp.name} | NO | ${alt.id} - ${alt.name}`);
  }
});
