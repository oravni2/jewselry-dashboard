const fs = require('fs');
const path = require('path');

// Load .env file (no dotenv dependency needed)
const envPath = path.join(__dirname, '.env');
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

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Anthropic client
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ---- TASKS API ----

app.get('/api/tasks', async (req, res) => {
  const { assigned_to, status } = req.query;
  let query = supabase
    .from('tasks')
    .select('*, categories(name, color)')
    .order('created_at', { ascending: false });

  if (assigned_to) query = query.eq('assigned_to', assigned_to);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/tasks', async (req, res) => {
  const { title, description, due_date, category_id, assigned_to } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const { data, error } = await supabase
    .from('tasks')
    .insert({ title, description, due_date: due_date || null, category_id: category_id || null, assigned_to: assigned_to || 'david' })
    .select('*, categories(name, color)')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.patch('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select('*, categories(name, color)')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ---- CATEGORIES API ----

app.get('/api/categories', async (req, res) => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/categories', async (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const { data, error } = await supabase
    .from('categories')
    .insert({ name, color: color || '#6366f1' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  const { name, color } = req.body;

  const { data, error } = await supabase
    .from('categories')
    .update({ name, color })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ---- SETTINGS API ----

app.get('/api/settings/:key', async (req, res) => {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', req.params.key)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/settings/:key', async (req, res) => {
  const { value } = req.body;
  const { data, error } = await supabase
    .from('settings')
    .upsert({ key: req.params.key, value })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ---- CUSTOMER SERVICE API ----

app.post('/api/cs/generate', async (req, res) => {
  const { customer_message, david_notes } = req.body;
  if (!customer_message) return res.status(400).json({ error: 'Customer message is required' });

  // Fetch system prompt from settings
  const { data: setting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'cs_system_prompt')
    .single();

  const systemPrompt = setting?.value || 'You are a customer service agent for a jewelry business.';

  let userContent = `Customer message:\n${customer_message}`;
  if (david_notes) {
    userContent += `\n\nNotes from David (in Hebrew):\n${david_notes}`;
  }
  userContent += '\n\nPlease respond with:\n1. First, a Hebrew summary of the customer\'s message (labeled "סיכום:")\n2. Then, a professional English reply to the customer (labeled "Reply:")';

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }]
    });

    const responseText = message.content[0].text;
    res.json({ response: responseText });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- SALES API ----

// Get sales with optional filters
app.get('/api/sales', async (req, res) => {
  const { month, listing_type, diamond } = req.query;
  let query = supabase
    .from('etsy_sales')
    .select('*')
    .order('sale_date', { ascending: false });

  if (month) query = query.eq('report_month', month);
  if (listing_type) query = query.eq('listing_type', listing_type);
  if (diamond === 'true') query = query.ilike('item_name', '%diamond%');

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Get sales summary/stats for a month (and previous month for comparison)
app.get('/api/sales/summary', async (req, res) => {
  const { month, diamond } = req.query;
  if (!month) return res.status(400).json({ error: 'Month is required (YYYY-MM)' });

  // Parse previous month
  const [y, m] = month.split('-').map(Number);
  const prevDate = new Date(y, m - 2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  // Fetch current and previous month data
  let curQuery = supabase.from('etsy_sales').select('*').eq('report_month', month);
  let prevQuery = supabase.from('etsy_sales').select('*').eq('report_month', prevMonth);
  if (diamond === 'true') {
    curQuery = curQuery.ilike('item_name', '%diamond%');
    prevQuery = prevQuery.ilike('item_name', '%diamond%');
  }
  const [current, previous] = await Promise.all([curQuery, prevQuery]);

  if (current.error) return res.status(500).json({ error: current.error.message });

  const summarize = (rows) => {
    if (!rows || !rows.length) return { revenue: 0, orders: 0, items: 0, byType: {}, bestsellers: [] };
    const orderIds = new Set(rows.map(r => r.order_id));
    const revenue = rows.reduce((sum, r) => sum + (Number(r.price) * r.quantity) - (Number(r.discount) || 0), 0);
    const items = rows.reduce((sum, r) => sum + r.quantity, 0);

    // By type
    const byType = {};
    rows.forEach(r => {
      if (!byType[r.listing_type]) byType[r.listing_type] = { revenue: 0, orders: new Set(), items: 0 };
      byType[r.listing_type].revenue += (Number(r.price) * r.quantity) - (Number(r.discount) || 0);
      byType[r.listing_type].orders.add(r.order_id);
      byType[r.listing_type].items += r.quantity;
    });
    // Convert sets to counts
    Object.keys(byType).forEach(k => { byType[k].orders = byType[k].orders.size; });

    // Bestsellers (top 10 by quantity)
    const itemMap = {};
    rows.forEach(r => {
      const key = r.item_name;
      if (!itemMap[key]) itemMap[key] = { name: key, quantity: 0, revenue: 0 };
      itemMap[key].quantity += r.quantity;
      itemMap[key].revenue += (Number(r.price) * r.quantity) - (Number(r.discount) || 0);
    });
    const bestsellers = Object.values(itemMap).sort((a, b) => b.quantity - a.quantity).slice(0, 10);

    return { revenue, orders: orderIds.size, items, byType, bestsellers };
  };

  res.json({
    current: summarize(current.data),
    previous: summarize(previous.data || []),
    month,
    prevMonth,
  });
});

// Get available months
app.get('/api/sales/months', async (req, res) => {
  const { data, error } = await supabase
    .from('etsy_sales')
    .select('report_month')
    .order('report_month', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  const months = [...new Set(data.map(r => r.report_month))];
  res.json(months);
});

// Upload/import sales data
app.post('/api/sales/import', async (req, res) => {
  const { rows, report_month } = req.body;
  if (!rows || !rows.length) return res.status(400).json({ error: 'No rows to import' });
  if (!report_month) return res.status(400).json({ error: 'Report month is required' });

  // Upsert rows (skip duplicates via unique constraint)
  let imported = 0;
  let skipped = 0;
  const errors = [];

  for (const row of rows) {
    const { data, error } = await supabase
      .from('etsy_sales')
      .upsert({
        order_id: row.order_id,
        item_name: row.item_name,
        quantity: row.quantity || 1,
        price: row.price || 0,
        discount: row.discount || null,
        sku: row.sku || null,
        listing_type: row.listing_type || 'physical',
        country: row.country || null,
        sale_date: row.sale_date,
        report_month,
        shipping_discount: row.shipping_discount || null,
        order_shipping: row.order_shipping || null,
        variations: row.variations || null,
      }, { onConflict: 'order_id,sku', ignoreDuplicates: true })
      .select();

    if (error) {
      errors.push(`Row ${row.order_id}: ${error.message}`);
      skipped++;
    } else if (data && data.length > 0) {
      imported++;
    } else {
      skipped++;
    }
  }

  res.json({ imported, skipped, errors: errors.slice(0, 5) });
});

// ---- PAYMENTS API ----

app.post('/api/payments/import', async (req, res) => {
  const { rows, report_month } = req.body;
  if (!rows || !rows.length) return res.status(400).json({ error: 'No rows to import' });
  if (!report_month) return res.status(400).json({ error: 'Report month is required' });

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const { data, error } = await supabase
      .from('etsy_payments')
      .upsert({
        payment_id: row.payment_id,
        order_id: row.order_id,
        gross_amount: row.gross_amount,
        fees: row.fees,
        net_amount: row.net_amount,
        vat_amount: row.vat_amount,
        currency: row.currency,
        listing_amount: row.listing_amount,
        listing_currency: row.listing_currency,
        exchange_rate: row.exchange_rate,
        order_date: row.order_date,
        report_month,
      }, { onConflict: 'payment_id,report_month', ignoreDuplicates: true })
      .select();

    if (error) { skipped++; }
    else if (data && data.length > 0) { imported++; }
    else { skipped++; }
  }

  res.json({ imported, skipped });
});

app.get('/api/payments/tax-report', async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'Month is required' });

  // Fetch payments for the month
  const { data: payments, error: pErr } = await supabase
    .from('etsy_payments')
    .select('*')
    .eq('report_month', month)
    .order('order_date', { ascending: false });

  if (pErr) return res.status(500).json({ error: pErr.message });

  // Fetch sales for the month (for type/country info)
  const { data: sales } = await supabase
    .from('etsy_sales')
    .select('order_id, item_name, listing_type, country, price, quantity')
    .eq('report_month', month);

  // Build lookup: order_id -> ALL matching sale rows
  const salesMap = {};
  (sales || []).forEach(s => {
    if (!salesMap[s.order_id]) salesMap[s.order_id] = [];
    salesMap[s.order_id].push(s);
  });

  // Categorize
  let podNet = 0, physicalNet = 0, israelNet = 0;
  let totalNet = 0, totalGross = 0, totalFees = 0, totalVat = 0;

  const detail = (payments || []).map(p => {
    const net = Number(p.net_amount) || 0;
    const gross = Number(p.gross_amount) || 0;
    const fees = Number(p.fees) || 0;
    const vat = Number(p.vat_amount) || 0;

    totalNet += net;
    totalGross += gross;
    totalFees += fees;
    totalVat += vat;

    // Split net proportionally across all items in this order
    const orderItems = salesMap[p.order_id] || [];
    if (orderItems.length > 0) {
      const totalOrderPrice = orderItems.reduce((sum, s) => sum + (Number(s.price) * (s.quantity || 1)), 0);
      orderItems.forEach(s => {
        const itemPrice = Number(s.price) * (s.quantity || 1);
        const share = totalOrderPrice > 0 ? (itemPrice / totalOrderPrice) * net : net / orderItems.length;
        if (s.listing_type === 'pod') podNet += share;
        if (s.listing_type === 'physical') physicalNet += share;
        if (s.country && s.country.toLowerCase().includes('israel')) israelNet += share;
      });
    }

    // Use first item for display in detail table
    const firstItem = orderItems[0] || {};

    return {
      order_id: p.order_id,
      payment_id: p.payment_id,
      item_name: orderItems.length > 1
        ? firstItem.item_name + ` (+${orderItems.length - 1})`
        : (firstItem.item_name || ''),
      listing_type: orderItems.length > 1
        ? orderItems.map(s => s.listing_type).filter((v, i, a) => a.indexOf(v) === i).join('/')
        : (firstItem.listing_type || ''),
      country: firstItem.country || '',
      gross_amount: gross,
      net_amount: net,
      fees,
      vat_amount: vat,
      currency: p.currency,
      order_date: p.order_date,
    };
  });

  res.json({
    podNet, physicalNet, israelNet,
    totalNet, totalGross, totalFees, totalVat,
    currency: payments?.[0]?.currency || 'USD',
    detail,
  });
});

// ---- TAX SCREENSHOT API ----

app.post('/api/tax/analyze-screenshot', async (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: 'Image is required' });

  try {
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
    const mediaType = image.match(/^data:(image\/[a-z]+);/)?.[1] || 'image/jpeg';

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
          { type: 'text', text: 'Extract the following numbers from this Etsy Activity Summary screenshot.\nReturn ONLY valid JSON, no markdown, no explanation.\nFields: total_sales, refunds (positive number), fees (positive number), etsy_ads (positive number), offsite_ads (positive number), etsy_plus (positive number), net_profit.\nCurrency: detect from ₪ or $ symbols — return "ILS" or "USD".\nIf a field is not shown or is "--", return 0.' },
        ]
      }]
    });

    const responseText = message.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Failed to parse AI response' });
    const parsed = JSON.parse(jsonMatch[0]);
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- PRINTIFY API ----

async function getPrintifyToken() {
  // Try env first, then DB setting
  if (process.env.PRINTIFY_API_TOKEN) return process.env.PRINTIFY_API_TOKEN;
  const { data } = await supabase.from('settings').select('value').eq('key', 'printify_api_token').single();
  return data?.value || null;
}

// Get configured POD products from settings
app.get('/api/printify/products', async (req, res) => {
  const { data, error } = await supabase.from('settings').select('value').eq('key', 'pod_products').single();
  if (error || !data) return res.status(500).json({ error: 'pod_products not configured' });
  try {
    res.json(JSON.parse(data.value));
  } catch (e) {
    res.status(500).json({ error: 'Invalid pod_products JSON' });
  }
});

// Get print providers for a blueprint
app.get('/api/printify/blueprints/:blueprintId/variants', async (req, res) => {
  const token = await getPrintifyToken();
  if (!token) return res.status(400).json({ error: 'Printify API token not configured' });
  try {
    const response = await fetch(`https://api.printify.com/v1/catalog/blueprints/${req.params.blueprintId}/print_providers.json`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!response.ok) return res.status(response.status).json({ error: 'Printify API error' });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get variants for a specific blueprint + provider combo
app.get('/api/printify/blueprints/:blueprintId/providers/:providerId/variants', async (req, res) => {
  const token = await getPrintifyToken();
  if (!token) return res.status(400).json({ error: 'Printify API token not configured' });
  try {
    const response = await fetch(`https://api.printify.com/v1/catalog/blueprints/${req.params.blueprintId}/print_providers/${req.params.providerId}/variants.json`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!response.ok) return res.status(response.status).json({ error: 'Printify API error' });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/printify/upload-image', async (req, res) => {
  const { image, filename } = req.body;
  const token = await getPrintifyToken();
  if (!token) return res.status(400).json({ error: 'Printify API token not configured' });
  try {
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
    const response = await fetch('https://api.printify.com/v1/uploads/images.json', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_name: filename || 'design.png', contents: base64Data })
    });
    if (!response.ok) return res.status(response.status).json({ error: 'Printify upload failed' });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/printify/create-product', async (req, res) => {
  const { title, description, blueprint_id, print_provider_id, variants, image_id } = req.body;
  const token = await getPrintifyToken();
  const shopId = process.env.PRINTIFY_SHOP_ID;
  if (!token) return res.status(400).json({ error: 'Printify API token not configured' });
  if (!shopId) return res.status(400).json({ error: 'PRINTIFY_SHOP_ID not configured' });
  try {
    console.log(`[Printify] Creating product in shop ${shopId}: "${title}" (blueprint: ${blueprint_id}, provider: ${print_provider_id})`);
    const response = await fetch(`https://api.printify.com/v1/shops/${shopId}/products.json`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        blueprint_id,
        print_provider_id,
        variants,
        print_areas: [{ variant_ids: variants.map(v => v.id), placeholders: [{ position: 'front', images: [{ id: image_id, x: 0.5, y: 0.5, scale: 1, angle: 0 }] }] }]
      })
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error(`[Printify] Create failed (${response.status}):`, JSON.stringify(errData, null, 2));
      return res.status(response.status).json({ error: errData.message || 'Printify create failed' });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- LISTING GENERATOR API ----

app.post('/api/listing/generate', async (req, res) => {
  const { image, product_type, fields, notes } = req.body;
  if (!image) return res.status(400).json({ error: 'Image is required' });
  if (!product_type) return res.status(400).json({ error: 'Product type is required' });

  // Fetch system prompt and keyword bank
  const [promptRes, keywordsRes] = await Promise.all([
    supabase.from('settings').select('value').eq('key', 'listing_system_prompt').single(),
    supabase.from('settings').select('value').eq('key', 'keyword_bank').single(),
  ]);

  let systemPrompt = promptRes.data?.value || 'You are a listing generator for an Etsy jewelry store.';
  const keywordBank = keywordsRes.data?.value || '[]';

  // Inject keyword bank into prompt
  systemPrompt = systemPrompt.replace('{keyword_bank}', keywordBank);

  const productTypes = {
    necklace: 'שרשרת', bracelet: 'צמיד', ring: 'טבעת',
    challah_cover: 'כיסוי חלה', candles: 'נרות', tefillin_tallit: 'כיסוי תפילין/טלית',
  };

  let userText = `Product type: ${productTypes[product_type] || product_type}\n`;
  if (fields && Object.keys(fields).length > 0) {
    userText += 'Product details:\n';
    for (const [key, val] of Object.entries(fields)) {
      if (val) userText += `- ${key}: ${val}\n`;
    }
  }
  if (notes) userText += `\nAdditional notes: ${notes}`;
  userText += '\n\nPlease respond with valid JSON only: {"title":"...","description":"...","tags":"comma,separated,tags","warning":"...or null"}';

  try {
    // Strip data URL prefix if present
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
    const mediaType = image.match(/^data:(image\/[a-z]+);/)?.[1] || 'image/jpeg';

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
          { type: 'text', text: userText },
        ]
      }]
    });

    const responseText = message.content[0].text;
    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Failed to parse AI response' });

    const parsed = JSON.parse(jsonMatch[0]);
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Jewselry Dashboard running on port ${PORT}`);
});
