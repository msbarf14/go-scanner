import './display.css';

const API_BASE = '';
const ASSET_BASE_URL = (import.meta.env.VITE_ASSET_BASE_URL || 'https://r2.fenturun2026.com/assets').replace(/\/$/, '');
const ASSET_VERSION = import.meta.env.VITE_ASSET_VERSION ?? '11';

interface DisplayData {
  order: {
    id: string;
    number?: string;
    race_pack_picked_up: boolean;
    race_pack_picked_up_at?: string;
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
  scanned_at: string;
}

interface DisplayResponse {
  outcome: string;
  data: {
    display: DisplayData | null;
    station: string;
  };
}

interface ValidateResponse {
  outcome: string;
}

let station = 1;
let debugScanner = false;
let currentData: DisplayData | null = null;
let show = false;
let scanProcessing = false;
let scannerInput: HTMLInputElement | null = null;

const app = document.getElementById('app')!;

function assetUrl(path: string): string {
  const url = `${ASSET_BASE_URL}/${path.replace(/^\/+/, '')}`;
  return ASSET_VERSION ? `${url}?v=${encodeURIComponent(ASSET_VERSION)}` : url;
}

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
  const params = new URLSearchParams(window.location.search);
  station = normalizeStation(params.get('station'));
  debugScanner = params.get('debug') === '1';

  renderShell();
  render();
  mountScannerInput();
  void fetchDisplayData();
  setInterval(() => void fetchDisplayData(), 500);
}

function normalizeStation(value: string | null): number {
  if (!value) return 1;

  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 99 ? parsed : 1;
}

function mountScannerInput() {
  const host = document.createElement('div');
  host.className = `display-scanner ${debugScanner ? 'display-scanner-debug' : 'display-scanner-hidden'}`;

  const form = document.createElement('form');
  form.className = 'display-scanner-form';
  form.setAttribute('aria-label', 'Scanner QR Runner Display');

  const input = document.createElement('input');
  input.id = 'displayScannerInput';
  input.className = 'display-scanner-input';
  input.type = 'text';
  input.autocomplete = 'off';
  input.placeholder = 'Scan atau masukkan QR Code tiket...';
  input.setAttribute('aria-label', 'Input QR Code tiket');

  form.appendChild(input);
  host.appendChild(form);
  document.body.appendChild(host);
  scannerInput = input;

  form.addEventListener('submit', (event) => void handleScanSubmit(event));
  input.addEventListener('blur', () => setTimeout(focusScannerInput, 0));
  document.addEventListener('click', focusScannerInput);
  window.addEventListener('focus', focusScannerInput);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') focusScannerInput();
  });

  setTimeout(focusScannerInput, 0);
  setInterval(focusScannerInput, 250);
}

function focusScannerInput() {
  if (!scanProcessing && scannerInput && document.visibilityState === 'visible') scannerInput.focus();
}

async function handleScanSubmit(event: SubmitEvent) {
  event.preventDefault();
  if (scanProcessing || !scannerInput) return;

  const payload = scannerInput.value.trim();
  scannerInput.value = '';
  if (!payload) {
    focusScannerInput();
    return;
  }

  scanProcessing = true;

  try {
    const response = await fetch(`${API_BASE}/api/scans/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload, station: station.toString() }),
    });
    const data: ValidateResponse = await response.json();

    if (data.outcome === 'valid' || data.outcome === 'already_picked_up') {
      await fetchDisplayData();
    }
  } catch {
  } finally {
    scanProcessing = false;
    focusScannerInput();
  }
}

async function fetchDisplayData() {
  try {
    const res = await fetch(`${API_BASE}/api/display?station=${station}`);
    if (!res.ok) return;

    const data: DisplayResponse = await res.json();
    const newData = data.data.display;

    if (newData && (!currentData || newData.order.id !== currentData.order.id || newData.scanned_at !== currentData.scanned_at)) {
      currentData = newData;
      show = false;
      render();
      setTimeout(() => {
        show = true;
        render();
      }, 50);
    } else if (!newData && currentData) {
      currentData = null;
      show = false;
      render();
    }
  } catch {
    // Ignore fetch errors
  }
}

function renderShell() {
  app.innerHTML = `
    <div class="display-container">
      <div class="display-bg" aria-hidden="true">
        <img src="${assetUrl('img/2026-runner-display.jpg')}" loading="eager" decoding="async" fetchpriority="high" alt="" />
        <div class="display-overlay"></div>
      </div>

      <div class="display-content">
        <header class="display-header">
          <div class="header-inner">
            <div class="brand-official">
              <div class="station-label">Station #${escapeHtml(station)}</div>
              <img src="${assetUrl('img/2026-official.png')}" class="official-logo" loading="eager" decoding="async" alt="Official logo" />
            </div>
            <div class="brand-event">
              <img src="${assetUrl('img/2026-logo.png')}" class="event-logo" loading="eager" decoding="async" alt="Fenturun 2026" />
            </div>
          </div>
        </header>

        <main class="display-main"></main>

        <div class="partner-section">
          <div class="partner-inner">
            <img src="${assetUrl('img/2026-partner.png')}" class="partner-logo" loading="eager" decoding="async" alt="Partner logo" />
          </div>
        </div>

        <footer class="display-footer">
          <p>&copy; 2026 Fenturun 2026. Microsite By <a href="https://deka.co.id" target="_blank" rel="noopener noreferrer">DEKA</a>.</p>
        </footer>
      </div>
    </div>
  `;
}

function render() {
  const displayMain = app.querySelector<HTMLElement>('.display-main');
  if (!displayMain) return;

  const category = currentData?.ticket?.category || '-';
  const participantName = currentData?.participant?.name || '-';
  const bibName = currentData?.participant?.bib_name || '';
  const bibNumber = currentData?.participant?.bib_number || '—';
  const displayName = bibName || participantName;
  const showLegalName = Boolean(bibName && bibName !== participantName);

  displayMain.innerHTML = currentData ? `
    <section class="runner-content ${show ? 'runner-content-show' : 'runner-content-hide'}" aria-live="polite">
      <div class="runner-welcome-row">
        <h1 class="welcome-title">WELCOME, RUNNER!</h1>
        <div class="category-badge">${escapeHtml(category)}</div>
      </div>

      <div class="runner-hero">
        <div class="runner-copy">
          <div class="bib-number">${escapeHtml(bibNumber)}</div>

          <div class="runner-name-block">
            <h2 class="runner-bib-name">BIB: ${escapeHtml(displayName)}</h2>
            ${showLegalName ? `<p class="runner-legal-name">${escapeHtml(participantName)}</p>` : ''}
          </div>
        </div>
      </div>
    </section>
  ` : `
    <section class="idle-content" aria-live="polite">
      <div class="qr-icon-wrapper">
        <svg class="qr-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
      </div>
      <h2 class="idle-title">Scan QR Code Tiket Anda</h2>
      <p class="idle-subtitle">Tunjukkan QR Code e-Ticket ke petugas scanner</p>
    </section>
  `;
}

init();
