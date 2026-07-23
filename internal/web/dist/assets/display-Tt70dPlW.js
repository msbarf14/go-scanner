import"./modulepreload-polyfill-B5Qt9EMX.js";const w="",A="https://r2.fenturun2026.com/assets".replace(/\/$/,""),C="11";let v=1,S=!1,t=null,o=null,l=null,r=!1,m=!1,u=null;const $=document.getElementById("app");function p(e){return`${`${A}/${e.replace(/^\/+/,"")}`}?v=${encodeURIComponent(C)}`}function c(e){return String(e??"").replace(/[&<>'"]/g,n=>{switch(n){case"&":return"&amp;";case"<":return"&lt;";case">":return"&gt;";case"'":return"&#39;";case'"':return"&quot;";default:return n}})}function N(){const e=new URLSearchParams(window.location.search);v=R(e.get("station")),S=e.get("debug")==="1",O(),d(),M(),g(),setInterval(()=>void g(),500)}function R(e){if(!e)return 1;const n=Number(e.trim());return Number.isInteger(n)&&n>=1&&n<=99?n:1}function M(){const e=document.createElement("div");e.className=`display-scanner ${S?"display-scanner-debug":"display-scanner-hidden"}`;const n=document.createElement("form");n.className="display-scanner-form",n.setAttribute("aria-label","Scanner QR Runner Display");const a=document.createElement("input");a.id="displayScannerInput",a.className="display-scanner-input",a.type="text",a.autocomplete="off",a.placeholder="Scan atau masukkan QR Code tiket...",a.setAttribute("aria-label","Input QR Code tiket"),n.appendChild(a),e.appendChild(n),document.body.appendChild(e),u=a,n.addEventListener("submit",i=>void L(i)),a.addEventListener("blur",()=>setTimeout(s,0)),document.addEventListener("click",s),window.addEventListener("focus",s),document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&s()}),setTimeout(s,0),setInterval(s,250)}function s(){!m&&u&&document.visibilityState==="visible"&&u.focus()}async function L(e){if(e.preventDefault(),m||!u)return;const n=u.value.trim();if(u.value="",!n){s();return}m=!0;try{const i=await(await fetch(`${w}/api/scans/validate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({payload:n,station:v.toString()})})).json();i.outcome==="valid"||i.outcome==="already_picked_up"?(B(),await g()):_(i.outcome,i.message)}catch{f({kind:"error",title:"KONEKSI BERMASALAH",message:"Scan belum bisa diproses. Coba ulangi setelah koneksi stabil."})}finally{m=!1,s()}}function _(e,n){if(e==="not_found"){f({kind:"not_found",title:"TIKET TIDAK DITEMUKAN",message:"QR Code atau Order ID tidak ditemukan. Silakan cek tiket atau hubungi petugas."});return}f({kind:"invalid",title:"QR CODE TIDAK VALID",message:n||"Format QR Code atau Order ID tidak dikenali. Silakan scan ulang tiket yang benar."})}function f(e){l!==null&&(window.clearTimeout(l),l=null),t=null,o=e,r=!1,d(),setTimeout(()=>{r=!0,d()},50),l=window.setTimeout(()=>{o=null,l=null,r=!1,d()},4500)}function B(){l!==null&&(window.clearTimeout(l),l=null),o=null}async function g(){try{const e=await fetch(`${w}/api/display?station=${v}`);if(!e.ok)return;const a=(await e.json()).data.display;if(o)return;a&&(!t||a.scan_id!==t.scan_id)?(t=a,r=!1,d(),setTimeout(()=>{r=!0,d()},50)):!a&&t&&(t=null,r=!1,d())}catch{}}function O(){$.innerHTML=`
    <div class="display-container">
      <div class="display-bg" aria-hidden="true">
        <img src="${p("img/2026-runner-display.jpg")}" loading="eager" decoding="async" fetchpriority="high" alt="" />
        <div class="display-overlay"></div>
      </div>

      <div class="display-content">
        <header class="display-header">
          <div class="header-inner">
            <div class="brand-official">
              <div class="station-label">Station #${c(v)}</div>
              <img src="${p("img/2026-official.png")}" class="official-logo" loading="eager" decoding="async" alt="Official logo" />
            </div>
            <div class="brand-event">
              <img src="${p("img/2026-logo.png")}" class="event-logo" loading="eager" decoding="async" alt="Fenturun 2026" />
            </div>
          </div>
        </header>

        <main class="display-main"></main>

        <div class="partner-section">
          <div class="partner-inner">
            <img src="${p("img/2026-partner.png")}" class="partner-logo" loading="eager" decoding="async" alt="Partner logo" />
          </div>
        </div>

        <footer class="display-footer">
          <p>&copy; 2026 Fenturun 2026. Microsite By <a href="https://deka.co.id" target="_blank" rel="noopener noreferrer">DEKA</a>.</p>
        </footer>
      </div>
    </div>
  `}function d(){var h,b,y,k;const e=$.querySelector(".display-main");if(!e)return;const n=((h=t==null?void 0:t.ticket)==null?void 0:h.category)||"-",a=((b=t==null?void 0:t.participant)==null?void 0:b.name)||"-",i=((y=t==null?void 0:t.participant)==null?void 0:y.bib_name)||"",E=((k=t==null?void 0:t.participant)==null?void 0:k.bib_number)||"—",T=i||a,I=!!(i&&i!==a);e.innerHTML=o?`
    <section class="fallback-content fallback-${o.kind} ${r?"runner-content-show":"runner-content-hide"}" aria-live="assertive">
      <div class="fallback-icon-wrapper">
        <svg class="fallback-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12V16.5zm9-4.5a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 class="fallback-title">${c(o.title)}</h2>
      <p class="fallback-message">${c(o.message)}</p>
    </section>
  `:t?`
    <section class="runner-content ${r?"runner-content-show":"runner-content-hide"}" aria-live="polite">
      <div class="runner-welcome-row">
        <h1 class="welcome-title">WELCOME, RUNNER!</h1>
        <div class="category-badge">${c(n)}</div>
      </div>

      <div class="runner-hero">
        <div class="runner-copy">
          <div class="bib-number">${c(E)}</div>

          <div class="runner-name-block">
            <h2 class="runner-bib-name">BIB: ${c(T)}</h2>
            ${I?`<p class="runner-legal-name">${c(a)}</p>`:""}
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
  `}N();
