import './display.css';

const API_BASE = '';

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

let station = 1;
let currentData: DisplayData | null = null;
let show = false;

const app = document.getElementById('app')!;

function init() {
  const params = new URLSearchParams(window.location.search);
  station = parseInt(params.get('station') || '1', 10);

  render();
  fetchDisplayData();
  setInterval(fetchDisplayData, 500);
}

async function fetchDisplayData() {
  try {
    const res = await fetch(`${API_BASE}/api/display?station=${station}`);
    if (!res.ok) return;

    const data: DisplayResponse = await res.json();
    const newData = data.data.display;

    if (newData && (!currentData || newData.order.id !== currentData.order.id)) {
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

function render() {
  const category = currentData?.ticket?.category || '';
  const categoryClass = getCategoryClass(category);

  app.innerHTML = `
    <div class="display-container">
      <header class="display-header">
        <div class="logo-placeholder">F</div>
        <div class="station-info">
          <span class="station-label">Station #${station}</span>
        </div>
      </header>

      <main class="display-main">
        ${currentData ? `
          <div class="runner-content ${show ? 'runner-content-show' : 'runner-content-hide'}">
            <div class="welcome-text">
              <h2>WELCOME, RUNNERS!</h2>
            </div>

            <div class="runner-card">
              <div class="category-badge ${categoryClass}">
                <svg class="badge-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                ${category || '-'}
              </div>

              <div class="bib-number">
                ${currentData.participant?.bib_number || '—'}
              </div>

              <div class="runner-name">
                ${currentData.participant?.name || '-'}
              </div>

              ${currentData.participant?.bib_name && currentData.participant.bib_name !== currentData.participant.name ? `
                <div class="bib-name">BIB: ${currentData.participant.bib_name}</div>
              ` : ''}

              <div class="info-chips">
                ${currentData.participant?.jersey_size ? `
                  <div class="chip">
                    <svg class="chip-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                    Jersey: ${currentData.participant.jersey_size}
                  </div>
                ` : ''}
                ${currentData.order?.number ? `
                  <div class="chip">
                    <svg class="chip-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    ${currentData.order.number}
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        ` : `
          <div class="idle-content">
            <div class="qr-icon-wrapper">
              <svg class="qr-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <h2 class="idle-title">Scan QR Code Tiket Anda</h2>
            <p class="idle-subtitle">Tunjukkan QR Code e-Ticket ke petugas scanner</p>
          </div>
        `}
      </main>

      <footer class="display-footer">
        <p>&copy; 2026 Fenturun 2026. Microsite By <a href="https://deka.co.id" target="_blank">DEKA</a>.</p>
      </footer>
    </div>
  `;
}

function getCategoryClass(category: string): string {
  if (category.includes('5')) return 'category-5k';
  if (category.includes('10')) return 'category-10k';
  if (category.includes('21')) return 'category-21k';
  return 'category-default';
}

init();
