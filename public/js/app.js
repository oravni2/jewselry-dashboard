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
    if (page === 'settings') loadSettings();
  });
});

// ---- Tasks ----
async function loadTasks() {
  const showAll = document.getElementById('show-all-tasks').checked;
  const showDone = document.getElementById('show-done-tasks').checked;

  let url = '/api/tasks?';
  if (!showAll) url += 'assigned_to=david&';
  if (!showDone) url += 'status=open&';

  const tasks = await api(url);
  renderTasks(tasks);
}

function renderTasks(tasks) {
  const container = document.getElementById('tasks-list');

  if (!Array.isArray(tasks) || tasks.length === 0) {
    container.innerHTML = '<div class="empty-state">אין משימות להצגה</div>';
    return;
  }

  container.innerHTML = tasks.map(task => {
    const isDone = task.status === 'done';
    const cat = task.categories;
    const catDot = cat
      ? `<div class="cat-dot" style="background:${cat.color}" title="${cat.name}"></div>`
      : '';
    const dueDateStr = task.due_date
      ? new Date(task.due_date).toLocaleDateString('he-IL')
      : '';
    const assignedName = task.assigned_to === 'david' ? 'דוד' : 'אור';

    return `
      <div class="task-card ${isDone ? 'done' : ''}" data-id="${task.id}">
        <button class="task-check" onclick="toggleTask('${task.id}', '${task.status}')" title="${isDone ? 'סמן כפתוח' : 'סמן כהושלם'}"></button>
        ${catDot}
        <div class="task-body">
          <div class="task-title">${escapeHtml(task.title)}</div>
          <div class="task-meta">
            ${task.description ? `<span>${escapeHtml(task.description)}</span>` : ''}
            ${dueDateStr ? `<span>${dueDateStr}</span>` : ''}
          </div>
        </div>
        <span class="task-assigned-badge">${assignedName}</span>
      </div>
    `;
  }).join('');
}

async function toggleTask(id, currentStatus) {
  const newStatus = currentStatus === 'open' ? 'done' : 'open';
  await api('/api/tasks/' + id, {
    method: 'PATCH',
    body: { status: newStatus },
  });
  loadTasks();
}

// Filter change listeners
document.getElementById('show-all-tasks').addEventListener('change', loadTasks);
document.getElementById('show-done-tasks').addEventListener('change', loadTasks);

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
  loadingDiv.style.display = 'block';

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
    const summaryMatch = text.match(/סיכום:?\s*([\s\S]*?)(?=Reply:|$)/i);
    const replyMatch = text.match(/Reply:?\s*([\s\S]*)/i);

    document.getElementById('cs-summary').textContent = summaryMatch
      ? summaryMatch[1].trim()
      : text;
    document.getElementById('cs-reply').textContent = replyMatch
      ? replyMatch[1].trim()
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

// ---- Settings ----
async function loadSettings() {
  // Load system prompt
  const promptData = await api('/api/settings/cs_system_prompt');
  document.getElementById('settings-prompt').value = promptData.error ? '' : (promptData.value || '');

  // Load listing prompt
  const listingPromptData = await api('/api/settings/listing_system_prompt');
  document.getElementById('settings-listing-prompt').value = listingPromptData.error ? '' : (listingPromptData.value || '');

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

async function loadSalesPage() {
  // Load available months
  salesMonths = await api('/api/sales/months');
  const monthSelect = document.getElementById('sales-month');

  if (Array.isArray(salesMonths) && salesMonths.length > 0) {
    monthSelect.innerHTML = salesMonths.map(m => `<option value="${m}">${formatMonth(m)}</option>`).join('');
  } else {
    // Default to current month
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    monthSelect.innerHTML = `<option value="${currentMonth}">${formatMonth(currentMonth)}</option>`;
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
        backgroundColor: 'rgba(202, 138, 4, 0.6)',
        borderColor: 'rgba(161, 98, 7, 0.8)',
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
  if (e.target.files[0]) handleListingImage(e.target.files[0]);
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
