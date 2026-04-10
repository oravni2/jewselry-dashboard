/**
 * insert-from-tsv.js
 *
 * Reads keywords-data.txt (TSV: keyword\tvolume\tcompetition),
 * parses each row, and upserts the full array as JSON into the
 * Supabase `settings` table under key = 'keyword_bank'.
 *
 * Usage:  node scripts/insert-from-tsv.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── 1. Load .env manually (no dotenv package) ────────────────────────────────
const envPath = path.resolve(__dirname, '..', '.env');
const envLines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key   = trimmed.slice(0, eqIdx).trim();
  const value = trimmed.slice(eqIdx + 1).trim();
  if (key && !(key in process.env)) {
    process.env[key] = value;
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and/or SUPABASE_KEY not found in .env');
  process.exit(1);
}

// ── 2. Load Supabase from parent node_modules ────────────────────────────────
const { createClient } = require(
  path.resolve(__dirname, '..', 'node_modules', '@supabase', 'supabase-js')
);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── 3. Parse keywords-data.txt ───────────────────────────────────────────────
const tsvPath = path.resolve(__dirname, 'keywords-data.txt');
const rawText = fs.readFileSync(tsvPath, 'utf8');

const keywords = [];

for (const line of rawText.split(/\r?\n/)) {
  // Skip empty lines
  if (!line.trim()) continue;

  const parts = line.split('\t');

  // parts[0] = keyword, parts[1] = volume, parts[2] = competition
  const keyword = (parts[0] || '').trim();
  if (!keyword) continue;

  const rawVolume      = (parts[1] || '').trim();
  const rawCompetition = (parts[2] || '').trim();

  const volume      = rawVolume      ? parseInt(rawVolume,      10) : 0;
  const competition = (!rawCompetition || rawCompetition === '-1')
    ? -1
    : parseInt(rawCompetition, 10);

  keywords.push({ keyword, volume, competition });
}

console.log(`Parsed ${keywords.length} keywords from keywords-data.txt`);

// ── 4. Upsert into settings table ────────────────────────────────────────────
(async () => {
  const { error } = await supabase
    .from('settings')
    .upsert(
      { key: 'keyword_bank', value: keywords },
      { onConflict: 'key' }
    );

  if (error) {
    console.error('Supabase upsert error:', error.message);
    process.exit(1);
  }

  console.log(`Successfully inserted/updated keyword_bank with ${keywords.length} keywords.`);
})();
