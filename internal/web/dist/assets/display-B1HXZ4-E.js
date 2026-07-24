import"./modulepreload-polyfill-B5Qt9EMX.js";const w="",C="https://r2.fenturun2026.com/assets".replace(/\/$/,""),R="11";let f=1,E=!1,i=null,S=null,c=null,l=null,r=!1,v=!1,u=null;const I=document.getElementById("app");function m(e){return`${`${C}/${e.replace(/^\/+/,"")}`}?v=${encodeURIComponent(R)}`}function o(e){return String(e??"").replace(/[&<>'"]/g,a=>{switch(a){case"&":return"&amp;";case"<":return"&lt;";case">":return"&gt;";case"'":return"&#39;";case'"':return"&quot;";default:return a}})}function M(){const e=new URLSearchParams(window.location.search);f=L(e.get("station")),E=e.get("debug")==="1",O(),d(),B(),g(),setInterval(()=>void g(),500)}function L(e){if(!e)return 1;const a=Number(e.trim());return Number.isInteger(a)&&a>=1&&a<=99?a:1}function B(){const e=document.createElement("div");e.className=`display-scanner ${E?"display-scanner-debug":"display-scanner-hidden"}`;const a=document.createElement("form");a.className="display-scanner-form",a.setAttribute("aria-label","Scanner QR Runner Display");const n=document.createElement("input");n.id="displayScannerInput",n.className="display-scanner-input",n.type="text",n.autocomplete="off",n.placeholder="Scan atau masukkan QR Code tiket...",n.setAttribute("aria-label","Input QR Code tiket"),a.appendChild(n),e.appendChild(a),document.body.appendChild(e),u=n,a.addEventListener("submit",t=>void K(t)),n.addEventListener("blur",()=>setTimeout(s,0)),document.addEventListener("click",s),window.addEventListener("focus",s),document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&s()}),setTimeout(s,0),setInterval(s,250)}function s(){!v&&u&&document.visibilityState==="visible"&&u.focus()}async function K(e){if(e.preventDefault(),v||!u)return;const a=u.value.trim();if(u.value="",!a){s();return}v=!0;try{const t=await(await fetch(`${w}/api/scans/validate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({payload:a,station:f.toString()})})).json();t.outcome==="valid"||t.outcome==="already_picked_up"?($(),await g()):T(t.outcome,t.message)}catch{p({kind:"error",title:"KONEKSI BERMASALAH",message:"Scan belum bisa diproses. Coba ulangi setelah koneksi stabil."})}finally{v=!1,s()}}function T(e,a){if(e==="station_mismatch"){p({kind:"invalid",title:"STATION TIDAK SESUAI",message:a||"Kategori tiket tidak dilayani di station ini. Hubungi petugas."});return}if(e==="not_found"){p({kind:"not_found",title:"TIKET TIDAK DITEMUKAN",message:"QR Code atau Order ID tidak ditemukan. Silakan cek tiket atau hubungi petugas."});return}if(e==="database_unavailable"||e==="internal_error"){p({kind:"error",title:"KONEKSI BERMASALAH",message:a||"Scan belum bisa diproses. Coba ulangi setelah koneksi stabil."});return}p({kind:"invalid",title:"QR CODE TIDAK VALID",message:a||"Format QR Code atau Order ID tidak dikenali. Silakan scan ulang tiket yang benar."})}function p(e){l!==null&&(window.clearTimeout(l),l=null),i=null,c=e,r=!1,d(),setTimeout(()=>{r=!0,d()},50),l=window.setTimeout(()=>{c=null,l=null,r=!1,d()},4500)}function $(){l!==null&&(window.clearTimeout(l),l=null),c=null}async function g(){try{const e=await fetch(`${w}/api/display?station=${f}`);if(!e.ok)return;const n=(await e.json()).data.display;if(n&&n.scan_id!==S){if(S=n.scan_id,n.outcome!=="valid"&&n.outcome!=="already_picked_up"){T(n.outcome,n.message);return}$(),i=n,r=!1,d(),setTimeout(()=>{r=!0,d()},50)}else!n&&i&&(i=null,r=!1,d())}catch{}}function O(){I.innerHTML=`
    <div class="display-container">
      <div class="display-bg" aria-hidden="true">
        <img src="${m("img/2026-runner-display.jpg")}" loading="eager" decoding="async" fetchpriority="high" alt="" />
        <div class="display-overlay"></div>
      </div>

      <div class="display-content">
        <header class="display-header">
          <div class="header-inner">
            <div class="brand-official">
              <div class="station-label">Station #${o(f)}</div>
              <img src="${m("img/2026-official.png")}" class="official-logo" loading="eager" decoding="async" alt="Official logo" />
            </div>
            <div class="brand-event">
              <img src="${m("img/2026-logo.png")}" class="event-logo" loading="eager" decoding="async" alt="Fenturun 2026" />
            </div>
          </div>
        </header>

        <main class="display-main"></main>

        <div class="partner-section">
          <div class="partner-inner">
            <img src="${m("img/2026-partner.png")}" class="partner-logo" loading="eager" decoding="async" alt="Partner logo" />
          </div>
        </div>

        <footer class="display-footer">
          <p>&copy; 2026 Fenturun 2026. Microsite By <a href="https://deka.co.id" target="_blank" rel="noopener noreferrer">DEKA</a>.</p>
        </footer>
      </div>
    </div>
  `}function d(){var h,b,k,y;const e=I.querySelector(".display-main");if(!e)return;const a=((h=i==null?void 0:i.ticket)==null?void 0:h.category)||"-",n=((b=i==null?void 0:i.participant)==null?void 0:b.name)||"-",t=((k=i==null?void 0:i.participant)==null?void 0:k.bib_name)||"",A=((y=i==null?void 0:i.participant)==null?void 0:y.bib_number)||"—",N=t||n,_=!!(t&&t!==n);e.innerHTML=c?`
    <section class="fallback-content fallback-${c.kind} ${r?"runner-content-show":"runner-content-hide"}" aria-live="assertive">
      <div class="fallback-icon-wrapper">
        <svg class="fallback-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12V16.5zm9-4.5a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 class="fallback-title">${o(c.title)}</h2>
      <p class="fallback-message">${o(c.message)}</p>
    </section>
  `:i?`
    <section class="runner-content ${r?"runner-content-show":"runner-content-hide"}" aria-live="polite">
      <div class="runner-welcome-row">
        <h1 class="welcome-title">WELCOME, RUNNER!</h1>
        <div class="category-badge">${o(a)}</div>
      </div>

      <div class="runner-hero">
        <div class="runner-copy">
          <div class="bib-number">${o(A)}</div>

          <div class="runner-name-block">
            <h2 class="runner-bib-name">BIB: ${o(N)}</h2>
            ${_?`<p class="runner-legal-name">${o(n)}</p>`:""}
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
  `}M();
