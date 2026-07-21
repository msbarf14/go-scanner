import"./modulepreload-polyfill-B5Qt9EMX.js";const I="";let w=1,d=!1,h=[],m=null,f=!1;const L=document.getElementById("app");function A(){const e=new URLSearchParams(window.location.search);w=parseInt(e.get("station")||"1",10),m=new(window.AudioContext||window.webkitAudioContext),P(),document.addEventListener("click",()=>v()),setTimeout(()=>v(),100)}function P(){var e,s;L.innerHTML=`
    <div class="min-h-screen bg-gray-50">
      <header class="header">
        <div class="header-inner">
          <div class="header-left">
            <div class="logo-placeholder">F</div>
            <div>
              <h1 class="header-title">Runner Scanner</h1>
              <p class="header-subtitle">Station #${w}</p>
            </div>
          </div>
          <div class="header-right">
            <label class="toggle-label">
              <span class="toggle-text ${d?"toggle-text-active":""}">Race Pack</span>
              <div class="toggle-wrapper">
                <input
                  type="checkbox"
                  id="racePackToggle"
                  class="toggle-input"
                  ${d?"checked":""}
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
        ${d?`
          <div class="info-banner info-banner-active">
            <svg class="info-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span class="info-text">Mode Race Pack aktif — Scan akan membuka verifikasi penyerahan race pack.</span>
          </div>
        `:""}

        <form id="scanForm" class="scan-form">
          <div id="scanBox" class="scan-box">
            <label class="scan-label">
              ${d?"Scan QR Code untuk Penyerahan Race Pack":"Scan QR Code Tiket"}
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

        <div id="resultArea" class="result-area" style="display:none;"></div>

        <div id="historyCard" class="history-card">
          <div class="history-header">
            <h2 class="history-title">Riwayat Scan</h2>
            <span id="historyCount" class="history-count">${h.length} scan</span>
          </div>
          <div id="historyContent">
            ${M()}
          </div>
        </div>
      </main>
    </div>
  `,(e=document.getElementById("scanForm"))==null||e.addEventListener("submit",j),(s=document.getElementById("racePackToggle"))==null||s.addEventListener("change",a=>{d=a.target.checked,P(),v()}),v()}function M(){return h.length===0?`
      <div class="history-empty">
        <svg class="empty-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
        <p>Belum ada scan. Arahkan barcode scanner ke QR Code tiket.</p>
      </div>
    `:`
    <div class="history-table-wrapper">
      <table class="history-table">
        <thead>
          <tr>
            <th>Waktu</th>
            <th>No. Invoice</th>
            <th>Kategori</th>
            <th>BIB</th>
            <th>Nama</th>
            ${d?"<th>Race Pack</th>":""}
          </tr>
        </thead>
        <tbody>
          ${h.map((e,s)=>`
            <tr class="${s===0?"history-row-first":""}">
              <td class="text-gray">${e.time}</td>
              <td class="font-mono text-xs">${e.orderNumber}</td>
              <td><span class="badge">${e.category}</span></td>
              <td class="font-bold">${e.bib}</td>
              <td>${e.name}</td>
              ${d?`
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
  `}function v(){const e=document.getElementById("scanInput");e&&!f&&e.focus()}function k(e){if(!m)return;const s=m.createOscillator(),a=m.createGain();s.connect(a),a.connect(m.destination),e==="success"?(s.frequency.value=880,s.type="sine",a.gain.value=.3,s.start(),s.stop(m.currentTime+.15)):(s.frequency.value=300,s.type="square",a.gain.value=.2,s.start(),s.stop(m.currentTime+.3))}async function j(e){if(e.preventDefault(),f)return;const s=document.getElementById("scanInput"),a=s.value.trim();if(s.value="",!a){c("error","Input kosong");return}if(!H(a)){c("error","QR Code tidak valid — format URL tidak dikenali");return}f=!0,c("loading","Memvalidasi tiket...");try{const o=await(await fetch(`${I}/api/scans/validate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({payload:a,station:w.toString()})})).json();E(o,a)}catch{c("error","Koneksi bermasalah")}finally{f=!1,v()}}function H(e){const s="[0-9A-HJ-NP-Za-hj-np-z]{26}",a=e.match(new RegExp(`/ticket/(${s})`,"i"));return a?a[1]:e.match(new RegExp(`^(${s})$`,"i"))?e:null}function E(e,s){var n,o,u,r,l,g,b,$;const{outcome:a,message:t}=e;switch(a){case"valid":if(d)N(e,s);else{const y=(n=e.data)==null?void 0:n.order,p=(o=e.data)==null?void 0:o.participant,x=(p==null?void 0:p.bib_number)||"-",B=(p==null?void 0:p.name)||"-",T=((r=(u=e.data)==null?void 0:u.ticket)==null?void 0:r.category)||"-";C((y==null?void 0:y.number)||"-",T,x,B,!1),c("success",`#${x} — ${B}`),k("success")}break;case"already_picked_up":c("error",t),k("error");break;case"picked_up":const i=e.data,R=((l=i==null?void 0:i.participant)==null?void 0:l.bib_number)||"-",S=((g=i==null?void 0:i.participant)==null?void 0:g.name)||"-";C(((b=i==null?void 0:i.order)==null?void 0:b.number)||"-",(($=i==null?void 0:i.ticket)==null?void 0:$.category)||"-",R,S,!0),c("success",t),k("success");break;default:c("error",t),k("error")}}function N(e,s){var u,r,l,g,b;const a=(u=e.data)==null?void 0:u.order,t=(r=e.data)==null?void 0:r.participant,n=(l=e.data)==null?void 0:l.ticket,o=document.createElement("div");o.className="modal-overlay",o.innerHTML=`
    <div class="modal-card">
      <div class="modal-header">
        <h2>Verifikasi & Penyerahan Race Pack</h2>
      </div>
      <div class="modal-body">
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Order</span>
            <span class="info-value">${(a==null?void 0:a.number)||(a==null?void 0:a.id)||"-"}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Nama</span>
            <span class="info-value">${(t==null?void 0:t.name)||"-"}</span>
          </div>
          <div class="info-item">
            <span class="info-label">BIB</span>
            <span class="info-value">${(t==null?void 0:t.bib_name)||"-"} (${(t==null?void 0:t.bib_number)||"-"})</span>
          </div>
          <div class="info-item">
            <span class="info-label">Kategori</span>
            <span class="info-value">${(n==null?void 0:n.category)||"-"}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Jersey</span>
            <span class="info-value">${(t==null?void 0:t.jersey_size)||"-"}</span>
          </div>
        </div>
      </div>
      <div class="modal-actions">
        <button id="confirmPickup" class="btn btn-success">Konfirmasi Serahkan Race Pack</button>
        <button id="cancelPickup" class="btn btn-secondary">Batal</button>
      </div>
    </div>
  `,document.body.appendChild(o),(g=document.getElementById("confirmPickup"))==null||g.addEventListener("click",async()=>{document.body.removeChild(o),await _((a==null?void 0:a.id)||s)}),(b=document.getElementById("cancelPickup"))==null||b.addEventListener("click",()=>{document.body.removeChild(o),v()})}async function _(e){f=!0,c("loading","Mengonfirmasi pickup...");try{const a=await(await fetch(`${I}/api/orders/${e}/pickup`,{method:"POST",headers:{"Content-Type":"application/json"}})).json();E(a,e)}catch{c("error","Koneksi bermasalah. Jangan serahkan race pack.")}finally{f=!1,v()}}function c(e,s){const a=document.getElementById("resultArea"),t=document.getElementById("scanBox");t.className=`scan-box ${e==="success"?"scan-box-success":e==="error"?"scan-box-error":""}`;let n="";switch(e){case"success":n='<svg class="result-icon-svg success" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>';break;case"error":n='<svg class="result-icon-svg error" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>';break;case"loading":n='<div class="spinner-small"></div>';break}a.innerHTML=`
    <div class="result-banner ${e==="success"?"result-success":e==="error"?"result-error":"result-loading"}">
      ${n}
      <span class="result-text">${s}</span>
    </div>
  `,a.style.display="block",e!=="loading"&&setTimeout(()=>{a.style.display="none",t.className="scan-box"},3e3)}function C(e,s,a,t,n){const u=new Date().toLocaleTimeString("id-ID",{timeZone:"Asia/Makassar",hour:"2-digit",minute:"2-digit",second:"2-digit"});h.unshift({time:u,orderNumber:e,category:s,bib:a,name:t,racePack:n}),h.length>20&&(h.length=20);const r=document.getElementById("historyCount"),l=document.getElementById("historyContent");r&&(r.textContent=`${h.length} scan`),l&&(l.innerHTML=M())}A();
