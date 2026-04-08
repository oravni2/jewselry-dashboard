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
app.use(express.json());
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

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Jewselry Dashboard running on port ${PORT}`);
});
