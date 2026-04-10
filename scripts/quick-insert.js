const fs = require('fs');
const path = require('path');

// Load env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const i = t.indexOf('=');
    if (i > 0 && !process.env[t.slice(0,i).trim()]) process.env[t.slice(0,i).trim()] = t.slice(i+1).trim();
  });
}

// Read from stdin
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => input += d);
process.stdin.on('end', async () => {
  const lines = input.split('\n').map(l => l.trim()).filter(l => l);
  const keywords = [];
  for (const line of lines) {
    const p = line.split('\t');
    const kw = (p[0]||'').trim();
    if (!kw || kw.toLowerCase() === 'keyword' || kw.toLowerCase().startsWith('[keyword')) continue;
    const vol = parseInt((p[1]||'').trim(), 10) || 0;
    const compStr = (p[2]||'').trim();
    const comp = (!compStr || compStr === '-1') ? -1 : (parseInt(compStr, 10) || -1);
    if (vol > 0) keywords.push({ keyword: kw, volume: vol, competition: comp });
  }
  console.log('Parsed ' + keywords.length + ' keywords');

  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  const val = JSON.stringify(keywords);
  console.log('JSON size: ' + (val.length/1024).toFixed(1) + ' KB');

  const { error } = await sb.from('settings').upsert({ key: 'keyword_bank', value: val }).select().single();
  if (error) { console.error('Error:', error.message); process.exit(1); }
  console.log('Inserted keyword_bank with ' + keywords.length + ' keywords');

  // Verify
  const { data } = await sb.from('settings').select('value').eq('key', 'keyword_bank').single();
  if (data) {
    const parsed = JSON.parse(data.value);
    console.log('Verified: ' + parsed.length + ' keywords in database');
  }
});
