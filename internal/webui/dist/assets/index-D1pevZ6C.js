(function(){const a=document.createElement("link").relList;if(a&&a.supports&&a.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))s(n);new MutationObserver(n=>{for(const c of n)if(c.type==="childList")for(const o of c.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&s(o)}).observe(document,{childList:!0,subtree:!0});function e(n){const c={};return n.integrity&&(c.integrity=n.integrity),n.referrerPolicy&&(c.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?c.credentials="include":n.crossOrigin==="anonymous"?c.credentials="omit":c.credentials="same-origin",c}function s(n){if(n.ep)return;n.ep=!0;const c=e(n);fetch(n.href,c)}})();const B="";let M=1,r=!1,h=[],d=null,y=null,u=null;const L=document.getElementById("app");function T(){const t=new URLSearchParams(window.location.search);M=parseInt(t.get("station")||"1",10),u=new(window.AudioContext||window.webkitAudioContext),$(),g()}function $(){var t,a;L.innerHTML=`
    <div class="min-h-screen bg-gray-50">
      <header class="header">
        <div class="header-inner">
          <div class="header-left">
            <div class="logo-placeholder">F</div>
            <div>
              <h1 class="header-title">Runner Scanner</h1>
              <p class="header-subtitle">Station #${M}</p>
            </div>
          </div>
          <div class="header-right">
            <label class="toggle-label">
              <span class="toggle-text ${r?"toggle-text-active":""}">Race Pack</span>
              <div class="toggle-wrapper">
                <input
                  type="checkbox"
                  id="racePackToggle"
                  class="toggle-input"
                  ${r?"checked":""}
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
        ${r?`
          <div class="info-banner info-banner-active">
            <svg class="info-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span class="info-text">Mode Race Pack aktif — Scan akan membuka verifikasi penyerahan race pack.</span>
          </div>
        `:""}

        <form id="scanForm" class="scan-form">
          <div class="scan-box ${d==="success"?"scan-box-success":""} ${d==="error"?"scan-box-error":""} ${!d&&r?"scan-box-active":""}">
            <label class="scan-label">
              ${r?"Scan QR Code untuk Penyerahan Race Pack":"Scan QR Code Tiket"}
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

        ${d&&y?`
          <div class="result-banner ${d==="success"?"result-success":"result-error"}">
            ${d==="success"?`
              <svg class="result-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            `:`
              <svg class="result-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            `}
            <span class="result-text">${y}</span>
          </div>
        `:""}

        <div class="history-card">
          <div class="history-header">
            <h2 class="history-title">Riwayat Scan</h2>
            <span class="history-count">${h.length} scan</span>
          </div>

          ${h.length>0?`
            <div class="history-table-wrapper">
              <table class="history-table">
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>No. Invoice</th>
                    <th>Kategori</th>
                    <th>BIB</th>
                    <th>Nama</th>
                    ${r?"<th>Race Pack</th>":""}
                  </tr>
                </thead>
                <tbody>
                  ${h.map((e,s)=>`
                    <tr class="${s===0?"history-row-first":""}">
                      <td class="text-gray">${e.time}</td>
                      <td class="font-mono text-xs">${e.orderNumber}</td>
                      <td>
                        <span class="badge">${e.category}</span>
                      </td>
                      <td class="font-bold">${e.bib}</td>
                      <td>${e.name}</td>
                      ${r?`
                        <td>
                          ${e.racePack?`
                            <span class="badge badge-success">Diserahkan</span>
                          `:`
                            <span class="badge badge-gray">&mdash;</span>
                          `}
                        </td>
                      `:""}
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          `:`
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
  `,(t=document.getElementById("scanForm"))==null||t.addEventListener("submit",O),(a=document.getElementById("racePackToggle"))==null||a.addEventListener("change",e=>{r=e.target.checked,$(),g()}),document.addEventListener("click",()=>g())}function g(){const t=document.getElementById("scanInput");t&&setTimeout(()=>t.focus(),50)}function j(t){if(!u)return;const a=u.createOscillator(),e=u.createGain();a.connect(e),e.connect(u.destination),t==="success"?(a.frequency.value=880,a.type="sine",e.gain.value=.3,a.start(),a.stop(u.currentTime+.15)):(a.frequency.value=300,a.type="square",e.gain.value=.2,a.start(),a.stop(u.currentTime+.3))}async function O(t){t.preventDefault();const a=document.getElementById("scanInput"),e=a.value.trim();if(a.value="",!e){l("error","Input kosong");return}if(!A(e)){l("error","QR Code tidak valid — format URL tidak dikenali");return}try{const c=await(await fetch(`${B}/api/scans/validate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({payload:e})})).json();R(c,e)}catch{l("error","Koneksi bermasalah")}}function A(t){const a="[0-9A-HJ-NP-Za-hj-np-z]{26}",e=t.match(new RegExp(`/ticket/(${a})`,"i"));return e?e[1]:t.match(new RegExp(`^(${a})$`,"i"))?t:null}function R(t,a){var n,c,o,p,v,f,b,w;const{outcome:e,message:s}=t;switch(e){case"valid":if(r)N(t,a);else{const k=(n=t.data)==null?void 0:n.order,m=(c=t.data)==null?void 0:c.participant,P=(m==null?void 0:m.bib_number)||"-",x=(m==null?void 0:m.name)||"-",E=((p=(o=t.data)==null?void 0:o.ticket)==null?void 0:p.category)||"-";I((k==null?void 0:k.number)||"-",E,P,x,!1),l("success",`#${P} — ${x}`)}break;case"already_picked_up":l("error",s);break;case"picked_up":const i=t.data,S=((v=i==null?void 0:i.participant)==null?void 0:v.bib_number)||"-",C=((f=i==null?void 0:i.participant)==null?void 0:f.name)||"-";I(((b=i==null?void 0:i.order)==null?void 0:b.number)||"-",((w=i==null?void 0:i.ticket)==null?void 0:w.category)||"-",S,C,!0),l("success",s);break;default:l("error",s)}}function N(t,a){var o,p,v,f,b;const e=(o=t.data)==null?void 0:o.order,s=(p=t.data)==null?void 0:p.participant,n=(v=t.data)==null?void 0:v.ticket,c=document.createElement("div");c.className="modal-overlay",c.innerHTML=`
    <div class="modal-card">
      <div class="modal-header">
        <h2>Verifikasi & Penyerahan Race Pack</h2>
      </div>
      <div class="modal-body">
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Order</span>
            <span class="info-value">${(e==null?void 0:e.number)||(e==null?void 0:e.id)||"-"}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Nama</span>
            <span class="info-value">${(s==null?void 0:s.name)||"-"}</span>
          </div>
          <div class="info-item">
            <span class="info-label">BIB</span>
            <span class="info-value">${(s==null?void 0:s.bib_name)||"-"} (${(s==null?void 0:s.bib_number)||"-"})</span>
          </div>
          <div class="info-item">
            <span class="info-label">Kategori</span>
            <span class="info-value">${(n==null?void 0:n.category)||"-"}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Jersey</span>
            <span class="info-value">${(s==null?void 0:s.jersey_size)||"-"}</span>
          </div>
        </div>
      </div>
      <div class="modal-actions">
        <button id="confirmPickup" class="btn btn-success">Konfirmasi Serahkan Race Pack</button>
        <button id="cancelPickup" class="btn btn-secondary">Batal</button>
      </div>
    </div>
  `,document.body.appendChild(c),(f=document.getElementById("confirmPickup"))==null||f.addEventListener("click",async()=>{document.body.removeChild(c),await _((e==null?void 0:e.id)||a)}),(b=document.getElementById("cancelPickup"))==null||b.addEventListener("click",()=>{document.body.removeChild(c),g()})}async function _(t){l("success","Mengonfirmasi pickup...");try{const e=await(await fetch(`${B}/api/orders/${t}/pickup`,{method:"POST",headers:{"Content-Type":"application/json"}})).json();R(e,t)}catch{l("error","Koneksi bermasalah. Jangan serahkan race pack.")}}function l(t,a){d=t,y=a,j(t),$(),g()}function I(t,a,e,s,n){const o=new Date().toLocaleTimeString("id-ID",{timeZone:"Asia/Makassar",hour:"2-digit",minute:"2-digit",second:"2-digit"});h.unshift({time:o,orderNumber:t,category:a,bib:e,name:s,racePack:n}),h.length>20&&(h.length=20)}T();
