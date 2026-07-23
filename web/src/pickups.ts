import './styles.css';
import './pickups.css';

const API_BASE = '';
const PAGE_LIMIT = 50;
const REFRESH_INTERVAL_MS = 5000;

type AuthStatus = 'unknown' | 'anonymous' | 'authenticated' | 'forbidden';
type PageStatus = 'checking' | 'login_required' | 'loading' | 'ready' | 'empty' | 'offline' | 'error' | 'forbidden';

interface ApiResponse<T = Record<string, unknown>> {
  outcome: string;
  message: string;
  data?: T;
}

interface AuthData {
  authenticated?: boolean;
  user_id?: string;
  token?: string;
}

interface PickupListData {
  items: PickupItem[];
  page: {
    limit: number;
    has_more: boolean;
    next_cursor?: string;
  };
}

interface PickupItem {
  order: {
    id: string;
    number?: string;
    status?: string;
    picked_up_at: string;
  };
  participant: {
    name?: string;
    bib_name?: string;
    bib_number?: string;
    jersey_size?: string;
  };
  ticket: {
    category?: string;
  };
  operator: {
    name?: string;
  };
}

interface Filters {
  q: string;
  category: string;
  pickedUpFrom: string;
  pickedUpTo: string;
}

let authStatus: AuthStatus = 'unknown';
let pageStatus: PageStatus = 'checking';
let csrfToken: string | null = null;
let items: PickupItem[] = [];
let nextCursor: string | null = null;
let hasMore = false;
let lastUpdatedAt: string | null = null;
let statusMessage = 'Memeriksa session...';
let loginModalOpen = false;
let loginSubmitting = false;
let loginError = '';
let logoutSubmitting = false;
let activeFetch: AbortController | null = null;
let filterTimer: number | null = null;
let refreshTimer: number | null = null;
let filters: Filters = readFiltersFromURL();

const app = document.getElementById('app')!;

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case "'":
        return '&#39;';
      case '"':
        return '&quot;';
      default:
        return char;
    }
  });
}

function init() {
  render();
  void refreshSession();
  window.addEventListener('online', () => {
    if (authStatus === 'authenticated') void loadPickups({ reset: true });
  });
  window.addEventListener('offline', () => {
    pageStatus = 'offline';
    statusMessage = 'Browser sedang offline.';
    render();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && authStatus === 'authenticated' && navigator.onLine) void loadPickups({ reset: true, silent: true });
  });
  refreshTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible' && authStatus === 'authenticated' && navigator.onLine) void loadPickups({ reset: true, silent: true });
  }, REFRESH_INTERVAL_MS);
}

function render() {
  app.innerHTML = `
    <div class="min-h-screen bg-gray-50 pickups-shell">
      <header class="header">
        <div class="header-inner">
          <div class="header-left">
            <div class="logo-placeholder">F</div>
            <div>
              <h1 class="header-title">Data Pickup Race Pack</h1>
              <p class="header-subtitle">Monitoring peserta/order yang sudah mengambil race pack</p>
            </div>
          </div>
          <div class="header-actions">
            <a class="header-link header-icon-only" href="/runner-scanner" aria-label="Kembali ke Scanner" title="Kembali ke Scanner">
              <svg class="header-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </a>
            ${authStatus === 'authenticated' ? `<button id="refreshButton" class="btn-secondary header-action-button header-icon-only" type="button" aria-label="Refresh data pickup" title="Refresh data pickup">
              <svg class="header-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992V4.356M20.49 9.348A9 9 0 105.64 18.36" />
              </svg>
            </button>` : ''}
            ${authStatus === 'authenticated' ? `<button id="logoutButton" class="btn-danger header-action-button header-icon-only" type="button" ${logoutSubmitting ? 'disabled' : ''} aria-label="Logout" title="Logout">
              <svg class="header-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </button>` : `<button id="loginButton" class="btn-primary header-action-button" type="button" aria-label="Login">
              <svg class="header-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3-6l3 3m0 0l-3 3m3-3H9" />
              </svg>
              <span class="header-action-label">Login</span>
            </button>`}
            <div class="status-indicator status-${statusClass()}">
              <div class="status-dot"></div>
              <span>${escapeHtml(statusLabel())}</span>
            </div>
          </div>
        </div>
      </header>

      <main class="main-content">
        <div class="pickups-note">Halaman ini menampilkan status akhir pickup dari database. Ini bukan audit scan, tidak menyimpan station, dan tidak menampilkan data kontak/identitas peserta.</div>
        ${authStatus === 'authenticated' ? renderFilters() : renderLoginRequired()}
        ${renderContent()}
      </main>

      ${loginModalOpen ? renderLoginModal() : ''}
    </div>
  `;

  bindEvents();
}

function renderLoginRequired(): string {
  if (pageStatus === 'checking') {
    return '<div class="login-required-state">Memeriksa session operator...</div>';
  }
  if (authStatus === 'forbidden') {
    return '<div class="error-state">Anda tidak memiliki akses scanner untuk membuka data pickup.</div>';
  }
  return '<div class="login-required-state">Silakan login operator Race Pack untuk melihat data pickup. Data tidak dimuat sebelum session valid.</div>';
}

function renderFilters(): string {
  return `
    <section class="filters-card">
      <form id="filtersForm" class="filters-form">
        <div class="filter-field">
          <label class="filter-label" for="searchInput">Pencarian</label>
          <input id="searchInput" class="filter-input" type="search" maxlength="100" autocomplete="off" placeholder="Order, BIB, atau nama" value="${escapeHtml(filters.q)}" />
        </div>
        <div class="filter-field">
          <label class="filter-label" for="fromInput">Dari</label>
          <input id="fromInput" class="filter-input" type="datetime-local" value="${escapeHtml(filters.pickedUpFrom)}" />
        </div>
        <div class="filter-field">
          <label class="filter-label" for="toInput">Sampai</label>
          <input id="toInput" class="filter-input" type="datetime-local" value="${escapeHtml(filters.pickedUpTo)}" />
        </div>
        <div class="filter-field">
          <label class="filter-label" for="categoryInput">Kategori</label>
          <input id="categoryInput" class="filter-input" type="text" maxlength="100" autocomplete="off" placeholder="5K" value="${escapeHtml(filters.category)}" />
        </div>
        <div class="filter-actions">
          <button id="applyFiltersButton" class="btn-primary" type="submit">Terapkan</button>
          <button id="resetFiltersButton" class="btn-secondary" type="button">Reset</button>
        </div>
      </form>
    </section>
  `;
}

function renderContent(): string {
  if (authStatus !== 'authenticated') return '';
  if (pageStatus === 'loading' && items.length === 0) return '<div class="empty-state">Memuat data pickup...</div>';
  if (pageStatus === 'offline') return '<div class="error-state">Browser offline. Data pickup tidak ditampilkan dari cache.</div>';
  if (pageStatus === 'error') return `<div class="error-state">${escapeHtml(statusMessage)}</div>`;
  if (pageStatus === 'empty') return '<div class="empty-state">Belum ada data pickup sesuai filter.</div>';

  return `
    <section class="pickups-card">
      <div class="pickups-card-header">
        <div>
          <h2 class="pickups-title">Daftar Pickup</h2>
          <p class="pickups-meta">${items.length} item dimuat${lastUpdatedAt ? ` · Refresh terakhir ${escapeHtml(formatDateTime(lastUpdatedAt))}` : ''}</p>
        </div>
        ${pageStatus === 'loading' ? '<span class="status-pill">Memuat...</span>' : '<span class="status-pill">Aktif</span>'}
      </div>
      <div class="pickups-table-wrapper">
        <table class="pickups-table">
          <thead>
            <tr>
              <th>Waktu Pickup</th>
              <th>Order</th>
              <th>BIB</th>
              <th>Peserta</th>
              <th>Kategori</th>
              <th>Jersey</th>
              <th>Operator</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(renderTableRow).join('')}
          </tbody>
        </table>
      </div>
      <div class="pickups-mobile-list">
        ${items.map(renderMobileCard).join('')}
      </div>
      ${hasMore ? '<div class="load-more-row"><button id="loadMoreButton" class="btn-secondary" type="button">Muat lebih banyak</button></div>' : ''}
    </section>
  `;
}

function renderTableRow(item: PickupItem): string {
  return `
    <tr>
      <td><div class="value-primary">${escapeHtml(formatDateTime(item.order.picked_up_at))}</div></td>
      <td><div class="value-primary">${escapeHtml(item.order.number || '-')}</div><div class="value-secondary">${escapeHtml(item.order.status || '-')}</div></td>
      <td><div class="value-primary">${escapeHtml(item.participant.bib_number || '-')}</div><div class="value-secondary">${escapeHtml(item.participant.bib_name || '-')}</div></td>
      <td><div class="value-primary">${escapeHtml(item.participant.name || '-')}</div></td>
      <td>${escapeHtml(item.ticket.category || '-')}</td>
      <td>${escapeHtml(item.participant.jersey_size || '-')}</td>
      <td>${escapeHtml(item.operator.name || 'Operator tidak tersedia')}</td>
    </tr>
  `;
}

function renderMobileCard(item: PickupItem): string {
  return `
    <article class="pickup-card">
      <div class="pickup-card-header">
        <div>
          <div class="value-primary">${escapeHtml(item.order.number || '-')}</div>
          <div class="value-secondary">${escapeHtml(formatDateTime(item.order.picked_up_at))}</div>
        </div>
        <span class="status-pill">${escapeHtml(item.order.status || '-')}</span>
      </div>
      <div class="pickup-card-grid">
        ${renderMobileField('BIB', item.participant.bib_number || '-')}
        ${renderMobileField('Peserta', item.participant.name || '-')}
        ${renderMobileField('BIB Name', item.participant.bib_name || '-')}
        ${renderMobileField('Kategori', item.ticket.category || '-')}
        ${renderMobileField('Jersey', item.participant.jersey_size || '-')}
        ${renderMobileField('Operator', item.operator.name || 'Operator tidak tersedia')}
      </div>
    </article>
  `;
}

function renderMobileField(label: string, value: string): string {
  return `<div><div class="pickup-field-label">${escapeHtml(label)}</div><div class="pickup-field-value">${escapeHtml(value)}</div></div>`;
}

function renderLoginModal(): string {
  return `
    <div class="login-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="loginTitle">
      <form id="loginForm" class="login-modal">
        <div class="login-modal-header">
          <h2 id="loginTitle" class="login-modal-title">Login Operator Race Pack</h2>
          <p class="login-modal-subtitle">Gunakan akun Laravel yang memiliki akses scanner.</p>
        </div>
        <div class="login-modal-body">
          ${loginError ? `<div class="login-error">${escapeHtml(loginError)}</div>` : ''}
          <div class="filter-field">
            <label class="filter-label" for="identityInput">Username / Email</label>
            <input id="identityInput" class="filter-input" type="text" autocomplete="username" required />
          </div>
          <div class="filter-field">
            <label class="filter-label" for="passwordInput">Password</label>
            <input id="passwordInput" class="filter-input" type="password" autocomplete="current-password" required />
          </div>
        </div>
        <div class="login-modal-footer">
          <button id="loginCancel" class="btn-secondary" type="button" ${loginSubmitting ? 'disabled' : ''}>Cancel</button>
          <button class="btn-primary" type="submit" ${loginSubmitting ? 'disabled' : ''}>${loginSubmitting ? 'Login...' : 'Login'}</button>
        </div>
      </form>
    </div>
  `;
}

function bindEvents() {
  document.getElementById('loginButton')?.addEventListener('click', openLoginModal);
  document.getElementById('logoutButton')?.addEventListener('click', () => void logout());
  document.getElementById('refreshButton')?.addEventListener('click', () => void loadPickups({ reset: true }));
  document.getElementById('loadMoreButton')?.addEventListener('click', () => void loadPickups({ reset: false }));
  document.getElementById('loginCancel')?.addEventListener('click', closeLoginModal);
  document.getElementById('loginForm')?.addEventListener('submit', (event) => void submitLogin(event));
  document.getElementById('filtersForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    updateFiltersFromInputs();
    void loadPickups({ reset: true });
  });
  document.getElementById('resetFiltersButton')?.addEventListener('click', () => {
    filters = { q: '', category: '', pickedUpFrom: '', pickedUpTo: '' };
    writeFiltersToURL();
    void loadPickups({ reset: true });
  });
  for (const id of ['searchInput', 'categoryInput', 'fromInput', 'toInput']) {
    document.getElementById(id)?.addEventListener('input', scheduleFilterLoad);
  }
  if (loginModalOpen) setTimeout(() => document.getElementById('identityInput')?.focus(), 0);
}

async function refreshSession() {
  try {
    const response = await fetch(`${API_BASE}/auth/session`, { credentials: 'same-origin', cache: 'no-store' });
    if (response.ok) {
      authStatus = 'authenticated';
      pageStatus = 'loading';
      loginModalOpen = false;
      render();
      await loadPickups({ reset: true });
      return;
    }
    clearSensitiveData();
    if (response.status === 403) {
      authStatus = 'forbidden';
      pageStatus = 'forbidden';
      statusMessage = 'Akses ditolak.';
    } else {
      authStatus = 'anonymous';
      pageStatus = 'login_required';
      loginModalOpen = true;
      statusMessage = 'Login diperlukan.';
    }
    render();
  } catch {
    authStatus = 'anonymous';
    pageStatus = navigator.onLine ? 'error' : 'offline';
    statusMessage = navigator.onLine ? 'Gagal memeriksa session.' : 'Browser sedang offline.';
    loginModalOpen = navigator.onLine;
    clearSensitiveData();
    render();
  }
}

async function loadPickups(options: { reset: boolean; silent?: boolean }) {
  if (authStatus !== 'authenticated') return;
  if (!navigator.onLine) {
    pageStatus = 'offline';
    statusMessage = 'Browser sedang offline.';
    clearSensitiveData();
    render();
    return;
  }

  activeFetch?.abort();
  activeFetch = new AbortController();
  if (options.reset) nextCursor = null;
  if (!options.silent || items.length === 0) {
    pageStatus = 'loading';
    render();
  }

  try {
    const params = buildPickupParams(options.reset ? null : nextCursor);
    const response = await fetch(`${API_BASE}/api/race-pack-pickups?${params}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: activeFetch.signal,
    });
    if (response.status === 401) {
      handleAuthExpired();
      return;
    }
    if (response.status === 403) {
      clearSensitiveData();
      authStatus = 'forbidden';
      pageStatus = 'forbidden';
      statusMessage = 'Akses ditolak.';
      render();
      return;
    }
    const data: ApiResponse<PickupListData> = await response.json();
    if (!response.ok || !data.data) {
      pageStatus = 'error';
      statusMessage = data.message || 'Gagal memuat data pickup.';
      if (items.length === 0) clearSensitiveData();
      render();
      return;
    }

    if (options.reset) mergeFirstPage(data.data.items);
    else appendItems(data.data.items);
    hasMore = data.data.page.has_more;
    nextCursor = data.data.page.next_cursor ?? null;
    lastUpdatedAt = new Date().toISOString();
    pageStatus = items.length === 0 ? 'empty' : 'ready';
    statusMessage = 'Data pickup aktif.';
    render();
  } catch (error) {
    if ((error as Error).name === 'AbortError') return;
    pageStatus = navigator.onLine ? 'error' : 'offline';
    statusMessage = navigator.onLine ? 'Gagal memuat data pickup.' : 'Browser sedang offline.';
    if (items.length === 0) clearSensitiveData();
    render();
  }
}

async function submitLogin(event: Event) {
  event.preventDefault();
  if (loginSubmitting) return;
  const identity = (document.getElementById('identityInput') as HTMLInputElement | null)?.value.trim() || '';
  const password = (document.getElementById('passwordInput') as HTMLInputElement | null)?.value || '';
  if (!identity || !password) return;

  loginSubmitting = true;
  loginError = '';
  render();

  try {
    const token = await getCSRFToken();
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      body: JSON.stringify({ identity, password }),
    });
    const data: ApiResponse<AuthData> = await response.json();
    if (!response.ok || data.outcome !== 'valid') {
      loginError = data.message || 'Login gagal.';
      loginSubmitting = false;
      render();
      return;
    }

    authStatus = 'authenticated';
    pageStatus = 'loading';
    loginModalOpen = false;
    loginSubmitting = false;
    loginError = '';
    render();
    await loadPickups({ reset: true });
  } catch {
    loginError = 'Login gagal. Periksa koneksi server.';
    loginSubmitting = false;
    render();
  }
}

async function logout() {
  if (logoutSubmitting) return;
  logoutSubmitting = true;
  clearSensitiveData();
  render();

  try {
    const token = await getCSRFToken();
    const response = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      logoutSubmitting = false;
      statusMessage = 'Logout gagal di server.';
      pageStatus = 'error';
      render();
      return;
    }
    authStatus = 'anonymous';
    pageStatus = 'login_required';
    csrfToken = null;
    logoutSubmitting = false;
    loginModalOpen = true;
    render();
  } catch {
    logoutSubmitting = false;
    pageStatus = 'error';
    statusMessage = 'Logout gagal. Periksa koneksi server.';
    render();
  }
}

async function getCSRFToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const response = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'same-origin', cache: 'no-store' });
  const data: ApiResponse<AuthData> = await response.json();
  if (!response.ok || !data.data?.token) throw new Error('CSRF token unavailable');
  csrfToken = data.data.token;
  return csrfToken;
}

function buildPickupParams(cursor: string | null): URLSearchParams {
  const params = new URLSearchParams();
  params.set('limit', PAGE_LIMIT.toString());
  if (filters.q) params.set('q', filters.q);
  if (filters.category) params.set('category', filters.category);
  const from = localDateTimeToRFC3339(filters.pickedUpFrom);
  const to = localDateTimeToRFC3339(filters.pickedUpTo);
  if (from) params.set('picked_up_from', from);
  if (to) params.set('picked_up_to', to);
  if (cursor) params.set('cursor', cursor);
  return params;
}

function scheduleFilterLoad() {
  updateFiltersFromInputs();
  if (filterTimer) window.clearTimeout(filterTimer);
  filterTimer = window.setTimeout(() => void loadPickups({ reset: true }), 300);
}

function updateFiltersFromInputs() {
  filters = {
    q: (document.getElementById('searchInput') as HTMLInputElement | null)?.value.trim() || '',
    category: (document.getElementById('categoryInput') as HTMLInputElement | null)?.value.trim() || '',
    pickedUpFrom: (document.getElementById('fromInput') as HTMLInputElement | null)?.value || '',
    pickedUpTo: (document.getElementById('toInput') as HTMLInputElement | null)?.value || '',
  };
  writeFiltersToURL();
}

function readFiltersFromURL(): Filters {
  const params = new URLSearchParams(window.location.search);
  return {
    q: params.get('q') || '',
    category: params.get('category') || '',
    pickedUpFrom: rfc3339ToLocalDateTime(params.get('picked_up_from')),
    pickedUpTo: rfc3339ToLocalDateTime(params.get('picked_up_to')),
  };
}

function writeFiltersToURL() {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.category) params.set('category', filters.category);
  const from = localDateTimeToRFC3339(filters.pickedUpFrom);
  const to = localDateTimeToRFC3339(filters.pickedUpTo);
  if (from) params.set('picked_up_from', from);
  if (to) params.set('picked_up_to', to);
  const query = params.toString();
  const nextURL = `${window.location.pathname}${query ? `?${query}` : ''}`;
  window.history.replaceState({}, '', nextURL);
}

function localDateTimeToRFC3339(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

function rfc3339ToLocalDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function mergeFirstPage(incoming: PickupItem[]) {
  const byID = new Map<string, PickupItem>();
  for (const item of incoming) byID.set(item.order.id, item);
  for (const item of items) {
    if (!byID.has(item.order.id)) byID.set(item.order.id, item);
  }
  items = Array.from(byID.values()).sort(comparePickupItems);
}

function appendItems(incoming: PickupItem[]) {
  const seen = new Set(items.map((item) => item.order.id));
  for (const item of incoming) {
    if (!seen.has(item.order.id)) items.push(item);
  }
  items.sort(comparePickupItems);
}

function comparePickupItems(a: PickupItem, b: PickupItem): number {
  const timeDiff = new Date(b.order.picked_up_at).getTime() - new Date(a.order.picked_up_at).getTime();
  if (timeDiff !== 0) return timeDiff;
  return b.order.id.localeCompare(a.order.id);
}

function clearSensitiveData() {
  activeFetch?.abort();
  activeFetch = null;
  items = [];
  nextCursor = null;
  hasMore = false;
  lastUpdatedAt = null;
}

function handleAuthExpired() {
  clearSensitiveData();
  authStatus = 'anonymous';
  pageStatus = 'login_required';
  csrfToken = null;
  loginModalOpen = true;
  statusMessage = 'Session berakhir. Silakan login ulang.';
  render();
}

function openLoginModal() {
  loginModalOpen = true;
  loginError = '';
  render();
}

function closeLoginModal() {
  loginModalOpen = false;
  loginError = '';
  if (authStatus !== 'authenticated') pageStatus = 'login_required';
  render();
}

function statusLabel(): string {
  if (!navigator.onLine) return 'Offline';
  switch (pageStatus) {
    case 'checking':
      return 'Memeriksa session';
    case 'login_required':
      return 'Perlu login';
    case 'loading':
      return 'Memuat';
    case 'ready':
      return 'Aktif';
    case 'empty':
      return 'Kosong';
    case 'offline':
      return 'Offline';
    case 'forbidden':
      return 'Akses ditolak';
    default:
      return 'Error';
  }
}

function statusClass(): string {
  if (!navigator.onLine || pageStatus === 'offline' || pageStatus === 'error' || pageStatus === 'forbidden') return 'offline';
  if (pageStatus === 'loading' || pageStatus === 'checking') return 'checking';
  return 'ready';
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

window.addEventListener('beforeunload', () => {
  if (refreshTimer) window.clearInterval(refreshTimer);
});

init();
