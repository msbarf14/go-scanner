import"./modulepreload-polyfill-B5Qt9EMX.js";const y="",$="https://r2.fenturun2026.com/assets".replace(/\/$/,""),k="11";let p=1,b=!1,t=null,l=!1,d=!1,r=null;const E=document.getElementById("app");function c(n){return`${`${$}/${n.replace(/^\/+/,"")}`}?v=${encodeURIComponent(k)}`}function o(n){return String(n??"").replace(/[&<>'"]/g,e=>{switch(e){case"&":return"&amp;";case"<":return"&lt;";case">":return"&gt;";case"'":return"&#39;";case'"':return"&quot;";default:return e}})}function N(){const n=new URLSearchParams(window.location.search);p=I(n.get("station")),b=n.get("debug")==="1",u(),R(),m(),setInterval(()=>void m(),500)}function I(n){if(!n)return 1;const e=Number(n.trim());return Number.isInteger(e)&&e>=1&&e<=99?e:1}function R(){const n=document.createElement("div");n.className=`display-scanner ${b?"display-scanner-debug":"display-scanner-hidden"}`;const e=document.createElement("form");e.className="display-scanner-form",e.setAttribute("aria-label","Scanner QR Runner Display");const a=document.createElement("input");a.id="displayScannerInput",a.className="display-scanner-input",a.type="text",a.autocomplete="off",a.placeholder="Scan atau masukkan QR Code tiket...",a.setAttribute("aria-label","Input QR Code tiket"),e.appendChild(a),n.appendChild(e),document.body.appendChild(n),r=a,e.addEventListener("submit",s=>void C(s)),a.addEventListener("blur",()=>setTimeout(i,0)),document.addEventListener("click",i),window.addEventListener("focus",i),document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&i()}),setTimeout(i,0),setInterval(i,250)}function i(){!d&&r&&document.visibilityState==="visible"&&r.focus()}async function C(n){if(n.preventDefault(),d||!r)return;const e=r.value.trim();if(r.value="",!e){i();return}d=!0;try{const s=await(await fetch(`${y}/api/scans/validate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({payload:e,station:p.toString()})})).json();(s.outcome==="valid"||s.outcome==="already_picked_up")&&await m()}catch{}finally{d=!1,i()}}async function m(){try{const n=await fetch(`${y}/api/display?station=${p}`);if(!n.ok)return;const a=(await n.json()).data.display;a&&(!t||a.order.id!==t.order.id||a.scanned_at!==t.scanned_at)?(t=a,l=!1,u(),setTimeout(()=>{l=!0,u()},50)):!a&&t&&(t=null,l=!1,u())}catch{}}function u(){var v,f,h,g;const n=((v=t==null?void 0:t.ticket)==null?void 0:v.category)||"-",e=((f=t==null?void 0:t.participant)==null?void 0:f.name)||"-",a=((h=t==null?void 0:t.participant)==null?void 0:h.bib_name)||"",s=((g=t==null?void 0:t.participant)==null?void 0:g.bib_number)||"—",S=a||e,w=!!(a&&a!==e);E.innerHTML=`
    <div class="display-container">
      <div class="display-bg" aria-hidden="true">
        <img src="${c("img/2026-runner-display.jpg")}" alt="" />
        <div class="display-overlay"></div>
      </div>

      <div class="display-content">
        <header class="display-header">
          <div class="header-inner">
            <div class="brand-official">
              <div class="station-label">Station #${o(p)}</div>
              <img src="${c("img/2026-official.png")}" class="official-logo" loading="lazy" alt="Official logo" />
            </div>
            <div class="brand-event">
              <img src="${c("img/2026-logo.png")}" class="event-logo" loading="lazy" alt="Fenturun 2026" />
            </div>
          </div>
        </header>

        <main class="display-main">
          ${t?`
            <section class="runner-content ${l?"runner-content-show":"runner-content-hide"}" aria-live="polite">
              <div class="runner-welcome-row">
                <h1 class="welcome-title">WELCOME, RUNNER!</h1>
                <div class="category-badge">${o(n)}</div>
              </div>

              <div class="runner-hero">
                <div class="runner-copy">
                  <div class="bib-number">${o(s)}</div>

                  <div class="runner-name-block">
                    <h2 class="runner-bib-name">BIB: ${o(S)}</h2>
                    ${w?`<p class="runner-legal-name">${o(e)}</p>`:""}
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
          `}
        </main>

        <div class="partner-section">
          <div class="partner-inner">
            <img src="${c("img/2026-partner.png")}" class="partner-logo" loading="lazy" alt="Partner logo" />
          </div>
        </div>

        <footer class="display-footer">
          <p>&copy; 2026 Fenturun 2026. Microsite By <a href="https://deka.co.id" target="_blank" rel="noopener noreferrer">DEKA</a>.</p>
        </footer>
      </div>
    </div>
  `}N();
