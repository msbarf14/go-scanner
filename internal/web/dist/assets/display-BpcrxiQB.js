import"./modulepreload-polyfill-B5Qt9EMX.js";const y="",E="https://r2.fenturun2026.com/assets".replace(/\/$/,""),N="11";let p=1,b=!1,t=null,l=!1,d=!1,r=null;const S=document.getElementById("app");function c(e){return`${`${E}/${e.replace(/^\/+/,"")}`}?v=${encodeURIComponent(N)}`}function o(e){return String(e??"").replace(/[&<>'"]/g,n=>{switch(n){case"&":return"&amp;";case"<":return"&lt;";case">":return"&gt;";case"'":return"&#39;";case'"':return"&quot;";default:return n}})}function I(){const e=new URLSearchParams(window.location.search);p=R(e.get("station")),b=e.get("debug")==="1",L(),u(),T(),m(),setInterval(()=>void m(),500)}function R(e){if(!e)return 1;const n=Number(e.trim());return Number.isInteger(n)&&n>=1&&n<=99?n:1}function T(){const e=document.createElement("div");e.className=`display-scanner ${b?"display-scanner-debug":"display-scanner-hidden"}`;const n=document.createElement("form");n.className="display-scanner-form",n.setAttribute("aria-label","Scanner QR Runner Display");const a=document.createElement("input");a.id="displayScannerInput",a.className="display-scanner-input",a.type="text",a.autocomplete="off",a.placeholder="Scan atau masukkan QR Code tiket...",a.setAttribute("aria-label","Input QR Code tiket"),n.appendChild(a),e.appendChild(n),document.body.appendChild(e),r=a,n.addEventListener("submit",i=>void C(i)),a.addEventListener("blur",()=>setTimeout(s,0)),document.addEventListener("click",s),window.addEventListener("focus",s),document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&s()}),setTimeout(s,0),setInterval(s,250)}function s(){!d&&r&&document.visibilityState==="visible"&&r.focus()}async function C(e){if(e.preventDefault(),d||!r)return;const n=r.value.trim();if(r.value="",!n){s();return}d=!0;try{const i=await(await fetch(`${y}/api/scans/validate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({payload:n,station:p.toString()})})).json();(i.outcome==="valid"||i.outcome==="already_picked_up")&&await m()}catch{}finally{d=!1,s()}}async function m(){try{const e=await fetch(`${y}/api/display?station=${p}`);if(!e.ok)return;const a=(await e.json()).data.display;a&&(!t||a.order.id!==t.order.id||a.scanned_at!==t.scanned_at)?(t=a,l=!1,u(),setTimeout(()=>{l=!0,u()},50)):!a&&t&&(t=null,l=!1,u())}catch{}}function L(){S.innerHTML=`
    <div class="display-container">
      <div class="display-bg" aria-hidden="true">
        <img src="${c("img/2026-runner-display.jpg")}" loading="eager" decoding="async" fetchpriority="high" alt="" />
        <div class="display-overlay"></div>
      </div>

      <div class="display-content">
        <header class="display-header">
          <div class="header-inner">
            <div class="brand-official">
              <div class="station-label">Station #${o(p)}</div>
              <img src="${c("img/2026-official.png")}" class="official-logo" loading="eager" decoding="async" alt="Official logo" />
            </div>
            <div class="brand-event">
              <img src="${c("img/2026-logo.png")}" class="event-logo" loading="eager" decoding="async" alt="Fenturun 2026" />
            </div>
          </div>
        </header>

        <main class="display-main"></main>

        <div class="partner-section">
          <div class="partner-inner">
            <img src="${c("img/2026-partner.png")}" class="partner-logo" loading="eager" decoding="async" alt="Partner logo" />
          </div>
        </div>

        <footer class="display-footer">
          <p>&copy; 2026 Fenturun 2026. Microsite By <a href="https://deka.co.id" target="_blank" rel="noopener noreferrer">DEKA</a>.</p>
        </footer>
      </div>
    </div>
  `}function u(){var v,f,g,h;const e=S.querySelector(".display-main");if(!e)return;const n=((v=t==null?void 0:t.ticket)==null?void 0:v.category)||"-",a=((f=t==null?void 0:t.participant)==null?void 0:f.name)||"-",i=((g=t==null?void 0:t.participant)==null?void 0:g.bib_name)||"",w=((h=t==null?void 0:t.participant)==null?void 0:h.bib_number)||"—",k=i||a,$=!!(i&&i!==a);e.innerHTML=t?`
    <section class="runner-content ${l?"runner-content-show":"runner-content-hide"}" aria-live="polite">
      <div class="runner-welcome-row">
        <h1 class="welcome-title">WELCOME, RUNNER!</h1>
        <div class="category-badge">${o(n)}</div>
      </div>

      <div class="runner-hero">
        <div class="runner-copy">
          <div class="bib-number">${o(w)}</div>

          <div class="runner-name-block">
            <h2 class="runner-bib-name">BIB: ${o(k)}</h2>
            ${$?`<p class="runner-legal-name">${o(a)}</p>`:""}
          </div>
        </div>
      </div>
    </section>
  `:`
    <section class="idle-content" aria-live="polite">
      <div class="qr-icon-wrapper">
        <svg class="qr-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
      </div>
      <h2 class="idle-title">Scan QR Code Tiket Anda</h2>
      <p class="idle-subtitle">Tunjukkan QR Code e-Ticket ke petugas scanner</p>
    </section>
  `}I();
