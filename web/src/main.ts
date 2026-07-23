import './styles.css';
import { CameraScannerController } from './scanner/camera';
import {
  authFeedback,
  duplicateFeedback,
  emptyCameraFeedback,
  loadingFeedback,
  offlineFeedback,
  pickupSuccessFeedback,
  scanFeedback,
  unreadableFeedback,
  type CameraFeedback,
} from './scanner/feedback';
import { normalizeManualLookup, type ManualLookupType } from './scanner/manual-lookup';
import { extractOrderId } from './scanner/parser';
import type { CameraCapabilities, CameraStatus } from './scanner/types';

const API_BASE = '';
const HISTORY_STORAGE_KEY_PREFIX = 'fenturun_scanner_history';
const HISTORY_LIMIT = 20;

type AuthStatus = 'unknown' | 'anonymous' | 'authenticated';
type ConnectionStatus = 'checking' | 'ready' | 'offline' | 'database_not_ready';
type DisplayStatus = ConnectionStatus | 'processing' | 'verification_pending';
type InputMode = 'scanner' | 'camera';

interface ApiResponse<T = Record<string, unknown>> {
  outcome: string;
  message: string;
  data?: T;
}

interface ScanData {
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
}

type ScanResult = ApiResponse<ScanData>;

interface AuthData {
  authenticated?: boolean;
  user_id?: string;
  token?: string;
}

interface HistoryItem {
  time: string;
  orderNumber: string;
  category: string;
  bib: string;
  name: string;
  racePack: boolean;
}

interface VerificationState {
  modal: HTMLElement;
  orderId: string;
  confirming: boolean;
}

let station = 1;
let racePackMode = false;
let scanHistory: HistoryItem[] = [];
let audioCtx: AudioContext | null = null;
let isProcessing = false;
let authStatus: AuthStatus = 'unknown';
let csrfToken: string | null = null;
let loginModal: HTMLElement | null = null;
let activeVerification: VerificationState | null = null;
let connectionStatus: ConnectionStatus = navigator.onLine ? 'checking' : 'offline';
let inputMode: InputMode = 'scanner';
let manualLookupType: ManualLookupType = 'ticket';
let cameraRequested = false;
let cameraStatus: CameraStatus = {
  state: 'idle',
  message: 'Kamera belum aktif.',
  detail: 'USB/manual tetap bisa digunakan.',
  canRetry: false,
};
let cameraCapabilities: CameraCapabilities = {
  torch: false,
  torchEnabled: false,
};
let cameraFeedback: CameraFeedback = emptyCameraFeedback;
let cameraFeedbackTimer: number | null = null;
let lastCameraPayload = '';
let lastCameraScanAt = 0;
let cameraPagePaused = false;
let immersiveScrollY = 0;
let immersiveDocumentLocked = false;

const app = document.getElementById('app')!;
const cameraScanner = new CameraScannerController({
  onPayload: (payload) => void submitScanPayload(payload),
  onStatus: (status) => {
    cameraStatus = status;
    updateCameraUI();
  },
  onCapabilities: (capabilities) => {
    cameraCapabilities = capabilities;
    if (inputMode === 'camera') {
      render();
    } else {
      updateCameraUI();
    }
  },
  onFatalError: (message) => {
    cameraRequested = false;
    render();
    showResult('error', message);
  },
});

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
  const parsedStation = parseInt(params.get('station') || '1', 10);
  station = Number.isFinite(parsedStation) ? parsedStation : 1;

  scanHistory = loadHistory();
  audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

  registerServiceWorker();
  render();
  void refreshSession();
  void checkReadiness();

  document.addEventListener('click', () => focusInput());
  window.addEventListener('online', () => {
    setConnectionStatus('checking');
    void checkReadiness();
  });
  window.addEventListener('offline', () => setConnectionStatus('offline'));
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('pageshow', handlePageShow);
  setInterval(() => void checkReadiness(), 7000);
  setTimeout(() => focusInput(), 100);
}

function render() {
  syncImmersiveCameraDocumentState();
  app.innerHTML = inputMode === 'camera' ? renderCameraPanel() : renderScannerPage();

  document.getElementById('scanForm')?.addEventListener('submit', handleSubmit);
  document.getElementById('racePackToggle')?.addEventListener('change', (event) => {
    const checked = (event.target as HTMLInputElement).checked;
    void handleRacePackToggle(checked);
  });
  document.getElementById('logoutButton')?.addEventListener('click', () => void logout());
  document.getElementById('scannerModeButton')?.addEventListener('click', () => void setInputMode('scanner'));
  document.getElementById('cameraModeButton')?.addEventListener('click', () => void setInputMode('camera'));
  document.querySelectorAll<HTMLButtonElement>('[data-manual-lookup-type]').forEach((button) => {
    button.addEventListener('click', () => setManualLookupType(button.dataset.manualLookupType as ManualLookupType));
  });
  document.getElementById('cameraRetryButton')?.addEventListener('click', () => retryCamera());
  document.getElementById('cameraFallbackButton')?.addEventListener('click', () => void setInputMode('scanner'));
  document.getElementById('cameraFeedbackDismiss')?.addEventListener('click', () => {
    clearCameraFeedback();
    resumeCameraIfSafe();
  });
  document.getElementById('torchButton')?.addEventListener('click', () => void cameraScanner.setTorch(!cameraCapabilities.torchEnabled));
  document.getElementById('zoomControl')?.addEventListener('input', (event) => {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) void cameraScanner.setZoom(value);
  });

  if (inputMode === 'camera') {
    cameraScanner.attachVideo(document.getElementById('cameraPreview') as HTMLVideoElement | null);
  }
  if (inputMode === 'camera' && cameraRequested && !cameraScanner.isActive() && !cameraScanner.isStarting() && !cameraUnsafe()) {
    startCameraIfPossible();
  }
  focusInput();
}

function manualLookupLabel(type: ManualLookupType): string {
  switch (type) {
    case 'order_suffix':
      return 'Order suffix';
    case 'bib_number':
      return 'BIB';
    default:
      return 'QR Ticket';
  }
}

function scanInputLabel(): string {
  if (manualLookupType === 'order_suffix') return 'Input suffix nomor order';
  if (manualLookupType === 'bib_number') return 'Input nomor BIB lengkap';
  return racePackMode ? 'Scan QR Code untuk Penyerahan Race Pack' : 'Scan QR Code Tiket';
}

function scanInputPlaceholder(): string {
  if (manualLookupType === 'order_suffix') return 'Contoh: GOG';
  if (manualLookupType === 'bib_number') return 'Contoh: N0302';
  return 'Arahkan barcode scanner ke QR Code tiket...';
}

function renderManualLookupButtons(): string {
  const options: ManualLookupType[] = ['ticket', 'order_suffix', 'bib_number'];
  return `
    <div class="manual-lookup-control" role="group" aria-label="Pilih jenis input scanner">
      ${options.map((option) => `
        <button
          class="manual-lookup-button ${manualLookupType === option ? 'manual-lookup-button-active' : ''}"
          type="button"
          data-manual-lookup-type="${option}"
          aria-pressed="${manualLookupType === option}"
        >${manualLookupLabel(option)}</button>
      `).join('')}
    </div>
  `;
}

function renderScannerPage(): string {
  return `
    <div class="min-h-screen bg-gray-50">
      <header class="header">
        <div class="header-inner">
          <div class="header-left">
            <div class="logo-placeholder">F</div>
            <div>
              <h1 class="header-title">Runner Scanner</h1>
              <p class="header-subtitle">Station #${escapeHtml(station)}</p>
            </div>
          </div>
          <div class="header-right">
            <a class="header-link" href="/race-pack-pickups" aria-label="Data Pickup">
              <svg class="header-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-6h6v6m2 4H7a2 2 0 01-2-2V9.828a2 2 0 01.586-1.414l4.828-4.828a2 2 0 011.414-.586H17a2 2 0 012 2v14a2 2 0 01-2 2z" />
              </svg>
              <span class="header-action-label">Data Pickup</span>
            </a>
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
            ${authStatus === 'authenticated' ? '<button id="logoutButton" class="btn-logout" type="button">Logout</button>' : ''}
            <div id="connectionStatus" class="status-indicator status-${currentDisplayStatus()}">
              <div class="status-dot"></div>
              <span>${escapeHtml(statusLabel(currentDisplayStatus()))}</span>
            </div>
          </div>
        </div>
      </header>

      <main class="main-content">
        ${racePackMode ? `
          <div class="info-banner info-banner-active">
            <svg class="info-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span class="info-text">Mode Race Pack aktif — Scan akan membuka verifikasi penyerahan race pack.</span>
          </div>
        ` : ''}

        <form id="scanForm" class="scan-form">
          <div id="scanBox" class="scan-box">
            <div class="input-mode-control" role="group" aria-label="Pilih mode input QR">
              <button id="scannerModeButton" class="input-mode-button input-mode-button-active" type="button" aria-pressed="true" ${modeSwitchDisabled('scanner') ? 'disabled' : ''}>Scanner</button>
              <button id="cameraModeButton" class="input-mode-button" type="button" aria-pressed="false" ${modeSwitchDisabled('camera') ? 'disabled' : ''}>Kamera</button>
            </div>
            <div class="scanner-mode-panel">
              ${renderManualLookupButtons()}
              <label class="scan-label" for="scanInput">
                ${escapeHtml(scanInputLabel())}
              </label>
              <input id="scanInput" type="text" autocomplete="off" autofocus placeholder="${escapeHtml(scanInputPlaceholder())}" class="scan-input" />
              <p class="scan-hint">QR, order suffix, dan BIB dapat dipakai untuk Display Only. Login hanya diperlukan saat toggle Race Pack aktif.</p>
            </div>
          </div>
        </form>

        <div id="resultArea" class="result-area" style="display:none;"></div>

        <div id="historyCard" class="history-card">
          <div class="history-header">
            <div>
              <h2 class="history-title">Riwayat Scan</h2>
              <p class="history-note">Riwayat lokal sementara, bukan audit resmi.</p>
            </div>
            <span id="historyCount" class="history-count">${scanHistory.length} scan</span>
          </div>
          <div id="historyContent">${renderHistoryContent()}</div>
        </div>
      </main>
    </div>
  `;
}

function renderCameraPanel(): string {
  const isActive = cameraScanner.isActive();
  const isRecovering = cameraScanner.isRecovering();
  const statusClass = isRecovering ? 'camera-state-recovering' : isActive ? 'camera-state-active' : cameraStatus.state === 'error' ? 'camera-state-error' : '';
  const torchControl = cameraCapabilities.torch ? `
    <button id="torchButton" class="camera-control-button ${cameraCapabilities.torchEnabled ? 'camera-control-button-active' : ''}" type="button" aria-pressed="${cameraCapabilities.torchEnabled}" aria-label="${cameraCapabilities.torchEnabled ? 'Matikan lampu kamera' : 'Nyalakan lampu kamera'}">
      ${cameraCapabilities.torchEnabled ? 'Lampu On' : 'Lampu'}
    </button>
  ` : '';
  const zoomControl = cameraCapabilities.zoom ? `
    <label class="camera-zoom-control">
      <span>Zoom</span>
      <input id="zoomControl" type="range" min="${cameraCapabilities.zoom.min}" max="${cameraCapabilities.zoom.max}" step="${cameraCapabilities.zoom.step}" value="${cameraCapabilities.zoom.value}" aria-label="Zoom kamera" />
    </label>
  ` : '';
  const retryControl = cameraStatus.canRetry ? `<button id="cameraRetryButton" class="camera-control-button camera-primary-action" type="button">Coba Kamera Lagi</button>` : '';
  const feedbackMarkup = cameraFeedback.kind === 'none' ? '' : `
    <div id="cameraFeedback" class="camera-feedback camera-feedback-${cameraFeedback.tone}" role="status" aria-live="assertive">
      <strong>${escapeHtml(cameraFeedback.title)}</strong>
      <span>${escapeHtml(cameraFeedback.message)}</span>
      ${cameraFeedback.persistent ? '<button id="cameraFeedbackDismiss" class="camera-feedback-dismiss" type="button">Scan Berikutnya</button>' : ''}
    </div>
  `;

  return `
    <section id="cameraPanel" class="camera-shell ${statusClass}" aria-label="Scanner kamera fullscreen">
      <div class="camera-stage">
        <video id="cameraPreview" class="camera-preview ${isActive ? 'camera-preview-active' : ''}" muted playsinline></video>
        <div class="camera-gradient camera-gradient-top" aria-hidden="true"></div>
        <div class="camera-gradient camera-gradient-bottom" aria-hidden="true"></div>
        <div class="camera-viewfinder" aria-hidden="true">
          <span class="corner corner-tl"></span>
          <span class="corner corner-tr"></span>
          <span class="corner corner-bl"></span>
          <span class="corner corner-br"></span>
        </div>
      </div>

      <header class="camera-topbar">
        <div>
          <span class="camera-eyebrow">Station #${escapeHtml(station)}</span>
          <h1>${racePackMode ? 'Race Pack Scanner' : 'Runner Scanner'}</h1>
        </div>
        <div class="camera-topbar-actions">
          <span id="connectionStatus" class="camera-status-pill status-${currentDisplayStatus()}">${escapeHtml(statusLabel(currentDisplayStatus()))}</span>
          <span class="camera-mode-pill">${isRecovering ? 'Recovery' : isActive ? 'Live' : 'Standby'}</span>
          <button id="scannerModeButton" class="camera-exit-button" type="button" ${modeSwitchDisabled('scanner') ? 'disabled' : ''} aria-label="Keluar kamera dan gunakan Scanner">Scanner</button>
        </div>
      </header>

      <div class="camera-live-region" aria-live="polite">
        <span id="cameraStatus" class="camera-status ${isActive ? 'camera-status-active' : ''}">${escapeHtml(cameraStatus.message)}</span>
        <span id="cameraStatusDetail" class="camera-status-detail">${escapeHtml(cameraStatus.detail)}</span>
      </div>

      ${feedbackMarkup}

      <footer class="camera-bottom-controls">
        <p class="camera-guidance">Posisikan QR penuh di kotak. Kurangi pantulan dan gunakan Scanner/manual jika kamera belum membaca.</p>
        <div class="camera-controls">
          <button id="cameraFallbackButton" class="camera-control-button" type="button" ${modeSwitchDisabled('scanner') ? 'disabled' : ''}>Scanner/manual</button>
          ${retryControl}
          ${torchControl}
          ${zoomControl}
        </div>
      </footer>
    </section>
  `;
}

function currentDisplayStatus(): DisplayStatus {
  if (activeVerification) return 'verification_pending';
  if (isProcessing) return 'processing';
  return connectionStatus;
}

function statusLabel(status: DisplayStatus): string {
  switch (status) {
    case 'checking':
      return 'Checking';
    case 'ready':
      return 'Ready';
    case 'offline':
      return 'Offline';
    case 'database_not_ready':
      return 'DB Not Ready';
    case 'processing':
      return 'Processing';
    case 'verification_pending':
      return 'Verify Pending';
  }
}

function updateStatusIndicator() {
  const indicator = document.getElementById('connectionStatus');
  if (!indicator) return;

  const status = currentDisplayStatus();
  indicator.className = `status-indicator status-${status}`;
  const label = indicator.querySelector('span');
  if (label) {
    label.textContent = statusLabel(status);
  } else {
    indicator.textContent = statusLabel(status);
  }
}

function setConnectionStatus(status: ConnectionStatus) {
  connectionStatus = status;
  updateStatusIndicator();
}

async function checkReadiness() {
  if (!navigator.onLine) {
    setConnectionStatus('offline');
    return;
  }

  if (connectionStatus === 'checking') updateStatusIndicator();

  try {
    const response = await fetch(`${API_BASE}/readyz`, { cache: 'no-store' });
    setConnectionStatus(response.ok ? 'ready' : 'database_not_ready');
  } catch {
    setConnectionStatus('offline');
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      void navigator.serviceWorker.register('/service-worker.js');
    });
  }
}

function historyStorageKey(): string {
  return `${HISTORY_STORAGE_KEY_PREFIX}_${station}`;
}

function loadHistory(): HistoryItem[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(historyStorageKey()) || '[]');
    if (!Array.isArray(parsed)) return [];

    return parsed.slice(0, HISTORY_LIMIT).filter((item): item is HistoryItem => (
      typeof item?.time === 'string' &&
      typeof item?.orderNumber === 'string' &&
      typeof item?.category === 'string' &&
      typeof item?.bib === 'string' &&
      typeof item?.name === 'string' &&
      typeof item?.racePack === 'boolean'
    ));
  } catch {
    return [];
  }
}

function saveHistory() {
  sessionStorage.setItem(historyStorageKey(), JSON.stringify(scanHistory.slice(0, HISTORY_LIMIT)));
}

function clearHistory() {
  scanHistory = [];
  sessionStorage.removeItem(historyStorageKey());
}

function renderHistoryContent(): string {
  if (scanHistory.length === 0) {
    return `
      <div class="history-empty">
        <svg class="empty-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
        <p>Belum ada scan. Arahkan barcode scanner ke QR Code tiket.</p>
      </div>
    `;
  }

  return `
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
              <td class="text-gray">${escapeHtml(scan.time)}</td>
              <td class="font-mono text-xs">${escapeHtml(scan.orderNumber)}</td>
              <td><span class="badge">${escapeHtml(scan.category)}</span></td>
              <td class="font-bold">${escapeHtml(scan.bib)}</td>
              <td>${escapeHtml(scan.name)}</td>
              ${racePackMode ? `
                <td>
                  ${scan.racePack ? '<span class="badge badge-success">Diserahkan</span>' : '<span class="badge badge-gray">&mdash;</span>'}
                </td>
              ` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function focusInput() {
  if (inputMode !== 'scanner' || loginModal || activeVerification) return;
  const input = document.getElementById('scanInput') as HTMLInputElement | null;
  if (input && !isProcessing) input.focus();
}

function syncImmersiveCameraDocumentState() {
  const shouldLock = inputMode === 'camera';
  if (shouldLock && !immersiveDocumentLocked) {
    immersiveScrollY = window.scrollY;
    document.documentElement.classList.add('camera-immersive-active');
    document.body.classList.add('camera-immersive-active');
    document.body.style.top = `-${immersiveScrollY}px`;
    immersiveDocumentLocked = true;
    return;
  }

  if (!shouldLock && immersiveDocumentLocked) {
    document.documentElement.classList.remove('camera-immersive-active');
    document.body.classList.remove('camera-immersive-active');
    document.body.style.top = '';
    window.scrollTo(0, immersiveScrollY);
    immersiveDocumentLocked = false;
  }
}

function setCameraFeedback(feedback: CameraFeedback) {
  if (cameraFeedbackTimer !== null) {
    window.clearTimeout(cameraFeedbackTimer);
    cameraFeedbackTimer = null;
  }

  cameraFeedback = feedback;
  if (inputMode === 'camera') render();

  if (feedback.kind !== 'none' && !feedback.persistent && feedback.kind !== 'loading') {
    cameraFeedbackTimer = window.setTimeout(() => {
      cameraFeedback = emptyCameraFeedback;
      cameraFeedbackTimer = null;
      if (inputMode === 'camera') render();
    }, 2200);
  }
}

function clearCameraFeedback() {
  if (cameraFeedbackTimer !== null) {
    window.clearTimeout(cameraFeedbackTimer);
    cameraFeedbackTimer = null;
  }
  cameraFeedback = emptyCameraFeedback;
  if (inputMode === 'camera') render();
}

function setScannerControlsDisabled(disabled: boolean) {
  const input = document.getElementById('scanInput') as HTMLInputElement | null;
  const toggle = document.getElementById('racePackToggle') as HTMLInputElement | null;
  const logoutButton = document.getElementById('logoutButton') as HTMLButtonElement | null;
  const scannerModeButton = document.getElementById('scannerModeButton') as HTMLButtonElement | null;
  const cameraModeButton = document.getElementById('cameraModeButton') as HTMLButtonElement | null;
  const manualLookupButtons = document.querySelectorAll<HTMLButtonElement>('[data-manual-lookup-type]');

  if (input) input.disabled = disabled;
  if (toggle) toggle.disabled = disabled;
  if (logoutButton) logoutButton.disabled = disabled;
  if (scannerModeButton) scannerModeButton.disabled = disabled;
  if (cameraModeButton) cameraModeButton.disabled = disabled;
  manualLookupButtons.forEach((button) => {
    button.disabled = disabled;
  });
}

function updateCameraUI() {
  const status = document.getElementById('cameraStatus');
  const detail = document.getElementById('cameraStatusDetail');
  const panel = document.getElementById('cameraPanel');
  const preview = document.getElementById('cameraPreview');
  const pill = document.querySelector<HTMLElement>('.camera-mode-pill');
  const scannerModeButton = document.getElementById('scannerModeButton') as HTMLButtonElement | null;
  const cameraModeButton = document.getElementById('cameraModeButton') as HTMLButtonElement | null;
  const torchButton = document.getElementById('torchButton') as HTMLButtonElement | null;
  const zoomControl = document.getElementById('zoomControl') as HTMLInputElement | null;

  const isActive = cameraScanner.isActive();
  const isRecovering = cameraScanner.isRecovering();
  const stateClass = isRecovering ? 'camera-state-recovering' : isActive ? 'camera-state-active' : cameraStatus.state === 'error' ? 'camera-state-error' : '';

  if (panel) panel.className = `camera-shell ${stateClass}`;
  if (preview) preview.className = `camera-preview ${isActive ? 'camera-preview-active' : ''}`;
  if (pill) pill.textContent = isRecovering ? 'Recovery' : isActive ? 'Live' : 'Standby';
  if (status) {
    status.textContent = cameraStatus.message;
    status.className = `camera-status ${isActive ? 'camera-status-active' : ''}`;
  }
  if (detail) detail.textContent = cameraStatus.detail;
  if (scannerModeButton) scannerModeButton.disabled = modeSwitchDisabled('scanner');
  if (cameraModeButton) cameraModeButton.disabled = modeSwitchDisabled('camera');
  if (torchButton) {
    torchButton.textContent = cameraCapabilities.torchEnabled ? 'Lampu On' : 'Lampu';
    torchButton.className = `camera-control-button ${cameraCapabilities.torchEnabled ? 'camera-control-button-active' : ''}`;
    torchButton.setAttribute('aria-pressed', String(cameraCapabilities.torchEnabled));
  }
  if (zoomControl && cameraCapabilities.zoom) zoomControl.value = String(cameraCapabilities.zoom.value);
}

function cameraUnsafe(): boolean {
  return Boolean(isProcessing || activeVerification || loginModal || cameraPagePaused);
}

function modeSwitchDisabled(mode: InputMode): boolean {
  if (cameraUnsafe()) return true;
  return mode === 'camera' && cameraScanner.isStarting();
}

function setManualLookupType(type: ManualLookupType) {
  if (type !== 'ticket' && type !== 'order_suffix' && type !== 'bib_number') return;
  if (manualLookupType === type) return;
  manualLookupType = type;
  render();
}

function setInputMode(mode: InputMode) {
  if (mode === inputMode || modeSwitchDisabled(mode)) return;

  if (mode === 'scanner') {
    inputMode = 'scanner';
    cameraRequested = false;
    clearCameraFeedback();
    cameraScanner.stop('Kamera dimatikan. Scanner/manual aktif.');
    render();
    focusInput();
    return;
  }

  inputMode = 'camera';
  cameraRequested = true;
  clearCameraFeedback();
  render();
}

function startCameraIfPossible() {
  const preview = document.getElementById('cameraPreview') as HTMLVideoElement | null;
  if (!preview) return;
  void cameraScanner.start(preview);
}

function retryCamera() {
  cameraRequested = true;
  inputMode = 'camera';
  const preview = document.getElementById('cameraPreview') as HTMLVideoElement | null;
  if (preview) cameraScanner.attachVideo(preview);
  cameraScanner.retry();
}

function pauseCameraForUnsafeState() {
  cameraScanner.pause('Kamera dijeda sementara.');
}

function resumeCameraIfSafe() {
  if (inputMode !== 'camera' || !cameraRequested || cameraUnsafe()) return;
  if (cameraScanner.isActive()) {
    cameraScanner.resume();
    return;
  }
  startCameraIfPossible();
}

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    cameraPagePaused = true;
    cameraScanner.stop('Kamera dijeda karena tab tidak aktif.');
    return;
  }

  cameraPagePaused = false;
  resumeCameraIfSafe();
}

function handlePageHide() {
  cameraPagePaused = true;
  cameraScanner.stop('Kamera dijeda karena halaman ditutup.');
}

function handlePageShow() {
  cameraPagePaused = false;
  resumeCameraIfSafe();
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

async function refreshSession(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/auth/session`, { credentials: 'same-origin' });
    const data: ApiResponse<AuthData> = await response.json();
    if (response.ok && data.data?.authenticated) {
      authStatus = 'authenticated';
      render();
      return true;
    }
  } catch {
    authStatus = 'anonymous';
    return false;
  }

  authStatus = 'anonymous';
  return false;
}

async function handleRacePackToggle(checked: boolean) {
  if (isProcessing || activeVerification) {
    render();
    return;
  }

  if (!checked) {
    racePackMode = false;
    render();
    return;
  }

  if (await refreshSession()) {
    racePackMode = true;
    render();
    return;
  }

  racePackMode = false;
  render();
  openLoginModal();
}

async function ensureCSRFToken(): Promise<string> {
  if (csrfToken) return csrfToken;

  const response = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'same-origin' });
  const data: ApiResponse<AuthData> = await response.json();
  if (!response.ok || !data.data?.token) throw new Error(data.message || 'Gagal menyiapkan keamanan session');

  csrfToken = data.data.token;
  return csrfToken;
}

function openLoginModal() {
  if (loginModal) return;

  pauseCameraForUnsafeState();

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="loginTitle">
      <div class="modal-header">
        <h2 id="loginTitle">Login Operator Race Pack</h2>
      </div>
      <form id="loginForm">
        <div class="modal-body login-form-fields">
          <p class="login-help">Gunakan akun operator dari sistem Fenturun 2026.</p>
          <label class="login-field">
            <span>Username atau Email</span>
            <input id="loginIdentity" class="scan-input" type="text" autocomplete="username" required />
          </label>
          <label class="login-field">
            <span>Password</span>
            <input id="loginPassword" class="scan-input" type="password" autocomplete="current-password" required />
          </label>
          <p id="loginError" class="login-error" role="alert"></p>
        </div>
        <div class="modal-actions">
          <button id="loginSubmit" class="btn btn-success" type="submit">Login & Aktifkan Race Pack</button>
          <button id="loginCancel" class="btn btn-secondary" type="button">Batal</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  loginModal = modal;
  modal.querySelector<HTMLFormElement>('#loginForm')?.addEventListener('submit', handleLogin);
  modal.querySelector<HTMLButtonElement>('#loginCancel')?.addEventListener('click', closeLoginModal);
  setTimeout(() => modal.querySelector<HTMLInputElement>('#loginIdentity')?.focus(), 0);
}

function closeLoginModal() {
  loginModal?.remove();
  loginModal = null;
  racePackMode = false;
  render();
  resumeCameraIfSafe();
}

async function handleLogin(event: Event) {
  event.preventDefault();
  if (!loginModal) return;

  const identity = loginModal.querySelector<HTMLInputElement>('#loginIdentity')!;
  const password = loginModal.querySelector<HTMLInputElement>('#loginPassword')!;
  const submit = loginModal.querySelector<HTMLButtonElement>('#loginSubmit')!;
  const cancel = loginModal.querySelector<HTMLButtonElement>('#loginCancel')!;
  const error = loginModal.querySelector<HTMLElement>('#loginError')!;

  submit.disabled = true;
  cancel.disabled = true;
  submit.textContent = 'Memverifikasi...';
  error.textContent = '';

  try {
    const token = await ensureCSRFToken();
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': token,
      },
      body: JSON.stringify({ identity: identity.value, password: password.value }),
    });
    const data: ApiResponse<AuthData> = await response.json();

    if (!response.ok || !data.data?.authenticated) {
      error.textContent = data.message || 'Login gagal';
      return;
    }

    authStatus = 'authenticated';
    racePackMode = true;
    loginModal.remove();
    loginModal = null;
    render();
  } catch (caught) {
    error.textContent = caught instanceof Error ? caught.message : 'Koneksi bermasalah';
  } finally {
    if (loginModal) {
      submit.disabled = false;
      cancel.disabled = false;
      submit.textContent = 'Login & Aktifkan Race Pack';
    }
  }
}

async function logout() {
  if (activeVerification) return;

  let serverLogoutSucceeded = false;
  let failureMessage = 'Koneksi bermasalah';

  try {
    const token = await ensureCSRFToken();
    const response = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': token,
      },
      body: '{}',
    });

    if (!response.ok) {
      if (response.status === 403) csrfToken = null;

      const data: ApiResponse = await response.json().catch(() => ({
        outcome: 'logout_failed',
        message: 'Logout server gagal',
      }));
      throw new Error(data.message || 'Logout server gagal');
    }

    serverLogoutSucceeded = true;
  } catch (caught) {
    failureMessage = caught instanceof Error ? caught.message : failureMessage;
  } finally {
    authStatus = 'anonymous';
    csrfToken = null;
    racePackMode = false;
    clearHistory();
    render();

    if (serverLogoutSucceeded) {
      showResult('success', 'Logout berhasil. Mode scan biasa tetap aktif.');
    } else {
      showResult('error', `Mode Race Pack dimatikan lokal, tetapi logout server belum terkonfirmasi: ${failureMessage}`);
    }
  }
}

async function handleSubmit(event: Event) {
  event.preventDefault();
  if (inputMode !== 'scanner') return;

  const input = document.getElementById('scanInput') as HTMLInputElement | null;
  if (!input) return;

  const payload = input.value.trim();
  input.value = '';
  await submitScanPayload(payload);
}

async function submitScanPayload(payload: string) {
  if (isProcessing || activeVerification || loginModal) return;

  if (!payload) {
    showResult('error', 'Input kosong');
    return;
  }

  const orderId = extractOrderId(payload);
  const useManualLookup = inputMode === 'scanner' && manualLookupType !== 'ticket' && !orderId;
  if (!orderId && !useManualLookup) {
    if (inputMode === 'camera') setCameraFeedback(unreadableFeedback('QR Code tidak valid. Posisikan QR penuh di kotak, kurangi pantulan, atau gunakan Scanner/manual.'));
    showResult('error', 'QR Code tidak valid — format URL tidak dikenali');
    resumeCameraIfSafe();
    return;
  }

  const manualPayload = useManualLookup ? normalizeManualLookup(manualLookupType, payload) : null;
  if (useManualLookup && !manualPayload) {
    showResult('error', manualLookupType === 'order_suffix' ? 'Suffix order hanya boleh huruf/angka, contoh GOG' : 'Nomor BIB harus lengkap dan hanya huruf/angka, contoh N0302');
    return;
  }

  if (useManualLookup && racePackMode && authStatus !== 'authenticated' && !(await refreshSession())) {
    showResult('error', 'Lookup manual Race Pack perlu login operator.');
    openLoginModal();
    return;
  }

  if (inputMode === 'camera') {
    const now = Date.now();
    if (payload === lastCameraPayload && now - lastCameraScanAt < 2000) {
      setCameraFeedback(duplicateFeedback());
      resumeCameraIfSafe();
      return;
    }
    lastCameraPayload = payload;
    lastCameraScanAt = now;
  }

  pauseCameraForUnsafeState();
  isProcessing = true;
  updateStatusIndicator();
  if (inputMode === 'camera') setCameraFeedback(loadingFeedback('Memvalidasi tiket...'));
  showResult('loading', 'Memvalidasi tiket...');

  try {
    const requestHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    let requestURL = `${API_BASE}/api/scans/validate`;
    let requestBody = JSON.stringify({ payload, station: station.toString() });
    let requestCredentials: RequestCredentials | undefined;

    if (useManualLookup && manualPayload) {
      requestURL = `${API_BASE}${racePackMode ? '/api/scans/manual-validate' : '/api/scans/manual-display'}`;
      if (racePackMode) {
        requestHeaders['X-CSRF-Token'] = await ensureCSRFToken();
        requestCredentials = 'same-origin';
      }
      requestBody = JSON.stringify({ lookup_type: manualLookupType, payload: manualPayload, station: station.toString() });
    }

    const response = await fetch(requestURL, {
      method: 'POST',
      credentials: requestCredentials,
      headers: requestHeaders,
      body: requestBody,
    });

    if (response.status >= 500) {
      setConnectionStatus('database_not_ready');
    } else {
      setConnectionStatus('ready');
    }

    const data: ScanResult = await response.json();
    if (useManualLookup && (response.status === 401 || response.status === 403)) {
      authStatus = 'anonymous';
      csrfToken = null;
      racePackMode = false;
      if (inputMode === 'camera') setCameraFeedback(authFeedback(data.message));
      showResult('error', 'Session Race Pack berakhir. Login ulang lalu scan kembali.');
      return;
    }
    handleScanResult(data);
  } catch {
    setConnectionStatus('offline');
    if (inputMode === 'camera') setCameraFeedback(offlineFeedback());
    showResult('error', 'Koneksi bermasalah');
  } finally {
    isProcessing = false;
    updateStatusIndicator();
    resumeCameraIfSafe();
    focusInput();
  }
}

function handleScanResult(data: ScanResult) {
  const { outcome, message } = data;
  const order = data.data?.order;
  const participant = data.data?.participant;
  const bib = participant?.bib_number || '-';
  const name = participant?.name || '-';
  const category = data.data?.ticket?.category || '-';

  if (inputMode === 'camera') {
    setCameraFeedback(scanFeedback({ outcome, message, racePackMode, bib, name, category }));
  }

  switch (outcome) {
    case 'valid':
      if (racePackMode) {
        showVerification(data);
      } else {
        addToHistory(order?.number || '-', category, bib, name, false);
        showResult('success', `#${bib} — ${name}`);
        playBeep('success');
      }
      break;
    case 'already_picked_up':
      if (racePackMode) {
        showResult('error', message);
        playBeep('error');
      } else {
        addToHistory(order?.number || '-', category, bib, name, false);
        showResult('success', `#${bib} — ${name} (race pack sudah diambil)`);
        playBeep('success');
      }
      break;
    default:
      showResult('error', message);
      playBeep('error');
  }
}

function showVerification(data: ScanResult) {
  if (activeVerification) return;

  const order = data.data?.order;
  const participant = data.data?.participant;
  const ticket = data.data?.ticket;

  if (!order?.id) {
    showResult('error', 'Data order dari server tidak lengkap. Scan ulang tiket.');
    playBeep('error');
    return;
  }

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
            <span class="info-value">${escapeHtml(order.number || order.id)}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Nama</span>
            <span class="info-value">${escapeHtml(participant?.name || '-')}</span>
          </div>
          <div class="info-item">
            <span class="info-label">BIB</span>
            <span class="info-value">${escapeHtml(participant?.bib_name || '-')} (${escapeHtml(participant?.bib_number || '-')})</span>
          </div>
          <div class="info-item">
            <span class="info-label">Kategori</span>
            <span class="info-value">${escapeHtml(ticket?.category || '-')}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Jersey</span>
            <span class="info-value">${escapeHtml(participant?.jersey_size || '-')}</span>
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
  activeVerification = { modal, orderId: order.id, confirming: false };
  setScannerControlsDisabled(true);
  updateStatusIndicator();

  modal.querySelector<HTMLButtonElement>('#confirmPickup')?.addEventListener('click', async () => {
    if (!activeVerification || activeVerification.confirming) return;

    const confirmButton = modal.querySelector<HTMLButtonElement>('#confirmPickup');
    const cancelButton = modal.querySelector<HTMLButtonElement>('#cancelPickup');
    activeVerification.confirming = true;
    if (confirmButton) {
      confirmButton.disabled = true;
      confirmButton.textContent = 'Mengonfirmasi...';
    }
    if (cancelButton) cancelButton.disabled = true;

    modal.remove();
    await confirmPickup(activeVerification.orderId, data);
  });

  modal.querySelector<HTMLButtonElement>('#cancelPickup')?.addEventListener('click', () => {
    clearVerification();
    focusInput();
  });
}

function clearVerification() {
  activeVerification?.modal.remove();
  activeVerification = null;
  setScannerControlsDisabled(false);
  updateStatusIndicator();
  resumeCameraIfSafe();
}

async function confirmPickup(orderId: string, validatedData: ScanResult) {
  isProcessing = true;
  updateStatusIndicator();
  if (inputMode === 'camera') setCameraFeedback(loadingFeedback('Mengonfirmasi pickup...'));
  showResult('loading', 'Mengonfirmasi pickup...');

  try {
    const token = await ensureCSRFToken();
    const response = await fetch(`${API_BASE}/api/orders/${orderId}/pickup`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': token,
      },
      body: '{}',
    });
    if (response.status >= 500) {
      setConnectionStatus('database_not_ready');
    } else {
      setConnectionStatus('ready');
    }

    const data: ScanResult = await response.json();

    if (response.status === 401 || response.status === 403) {
      authStatus = 'anonymous';
      csrfToken = null;
      racePackMode = false;
      clearHistory();
      clearVerification();
      render();
      if (inputMode === 'camera') setCameraFeedback(authFeedback());
      showResult('error', 'Session Race Pack berakhir. Login ulang lalu scan kembali.');
      playBeep('error');
      return;
    }

    if (data.outcome === 'picked_up') {
      const order = validatedData.data?.order;
      const participant = validatedData.data?.participant;
      addToHistory(
        order?.number || '-',
        validatedData.data?.ticket?.category || '-',
        participant?.bib_number || '-',
        participant?.name || '-',
        true,
      );
      if (inputMode === 'camera') setCameraFeedback(pickupSuccessFeedback(data.message));
      showResult('success', data.message);
      playBeep('success');
      return;
    }

    if (inputMode === 'camera') setCameraFeedback(scanFeedback({ outcome: data.outcome, message: data.message, racePackMode: true }));
    showResult('error', data.message);
    playBeep('error');
  } catch {
    setConnectionStatus('offline');
    if (inputMode === 'camera') setCameraFeedback(offlineFeedback('Koneksi bermasalah. Jangan serahkan Race Pack.'));
    showResult('error', 'Koneksi bermasalah. Jangan serahkan race pack.');
  } finally {
    isProcessing = false;
    clearVerification();
    updateStatusIndicator();
    focusInput();
  }
}

function showResult(type: 'success' | 'error' | 'loading', message: string) {
  if (inputMode === 'camera') {
    if (type === 'loading') setCameraFeedback(loadingFeedback(message));
    else if (type === 'error' && cameraFeedback.kind === 'none') setCameraFeedback(unreadableFeedback(message));
    return;
  }

  const resultArea = document.getElementById('resultArea');
  const scanBox = document.getElementById('scanBox');
  if (!resultArea || !scanBox) return;

  scanBox.className = `scan-box ${type === 'success' ? 'scan-box-success' : type === 'error' ? 'scan-box-error' : ''}`;

  let icon = '';
  switch (type) {
    case 'success':
      icon = '<svg class="result-icon-svg success" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>';
      break;
    case 'error':
      icon = '<svg class="result-icon-svg error" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>';
      break;
    case 'loading':
      icon = '<div class="spinner-small"></div>';
      break;
  }

  resultArea.innerHTML = `
    <div class="result-banner ${type === 'success' ? 'result-success' : type === 'error' ? 'result-error' : 'result-loading'}">
      ${icon}
      <span class="result-text">${escapeHtml(message)}</span>
    </div>
  `;
  resultArea.style.display = 'block';

  if (type !== 'loading') {
    setTimeout(() => {
      resultArea.style.display = 'none';
      scanBox.className = 'scan-box';
    }, 3000);
  }
}

function addToHistory(orderNumber: string, category: string, bib: string, name: string, racePack: boolean) {
  const now = new Date();
  const time = now.toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Makassar',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  scanHistory.unshift({ time, orderNumber, category, bib, name, racePack });
  if (scanHistory.length > HISTORY_LIMIT) scanHistory.length = HISTORY_LIMIT;
  saveHistory();

  const historyCount = document.getElementById('historyCount');
  const historyContent = document.getElementById('historyContent');
  if (historyCount) historyCount.textContent = `${scanHistory.length} scan`;
  if (historyContent) historyContent.innerHTML = renderHistoryContent();
}

init();
