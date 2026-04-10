// Parse keyword data and insert into settings table via API
const fs = require('fs');
const path = require('path');

// Load env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  });
}

const rawData = fs.readFileSync(path.join(__dirname, 'keywords-raw.tsv'), 'utf8');
const lines = rawData.split('\n').map(l => l.trim()).filter(l => l);

// Skip header line
const keywords = [];
for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split('\t');
  const keyword = (parts[0] || '').trim();
  const volumeStr = (parts[1] || '').trim();
  const compStr = (parts[2] || '').trim();

  if (!keyword) continue;

  const volume = parseInt(volumeStr, 10) || 0;
  const competition = compStr === '' || compStr === '-1' ? -1 : (parseInt(compStr, 10) || -1);

  keywords.push({ keyword, volume, competition });
}

console.log(`Parsed ${keywords.length} keywords`);

// Insert via Supabase directly
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function main() {
  const jsonValue = JSON.stringify(keywords);
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

  console.log(`Successfully inserted keyword_bank with ${keywords.length} keywords`);

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
