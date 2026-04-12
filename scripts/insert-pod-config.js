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

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function main() {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'pod-config.json'), 'utf8'));
  const value = JSON.stringify(config);
  console.log(`Inserting pod_products with ${config.length} products (${(value.length / 1024).toFixed(1)} KB)`);

  const { data, error } = await supabase
    .from('settings')
    .upsert({ key: 'pod_products', value })
    .select()
    .single();

  if (error) { console.error('Error:', error.message); process.exit(1); }
  console.log('Successfully inserted pod_products');

  // Verify
  const { data: check } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'pod_products')
    .single();

  const parsed = JSON.parse(check.value);
  console.log(`Verified: ${parsed.length} products in database`);
}

main();
