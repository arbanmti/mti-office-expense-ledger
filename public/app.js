const state = { csrf: '', user: null, setupToken: '', types: [], ledgerItems: [], currentPage: 'dashboard' };
const PAYMENT_METHODS = ['Cash', 'Bank', 'bKash', 'Nagad', 'Card', 'Other'];
const configuredApiBase = document.querySelector('meta[name="ledger-api-base"]')?.content;
const API_BASE = configuredApiBase ? new URL(configuredApiBase, location.origin) : new URL('.', document.baseURI);
let flashTimer;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function money(paisa) {
  const amount = Number(paisa || 0) / 100;
  return `৳ ${new Intl.NumberFormat('en-BD', { minimumFractionDigits: amount % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(amount)}`;
}

function today() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function flash(message, isError = false) {
  const element = $('#flash');
  element.textContent = message;
  element.className = `flash show${isError ? ' error' : ''}`;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { element.className = 'flash'; }, 4500);
}

async function api(path, options = {}) {
  const method = options.method || 'GET';
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
  if (!['GET', 'HEAD'].includes(method) && state.csrf) headers['X-CSRF-Token'] = state.csrf;
  const response = await fetch(new URL(path.replace(/^\//, ''), API_BASE), { method, headers, credentials: 'include', body: options.body ? JSON.stringify(options.body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && state.user) setTimeout(checkStatus, 0);
    throw new Error(data.error || 'অনুরোধটি সম্পন্ন করা যায়নি।');
  }
  return data;
}

function showAuth(which) {
  $('#auth-screen').hidden = false;
  $('#app-shell').hidden = true;
  $('#setup-form').hidden = which !== 'setup';
  $('#login-form').hidden = which !== 'login';
}

function applyUser(user, csrf) {
  state.user = user;
  state.csrf = csrf;
  $('#auth-screen').hidden = true;
  $('#app-shell').hidden = false;
  $('#user-name').textContent = user.username;
  $('.avatar').textContent = user.username.slice(0, 1).toUpperCase();
  $('#settings-username').textContent = user.username;
}

async function checkStatus() {
  try {
    const status = await api('/api/auth/status');
    if (status.needs_setup) {
      state.user = null;
      state.csrf = '';
      state.setupToken = status.setup_token;
      return showAuth('setup');
    }
    if (status.authenticated) {
      applyUser(status.user, status.csrf_token);
      await initializeApp();
      return;
    }
    state.user = null;
    state.csrf = '';
    showAuth('login');
  } catch (error) {
    flash('Server-এর সাথে সংযোগ করা যাচ্ছে না। আবার চেষ্টা করুন।', true);
  }
}

async function initializeApp() {
  $('#expense-form [name="expense_date"]').value = today();
  $('#report-month').value = today().slice(0, 7);
  await Promise.all([loadExpenseTypes(), loadDashboard()]);
  showPage(state.currentPage || 'dashboard', false);
}

function setLoadingBody(id, columns) {
  $(`#${id}`).innerHTML = `<tr><td class="empty" colspan="${columns}">লোড হচ্ছে…</td></tr>`;
}

function blankBody(id, columns, message) {
  $(`#${id}`).innerHTML = `<tr><td class="empty" colspan="${columns}">${escapeHtml(message)}</td></tr>`;
}

function expenseRows(items, actionMode = false) {
  if (!items.length) return '';
  return items.map((item) => `<tr>
    <td>${escapeHtml(item.expense_date)}</td><td><span class="type-pill">${escapeHtml(item.expense_type)}</span></td>
    <td>${escapeHtml(item.description)}</td><td class="amount-cell">${money(item.amount_paisa)}</td>
    <td>${escapeHtml(item.payment_method)}</td>${actionMode ? `<td>${escapeHtml(item.paid_to || '—')}</td><td>${escapeHtml(item.note || '—')}</td>
      <td><div class="row-actions"><button class="row-action" data-action="view" data-id="${item.id}">View</button><button class="row-action" data-action="edit" data-id="${item.id}">Edit</button><button class="row-action delete" data-action="delete" data-id="${item.id}">Delete</button></div></td>` : `<td>${escapeHtml(item.paid_to || '—')}</td>`}
  </tr>`).join('');
}

async function loadDashboard() {
  const data = await api('/api/dashboard');
  $('#today-total').textContent = money(data.today_paisa);
  $('#month-total').textContent = money(data.month_paisa);
  $('#all-total').textContent = money(data.total_paisa);
  $('#visa-total').textContent = money(data.visa_fee_paisa);
  $('#recent-body').innerHTML = data.recent.length ? expenseRows(data.recent) : '<tr><td class="empty" colspan="5">এখনো কোনো খরচ লেখা হয়নি।</td></tr>';
}

async function loadExpenseTypes() {
  const data = await api('/api/expense-types?all=true');
  state.types = data.items;
  const active = data.items.filter((item) => item.is_active);
  const select = $('#expense-type-select');
  select.innerHTML = active.length ? active.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('') : '<option value="">আগে একটি Expense Type যোগ করুন</option>';
  $('#type-body').innerHTML = data.items.length ? data.items.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td><span class="status-pill${item.is_active ? '' : ' inactive'}">${item.is_active ? 'Active' : 'Inactive'}</span></td><td><button class="row-action" data-type-id="${item.id}" data-active="${item.is_active}">${item.is_active ? 'Deactivate' : 'Activate'}</button></td></tr>`).join('') : '<tr><td class="empty" colspan="3">কোনো expense type নেই।</td></tr>';
}

async function loadLedger() {
  setLoadingBody('ledger-body', 8);
  const range = $('#ledger-range').value;
  const params = new URLSearchParams({ range });
  const query = $('#ledger-query').value.trim();
  if (query) params.set('q', query);
  if (range === 'custom') {
    if ($('#ledger-from').value) params.set('from', $('#ledger-from').value);
    if ($('#ledger-to').value) params.set('to', $('#ledger-to').value);
  }
  const data = await api(`/api/expenses?${params.toString()}`);
  state.ledgerItems = data.items;
  $('#ledger-total').textContent = `Total: ${money(data.total_paisa)}`;
  $('#ledger-body').innerHTML = data.items.length ? expenseRows(data.items, true) : '<tr><td class="empty" colspan="8">এই filter-এ কোনো খরচ পাওয়া যায়নি।</td></tr>';
}

async function loadReport() {
  const month = $('#report-month').value || today().slice(0, 7);
  const data = await api(`/api/reports/monthly?month=${encodeURIComponent(month)}`);
  $('#report-total').textContent = money(data.total_paisa);
  $('#report-visa').textContent = money(data.visa_fee_paisa);
  $('#payment-totals').innerHTML = PAYMENT_METHODS.map((method) => `<div class="payment-item"><span>${method}</span><strong>${money(data.payment_totals[method])}</strong></div>`).join('');
  $('#report-body').innerHTML = data.items.length ? expenseRows(data.items) : '<tr><td class="empty" colspan="6">এই মাসে কোনো খরচ নেই।</td></tr>';
}

function showPage(page, shouldLoad = true) {
  state.currentPage = page;
  const labels = { dashboard: ['Dashboard', 'OVERVIEW'], expense: ['Add Expense', 'NEW ENTRY'], ledger: ['Expense Ledger', 'ALL EXPENSES'], report: ['Monthly Report', 'MONTHLY SUMMARY'], types: ['Expense Types', 'CATEGORIES'], backup: ['Backup', 'DATA MANAGEMENT'], settings: ['Settings', 'ACCOUNT'] };
  $$('.page').forEach((element) => element.classList.toggle('active', element.dataset.pageContent === page));
  $$('.nav-link').forEach((element) => element.classList.toggle('active', element.dataset.page === page));
  $('#page-title').textContent = labels[page][0];
  $('#page-kicker').textContent = labels[page][1];
  $('.sidebar').classList.remove('open');
  if (!shouldLoad) return;
  const tasks = { dashboard: loadDashboard, ledger: loadLedger, report: loadReport, types: loadExpenseTypes, expense: loadExpenseTypes };
  if (tasks[page]) tasks[page]().catch((error) => flash(error.message, true));
}

function resetExpenseForm() {
  const form = $('#expense-form');
  form.reset();
  form.dataset.editId = '';
  form.querySelector('[name="expense_date"]').value = today();
  $('#expense-form-title').textContent = 'নতুন খরচ লিখুন';
  $('#expense-save-button').textContent = 'Save Expense';
}

function editExpense(item) {
  const form = $('#expense-form');
  form.dataset.editId = item.id;
  form.expense_date.value = item.expense_date;
  form.expense_type_id.value = String(item.expense_type_id);
  form.description.value = item.description;
  form.amount.value = (item.amount_paisa / 100).toFixed(2);
  form.payment_method.value = item.payment_method;
  form.paid_to.value = item.paid_to || '';
  form.note.value = item.note || '';
  $('#expense-form-title').textContent = 'খরচের তথ্য পরিবর্তন করুন';
  $('#expense-save-button').textContent = 'Update Expense';
  showPage('expense', false);
}

function viewExpense(item) {
  const fields = [['Date', item.expense_date], ['Expense Type', item.expense_type], ['Description', item.description], ['Amount', money(item.amount_paisa)], ['Payment Method', item.payment_method], ['Paid To', item.paid_to || '—'], ['Note', item.note || '—']];
  $('#expense-details').innerHTML = fields.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join('');
  const dialog = $('#expense-dialog');
  if (dialog.showModal) dialog.showModal();
  else flash(`${item.description} — ${money(item.amount_paisa)}`);
}

async function handleExpenseSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  try {
    const editId = form.dataset.editId;
    const result = await api(editId ? `/api/expenses/${editId}` : '/api/expenses', { method: editId ? 'PUT' : 'POST', body: data });
    flash(result.message);
    resetExpenseForm();
    await Promise.all([loadDashboard(), loadLedger()]);
    showPage('ledger', false);
  } catch (error) { flash(error.message, true); }
}

function updateCustomFields() {
  const custom = $('#ledger-range').value === 'custom';
  $$('.custom-date').forEach((element) => { element.hidden = !custom; });
  if (state.currentPage === 'ledger') loadLedger().catch((error) => flash(error.message, true));
}

async function handleTypeSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    const result = await api('/api/expense-types', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
    flash(`${result.item.name} যোগ করা হয়েছে।`);
    form.reset();
    await loadExpenseTypes();
  } catch (error) { flash(error.message, true); }
}

async function importBackup(event) {
  event.preventDefault();
  const file = event.currentTarget.backup.files[0];
  if (!file) return;
  try {
    const backup = JSON.parse(await file.text());
    const result = await api('/api/backup/import', { method: 'POST', body: backup });
    flash(result.message);
    event.currentTarget.reset();
    await Promise.all([loadExpenseTypes(), loadDashboard()]);
  } catch (error) { flash(error instanceof SyntaxError ? 'JSON backup fileটি সঠিক নয়।' : error.message, true); }
}

async function changePassword(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (form.new_password.value !== form.confirm_password.value) return flash('নতুন password দুটি এক নয়।', true);
  try {
    const result = await api('/api/settings/password', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
    flash(result.message);
    form.reset();
  } catch (error) { flash(error.message, true); }
}

async function logout() {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* session may already be gone */ }
  state.user = null;
  state.csrf = '';
  resetExpenseForm();
  showAuth('login');
  flash('You have been logged out.');
}

function attachEvents() {
  $$('[data-api-download]').forEach((element) => { element.href = new URL(element.dataset.apiDownload, API_BASE).toString(); });
  $('#setup-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.password.value !== form.confirm_password.value) return flash('Password দুটি এক নয়।', true);
    try {
      const result = await api('/api/auth/setup', { method: 'POST', body: { username: form.username.value, password: form.password.value, setup_token: state.setupToken } });
      applyUser(result.user, result.csrf_token);
      flash('Admin account তৈরি হয়েছে।');
      await initializeApp();
    } catch (error) { flash(error.message, true); }
  });
  $('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const form = event.currentTarget;
      const result = await api('/api/auth/login', { method: 'POST', body: { username: form.username.value, password: form.password.value } });
      applyUser(result.user, result.csrf_token);
      flash('Welcome back.');
      await initializeApp();
    } catch (error) { flash(error.message, true); }
  });
  $$('.nav-link').forEach((element) => element.addEventListener('click', () => showPage(element.dataset.page)));
  $$('[data-go]').forEach((element) => element.addEventListener('click', () => showPage(element.dataset.go)));
  $('#mobile-menu').addEventListener('click', () => $('.sidebar').classList.toggle('open'));
  $('#logout-button').addEventListener('click', logout);
  $('#expense-form').addEventListener('submit', handleExpenseSubmit);
  $('#expense-cancel-button').addEventListener('click', () => { resetExpenseForm(); showPage('dashboard'); });
  $('#ledger-range').addEventListener('change', updateCustomFields);
  $('#ledger-from').addEventListener('change', () => loadLedger().catch((error) => flash(error.message, true)));
  $('#ledger-to').addEventListener('change', () => loadLedger().catch((error) => flash(error.message, true)));
  $('#ledger-search').addEventListener('submit', (event) => { event.preventDefault(); loadLedger().catch((error) => flash(error.message, true)); });
  $('#ledger-body').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const item = state.ledgerItems.find((entry) => entry.id === Number(button.dataset.id));
    if (!item) return;
    if (button.dataset.action === 'view') return viewExpense(item);
    if (button.dataset.action === 'edit') return editExpense(item);
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      const result = await api(`/api/expenses/${item.id}`, { method: 'DELETE' });
      flash(result.message);
      await Promise.all([loadLedger(), loadDashboard()]);
    } catch (error) { flash(error.message, true); }
  });
  $('#report-month').addEventListener('change', () => loadReport().catch((error) => flash(error.message, true)));
  $('#type-form').addEventListener('submit', handleTypeSubmit);
  $('#type-body').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-type-id]');
    if (!button) return;
    try {
      const result = await api(`/api/expense-types/${button.dataset.typeId}`, { method: 'PATCH', body: { is_active: button.dataset.active !== 'true' } });
      flash(`${result.item.name} ${result.item.is_active ? 'active' : 'inactive'} করা হয়েছে।`);
      await loadExpenseTypes();
    } catch (error) { flash(error.message, true); }
  });
  $('#import-form').addEventListener('submit', importBackup);
  $('#password-form').addEventListener('submit', changePassword);
  $('#dialog-close').addEventListener('click', () => $('#expense-dialog').close());
}

attachEvents();
checkStatus();
