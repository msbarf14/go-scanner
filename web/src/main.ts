import './styles.css';

const API_BASE = '';

interface ScanResult {
  outcome: string;
  message: string;
  data?: {
    order?: {
      id: string;
      number?: string;
      race_pack_picked_up: boolean;
      race_pack_picked_up_at?: string;
    };
    participant?: {
      name?: string;
      bib_name?: string;
      bib_number?: string;
      jersey_size?: string;
    };
    ticket?: {
      category?: string;
    };
    picked_up_at?: string;
    order_id?: string;
  };
}

interface HistoryItem {
  time: string;
  orderNumber: string;
  category: string;
  bib: string;
  name: string;
  racePack: boolean;
}

let station = 1;
let racePackMode = false;
let scanHistory: HistoryItem[] = [];
let lastStatus: 'success' | 'error' | null = null;
let lastMessage: string | null = null;
let audioCtx: AudioContext | null = null;

const app = document.getElementById('app')!;

function init() {
  const params = new URLSearchParams(window.location.search);
  station = parseInt(params.get('station') || '1', 10);

  audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

  render();
  focusInput();
}

function render() {
  app.innerHTML = `
    <div class="min-h-screen bg-gray-50">
      <header class="header">
        <div class="header-inner">
          <div class="header-left">
            <div class="logo-placeholder">F</div>
            <div>
              <h1 class="header-title">Runner Scanner</h1>
              <p class="header-subtitle">Station #${station}</p>
            </div>
          </div>
          <div class="header-right">
            <label class="toggle-label">
              <span class="toggle-text ${racePackMode ? 'toggle-text-active' : ''}">Race Pack</span>
              <div class="toggle-wrapper">
                <input
                  type="checkbox"
                  id="racePackToggle"
                  class="toggle-input"
                  ${racePackMode ? 'checked' : ''}
                />
                <div class="toggle-track"></div>
                <div class="toggle-thumb"></div>
              </div>
            </label>
            <div class="status-indicator">
              <div class="status-dot"></div>
              <span>Ready</span>
            </div>
          </div>
        </div>
      </header>

      <main class="main-content">
        ${racePackMode ? `
          <div class="info-banner info-banner-active">
            <svg class="info-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span class="info-text">Mode Race Pack aktif — Scan akan membuka verifikasi penyerahan race pack.</span>
          </div>
        ` : ''}

        <form id="scanForm" class="scan-form">
          <div class="scan-box ${lastStatus === 'success' ? 'scan-box-success' : ''} ${lastStatus === 'error' ? 'scan-box-error' : ''} ${!lastStatus && racePackMode ? 'scan-box-active' : ''}">
            <label class="scan-label">
              ${racePackMode ? 'Scan QR Code untuk Penyerahan Race Pack' : 'Scan QR Code Tiket'}
            </label>
            <input
              id="scanInput"
              type="text"
              autocomplete="off"
              autofocus
              placeholder="Arahkan barcode scanner ke QR Code tiket..."
              class="scan-input"
            />
            <p class="scan-hint">
              Input otomatis dari barcode scanner USB. Klik di mana saja untuk re-focus.
            </p>
          </div>
        </form>

        ${lastStatus && lastMessage ? `
          <div class="result-banner ${lastStatus === 'success' ? 'result-success' : 'result-error'}">
            ${lastStatus === 'success' ? `
              <svg class="result-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ` : `
              <svg class="result-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            `}
            <span class="result-text">${lastMessage}</span>
          </div>
        ` : ''}

        <div class="history-card">
          <div class="history-header">
            <h2 class="history-title">Riwayat Scan</h2>
            <span class="history-count">${scanHistory.length} scan</span>
          </div>

          ${scanHistory.length > 0 ? `
            <div class="history-table-wrapper">
              <table class="history-table">
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>No. Invoice</th>
                    <th>Kategori</th>
                    <th>BIB</th>
                    <th>Nama</th>
                    ${racePackMode ? '<th>Race Pack</th>' : ''}
                  </tr>
                </thead>
                <tbody>
                  ${scanHistory.map((scan, i) => `
                    <tr class="${i === 0 ? 'history-row-first' : ''}">
                      <td class="text-gray">${scan.time}</td>
                      <td class="font-mono text-xs">${scan.orderNumber}</td>
                      <td>
                        <span class="badge">${scan.category}</span>
                      </td>
                      <td class="font-bold">${scan.bib}</td>
                      <td>${scan.name}</td>
                      ${racePackMode ? `
                        <td>
                          ${scan.racePack ? `
                            <span class="badge badge-success">Diserahkan</span>
                          ` : `
                            <span class="badge badge-gray">&mdash;</span>
                          `}
                        </td>
                      ` : ''}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div class="history-empty">
              <svg class="empty-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              <p>Belum ada scan. Arahkan barcode scanner ke QR Code tiket.</p>
            </div>
          `}
        </div>
      </main>
    </div>
  `;

  document.getElementById('scanForm')?.addEventListener('submit', handleSubmit);
  document.getElementById('racePackToggle')?.addEventListener('change', (e) => {
    racePackMode = (e.target as HTMLInputElement).checked;
    render();
    focusInput();
  });

  document.addEventListener('click', () => focusInput());
}

function focusInput() {
  const input = document.getElementById('scanInput') as HTMLInputElement;
  if (input) {
    setTimeout(() => input.focus(), 50);
  }
}

function playBeep(type: 'success' | 'error') {
  if (!audioCtx) return;

  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.connect(gain);
  gain.connect(audioCtx.destination);

  if (type === 'success') {
    oscillator.frequency.value = 880;
    oscillator.type = 'sine';
    gain.gain.value = 0.3;
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.15);
  } else {
    oscillator.frequency.value = 300;
    oscillator.type = 'square';
    gain.gain.value = 0.2;
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.3);
  }
}

async function handleSubmit(e: Event) {
  e.preventDefault();
  const input = document.getElementById('scanInput') as HTMLInputElement;
  const payload = input.value.trim();
  input.value = '';

  if (!payload) {
    setStatus('error', 'Input kosong');
    return;
  }

  const orderId = extractOrderId(payload);
  if (!orderId) {
    setStatus('error', 'QR Code tidak valid — format URL tidak dikenali');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/scans/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload }),
    });

    const data: ScanResult = await res.json();
    handleScanResult(data, payload);
  } catch {
    setStatus('error', 'Koneksi bermasalah');
  }
}

function extractOrderId(input: string): string | null {
  const ulidPattern = '[0-9A-HJ-NP-Za-hj-np-z]{26}';
  const urlMatch = input.match(new RegExp(`/ticket/(${ulidPattern})`, 'i'));
  if (urlMatch) return urlMatch[1];

  const rawMatch = input.match(new RegExp(`^(${ulidPattern})$`, 'i'));
  if (rawMatch) return input;

  return null;
}

function handleScanResult(data: ScanResult, originalPayload: string) {
  const { outcome, message } = data;

  switch (outcome) {
    case 'valid':
      if (racePackMode) {
        showVerification(data, originalPayload);
      } else {
        const order = data.data?.order;
        const participant = data.data?.participant;
        const bib = participant?.bib_number || '-';
        const name = participant?.name || '-';
        const category = data.data?.ticket?.category || '-';

        addToHistory(
          order?.number || '-',
          category,
          bib,
          name,
          false
        );
        setStatus('success', `#${bib} — ${name}`);
      }
      break;
    case 'already_picked_up':
      setStatus('error', message);
      break;
    case 'picked_up':
      const pData = data.data;
      const pBib = pData?.participant?.bib_number || '-';
      const pName = pData?.participant?.name || '-';
      addToHistory(
        pData?.order?.number || '-',
        pData?.ticket?.category || '-',
        pBib,
        pName,
        true
      );
      setStatus('success', message);
      break;
    default:
      setStatus('error', message);
  }
}

function showVerification(data: ScanResult, originalPayload: string) {
  const order = data.data?.order;
  const participant = data.data?.participant;
  const ticket = data.data?.ticket;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h2>Verifikasi & Penyerahan Race Pack</h2>
      </div>
      <div class="modal-body">
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Order</span>
            <span class="info-value">${order?.number || order?.id || '-'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Nama</span>
            <span class="info-value">${participant?.name || '-'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">BIB</span>
            <span class="info-value">${participant?.bib_name || '-'} (${participant?.bib_number || '-'})</span>
          </div>
          <div class="info-item">
            <span class="info-label">Kategori</span>
            <span class="info-value">${ticket?.category || '-'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Jersey</span>
            <span class="info-value">${participant?.jersey_size || '-'}</span>
          </div>
        </div>
      </div>
      <div class="modal-actions">
        <button id="confirmPickup" class="btn btn-success">Konfirmasi Serahkan Race Pack</button>
        <button id="cancelPickup" class="btn btn-secondary">Batal</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('confirmPickup')?.addEventListener('click', async () => {
    document.body.removeChild(modal);
    await confirmPickup(order?.id || originalPayload);
  });

  document.getElementById('cancelPickup')?.addEventListener('click', () => {
    document.body.removeChild(modal);
    focusInput();
  });
}

async function confirmPickup(orderId: string) {
  setStatus('success', 'Mengonfirmasi pickup...');

  try {
    const res = await fetch(`${API_BASE}/api/orders/${orderId}/pickup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data: ScanResult = await res.json();
    handleScanResult(data, orderId);
  } catch {
    setStatus('error', 'Koneksi bermasalah. Jangan serahkan race pack.');
  }
}

function setStatus(status: 'success' | 'error', message: string) {
  lastStatus = status;
  lastMessage = message;
  playBeep(status);
  render();
  focusInput();
}

function addToHistory(orderNumber: string, category: string, bib: string, name: string, racePack: boolean) {
  const now = new Date();
  const time = now.toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Makassar',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  scanHistory.unshift({
    time,
    orderNumber,
    category,
    bib,
    name,
    racePack,
  });

  if (scanHistory.length > 20) {
    scanHistory.length = 20;
  }
}

init();
