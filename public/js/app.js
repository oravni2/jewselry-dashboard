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
