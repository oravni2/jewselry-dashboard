// Reads TSV keyword data from stdin, upserts into settings table as keyword_bank
const path = require('path');
const fs = require('fs');

// Load .env from parent directory
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

const { createClient } = require('@supabase/supabase-js');

async function main() {
  // Read all stdin
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const rawData = Buffer.concat(chunks).toString('utf8');

  const lines = rawData.split('\n').map(l => l.trim()).filter(l => l);

  if (lines.length === 0) {
    console.error('No data received on stdin.');
    process.exit(1);
  }

  // Detect and skip header line if present
  const startIndex = lines[0].toLowerCase().startsWith('keyword') ? 1 : 0;

  const keywords = [];
  for (let i = startIndex; i < lines.length; i++) {
    const parts = lines[i].split('\t');
    const keyword = (parts[0] || '').trim();
    const volumeStr = (parts[1] || '').trim();
    const compStr = (parts[2] || '').trim();

    if (!keyword) continue;

    const volume = parseInt(volumeStr, 10) || 0;
    const competition = compStr === '' || compStr === '-1'
      ? -1
      : (parseInt(compStr, 10) || -1);

    keywords.push({ keyword, volume, competition });
  }

  console.log(`Parsed ${keywords.length} keywords`);

  if (keywords.length === 0) {
    console.error('No valid keyword rows found.');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );

  const jsonValue = JSON.stringify(keywords);
  console.log(`JSON size: ${(jsonValue.length / 1024).toFixed(1)} KB`);

  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'keyword_bank', value: jsonValue })
    .select()
    .single();

  if (error) {
    console.error('Supabase error:', error.message);
    process.exit(1);
  }

  console.log(`Successfully upserted keyword_bank with ${keywords.length} keywords`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
