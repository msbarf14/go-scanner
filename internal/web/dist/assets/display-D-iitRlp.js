import"./modulepreload-polyfill-B5Qt9EMX.js";const h="";let s=1,a=null,n=!1;const u=document.getElementById("app");function m(){const e=new URLSearchParams(window.location.search);s=parseInt(e.get("station")||"1",10),t(),v(),setInterval(v,500)}async function v(){try{const e=await fetch(`${h}/api/display?station=${s}`);if(!e.ok)return;const i=(await e.json()).data.display;i&&(!a||i.order.id!==a.order.id)?(a=i,n=!1,t(),setTimeout(()=>{n=!0,t()},50)):!i&&a&&(a=null,n=!1,t())}catch{}}function t(){var i,o,c,l,d,p;const e=((i=a==null?void 0:a.ticket)==null?void 0:i.category)||"",r=k(e);u.innerHTML=`
    <div class="display-container">
      <header class="display-header">
        <div class="logo-placeholder">F</div>
        <div class="station-info">
          <span class="station-label">Station #${s}</span>
        </div>
      </header>

      <main class="display-main">
        ${a?`
          <div class="runner-content ${n?"runner-content-show":"runner-content-hide"}">
            <div class="welcome-text">
              <h2>WELCOME, RUNNERS!</h2>
            </div>

            <div class="runner-card">
              <div class="category-badge ${r}">
                <svg class="badge-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                ${e||"-"}
              </div>

              <div class="bib-number">
                ${((o=a.participant)==null?void 0:o.bib_number)||"—"}
              </div>

              <div class="runner-name">
                ${((c=a.participant)==null?void 0:c.name)||"-"}
              </div>

              ${(l=a.participant)!=null&&l.bib_name&&a.participant.bib_name!==a.participant.name?`
                <div class="bib-name">BIB: ${a.participant.bib_name}</div>
              `:""}

              <div class="info-chips">
                ${(d=a.participant)!=null&&d.jersey_size?`
                  <div class="chip">
                    <svg class="chip-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                    Jersey: ${a.participant.jersey_size}
                  </div>
                `:""}
                ${(p=a.order)!=null&&p.number?`
                  <div class="chip">
                    <svg class="chip-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    ${a.order.number}
                  </div>
                `:""}
              </div>
            </div>
          </div>
        `:`
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
  `}function k(e){return e.includes("5")?"category-5k":e.includes("10")?"category-10k":e.includes("21")?"category-21k":"category-default"}m();
