// ---- State ----
let categories = [];

// ---- API helpers ----
async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return res.json();
}

// ---- Navigation ----
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const page = link.dataset.page;
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');

    if (page === 'tasks') loadTasks();
    if (page === 'sales') loadSalesPage();
    if (page === 'listing') initListingPage();
    if (page === 'help') renderHelp();
    if (page === 'inventory') loadInventoryPage();
    if (page === 'pod') loadPodPage();
    if (page === 'settings') loadSettings();
  });
});

// ---- Tasks (List View) ----
let allTasks = [];
let currentTaskDetail = null;
const collapsedGroups = new Set();

async function loadTasks() {
  const showAll = document.getElementById('show-all-tasks').checked;
  let url = '/api/tasks?';
  if (!showAll) url += 'assigned_to=david&';

  allTasks = await api(url);
  renderTaskList();
}

function renderTaskList() {
  const search = (document.getElementById('task-search')?.value || '').trim().toLowerCase();
  const tasks = Array.isArray(allTasks) ? allTasks : [];

  const filtered = search
    ? tasks.filter(t => t.title.toLowerCase().includes(search) || (t.description || '').toLowerCase().includes(search))
    : tasks;

  const groups = { open: [], in_progress: [], done: [] };
  filtered.forEach(t => {
    const g = groups[t.status] || groups.open;
    g.push(t);
  });

  const statusLabels = { open: 'לביצוע', in_progress: 'בטיפול', done: 'הושלם' };
  const priorityLabels = { urgent: 'דחוף', high: 'גבוה', normal: 'רגיל', low: 'נמוך' };
  const container = document.getElementById('task-list-view');
  const today = new Date().toISOString().split('T')[0];

  container.innerHTML = ['open', 'in_progress', 'done'].map(status => {
    const items = groups[status];
    const collapsed = collapsedGroups.has(status);

    const rows = collapsed ? '' : items.map(task => {
      const cat = task.categories;
      const catPill = cat ? `<span class="task-chip-cat-pill" style="background:${cat.color}">${escapeHtml(cat.name)}</span>` : '';
      const priorityBadge = task.priority && task.priority !== 'normal'
        ? `<span class="task-chip-priority task-chip-priority-${task.priority}">${priorityLabels[task.priority]}</span>`
        : '';
      const avatar = task.assigned_to === 'david' ? 'ד' : 'א';
      const isDone = task.status === 'done';
      const dueStr = task.due_date ? new Date(task.due_date).toLocaleDateString('he-IL') : '';
      const isOverdue = task.due_date && task.due_date < today && !isDone;
      const selected = currentTaskDetail && currentTaskDetail.id === task.id ? ' task-row-selected' : '';

      return `<div class="task-row ${isDone ? 'done-row' : ''}${selected}" onclick="openSidePanel('${task.id}')">
        <button class="task-row-check ${isDone ? 'checked' : ''}" onclick="event.stopPropagation(); toggleTaskStatus('${task.id}', '${task.status}')"></button>
        <span class="task-row-title">${escapeHtml(task.title)}</span>
        <div class="task-row-chips">
          ${priorityBadge}
          ${catPill}
          ${dueStr ? `<span class="task-chip-due ${isOverdue ? 'overdue' : ''}">${dueStr}</span>` : ''}
          <span class="task-chip-avatar">${avatar}</span>
        </div>
        <div class="task-row-actions" onclick="event.stopPropagation()">
          <button class="task-row-action" onclick="openSidePanel('${task.id}')" title="ערוך">✏️</button>
        </div>
      </div>`;
    }).join('');

    const inlineAdd = collapsed ? '' : `<div class="task-inline-add" onclick="startInlineAdd('${status}', this)">
      <span>+</span> <span>משימה חדשה</span>
    </div>`;

    return `<div class="task-group">
      <div class="task-group-header ${collapsed ? 'collapsed' : ''}" onclick="toggleGroup('${status}')">
        <span class="task-group-arrow">▼</span>
        <span class="task-group-name task-group-name-${status}">${statusLabels[status]}</span>
        <span class="task-group-count">${items.length}</span>
      </div>
      <div class="task-group-items">${rows}${inlineAdd}</div>
    </div>`;
  }).join('');
}

window.toggleGroup = function(status) {
  if (collapsedGroups.has(status)) collapsedGroups.delete(status);
  else collapsedGroups.add(status);
  renderTaskList();
};

window.toggleTaskStatus = async function(id, currentStatus) {
  const newStatus = currentStatus === 'done' ? 'open' : 'done';
  await api('/api/tasks/' + id, { method: 'PATCH', body: { status: newStatus } });
  loadTasks();
};

window.startInlineAdd = function(status, el) {
  const parent = el.parentElement;
  el.style.display = 'none';
  const row = document.createElement('div');
  row.className = 'task-row';
  row.innerHTML = `<input class="task-inline-input" type="text" placeholder="הזן שם משימה..." autofocus onkeydown="if(event.key==='Enter')submitInlineAdd('${status}',this); if(event.key==='Escape'){this.parentElement.remove(); document.querySelector('.task-inline-add')&&(document.querySelector('.task-inline-add').style.display='flex');}">`;
  parent.insertBefore(row, el);
  row.querySelector('input').focus();
};

window.submitInlineAdd = async function(status, input) {
  const title = input.value.trim();
  if (!title) { input.parentElement.remove(); renderTaskList(); return; }
  await api('/api/tasks', { method: 'POST', body: { title, status, assigned_to: 'david' } });
  loadTasks();
};

// Side panel
window.openSidePanel = function(id) {
  const task = allTasks.find(t => t.id === id);
  if (!task) return;
  currentTaskDetail = task;

  document.getElementById('side-panel-title').value = task.title || '';
  document.getElementById('side-panel-desc').value = task.description || '';
  document.getElementById('side-panel-status').value = task.status || 'open';
  document.getElementById('side-panel-priority').value = task.priority || 'normal';
  document.getElementById('side-panel-due').value = task.due_date || '';
  document.getElementById('side-panel-assigned').value = task.assigned_to || 'david';

  // Populate category select
  const catSelect = document.getElementById('side-panel-category');
  catSelect.innerHTML = '<option value="">ללא</option>';
  categories.forEach(cat => {
    catSelect.innerHTML += `<option value="${cat.id}" ${cat.id === task.category_id ? 'selected' : ''}>${escapeHtml(cat.name)}</option>`;
  });

  document.getElementById('task-detail-modal').style.display = 'flex';
  renderTaskList();
};

function closeTaskModal() {
  document.getElementById('task-detail-modal').style.display = 'none';
  currentTaskDetail = null;
  renderTaskList();
}

document.getElementById('btn-close-side-panel').addEventListener('click', closeTaskModal);

// Close on overlay click
document.getElementById('task-detail-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('task-detail-modal')) closeTaskModal();
});

// Close on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.getElementById('task-detail-modal').style.display === 'flex') {
    closeTaskModal();
  }
});

document.getElementById('btn-side-panel-save').addEventListener('click', async () => {
  if (!currentTaskDetail) return;
  const body = {
    title: document.getElementById('side-panel-title').value,
    description: document.getElementById('side-panel-desc').value || null,
    status: document.getElementById('side-panel-status').value,
    priority: document.getElementById('side-panel-priority').value,
    due_date: document.getElementById('side-panel-due').value || null,
    assigned_to: document.getElementById('side-panel-assigned').value,
    category_id: document.getElementById('side-panel-category').value || null,
  };
  const result = await api('/api/tasks/' + currentTaskDetail.id, { method: 'PATCH', body });
  if (result.error) { alert('שגיאה: ' + result.error); return; }
  closeTaskModal();
  loadTasks();
});

document.getElementById('btn-side-panel-delete').addEventListener('click', async () => {
  if (!currentTaskDetail) return;
  if (!confirm(`למחוק את המשימה "${currentTaskDetail.title}"?`)) return;
  await api('/api/tasks/' + currentTaskDetail.id, { method: 'PATCH', body: { status: 'done' } });
  closeTaskModal();
  loadTasks();
});

// Filter & search listeners
document.getElementById('show-all-tasks').addEventListener('change', loadTasks);
document.getElementById('task-search').addEventListener('input', renderTaskList);

// Add task modal
const taskModal = document.getElementById('task-modal');

document.getElementById('btn-add-task').addEventListener('click', () => {
  document.getElementById('modal-title').textContent = 'משימה חדשה';
  document.getElementById('task-form').reset();
  document.getElementById('task-id').value = '';
  populateCategorySelect();
  taskModal.style.display = 'flex';
});

document.getElementById('btn-cancel-task').addEventListener('click', () => {
  taskModal.style.display = 'none';
});

taskModal.querySelector('.modal-backdrop').addEventListener('click', () => {
  taskModal.style.display = 'none';
});

document.getElementById('task-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('task-id').value;
  const body = {
    title: document.getElementById('task-title').value,
    description: document.getElementById('task-desc').value || null,
    due_date: document.getElementById('task-due').value || null,
    category_id: document.getElementById('task-category').value || null,
    assigned_to: document.getElementById('task-assigned').value,
    priority: document.getElementById('task-priority').value || 'normal',
  };

  if (id) {
    await api('/api/tasks/' + id, { method: 'PATCH', body });
  } else {
    await api('/api/tasks', { method: 'POST', body });
  }

  taskModal.style.display = 'none';
  loadTasks();
});

function populateCategorySelect() {
  const select = document.getElementById('task-category');
  select.innerHTML = '<option value="">ללא</option>';
  categories.forEach(cat => {
    select.innerHTML += `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`;
  });
}

// AI category suggestion (debounced)
let aiCatTimer = null;
document.getElementById('task-title').addEventListener('input', (e) => {
  clearTimeout(aiCatTimer);
  const title = e.target.value.trim();
  if (title.length < 5) { document.getElementById('task-ai-category').style.display = 'none'; return; }
  aiCatTimer = setTimeout(async () => {
    const result = await api('/api/tasks/0/ai-category', { method: 'POST', body: { title } });
    if (result.category) {
      const el = document.getElementById('task-ai-category');
      el.textContent = `הצעת קטגוריה: ${result.category}`;
      el.style.display = 'block';
      el.style.cursor = 'pointer';
      el.onclick = () => {
        // Try to select matching category
        const select = document.getElementById('task-category');
        const match = [...select.options].find(o => o.textContent === result.category);
        if (match) select.value = match.value;
        el.style.display = 'none';
      };
    }
  }, 800);
});

// ---- Customer Service ----
document.getElementById('btn-generate-reply').addEventListener('click', async () => {
  const customerMsg = document.getElementById('cs-customer-msg').value.trim();
  if (!customerMsg) return;

  const davidNotes = document.getElementById('cs-david-notes').value.trim();
  const outputDiv = document.getElementById('cs-output');
  const loadingDiv = document.getElementById('cs-loading');
  const btn = document.getElementById('btn-generate-reply');

  btn.disabled = true;
  outputDiv.style.display = 'none';
  document.getElementById('cs-empty-state').style.display = 'none';
  loadingDiv.style.display = 'flex';

  try {
    const result = await api('/api/cs/generate', {
      method: 'POST',
      body: { customer_message: customerMsg, david_notes: davidNotes || undefined },
    });

    if (result.error) {
      alert('שגיאה: ' + result.error);
      return;
    }

    const text = result.response;
    // Split response into Hebrew summary and English reply
    const stripMd = (s) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/^#{1,6}\s+/gm, '');
    const summaryMatch = text.match(/סיכום:?\s*([\s\S]*?)(?=Reply:|$)/i);
    const replyMatch = text.match(/Reply:?\s*([\s\S]*?)(?=תרגום לעברית:|$)/i);
    const translationMatch = text.match(/תרגום לעברית:?\s*([\s\S]*)/i);

    document.getElementById('cs-summary').textContent = summaryMatch
      ? stripMd(summaryMatch[1].trim())
      : stripMd(text);
    document.getElementById('cs-reply').textContent = replyMatch
      ? stripMd(replyMatch[1].trim())
      : '';
    document.getElementById('cs-translation').textContent = translationMatch
      ? stripMd(translationMatch[1].trim())
      : '';

    outputDiv.style.display = 'flex';
  } catch (err) {
    alert('שגיאה: ' + err.message);
  } finally {
    btn.disabled = false;
    loadingDiv.style.display = 'none';
  }
});

document.getElementById('btn-copy-reply').addEventListener('click', () => {
  const replyText = document.getElementById('cs-reply').textContent;
  navigator.clipboard.writeText(replyText).then(() => {
    const btn = document.getElementById('btn-copy-reply');
    btn.textContent = 'הועתק!';
    setTimeout(() => { btn.textContent = 'העתק'; }, 1500);
  });
});

document.getElementById('btn-copy-translation').addEventListener('click', () => {
  const text = document.getElementById('cs-translation').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('btn-copy-translation');
    btn.textContent = 'הועתק!';
    setTimeout(() => { btn.textContent = 'העתק'; }, 1500);
  });
});

// Save CS message as task
document.getElementById('btn-save-cs-task').addEventListener('click', async () => {
  const customerMsg = document.getElementById('cs-customer-msg').value.trim();
  if (!customerMsg) return alert('יש להזין הודעת לקוח');

  const davidNotes = document.getElementById('cs-david-notes').value.trim();
  const btn = document.getElementById('btn-save-cs-task');
  btn.disabled = true;

  // Find or create "שירות לקוחות" category
  let catId = null;
  const cats = await api('/api/categories');
  if (Array.isArray(cats)) {
    const existing = cats.find(c => c.name === 'שירות לקוחות');
    if (existing) {
      catId = existing.id;
    } else {
      const newCat = await api('/api/categories', { method: 'POST', body: { name: 'שירות לקוחות', color: '#3b82f6' } });
      if (newCat.id) catId = newCat.id;
    }
  }

  const title = 'מענה ללקוח — ' + customerMsg.slice(0, 50);
  const description = 'הודעת לקוח:\n' + customerMsg + (davidNotes ? '\n\nהערות:\n' + davidNotes : '');

  await api('/api/tasks', {
    method: 'POST',
    body: { title, description, assigned_to: 'david', category_id: catId },
  });

  const msg = document.getElementById('cs-task-saved-msg');
  msg.style.display = 'inline';
  setTimeout(() => { msg.style.display = 'none'; }, 2000);
  btn.disabled = false;
});

// ---- Settings ----
async function loadSettings() {
  // Load system prompt
  const promptData = await api('/api/settings/cs_system_prompt');
  document.getElementById('settings-prompt').value = promptData.error ? '' : (promptData.value || '');

  // Load listing prompt
  const listingPromptData = await api('/api/settings/listing_system_prompt');
  document.getElementById('settings-listing-prompt').value = listingPromptData.error ? '' : (listingPromptData.value || '');

  // Load Printify token
  const printifyData = await api('/api/settings/printify_api_token');
  document.getElementById('settings-printify-token').value = printifyData.error ? '' : (printifyData.value || '');

  // Load accountant email
  const accountantData = await api('/api/settings/accountant_email');
  document.getElementById('settings-accountant-email').value = accountantData.error ? '' : (accountantData.value || '');

  // Load categories
  await loadCategories();
}

document.getElementById('btn-save-prompt').addEventListener('click', async () => {
  const value = document.getElementById('settings-prompt').value;
  await api('/api/settings/cs_system_prompt', {
    method: 'PUT',
    body: { value },
  });
  const msg = document.getElementById('prompt-saved-msg');
  msg.style.display = 'inline';
  setTimeout(() => { msg.style.display = 'none'; }, 2000);
});

document.getElementById('btn-save-accountant-email').addEventListener('click', async () => {
  const value = document.getElementById('settings-accountant-email').value;
  await api('/api/settings/accountant_email', { method: 'PUT', body: { value } });
  const msg = document.getElementById('accountant-email-saved-msg');
  msg.style.display = 'inline';
  setTimeout(() => { msg.style.display = 'none'; }, 2000);
});

document.getElementById('btn-save-printify-token').addEventListener('click', async () => {
  const value = document.getElementById('settings-printify-token').value;
  await api('/api/settings/printify_api_token', { method: 'PUT', body: { value } });
  const msg = document.getElementById('printify-token-saved-msg');
  msg.style.display = 'inline';
  setTimeout(() => { msg.style.display = 'none'; }, 2000);
});

document.getElementById('btn-save-listing-prompt').addEventListener('click', async () => {
  const value = document.getElementById('settings-listing-prompt').value;
  await api('/api/settings/listing_system_prompt', { method: 'PUT', body: { value } });
  const msg = document.getElementById('listing-prompt-saved-msg');
  msg.style.display = 'inline';
  setTimeout(() => { msg.style.display = 'none'; }, 2000);
});

// ---- Categories ----
async function loadCategories() {
  categories = await api('/api/categories');
  renderCategories();
}

function renderCategories() {
  const container = document.getElementById('categories-list');
  if (!categories.length) {
    container.innerHTML = '<div class="empty-state" style="padding:1rem;">אין קטגוריות</div>';
    return;
  }
  container.innerHTML = categories.map(cat => `
    <div class="category-item">
      <div class="cat-dot" style="background:${cat.color}"></div>
      <span>${escapeHtml(cat.name)}</span>
      <button class="btn-small" onclick="editCategory('${cat.id}')">ערוך</button>
      <button class="btn-danger" onclick="deleteCategory('${cat.id}', '${escapeHtml(cat.name)}')">מחק</button>
    </div>
  `).join('');
}

document.getElementById('btn-add-category').addEventListener('click', async () => {
  const name = document.getElementById('new-cat-name').value.trim();
  const color = document.getElementById('new-cat-color').value;
  if (!name) return;

  await api('/api/categories', { method: 'POST', body: { name, color } });
  document.getElementById('new-cat-name').value = '';
  await loadCategories();
});

// Edit category modal
const catModal = document.getElementById('category-modal');

window.editCategory = function(id) {
  const cat = categories.find(c => c.id === id);
  if (!cat) return;
  document.getElementById('edit-cat-id').value = cat.id;
  document.getElementById('edit-cat-name').value = cat.name;
  document.getElementById('edit-cat-color').value = cat.color;
  catModal.style.display = 'flex';
};

document.getElementById('btn-cancel-cat').addEventListener('click', () => {
  catModal.style.display = 'none';
});

catModal.querySelector('.modal-backdrop').addEventListener('click', () => {
  catModal.style.display = 'none';
});

document.getElementById('category-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-cat-id').value;
  const name = document.getElementById('edit-cat-name').value;
  const color = document.getElementById('edit-cat-color').value;

  await api('/api/categories/' + id, {
    method: 'PUT',
    body: { name, color },
  });
  catModal.style.display = 'none';
  await loadCategories();
});

window.deleteCategory = async function(id, name) {
  if (!confirm(`למחוק את הקטגוריה "${name}"?`)) return;
  await api('/api/categories/' + id, { method: 'DELETE' });
  await loadCategories();
};

// ---- Sales Analytics ----
let salesMonths = [];
let parsedCsvRows = [];

// Sales tab switching
document.querySelectorAll('.sales-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    tab.closest('main').querySelectorAll('.sales-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    tab.closest('main').querySelectorAll('.sales-tab-content').forEach(c => { c.classList.remove('active'); c.style.display = 'none'; });
    const target = document.getElementById(tab.dataset.salesTab);
    if (!target) return;
    target.classList.add('active');
    target.style.display = 'block';

    if (tab.dataset.salesTab === 'tax-content') loadTaxReport();
  });
});

async function loadSalesPage() {
  // Load available months
  salesMonths = await api('/api/sales/months');
  const monthSelect = document.getElementById('sales-month');

  const taxMonthSelect = document.getElementById('tax-month');
  if (Array.isArray(salesMonths) && salesMonths.length > 0) {
    const opts = salesMonths.map(m => `<option value="${m}">${formatMonth(m)}</option>`).join('');
    monthSelect.innerHTML = opts;
    taxMonthSelect.innerHTML = '<option value="">בחר חודש</option>' + opts;
  } else {
    // Default to current month
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    monthSelect.innerHTML = `<option value="${currentMonth}">${formatMonth(currentMonth)}</option>`;
    taxMonthSelect.innerHTML = `<option value="">בחר חודש</option><option value="${currentMonth}">${formatMonth(currentMonth)}</option>`;
  }

  loadSalesData();
}

async function loadSalesData() {
  const month = document.getElementById('sales-month').value;
  const type = document.getElementById('sales-type').value;
  const diamond = document.getElementById('sales-diamond-filter').checked;
  if (!month) return;

  let summaryUrl = `/api/sales/summary?month=${month}`;
  if (diamond) summaryUrl += '&diamond=true';
  const summary = await api(summaryUrl);

  if (summary.error) return;

  renderKPIs(summary, type);
  renderTypeBreakdown(summary.current, type);
  renderBestsellers(summary.current, type);

  // Fetch raw rows for daily chart
  let salesUrl = `/api/sales?month=${month}`;
  if (type) salesUrl += `&listing_type=${type}`;
  if (diamond) salesUrl += '&diamond=true';
  const salesRows = await api(salesUrl);
  renderDailyChart(salesRows, month);
  renderCountryBreakdown(salesRows);

  // Diamond table
  const diamondSection = document.getElementById('diamond-section');
  if (diamond) {
    renderDiamondTable(salesRows);
    diamondSection.style.display = 'block';
  } else {
    diamondSection.style.display = 'none';
  }
}

function renderKPIs(summary, typeFilter) {
  let cur = summary.current;
  let prev = summary.previous;

  // If type filter is active, use only that type's data
  if (typeFilter) {
    const ct = cur.byType[typeFilter] || { revenue: 0, orders: 0, items: 0 };
    const pt = prev.byType[typeFilter] || { revenue: 0, orders: 0, items: 0 };
    cur = { revenue: ct.revenue, orders: ct.orders, items: ct.items };
    prev = { revenue: pt.revenue, orders: pt.orders, items: pt.items };
  }

  document.getElementById('kpi-revenue').textContent = '$' + formatNumber(cur.revenue);
  document.getElementById('kpi-orders').textContent = formatNumber(cur.orders);
  document.getElementById('kpi-items').textContent = formatNumber(cur.items);
  const curAov = cur.orders > 0 ? (cur.revenue / cur.orders).toFixed(2) : '0.00';
  const prevAov = prev.orders > 0 ? (prev.revenue / prev.orders) : 0;
  document.getElementById('kpi-aov').textContent = '$' + curAov;

  setChangeIndicator('kpi-revenue-change', cur.revenue, prev.revenue);
  setChangeIndicator('kpi-orders-change', cur.orders, prev.orders);
  setChangeIndicator('kpi-items-change', cur.items, prev.items);
  setChangeIndicator('kpi-aov-change', parseFloat(curAov), prevAov);
}

function setChangeIndicator(elementId, current, previous) {
  const el = document.getElementById(elementId);
  if (!previous || previous === 0) {
    if (current > 0) {
      el.textContent = 'חדש';
      el.className = 'kpi-change neutral';
    } else {
      el.textContent = '';
      el.className = 'kpi-change';
    }
    return;
  }
  const pct = ((current - previous) / previous * 100).toFixed(0);
  if (pct > 0) {
    el.textContent = `+${pct}% מהחודש הקודם`;
    el.className = 'kpi-change positive';
  } else if (pct < 0) {
    el.textContent = `${pct}% מהחודש הקודם`;
    el.className = 'kpi-change negative';
  } else {
    el.textContent = 'ללא שינוי';
    el.className = 'kpi-change neutral';
  }
}

function renderTypeBreakdown(data, typeFilter) {
  const container = document.getElementById('type-breakdown');
  const types = ['digital', 'pod', 'physical'];
  const labels = { digital: 'דיגיטלי', pod: 'POD', physical: 'פיזי' };

  if (!data.byType || Object.keys(data.byType).length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:1rem;">אין נתונים להצגה</div>';
    return;
  }

  const maxRevenue = Math.max(...types.map(t => (data.byType[t]?.revenue || 0)));

  container.innerHTML = types
    .filter(t => !typeFilter || t === typeFilter)
    .filter(t => (data.byType[t]?.orders || 0) > 0)
    .map(t => {
      const info = data.byType[t] || { revenue: 0, orders: 0, items: 0 };
      const pct = maxRevenue > 0 ? (info.revenue / maxRevenue * 100) : 0;
      return `
        <div class="type-row">
          <div class="type-row-header">
            <div class="type-label"><span class="type-dot ${t}"></span>${labels[t]}</div>
            <div class="type-stats">${info.orders} הזמנות · ${info.items} פריטים · <strong>$${formatNumber(info.revenue)}</strong></div>
          </div>
          <div class="type-bar-wrap">
            <div class="type-bar ${t}" style="width:${pct}%"></div>
          </div>
        </div>
      `;
    }).join('');
}

function renderBestsellers(data, typeFilter) {
  const container = document.getElementById('bestsellers-list');
  let items = data.bestsellers || [];

  // Note: bestsellers are already computed server-side from the full month data
  // Type filtering on bestsellers would need per-item type info; skip for now since
  // the server doesn't track listing_type per bestseller aggregation
  if (!items.length) {
    container.innerHTML = '<div class="empty-state" style="padding:1rem;">אין נתונים להצגה</div>';
    return;
  }

  container.innerHTML = items.map((item, i) => `
    <div class="bestseller-item">
      <div class="bestseller-rank">${i + 1}</div>
      <div class="bestseller-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
      <div class="bestseller-qty">${item.quantity} יח'</div>
      <div class="bestseller-rev">$${formatNumber(item.revenue)}</div>
    </div>
  `).join('');
}

function renderCountryBreakdown(rows) {
  const container = document.getElementById('country-breakdown');
  if (!container) return;

  if (!Array.isArray(rows) || rows.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:1rem;">אין נתונים להצגה</div>';
    return;
  }

  const countryMap = {};
  rows.forEach(r => {
    const c = r.country || 'לא ידוע';
    if (!countryMap[c]) countryMap[c] = { revenue: 0, orders: new Set() };
    countryMap[c].revenue += (Number(r.price) * r.quantity) - (Number(r.discount) || 0);
    countryMap[c].orders.add(r.order_id);
  });

  const sorted = Object.entries(countryMap)
    .map(([name, d]) => ({ name, revenue: d.revenue, orders: d.orders.size }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  container.innerHTML = sorted.map((c, i) => `
    <div class="country-item">
      <div class="country-rank">${i + 1}</div>
      <div class="country-name">${escapeHtml(c.name)}</div>
      <div class="country-orders">${c.orders} הזמנות</div>
      <div class="country-rev">$${formatNumber(c.revenue)}</div>
    </div>
  `).join('');
}

let dailyChartInstance = null;

function renderDailyChart(rows, month) {
  const canvas = document.getElementById('daily-sales-canvas');
  if (!canvas) return;

  // Destroy previous chart
  if (dailyChartInstance) {
    dailyChartInstance.destroy();
    dailyChartInstance = null;
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    canvas.style.display = 'none';
    return;
  }
  canvas.style.display = 'block';

  // Aggregate revenue by day
  const dailyMap = {};
  rows.forEach(r => {
    const day = r.sale_date;
    if (!dailyMap[day]) dailyMap[day] = 0;
    dailyMap[day] += (Number(r.price) * r.quantity) - (Number(r.discount) || 0);
  });

  // Build full date range for the month
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const labels = [];
  const data = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${month}-${String(d).padStart(2, '0')}`;
    labels.push(String(d));
    data.push(dailyMap[dateStr] || 0);
  }

  const ctx = canvas.getContext('2d');
  dailyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'הכנסות ($)',
        data,
        backgroundColor: 'rgba(92, 122, 94, 0.6)',
        borderColor: 'rgba(74, 106, 76, 0.8)',
        borderWidth: 1,
        borderRadius: 3,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => `יום ${items[0].label}`,
            label: (item) => `$${Number(item.raw).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 }, color: '#78716c' },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: {
            font: { size: 11 },
            color: '#78716c',
            callback: (v) => '$' + v.toLocaleString(),
          },
        }
      }
    }
  });
}

// Sales filter listeners
document.getElementById('sales-month').addEventListener('change', loadSalesData);
document.getElementById('sales-type').addEventListener('change', loadSalesData);
document.getElementById('sales-diamond-filter').addEventListener('change', loadSalesData);

// Diamond table
function renderDiamondTable(rows) {
  const tbody = document.getElementById('diamond-table-body');
  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state" style="padding:1.5rem;">אין הזמנות יהלומים בחודש זה</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.sale_date ? new Date(r.sale_date).toLocaleDateString('he-IL') : ''}</td>
      <td class="diamond-item-name" title="${escapeHtml(r.item_name)}">${escapeHtml(r.item_name)}</td>
      <td>${r.quantity}</td>
      <td>$${Number(r.price).toFixed(2)}</td>
      <td>${r.discount ? '$' + Number(r.discount).toFixed(2) : '-'}</td>
      <td>${r.shipping_discount ? '$' + Number(r.shipping_discount).toFixed(2) : '-'}</td>
      <td>${r.order_shipping ? '$' + Number(r.order_shipping).toFixed(2) : '-'}</td>
      <td class="diamond-variations">${r.variations ? escapeHtml(r.variations) : '-'}</td>
    </tr>
  `).join('');
}

// Export diamonds to Excel
document.getElementById('btn-export-diamonds').addEventListener('click', () => {
  const table = document.getElementById('diamond-table');
  if (!table) return;
  const wb = XLSX.utils.table_to_book(table, { sheet: 'Diamonds' });
  const month = document.getElementById('sales-month').value || 'export';
  XLSX.writeFile(wb, `jewselry-diamonds-${month}.xlsx`);
});

// CSV Upload Modal
const csvModal = document.getElementById('csv-modal');

document.getElementById('btn-upload-csv').addEventListener('click', () => {
  // Reset modal state
  document.getElementById('csv-file').value = '';
  document.getElementById('csv-file-name').textContent = '';
  document.getElementById('csv-preview').style.display = 'none';
  document.getElementById('csv-import-result').style.display = 'none';
  document.getElementById('btn-import-csv').disabled = true;
  parsedCsvRows = [];

  // Default month to current
  const now = new Date();
  document.getElementById('csv-month').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  csvModal.style.display = 'flex';
});

document.getElementById('btn-cancel-csv').addEventListener('click', () => {
  csvModal.style.display = 'none';
});

csvModal.querySelector('.modal-backdrop').addEventListener('click', () => {
  csvModal.style.display = 'none';
});

// CSV file handling
document.getElementById('csv-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  document.getElementById('csv-file-name').textContent = file.name;
  parseCSVFile(file);
  e.target.value = '';
});

// Drag and drop
const dropZone = document.getElementById('csv-drop-zone');
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('dragover'); });
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.name.endsWith('.csv')) {
    document.getElementById('csv-file-name').textContent = file.name;
    parseCSVFile(file);
  }
});

function parseCSVFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 2) return;

    const headers = parseCSVLine(lines[0]).map(h => h.trim());
    parsedCsvRows = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length < 2) continue;

      const row = {};
      headers.forEach((h, idx) => { row[h] = (cols[idx] || '').trim(); });

      // Map Etsy CSV columns to our schema
      const mapped = mapEtsyRow(row);
      if (mapped) parsedCsvRows.push(mapped);
    }

    document.getElementById('csv-row-count').textContent = `${parsedCsvRows.length} שורות זוהו בקובץ`;
    document.getElementById('csv-preview').style.display = 'block';
    document.getElementById('btn-import-csv').disabled = parsedCsvRows.length === 0;
  };
  reader.readAsText(file);
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function detectListingType(sku) {
  if (!sku || sku.trim() === '') return 'physical';
  if (sku.startsWith('JS')) return 'physical';
  if (/^\d+$/.test(sku)) return 'pod'; // Printify — numeric only
  return 'pod'; // Teelaunch and other POD — alphanumeric, not starting with JS
}

function mapEtsyRow(row) {
  // Etsy EtsySoldOrderItems CSV — exact column names
  const orderId = row['Order ID'] || '';
  const itemName = row['Item Name'] || '';
  const quantity = parseInt(row['Quantity'] || '1', 10) || 1;
  const priceStr = (row['Price'] || '0').replace(/[^0-9.\-]/g, '');
  const price = parseFloat(priceStr) || 0;
  const discountStr = (row['Discount Amount'] || '0').replace(/[^0-9.\-]/g, '');
  const discount = parseFloat(discountStr) || 0;
  const sku = row['SKU'] || null;
  const country = row['Ship Country'] || null;
  const saleDateRaw = row['Sale Date'] || '';
  const shippingDiscountStr = (row['Shipping Discount'] || '0').replace(/[^0-9.\-]/g, '');
  const shippingDiscount = parseFloat(shippingDiscountStr) || null;
  const orderShippingStr = (row['Order Shipping'] || '0').replace(/[^0-9.\-]/g, '');
  const orderShipping = parseFloat(orderShippingStr) || null;
  const variations = row['Variations'] || null;
  const listingsType = row['Listings Type'] || null;

  if (!orderId || !itemName) return null;

  // Parse date
  let saleDate = '';
  if (saleDateRaw) {
    const d = new Date(saleDateRaw);
    if (!isNaN(d.getTime())) {
      saleDate = d.toISOString().split('T')[0];
    }
  }
  if (!saleDate) {
    saleDate = new Date().toISOString().split('T')[0];
  }

  // Use Listings Type from CSV if available, otherwise detect from SKU
  let listingType = 'physical';
  if (listingsType) {
    const lt = listingsType.toLowerCase();
    if (lt === 'digital') listingType = 'digital';
    else if (lt === 'physical') listingType = 'physical';
    else listingType = detectListingType(sku);
  } else {
    listingType = detectListingType(sku);
  }

  return {
    order_id: orderId,
    item_name: itemName,
    quantity,
    price,
    discount: discount || null,
    sku,
    listing_type: listingType,
    country,
    sale_date: saleDate,
    shipping_discount: shippingDiscount,
    order_shipping: orderShipping,
    variations,
  };
}

// Import button
document.getElementById('btn-import-csv').addEventListener('click', async () => {
  const reportMonth = document.getElementById('csv-month').value;
  if (!reportMonth || parsedCsvRows.length === 0) return;

  const btn = document.getElementById('btn-import-csv');
  btn.disabled = true;
  btn.textContent = 'מייבא...';

  const result = await api('/api/sales/import', {
    method: 'POST',
    body: { rows: parsedCsvRows, report_month: reportMonth },
  });

  const resultDiv = document.getElementById('csv-import-result');
  resultDiv.style.display = 'block';

  if (result.error) {
    resultDiv.className = 'import-result error';
    resultDiv.textContent = 'שגיאה: ' + result.error;
  } else {
    resultDiv.className = 'import-result success';
    resultDiv.textContent = `יובאו ${result.imported} שורות בהצלחה. ${result.skipped > 0 ? `${result.skipped} כפילויות דולגו.` : ''}`;
    // Refresh sales data
    setTimeout(() => {
      csvModal.style.display = 'none';
      loadSalesPage();
    }, 1500);
  }

  btn.textContent = 'ייבוא';
  btn.disabled = false;
});

// Sales helpers
function formatMonth(ym) {
  const [y, m] = ym.split('-');
  const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

function formatNumber(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// ---- Tax Report ----
let taxPaymentData = null;

async function loadTaxReport() {
  const month = document.getElementById('tax-month').value;
  if (!month) return;

  const data = await api(`/api/payments/tax-report?month=${month}`);
  if (data.error) return;

  taxPaymentData = data;
  const currencySymbol = data.currency === 'ILS' ? '₪' : data.currency === 'USD' ? '$' : (data.currency || '$') + ' ';
  const fmt = (n) => currencySymbol + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  document.getElementById('tax-pod-net').textContent = fmt(data.podNet);
  document.getElementById('tax-physical-net').textContent = fmt(data.physicalNet);
  document.getElementById('tax-israel-net').textContent = fmt(data.israelNet);
  document.getElementById('tax-total-net').textContent = fmt(data.totalNet);
  document.getElementById('tax-total-fees').textContent = fmt(data.totalFees);

  // Update marketing & profit KPIs from extracted screenshot data
  updateTaxMarketingKPIs();

  // Detail table
  const tbody = document.getElementById('tax-detail-body');
  if (!data.detail || data.detail.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state" style="padding:1.5rem;">אין נתונים</td></tr>';
    return;
  }

  const typeLabels = { digital: 'דיגיטלי', pod: 'POD', physical: 'פיזי' };
  tbody.innerHTML = data.detail.map(r => `
    <tr>
      <td>${escapeHtml(r.order_id)}</td>
      <td class="diamond-item-name" title="${escapeHtml(r.item_name)}">${escapeHtml(r.item_name)}</td>
      <td>${typeLabels[r.listing_type] || r.listing_type || '-'}</td>
      <td>${escapeHtml(r.country) || '-'}</td>
      <td>${currencySymbol}${Number(r.gross_amount).toFixed(2)}</td>
      <td>${currencySymbol}${Number(r.net_amount).toFixed(2)}</td>
      <td>${currencySymbol}${Number(r.fees).toFixed(2)}</td>
      <td>${currencySymbol}${Number(r.vat_amount).toFixed(2)}</td>
    </tr>
  `).join('');
}

// Tax screenshot analysis
let taxScreenshotBase64 = null;
let taxExtractedCurrency = '$';

const taxScreenDrop = document.getElementById('tax-screenshot-drop');
const taxScreenInput = document.getElementById('tax-screenshot-input');

taxScreenDrop.addEventListener('click', () => taxScreenInput.click());
taxScreenDrop.addEventListener('dragover', (e) => { e.preventDefault(); taxScreenDrop.classList.add('dragover'); });
taxScreenDrop.addEventListener('dragleave', () => taxScreenDrop.classList.remove('dragover'));
taxScreenDrop.addEventListener('drop', (e) => {
  e.preventDefault(); taxScreenDrop.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) handleTaxScreenshot(file);
});
taxScreenInput.addEventListener('change', (e) => { if (e.target.files[0]) { handleTaxScreenshot(e.target.files[0]); e.target.value = ''; } });

function handleTaxScreenshot(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    taxScreenshotBase64 = e.target.result;
    document.getElementById('tax-screenshot-img').src = taxScreenshotBase64;
    document.getElementById('tax-screenshot-preview').style.display = 'block';
    document.getElementById('tax-screenshot-placeholder').style.display = 'none';
    document.getElementById('btn-analyze-screenshot').disabled = false;
  };
  reader.readAsDataURL(file);
}

document.getElementById('btn-analyze-screenshot').addEventListener('click', async () => {
  if (!taxScreenshotBase64) return;
  const btn = document.getElementById('btn-analyze-screenshot');
  const loading = document.getElementById('tax-screenshot-loading');
  btn.disabled = true;
  loading.style.display = 'flex';

  try {
    const result = await api('/api/tax/analyze-screenshot', {
      method: 'POST',
      body: { image: taxScreenshotBase64 },
    });
    if (result.error) { alert('שגיאה: ' + result.error); return; }

    taxExtractedCurrency = result.currency === 'ILS' ? '₪' : '$';
    document.getElementById('tax-ex-total-sales').value = result.total_sales || 0;
    document.getElementById('tax-ex-refunds').value = result.refunds || 0;
    document.getElementById('tax-ex-fees').value = result.fees || 0;
    document.getElementById('tax-ex-etsy-ads').value = result.etsy_ads || 0;
    document.getElementById('tax-ex-offsite-ads').value = result.offsite_ads || 0;
    document.getElementById('tax-ex-etsy-plus').value = result.etsy_plus || 0;
    document.getElementById('tax-ex-net-profit').value = result.net_profit || 0;
    document.getElementById('tax-extracted-data').style.display = 'block';
    updateTaxMarketingKPIs();
    // Hide upload UI, show success message
    document.getElementById('tax-screenshot-drop').style.display = 'none';
    document.getElementById('btn-analyze-screenshot').style.display = 'none';
    document.getElementById('tax-screenshot-success').style.display = 'flex';
  } catch (err) {
    alert('שגיאה: ' + err.message);
  } finally {
    btn.disabled = false;
    loading.style.display = 'none';
  }
});

// Replace screenshot button
document.getElementById('btn-replace-screenshot').addEventListener('click', () => {
  taxScreenshotBase64 = null;
  document.getElementById('tax-screenshot-drop').style.display = 'flex';
  document.getElementById('tax-screenshot-preview').style.display = 'none';
  document.getElementById('tax-screenshot-placeholder').style.display = 'flex';
  document.getElementById('btn-analyze-screenshot').style.display = '';
  document.getElementById('btn-analyze-screenshot').disabled = true;
  document.getElementById('tax-screenshot-success').style.display = 'none';
  document.getElementById('tax-screenshot-input').value = '';
});

// Recalculate on manual edits
document.querySelectorAll('.tax-extracted-grid input').forEach(input => {
  input.addEventListener('input', updateTaxMarketingKPIs);
});

function updateTaxMarketingKPIs() {
  const sym = taxExtractedCurrency || '$';
  const ads = parseFloat(document.getElementById('tax-ex-etsy-ads')?.value) || 0;
  const offsite = parseFloat(document.getElementById('tax-ex-offsite-ads')?.value) || 0;
  const plus = parseFloat(document.getElementById('tax-ex-etsy-plus')?.value) || 0;
  const netProfit = parseFloat(document.getElementById('tax-ex-net-profit')?.value) || 0;
  const totalMarketing = ads + offsite + plus;
  const hasScreenshot = netProfit > 0;

  const el = document.getElementById('tax-marketing-total');
  if (el) el.textContent = sym + totalMarketing.toFixed(2);

  const mKpi = document.getElementById('tax-marketing-kpi');
  if (mKpi) mKpi.textContent = sym + totalMarketing.toFixed(2);

  const pKpi = document.getElementById('tax-report-profit');
  if (pKpi) pKpi.textContent = sym + (netProfit - totalMarketing).toFixed(2);

  // Apply percentages from payments data to Activity Summary net_profit
  if (hasScreenshot && taxPaymentData) {
    const podFromActivity = taxPaymentData.podPct * netProfit;
    const physFromActivity = taxPaymentData.physicalPct * netProfit;
    const israelFromActivity = taxPaymentData.israelPct * netProfit;
    const fmtSym = (n) => sym + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    document.getElementById('tax-pod-net').textContent = fmtSym(podFromActivity);
    document.getElementById('tax-physical-net').textContent = fmtSym(physFromActivity);
    document.getElementById('tax-israel-net').textContent = fmtSym(israelFromActivity);
    document.getElementById('tax-total-net').textContent = fmtSym(netProfit);

    document.getElementById('tax-pod-net').title = `${(taxPaymentData.podPct * 100).toFixed(1)}% מהנטו`;
    document.getElementById('tax-physical-net').title = `${(taxPaymentData.physicalPct * 100).toFixed(1)}% מהנטו`;
    document.getElementById('tax-israel-net').title = `${(taxPaymentData.israelPct * 100).toFixed(1)}% מהנטו`;
  }
}

document.getElementById('tax-month').addEventListener('change', loadTaxReport);

// Send tax report to accountant
document.getElementById('btn-send-accountant').addEventListener('click', async () => {
  const month = document.getElementById('tax-month').value;
  if (!month) return alert('יש לבחור חודש');

  const btn = document.getElementById('btn-send-accountant');
  const msg = document.getElementById('send-accountant-msg');
  btn.disabled = true;

  const sym = taxExtractedCurrency || '$';
  const getVal = (id) => parseFloat(document.getElementById(id)?.textContent?.replace(/[^0-9.\-]/g, '')) || 0;

  const result = await api('/api/tax/send-email', {
    method: 'POST',
    body: {
      month,
      podNet: getVal('tax-pod-net'),
      physicalNet: getVal('tax-physical-net'),
      israelNet: getVal('tax-israel-net'),
      totalNet: getVal('tax-total-net'),
      marketingTotal: getVal('tax-marketing-kpi'),
      reportProfit: getVal('tax-report-profit'),
      currency: sym,
    },
  });

  if (result.error) {
    msg.style.display = 'inline';
    msg.style.color = 'var(--red-600)';
    msg.textContent = result.error;
  } else {
    // Open mailto link
    const mailto = `mailto:${encodeURIComponent(result.email)}?subject=${encodeURIComponent(result.subject)}&body=${encodeURIComponent(result.body)}`;
    window.open(mailto, '_blank');
    msg.style.display = 'inline';
    msg.style.color = 'var(--green-600)';
    msg.textContent = 'נפתח חלון אימייל';
  }
  setTimeout(() => { msg.style.display = 'none'; }, 4000);
  btn.disabled = false;
});

// Export tax table to Excel
document.getElementById('btn-export-tax').addEventListener('click', () => {
  const table = document.getElementById('tax-detail-table');
  if (!table) return;
  const wb = XLSX.utils.table_to_book(table, { sheet: 'Tax Report' });
  const month = document.getElementById('tax-month').value || 'export';
  XLSX.writeFile(wb, `jewselry-tax-report-${month}.xlsx`);
});

// Payments CSV Upload Modal
let parsedPaymentRows = [];
const paymentsModal = document.getElementById('payments-modal');

document.getElementById('btn-upload-payments').addEventListener('click', () => {
  document.getElementById('payments-csv-file').value = '';
  document.getElementById('payments-file-name').textContent = '';
  document.getElementById('payments-preview').style.display = 'none';
  document.getElementById('payments-import-result').style.display = 'none';
  document.getElementById('btn-import-payments').disabled = true;
  parsedPaymentRows = [];

  const now = new Date();
  document.getElementById('payments-csv-month').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  paymentsModal.style.display = 'flex';
});

document.getElementById('btn-cancel-payments').addEventListener('click', () => { paymentsModal.style.display = 'none'; });
paymentsModal.querySelector('.modal-backdrop').addEventListener('click', () => { paymentsModal.style.display = 'none'; });

// Payments CSV file handling
document.getElementById('payments-csv-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  document.getElementById('payments-file-name').textContent = file.name;
  parsePaymentsCSV(file);
  e.target.value = '';
});

const paymentsDropZone = document.getElementById('payments-drop-zone');
paymentsDropZone.addEventListener('dragover', (e) => { e.preventDefault(); paymentsDropZone.classList.add('dragover'); });
paymentsDropZone.addEventListener('dragleave', () => paymentsDropZone.classList.remove('dragover'));
paymentsDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  paymentsDropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.name.endsWith('.csv')) {
    document.getElementById('payments-file-name').textContent = file.name;
    parsePaymentsCSV(file);
  }
});

function parsePaymentsCSV(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 2) return;

    const headers = parseCSVLine(lines[0]).map(h => h.trim());
    parsedPaymentRows = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length < 2) continue;

      const row = {};
      headers.forEach((h, idx) => { row[h] = (cols[idx] || '').trim(); });

      const mapped = mapPaymentRow(row);
      if (mapped) parsedPaymentRows.push(mapped);
    }

    document.getElementById('payments-row-count').textContent = `${parsedPaymentRows.length} שורות זוהו בקובץ`;
    document.getElementById('payments-preview').style.display = 'block';
    document.getElementById('btn-import-payments').disabled = parsedPaymentRows.length === 0;
  };
  reader.readAsText(file);
}

function mapPaymentRow(row) {
  const paymentId = row['Payment ID'] || '';
  const orderId = row['Order ID'] || '';
  if (!orderId) return null;

  const parse = (v) => parseFloat((v || '0').replace(/[^0-9.\-]/g, '')) || 0;

  const orderDateRaw = row['Order Date'] || '';
  let orderDate = null;
  if (orderDateRaw) {
    const d = new Date(orderDateRaw);
    if (!isNaN(d.getTime())) orderDate = d.toISOString().split('T')[0];
  }

  return {
    payment_id: paymentId || null,
    order_id: orderId,
    gross_amount: parse(row['Gross Amount']),
    fees: parse(row['Fees']),
    net_amount: parse(row['Net Amount']),
    vat_amount: parse(row['VAT Amount']),
    currency: row['Currency'] || null,
    listing_amount: parse(row['Listing Amount']),
    listing_currency: row['Listing Currency'] || null,
    exchange_rate: parse(row['Exchange Rate']) || null,
    order_date: orderDate,
  };
}

document.getElementById('btn-import-payments').addEventListener('click', async () => {
  const reportMonth = document.getElementById('payments-csv-month').value;
  if (!reportMonth || parsedPaymentRows.length === 0) return;

  const btn = document.getElementById('btn-import-payments');
  btn.disabled = true;
  btn.textContent = 'מייבא...';

  const result = await api('/api/payments/import', {
    method: 'POST',
    body: { rows: parsedPaymentRows, report_month: reportMonth },
  });

  const resultDiv = document.getElementById('payments-import-result');
  resultDiv.style.display = 'block';

  if (result.error) {
    resultDiv.className = 'import-result error';
    resultDiv.textContent = 'שגיאה: ' + result.error;
  } else {
    resultDiv.className = 'import-result success';
    resultDiv.textContent = `יובאו ${result.imported} שורות בהצלחה. ${result.skipped > 0 ? `${result.skipped} כפילויות דולגו.` : ''}`;
    setTimeout(() => {
      paymentsModal.style.display = 'none';
      loadTaxReport();
    }, 1500);
  }

  btn.textContent = 'ייבוא';
  btn.disabled = false;
});

// ---- Listing Generator ----
let listingImageBase64 = null;

function initListingPage() {
  document.getElementById('listing-output').style.display = 'none';
  document.getElementById('listing-loading').style.display = 'none';
}

// Product type dynamic fields
const listingFieldDefs = {
  necklace: [
    { id: 'pendant_size', label: 'גודל תליון', type: 'text' },
    { id: 'chain_length', label: 'אורך שרשרת', type: 'text' },
    { id: 'material', label: 'חומר', type: 'text' },
  ],
  bracelet: [
    { id: 'pendant_size', label: 'גודל תליון', type: 'text', optional: true },
    { id: 'bracelet_length', label: 'אורך צמיד', type: 'text' },
    { id: 'adjustable', label: 'סגירה מתכווננת', type: 'checkbox' },
    { id: 'material', label: 'חומר', type: 'text' },
  ],
  ring: [
    { id: 'material', label: 'חומר', type: 'text' },
    { id: '_note', label: '', type: 'note', text: 'יש לפתוח VARIANTS של גדלי טבעת בנפרד' },
  ],
  challah_cover: [
    { id: 'size', label: 'גודל', type: 'text' },
    { id: 'material', label: 'חומר', type: 'text' },
  ],
  candles: [
    { id: 'size', label: 'גודל', type: 'text' },
  ],
  tefillin_tallit: [
    { id: 'size', label: 'גודל', type: 'text' },
    { id: 'material', label: 'חומר', type: 'text' },
  ],
};

document.getElementById('listing-product-type').addEventListener('change', (e) => {
  const container = document.getElementById('listing-dynamic-fields');
  const fields = listingFieldDefs[e.target.value];
  if (!fields) { container.innerHTML = ''; return; }

  container.innerHTML = fields.map(f => {
    if (f.type === 'note') {
      return `<div class="listing-note">${f.text}</div>`;
    }
    if (f.type === 'checkbox') {
      return `<div class="form-group"><label class="toggle-label"><input type="checkbox" id="listing-field-${f.id}"><span class="toggle-switch"></span><span class="toggle-text">${f.label}</span></label></div>`;
    }
    return `<div class="form-group"><label for="listing-field-${f.id}">${f.label}${f.optional ? ' <span class="label-hint">(אופציונלי)</span>' : ''}</label><input type="text" id="listing-field-${f.id}"></div>`;
  }).join('');
});

// Image upload
const listingDropZone = document.getElementById('listing-drop-zone');
const listingImageInput = document.getElementById('listing-image-input');

listingDropZone.addEventListener('click', () => listingImageInput.click());
listingDropZone.addEventListener('dragover', (e) => { e.preventDefault(); listingDropZone.classList.add('dragover'); });
listingDropZone.addEventListener('dragleave', () => listingDropZone.classList.remove('dragover'));
listingDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  listingDropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) handleListingImage(file);
});
listingImageInput.addEventListener('change', (e) => {
  if (e.target.files[0]) { handleListingImage(e.target.files[0]); e.target.value = ''; }
});

function handleListingImage(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    listingImageBase64 = e.target.result;
    document.getElementById('listing-preview-img').src = listingImageBase64;
    document.getElementById('listing-image-preview').style.display = 'block';
    document.getElementById('listing-image-placeholder').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

// Generate listing
document.getElementById('btn-generate-listing').addEventListener('click', async () => {
  const productType = document.getElementById('listing-product-type').value;
  if (!listingImageBase64) return alert('יש להעלות תמונה');
  if (!productType) return alert('יש לבחור סוג מוצר');

  // Collect dynamic fields
  const fieldDefs = listingFieldDefs[productType] || [];
  const fields = {};
  fieldDefs.forEach(f => {
    if (f.type === 'note') return;
    const el = document.getElementById('listing-field-' + f.id);
    if (!el) return;
    fields[f.label] = f.type === 'checkbox' ? (el.checked ? 'כן' : 'לא') : el.value;
  });

  const notes = document.getElementById('listing-notes').value.trim();
  const btn = document.getElementById('btn-generate-listing');
  const outputDiv = document.getElementById('listing-output');
  const loadingDiv = document.getElementById('listing-loading');

  btn.disabled = true;
  outputDiv.style.display = 'none';
  loadingDiv.style.display = 'flex';

  try {
    const result = await api('/api/listing/generate', {
      method: 'POST',
      body: { image: listingImageBase64, product_type: productType, fields, notes: notes || undefined },
    });

    if (result.error) { alert('שגיאה: ' + result.error); return; }

    document.getElementById('listing-title-val').value = result.title || '';
    document.getElementById('listing-desc-val').value = result.description || '';
    document.getElementById('listing-tags-val').value = result.tags || '';

    const warningDiv = document.getElementById('listing-warning');
    if (result.warning) {
      warningDiv.textContent = result.warning;
      warningDiv.style.display = 'block';
    } else {
      warningDiv.style.display = 'none';
    }

    outputDiv.style.display = 'block';
  } catch (err) {
    alert('שגיאה: ' + err.message);
  } finally {
    btn.disabled = false;
    loadingDiv.style.display = 'none';
  }
});

// Copy buttons for listing output
document.querySelectorAll('.listing-copy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.copy;
    const el = document.getElementById(targetId);
    const text = el.value || el.textContent;
    navigator.clipboard.writeText(text).then(() => {
      const textNode = btn.childNodes[btn.childNodes.length - 1];
      const orig = textNode.textContent;
      textNode.textContent = ' הועתק!';
      setTimeout(() => { textNode.textContent = orig; }, 1500);
    });
  });
});

// POD tab switching
document.querySelectorAll('[data-pod-tab]').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('[data-pod-tab]').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    tab.closest('main').querySelectorAll('.sales-tab-content').forEach(c => { c.classList.remove('active'); c.style.display = 'none'; });
    const target = document.getElementById(tab.dataset.podTab);
    if (!target) return;
    target.classList.add('active');
    target.style.display = 'block';
  });
});

// ---- POD (Print on Demand) ----
let podImageBase64 = null;
let podProducts = [];
let podSelectedProducts = []; // {blueprint_id, orientation}
const podCollapsedSections = new Set();

async function loadPodPage() {
  podSelectedProducts = [];
  document.getElementById('pod-results').style.display = 'none';
  document.getElementById('pod-loading').style.display = 'none';

  const grid = document.getElementById('pod-blueprints-grid');
  grid.innerHTML = '<div class="loading"><span class="spinner"></span>טוען מוצרים...</div>';

  const data = await api('/api/printify/products');
  if (data.error) {
    grid.innerHTML = `<div class="empty-state">${escapeHtml(data.error)}</div>`;
    return;
  }

  podProducts = Array.isArray(data) ? data : [];
  if (!podProducts.length) {
    grid.innerHTML = '<div class="empty-state">לא הוגדרו מוצרים. הוסף pod_products בהגדרות.</div>';
    return;
  }

  renderPodGrid();
}

function renderPodGrid() {
  const grid = document.getElementById('pod-blueprints-grid');
  const sections = [
    { key: 'square', label: 'ריבוע (Square)' },
    { key: 'vertical', label: 'אנכי (Vertical)' },
    { key: 'horizontal', label: 'אופקי (Horizontal)' },
  ];

  grid.innerHTML = sections.map(sec => {
    const items = podProducts.filter(p => (p.orientations || ['vertical','horizontal','square']).includes(sec.key));
    if (!items.length) return '';
    const collapsed = podCollapsedSections.has(sec.key);

    const cards = collapsed ? '' : items.map(p => {
      const selKey = `${p.blueprint_id}-${sec.key}`;
      const isSelected = podSelectedProducts.some(s => s.key === selKey);
      return `<div class="pod-blueprint-card ${isSelected ? 'selected' : ''}" data-sel-key="${selKey}" onclick="togglePodProduct(${p.blueprint_id}, '${sec.key}')">
        <div class="pod-blueprint-name">${escapeHtml(p.title)}</div>
      </div>`;
    }).join('');

    const selectedCount = items.filter(p => podSelectedProducts.some(s => s.key === `${p.blueprint_id}-${sec.key}`)).length;

    return `<div class="pod-orient-section">
      <div class="pod-orient-header ${collapsed ? 'collapsed' : ''}" onclick="togglePodSection('${sec.key}')">
        <span class="task-group-arrow">▼</span>
        <span class="pod-orient-label">${sec.label}</span>
        <span class="task-group-count">${items.length}</span>
        ${selectedCount > 0 ? `<span class="pod-orient-selected">${selectedCount} נבחרו</span>` : ''}
      </div>
      ${collapsed ? '' : `<div class="pod-orient-grid">${cards}</div>`}
    </div>`;
  }).join('');
}

window.togglePodSection = function(key) {
  if (podCollapsedSections.has(key)) podCollapsedSections.delete(key);
  else podCollapsedSections.add(key);
  renderPodGrid();
};

window.togglePodProduct = function(blueprintId, orientation) {
  const selKey = `${blueprintId}-${orientation}`;
  const idx = podSelectedProducts.findIndex(s => s.key === selKey);
  if (idx >= 0) {
    podSelectedProducts.splice(idx, 1);
  } else {
    podSelectedProducts.push({ key: selKey, blueprint_id: blueprintId, orientation });
  }
  renderPodGrid();
};

// Sync orientations button
document.getElementById('btn-sync-orientations')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-sync-orientations');
  btn.disabled = true;
  btn.textContent = 'מסנכרן...';
  const result = await api('/api/printify/sync-orientations', { method: 'POST' });
  btn.textContent = 'סנכרן מוצרים';
  btn.disabled = false;
  if (result.error) { alert('שגיאה: ' + result.error); return; }
  alert(`סונכרנו ${result.synced}/${result.total} מוצרים`);
  loadPodPage();
});

// POD image upload
const podDropZone = document.getElementById('pod-drop-zone');
const podImageInput = document.getElementById('pod-image-input');

podDropZone.addEventListener('click', () => podImageInput.click());
podDropZone.addEventListener('dragover', (e) => { e.preventDefault(); podDropZone.classList.add('dragover'); });
podDropZone.addEventListener('dragleave', () => podDropZone.classList.remove('dragover'));
podDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  podDropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) handlePodImage(file);
});
podImageInput.addEventListener('change', (e) => {
  if (e.target.files[0]) { handlePodImage(e.target.files[0]); e.target.value = ''; }
});

function handlePodImage(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    podImageBase64 = e.target.result;
    document.getElementById('pod-preview-img').src = podImageBase64;
    document.getElementById('pod-image-preview').style.display = 'block';
    document.getElementById('pod-image-placeholder').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

// Compress image client-side if too large (>4MB in base64 = ~5.3M chars)
async function compressImageIfNeeded(base64) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Detect orientation
      let orientation = 'square';
      if (img.width > img.height * 1.1) orientation = 'horizontal';
      else if (img.height > img.width * 1.1) orientation = 'vertical';

      if (base64.length <= 5333333) {
        resolve({ data: base64, orientation });
        return;
      }
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      const maxDim = 1500;
      if (w > maxDim || h > maxDim) {
        const ratio = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve({ data: canvas.toDataURL('image/jpeg', 0.85), orientation });
    };
    img.src = base64;
  });
}

// Create POD products
document.getElementById('btn-create-pod').addEventListener('click', async () => {
  if (!podImageBase64) return alert('יש להעלות עיצוב');
  if (podSelectedProducts.length === 0) return alert('יש לבחור לפחות מוצר אחד');

  const title = document.getElementById('pod-title').value.trim();
  const description = document.getElementById('pod-description').value.trim();
  const generateContent = !title; // auto-generate if no title provided

  const btn = document.getElementById('btn-create-pod');
  const loadingDiv = document.getElementById('pod-loading');
  const resultsDiv = document.getElementById('pod-results');

  btn.disabled = true;
  loadingDiv.style.display = 'flex';
  resultsDiv.style.display = 'none';

  try {
    // Step 1: Compress and upload image to Printify
    const { data: compressedImage, orientation: imageOrientation } = await compressImageIfNeeded(podImageBase64);
    const uploadRes = await api('/api/printify/upload-image', {
      method: 'POST',
      body: { image: compressedImage, filename: 'design.png' },
    });
    if (uploadRes.error) { alert('שגיאה בהעלאת תמונה: ' + uploadRes.error); return; }
    const imageId = uploadRes.id;

    // Step 2: Create products for each selected product+orientation
    const results = [];
    for (const sel of podSelectedProducts) {
      const product = podProducts.find(p => p.blueprint_id === sel.blueprint_id);
      if (!product) continue;

      // Fetch variants for this blueprint + provider combo
      const variantsData = await api(`/api/printify/blueprints/${product.blueprint_id}/providers/${product.provider_id}/variants`);
      if (variantsData.error || !variantsData.variants) {
        results.push({ title: product.title, error: variantsData.error || 'No variants found' });
        continue;
      }

      // Use ALL enabled variants
      const variants = variantsData.variants.map(v => ({ id: v.id, title: v.title, price: 0, is_enabled: true }));

      // Create product — use the section orientation, not the image orientation
      const createRes = await api('/api/printify/create-product', {
        method: 'POST',
        body: {
          title: title || product.title,
          description: description || '',
          blueprint_id: product.blueprint_id,
          print_provider_id: product.provider_id,
          variants,
          image_id: imageId,
          generate_content: generateContent,
          image_base64: generateContent ? compressedImage : undefined,
          orientation: sel.orientation,
        },
      });

      if (createRes.error) {
        results.push({ title: product.title, error: createRes.error });
      } else {
        results.push({
          title: createRes.generated_title || product.title,
          id: createRes.id,
          success: true,
          editor_url: createRes.editor_url,
          generated_tags: createRes.generated_tags,
        });
      }
    }

    // Show results
    const resultsList = document.getElementById('pod-results-list');
    resultsList.innerHTML = results.map(r => {
      if (r.success) {
        const tagsStr = Array.isArray(r.generated_tags) ? r.generated_tags.join(', ') : (r.generated_tags || '');
        const tagsId = 'pod-tags-' + r.id;
        const tagsLine = tagsStr ? `
          <div class="pod-tags-section">
            <label class="pod-tags-label">טאגים לפרינטיפיי:</label>
            <div class="pod-tags-copy-row">
              <input type="text" id="${tagsId}" class="pod-tags-input" value="${escapeHtml(tagsStr)}" readonly>
              <button class="btn btn-copy pod-tags-copy-btn" onclick="copyPodTags('${tagsId}', this)">העתק הכל</button>
            </div>
            <div class="pod-tags-hint">בפרינטיפיי → Tags → הדבק את כל הטאגים בבת אחת</div>
          </div>` : '';
        return `<div class="pod-result-item">
          <div>
            <span class="pod-result-name">${escapeHtml(r.title)}</span>
            ${tagsLine}
          </div>
          <a class="pod-result-link" href="${r.editor_url || 'https://printify.com/app/editor/' + r.id}" target="_blank">פתח בפרינטיפיי</a>
        </div>`;
      } else {
        return `<div class="pod-result-item">
          <span class="pod-result-name">${escapeHtml(r.title)}</span>
          <span style="color:var(--red-600); font-size:0.82rem;">${escapeHtml(r.error)}</span>
        </div>`;
      }
    }).join('');

    resultsDiv.style.display = 'block';
  } catch (err) {
    alert('שגיאה: ' + err.message);
  } finally {
    btn.disabled = false;
    loadingDiv.style.display = 'none';
  }
});

// ---- Inventory ----
async function loadInventoryPage() {
  await Promise.all([loadProducts(), loadMissingSkus()]);
}

async function loadProducts() {
  const products = await api('/api/products');
  if (!Array.isArray(products)) return;

  const physical = products.filter(p => p.type === 'physical');
  const pod = products.filter(p => p.type === 'pod');

  renderPhysicalProducts(physical);
  renderPodProducts(pod);
}

function renderPhysicalProducts(products) {
  const tbody = document.getElementById('inv-physical-body');
  if (!products.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state" style="padding:1.5rem;">אין מוצרים פיזיים</td></tr>';
    return;
  }
  tbody.innerHTML = products.map(p => {
    const stockClass = p.quantity === 0 ? 'stock-out' : p.quantity < 5 ? 'stock-low' : '';
    const badgeClass = p.quantity === 0 ? 'stock-badge-out' : p.quantity < 5 ? 'stock-badge-low' : 'stock-badge-ok';
    const badgeText = p.quantity === 0 ? 'אזל' : p.quantity < 5 ? 'נמוך' : 'תקין';
    return `<tr class="${stockClass}">
      <td>${escapeHtml(p.sku)}</td>
      <td class="inv-col-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</td>
      <td><input class="inv-inline-input" type="number" step="0.01" value="${p.cost || 0}" data-id="${p.id}" data-field="cost" onchange="updateProduct(this)"></td>
      <td><input class="inv-inline-input" type="number" step="0.01" value="${p.shipping_cost || 0}" data-id="${p.id}" data-field="shipping_cost" onchange="updateProduct(this)"></td>
      <td>
        <input class="inv-inline-input" type="number" value="${p.quantity || 0}" data-id="${p.id}" data-field="quantity" onchange="updateProduct(this)" style="width:60px;">
        <span class="stock-badge ${badgeClass}">${badgeText}</span>
      </td>
      <td>
        ${!p.quantity_snapshot_at ? `<button class="btn-small" onclick="setSnapshot('${p.id}')">הגדר כמות ראשונית</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

function renderPodProducts(products) {
  const tbody = document.getElementById('inv-pod-body');
  if (!products.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state" style="padding:1.5rem;">אין מוצרי POD</td></tr>';
    return;
  }
  tbody.innerHTML = products.map(p => `<tr>
    <td>${escapeHtml(p.sku)}</td>
    <td class="inv-col-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</td>
    <td>${p.printify_cost ? '$' + Number(p.printify_cost).toFixed(2) : '-'}</td>
    <td>${p.printify_shipping_cost ? '$' + Number(p.printify_shipping_cost).toFixed(2) : '-'}</td>
  </tr>`).join('');
}

async function loadMissingSkus() {
  const missing = await api('/api/products/missing-skus');
  const section = document.getElementById('inv-missing-section');
  const list = document.getElementById('inv-missing-list');

  if (!Array.isArray(missing) || missing.length === 0) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';
  list.innerHTML = missing.map(m => `
    <div class="inv-missing-item">
      <span class="inv-missing-name">${escapeHtml(m.name)}</span>
      <span class="inv-missing-count">${m.count} יח'</span>
      <button class="btn-small" onclick="generateSkuFor('${escapeHtml(m.name).replace(/'/g, "\\'")}')">צור מק"ט</button>
    </div>
  `).join('');
}

window.updateProduct = async function(el) {
  const id = el.dataset.id;
  const field = el.dataset.field;
  const value = field === 'quantity' ? parseInt(el.value, 10) : parseFloat(el.value);
  await api('/api/products/' + id, { method: 'PATCH', body: { [field]: value } });
};

window.setSnapshot = async function(id) {
  await api('/api/products/' + id, { method: 'PATCH', body: { quantity_snapshot_at: new Date().toISOString() } });
  loadProducts();
};

window.generateSkuFor = async function(name) {
  const result = await api('/api/products/generate-sku', { method: 'POST', body: { name } });
  if (result.sku) {
    await api('/api/products', {
      method: 'POST',
      body: { sku: result.sku, name, type: 'physical' },
    });
    loadInventoryPage();
  }
};

document.getElementById('btn-sync-products').addEventListener('click', async () => {
  const btn = document.getElementById('btn-sync-products');
  btn.disabled = true;
  btn.textContent = 'מסנכרן...';
  const result = await api('/api/products/sync-from-sales', { method: 'POST' });
  btn.textContent = 'סנכרן מוצרים מהמכירות';
  btn.disabled = false;
  if (result.error) { alert('שגיאה: ' + result.error); return; }
  alert(`סונכרנו ${result.created} מוצרים חדשים. ${result.skipped} דולגו.`);
  loadInventoryPage();
});

document.getElementById('btn-apply-sales').addEventListener('click', async () => {
  const month = prompt('הזן חודש (YYYY-MM):');
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return;
  const btn = document.getElementById('btn-apply-sales');
  btn.disabled = true;
  const result = await api('/api/products/apply-sales/' + month, { method: 'POST' });
  btn.disabled = false;
  if (result.error) { alert('שגיאה: ' + result.error); return; }
  alert(`עודכנו ${result.updated} מוצרים. ${result.skipped} דולגו.`);
  loadProducts();
});

window.copyPodTags = function(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  navigator.clipboard.writeText(input.value).then(() => {
    btn.textContent = '✓ הועתק';
    setTimeout(() => { btn.textContent = 'העתק הכל'; }, 2000);
  });
};

// ---- Design Generator ----
let designRefBase64 = null;

const designRefDrop = document.getElementById('design-ref-drop');
const designRefInput = document.getElementById('design-ref-input');
designRefDrop.addEventListener('click', () => designRefInput.click());
designRefDrop.addEventListener('dragover', (e) => { e.preventDefault(); designRefDrop.classList.add('dragover'); });
designRefDrop.addEventListener('dragleave', () => designRefDrop.classList.remove('dragover'));
designRefDrop.addEventListener('drop', (e) => {
  e.preventDefault(); designRefDrop.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) handleDesignRef(file);
});
designRefInput.addEventListener('change', (e) => { if (e.target.files[0]) { handleDesignRef(e.target.files[0]); e.target.value = ''; } });

function handleDesignRef(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    designRefBase64 = e.target.result;
    document.getElementById('design-ref-img').src = designRefBase64;
    document.getElementById('design-ref-preview').style.display = 'block';
    document.getElementById('design-ref-placeholder').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

// Midjourney prompt
function designStartLoading(text) {
  document.getElementById('btn-midjourney-prompt').disabled = true;
  document.getElementById('btn-dalle-generate').disabled = true;
  document.getElementById('design-empty-state').style.display = 'none';
  document.getElementById('mj-result').style.display = 'none';
  document.getElementById('dalle-result').style.display = 'none';
  document.getElementById('design-loading-text').textContent = text;
  document.getElementById('design-loading').style.display = 'flex';
}

function designStopLoading() {
  document.getElementById('btn-midjourney-prompt').disabled = false;
  document.getElementById('btn-dalle-generate').disabled = false;
  document.getElementById('design-loading').style.display = 'none';
}

document.getElementById('btn-midjourney-prompt').addEventListener('click', async () => {
  if (!designRefBase64) return alert('יש להעלות תמונת ייחוס');
  designStartLoading('מייצר פרומפט...');

  try {
    const notes = document.getElementById('design-style-notes').value.trim();
    const result = await api('/api/design/midjourney-prompt', {
      method: 'POST',
      body: { image: (await compressImageIfNeeded(designRefBase64)).data, style_notes: notes || undefined },
    });
    if (result.error) { alert('שגיאה: ' + result.error); return; }
    document.getElementById('mj-prompt-text').value = result.prompt;
    document.getElementById('mj-result').style.display = 'block';
  } catch (err) { alert('שגיאה: ' + err.message); }
  finally { designStopLoading(); }
});

document.getElementById('btn-copy-mj-prompt').addEventListener('click', () => {
  const text = document.getElementById('mj-prompt-text').value;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('btn-copy-mj-prompt');
    btn.textContent = 'הועתק!';
    setTimeout(() => { btn.textContent = 'העתק'; }, 1500);
  });
});

// DALL-E generate
document.getElementById('btn-dalle-generate').addEventListener('click', async () => {
  if (!designRefBase64) return alert('יש להעלות תמונת ייחוס');
  designStartLoading('מייצר עיצוב...');

  try {
    const notes = document.getElementById('design-style-notes').value.trim();
    const result = await api('/api/design/dalle-generate', {
      method: 'POST',
      body: { image: (await compressImageIfNeeded(designRefBase64)).data, style_notes: notes || undefined },
    });
    if (result.error) { alert('שגיאה: ' + result.error); return; }
    document.getElementById('dalle-result-img').src = result.image_url;
    document.getElementById('btn-download-dalle').href = result.image_url;
    document.getElementById('dalle-prompt-used').textContent = result.prompt_used;
    document.getElementById('dalle-result').style.display = 'block';
  } catch (err) { alert('שגיאה: ' + err.message); }
  finally { designStopLoading(); }
});

// ---- FAB Quick Task ----
document.getElementById('fab-new-task').addEventListener('click', () => {
  document.getElementById('fab-modal').style.display = 'flex';
  document.getElementById('fab-task-title').value = '';
  document.getElementById('fab-task-notes').value = '';
  document.getElementById('fab-task-assignee').value = 'david';
  setTimeout(() => document.getElementById('fab-task-title').focus(), 100);
});

document.getElementById('fab-modal-overlay').addEventListener('click', () => {
  document.getElementById('fab-modal').style.display = 'none';
});

document.getElementById('fab-modal-cancel').addEventListener('click', () => {
  document.getElementById('fab-modal').style.display = 'none';
});

document.getElementById('fab-modal-save').addEventListener('click', async () => {
  const title = document.getElementById('fab-task-title').value.trim();
  if (!title) return alert('יש להזין כותרת');
  const description = document.getElementById('fab-task-notes').value.trim() || null;
  const assigned_to = document.getElementById('fab-task-assignee').value;
  const btn = document.getElementById('fab-modal-save');
  btn.disabled = true;

  await api('/api/tasks', { method: 'POST', body: { title, description, assigned_to } });

  document.getElementById('fab-modal').style.display = 'none';
  btn.disabled = false;

  // Toast
  const toast = document.createElement('div');
  toast.className = 'fab-toast';
  toast.textContent = 'נשמר ✓';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);

  // Reload tasks if on tasks page
  if (document.getElementById('page-tasks').classList.contains('active')) loadTasks();
});

// ---- Help Page ----
const helpContent = {
  he: [
    { title: 'תחילת עבודה', items: [
      { q: 'איך מתחילים?', a: 'היכנס לדשבורד, הוסף משימה ראשונה מלוח המשימות, ונסה את סוכן שירות הלקוחות עם הודעה לדוגמה.' },
      { q: 'האם צריך להתקין משהו?', a: 'לא. המערכת עובדת בדפדפן ואין צורך בהתקנה. פשוט גש לכתובת האתר.' },
      { q: 'איך מוסיפים משתמשים?', a: 'כרגע המערכת תומכת בשני משתמשים: דוד ואור. ניתן לשייך משימות לכל אחד מהם.' },
    ]},
    { title: 'משימות', items: [
      { q: 'איך יוצרים משימה?', a: 'לחץ על "+ משימה חדשה" או על כפתור ה-+ הצף בפינה. ניתן גם להוסיף משימה ישירות מתוך הקבוצה.' },
      { q: 'מה המשמעות של הסטטוסים?', a: 'לביצוע = חדשה, בטיפול = בעבודה, הושלם = סיימתי. לחץ על משימה לשנות סטטוס.' },
      { q: 'איך מוחקים משימה?', a: 'פתח את המשימה ולחץ "מחק משימה". המשימה תסומן כהושלמה (לא נמחקת לחלוטין).' },
    ]},
    { title: 'שירות לקוחות', items: [
      { q: 'איך עובד סוכן השירות?', a: 'הדבק הודעת לקוח בכל שפה, הוסף הערות אם צריך, ולחץ "צור תשובה". המערכת תייצר סיכום בעברית ותשובה באנגלית.' },
      { q: 'אפשר לשמור תשובה כמשימה?', a: 'כן! לחץ "שמור כמשימה" והודעת הלקוח תישמר כמשימה חדשה עם קטגוריית שירות לקוחות.' },
    ]},
    { title: 'מכירות', items: [
      { q: 'איך מייבאים נתוני מכירות?', a: 'לחץ "ייבוא CSV" ובחר את קובץ EtsySoldOrderItems שהורדת מאטסי. בחר חודש ולחץ ייבוא.' },
      { q: 'מה זה דוח מס?', a: 'טאב דוח מס מאפשר לייבא Payments CSV, לנתח Activity Summary מצילום מסך, ולשלוח סיכום לרואה חשבון.' },
      { q: 'איך עובד סינון יהלומים?', a: 'הפעל "הצג יהלומים בלבד" כדי לסנן רק מוצרים שמכילים diamond בשם. מוצג טבלה מפורטת עם ייצוא לאקסל.' },
    ]},
    { title: 'POD', items: [
      { q: 'איך יוצרים מוצרי POD?', a: 'העלה עיצוב, בחר מוצרים מהרשימה (לפי אוריינטציה), מלא כותרת (או השאר ריק ליצירה אוטומטית) ולחץ "צור".' },
      { q: 'מה זה סנכרון מוצרים?', a: 'כפתור "סנכרן מוצרים" מביא מפרינטיפיי את האוריינטציות הזמינות לכל מוצר ומקבץ אותם בקבוצות.' },
      { q: 'איך עובד מחולל העיצוב?', a: 'העלה תמונת ייחוס, הוסף הערות סגנון, ובחר ליצור פרומפט למידג\'רני או עיצוב עם DALL-E.' },
    ]},
    { title: 'מחולל ליסט', items: [
      { q: 'איך יוצרים ליסטינג?', a: 'העלה תמונת מוצר, בחר סוג, מלא פרטים ולחץ "צור ליסט". המערכת תייצר כותרת, תיאור וטאגים מותאמים לSEO.' },
      { q: 'מה זה Keyword Bank?', a: 'מאגר מילות מפתח עם נתוני חיפוש מאטסי. המערכת משתמשת בו ליצירת כותרות וטאגים אופטימליים.' },
    ]},
    { title: 'מלאי', items: [
      { q: 'איך מסנכרנים מוצרים?', a: 'לחץ "סנכרן מוצרים מהמכירות" והמערכת תיצור רשומת מוצר לכל SKU שנמכר.' },
      { q: 'איך מעדכנים כמות?', a: 'ערוך ישירות בטבלה. לחץ "הגדר כמות ראשונית" לפני שמתחילים לעקוב אחרי מלאי.' },
    ]},
  ],
  en: [
    { title: 'Getting Started', items: [
      { q: 'How do I get started?', a: 'Log into the dashboard, create your first task, and try the customer service agent with a sample message.' },
      { q: 'Do I need to install anything?', a: 'No. The platform runs in your browser — just navigate to the URL.' },
      { q: 'How do I add users?', a: 'Currently the system supports two users: David and Or. Tasks can be assigned to either.' },
    ]},
    { title: 'Tasks', items: [
      { q: 'How do I create a task?', a: 'Click "+ New Task" or the floating + button. You can also add tasks inline within each status group.' },
      { q: 'What do the statuses mean?', a: 'To Do = new, In Progress = working on it, Done = completed. Click a task to change its status.' },
      { q: 'How do I delete a task?', a: 'Open the task and click "Delete Task". The task is marked as done (not permanently deleted).' },
    ]},
    { title: 'Customer Service', items: [
      { q: 'How does the CS agent work?', a: 'Paste a customer message in any language, add optional notes, and click "Generate Reply". The system creates a Hebrew summary and English reply.' },
      { q: 'Can I save a reply as a task?', a: 'Yes! Click "Save as Task" and the customer message will be saved as a new task under Customer Service category.' },
    ]},
    { title: 'Sales', items: [
      { q: 'How do I import sales data?', a: 'Click "Import CSV" and select the EtsySoldOrderItems file from Etsy. Choose the month and click Import.' },
      { q: 'What is the Tax Report?', a: 'The Tax Report tab lets you import Payments CSV, analyze Activity Summary screenshots, and email summaries to your accountant.' },
      { q: 'How does diamond filtering work?', a: 'Toggle "Show diamonds only" to filter products containing "diamond" in the name. A detailed table with Excel export is shown.' },
    ]},
    { title: 'POD', items: [
      { q: 'How do I create POD products?', a: 'Upload a design, select products by orientation, fill in title (or leave blank for AI generation), and click Create.' },
      { q: 'What is product sync?', a: 'The "Sync Products" button fetches available orientations from Printify for each product and groups them accordingly.' },
      { q: 'How does the design generator work?', a: 'Upload a reference image, add style notes, then choose to generate a Midjourney prompt or a DALL-E design.' },
    ]},
    { title: 'Listing Generator', items: [
      { q: 'How do I create a listing?', a: 'Upload a product image, select the type, fill in details and click "Generate Listing". The system creates SEO-optimized title, description and tags.' },
      { q: 'What is the Keyword Bank?', a: 'A database of search keywords with Etsy volume data. The system uses it to create optimal titles and tags.' },
    ]},
    { title: 'Inventory', items: [
      { q: 'How do I sync products?', a: 'Click "Sync Products from Sales" and the system will create a product record for each SKU found in your sales data.' },
      { q: 'How do I update quantities?', a: 'Edit directly in the table. Click "Set Initial Quantity" before starting to track inventory.' },
    ]},
  ],
};

let helpLang = localStorage.getItem('helpLang') || 'he';

window.setHelpLang = function(lang) {
  helpLang = lang;
  localStorage.setItem('helpLang', lang);
  renderHelp();
};

function renderHelp() {
  document.getElementById('btn-lang-he').classList.toggle('active', helpLang === 'he');
  document.getElementById('btn-lang-en').classList.toggle('active', helpLang === 'en');

  const page = document.getElementById('page-help');
  if (helpLang === 'en') {
    page.classList.add('ltr');
    document.getElementById('help-page-title').textContent = 'Help Center';
    document.getElementById('help-page-subtitle').textContent = 'FAQ and useful information';
  } else {
    page.classList.remove('ltr');
    document.getElementById('help-page-title').textContent = 'מרכז עזרה';
    document.getElementById('help-page-subtitle').textContent = 'שאלות נפוצות ומידע שימושי';
  }

  const sections = helpContent[helpLang] || [];
  document.getElementById('help-content').innerHTML = sections.map((sec, si) =>
    `<div class="help-section">
      <div class="help-section-title">${escapeHtml(sec.title)}</div>
      ${sec.items.map((item, ii) =>
        `<div class="help-item" onclick="this.classList.toggle('open')">
          <div class="help-question">
            <span>${escapeHtml(item.q)}</span>
            <span class="help-question-arrow">▼</span>
          </div>
          <div class="help-answer">${escapeHtml(item.a)}</div>
        </div>`
      ).join('')}
    </div>`
  ).join('');
}

// ---- Util ----
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---- Init ----
async function init() {
  await loadCategories();
  loadTasks();
}

init();
