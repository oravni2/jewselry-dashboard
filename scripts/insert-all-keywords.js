// Combine all keyword parts and insert into Supabase
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

const part1 = require('./full-keywords');
const part2 = require('./full-keywords-2');
const part3 = require('./full-keywords-3');
const part4 = require('./full-keywords-4');
const part5 = require('./full-keywords-5');

const all = [...part1, ...part2, ...part3, ...part4, ...part5];

// Normalize to final format
const keywords = all.map(r => ({
  keyword: r.k,
  volume: r.v,
  competition: r.c
}));

// Deduplicate by keyword (keep first occurrence)
const seen = new Set();
const unique = [];
for (const kw of keywords) {
  if (!seen.has(kw.keyword)) {
    seen.add(kw.keyword);
    unique.push(kw);
  }
}

console.log(`Total raw: ${keywords.length}, Unique: ${unique.length}`);

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function main() {
  const jsonValue = JSON.stringify(unique);
  console.log(`JSON size: ${(jsonValue.length / 1024).toFixed(1)} KB`);

  const { data, error } = await supabase
    .from('settings')
    .upsert({ key: 'keyword_bank', value: jsonValue })
    .select()
    .single();

  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  console.log(`Successfully inserted keyword_bank with ${unique.length} keywords`);

  // Verify
  const { data: check } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'keyword_bank')
    .single();

  const parsed = JSON.parse(check.value);
  console.log(`Verified: ${parsed.length} keywords in database`);
}

main();
