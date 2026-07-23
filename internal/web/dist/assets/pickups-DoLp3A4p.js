import"./modulepreload-polyfill-B5Qt9EMX.js";/* empty css               */const L="",U=50,x=5e3;let l="unknown",i="checking",w=null,d=[],E=null,D=!1,S=null,c="Memeriksa session...",p=!1,g=!1,v="",b=!1,f=null,_=null,M=null,s=te();const j=document.getElementById("app");function r(e){return String(e??"").replace(/[&<>'"]/g,t=>{switch(t){case"&":return"&amp;";case"<":return"&lt;";case">":return"&gt;";case"'":return"&#39;";case'"':return"&quot;";default:return t}})}function N(){o(),W(),window.addEventListener("online",()=>{l==="authenticated"&&u({reset:!0})}),window.addEventListener("offline",()=>{i="offline",c="Browser sedang offline.",o()}),document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&l==="authenticated"&&navigator.onLine&&u({reset:!0,silent:!0})}),M=window.setInterval(()=>{document.visibilityState==="visible"&&l==="authenticated"&&navigator.onLine&&u({reset:!0,silent:!0})},x)}function o(){j.innerHTML=`
    <div class="min-h-screen bg-gray-50 pickups-shell">
      <header class="header">
        <div class="header-inner">
          <div class="header-left">
            <div class="logo-placeholder">F</div>
            <div>
              <h1 class="header-title">Data Pickup Race Pack</h1>
              <p class="header-subtitle">Monitoring peserta/order yang sudah mengambil race pack</p>
            </div>
          </div>
          <div class="header-actions">
            <a class="header-link header-icon-only" href="/runner-scanner" aria-label="Kembali ke Scanner" title="Kembali ke Scanner">
              <svg class="header-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </a>
            ${l==="authenticated"?`<button id="refreshButton" class="btn-secondary header-action-button header-icon-only" type="button" aria-label="Refresh data pickup" title="Refresh data pickup">
              <svg class="header-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992V4.356M20.49 9.348A9 9 0 105.64 18.36" />
              </svg>
            </button>`:""}
            ${l==="authenticated"?`<button id="logoutButton" class="btn-danger header-action-button header-icon-only" type="button" ${b?"disabled":""} aria-label="Logout" title="Logout">
              <svg class="header-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </button>`:`<button id="loginButton" class="btn-primary header-action-button" type="button" aria-label="Login">
              <svg class="header-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3-6l3 3m0 0l-3 3m3-3H9" />
              </svg>
              <span class="header-action-label">Login</span>
            </button>`}
            <div class="status-indicator status-${le()}">
              <div class="status-dot"></div>
              <span>${r(se())}</span>
            </div>
          </div>
        </div>
      </header>

      <main class="main-content">
        <div class="pickups-note">Halaman ini menampilkan status akhir pickup dari database. Ini bukan audit scan, tidak menyimpan station, dan tidak menampilkan data kontak/identitas peserta.</div>
        ${l==="authenticated"?K():V()}
        ${H()}
      </main>

      ${p?z():""}
    </div>
  `,X()}function V(){return i==="checking"?'<div class="login-required-state">Memeriksa session operator...</div>':l==="forbidden"?'<div class="error-state">Anda tidak memiliki akses scanner untuk membuka data pickup.</div>':'<div class="login-required-state">Silakan login operator Race Pack untuk melihat data pickup. Data tidak dimuat sebelum session valid.</div>'}function K(){return`
    <section class="filters-card">
      <form id="filtersForm" class="filters-form">
        <div class="filter-field">
          <label class="filter-label" for="searchInput">Pencarian</label>
          <input id="searchInput" class="filter-input" type="search" maxlength="100" autocomplete="off" placeholder="Order, BIB, atau nama" value="${r(s.q)}" />
        </div>
        <div class="filter-field">
          <label class="filter-label" for="fromInput">Dari</label>
          <input id="fromInput" class="filter-input" type="datetime-local" value="${r(s.pickedUpFrom)}" />
        </div>
        <div class="filter-field">
          <label class="filter-label" for="toInput">Sampai</label>
          <input id="toInput" class="filter-input" type="datetime-local" value="${r(s.pickedUpTo)}" />
        </div>
        <div class="filter-field">
          <label class="filter-label" for="categoryInput">Kategori</label>
          <input id="categoryInput" class="filter-input" type="text" maxlength="100" autocomplete="off" placeholder="5K" value="${r(s.category)}" />
        </div>
        <div class="filter-actions">
          <button id="applyFiltersButton" class="btn-primary" type="submit">Terapkan</button>
          <button id="resetFiltersButton" class="btn-secondary" type="button">Reset</button>
        </div>
      </form>
    </section>
  `}function H(){return l!=="authenticated"?"":i==="loading"&&d.length===0?'<div class="empty-state">Memuat data pickup...</div>':i==="offline"?'<div class="error-state">Browser offline. Data pickup tidak ditampilkan dari cache.</div>':i==="error"?`<div class="error-state">${r(c)}</div>`:i==="empty"?'<div class="empty-state">Belum ada data pickup sesuai filter.</div>':`
    <section class="pickups-card">
      <div class="pickups-card-header">
        <div>
          <h2 class="pickups-title">Daftar Pickup</h2>
          <p class="pickups-meta">${d.length} item dimuat${S?` · Refresh terakhir ${r(F(S))}`:""}</p>
        </div>
        ${i==="loading"?'<span class="status-pill">Memuat...</span>':'<span class="status-pill">Aktif</span>'}
      </div>
      <div class="pickups-table-wrapper">
        <table class="pickups-table">
          <thead>
            <tr>
              <th>Waktu Pickup</th>
              <th>Order</th>
              <th>BIB</th>
              <th>Peserta</th>
              <th>Kategori</th>
              <th>Jersey</th>
              <th>Operator</th>
            </tr>
          </thead>
          <tbody>
            ${d.map(G).join("")}
          </tbody>
        </table>
      </div>
      <div class="pickups-mobile-list">
        ${d.map(J).join("")}
      </div>
      ${D?'<div class="load-more-row"><button id="loadMoreButton" class="btn-secondary" type="button">Muat lebih banyak</button></div>':""}
    </section>
  `}function G(e){const t=e.target.type==="external_participant"?"VIP":"Online";return`
    <tr>
      <td><div class="value-primary">${r(F(e.order.picked_up_at))}</div></td>
      <td><div class="value-primary">${r(e.order.number||t)}</div><div class="value-secondary">${r(e.order.status||t)}</div></td>
      <td><div class="value-primary">${r(e.participant.bib_number||"-")}</div><div class="value-secondary">${r(e.participant.bib_name||"-")}</div></td>
      <td><div class="value-primary">${r(e.participant.name||"-")}</div></td>
      <td>${r(e.ticket.category||"-")}</td>
      <td>${r(e.participant.jersey_size||"-")}</td>
      <td>${r(e.operator.name||"Operator tidak tersedia")}</td>
    </tr>
  `}function J(e){const t=e.target.type==="external_participant"?"VIP":"Online";return`
    <article class="pickup-card">
      <div class="pickup-card-header">
        <div>
          <div class="value-primary">${r(e.order.number||t)}</div>
          <div class="value-secondary">${r(F(e.order.picked_up_at))}</div>
        </div>
        <span class="status-pill">${r(e.order.status||t)}</span>
      </div>
      <div class="pickup-card-grid">
        ${y("BIB",e.participant.bib_number||"-")}
        ${y("Peserta",e.participant.name||"-")}
        ${y("BIB Name",e.participant.bib_name||"-")}
        ${y("Kategori",e.ticket.category||"-")}
        ${y("Jersey",e.participant.jersey_size||"-")}
        ${y("Operator",e.operator.name||"Operator tidak tersedia")}
      </div>
    </article>
  `}function y(e,t){return`<div><div class="pickup-field-label">${r(e)}</div><div class="pickup-field-value">${r(t)}</div></div>`}function z(){return`
    <div class="login-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="loginTitle">
      <form id="loginForm" class="login-modal">
        <div class="login-modal-header">
          <h2 id="loginTitle" class="login-modal-title">Login Operator Race Pack</h2>
          <p class="login-modal-subtitle">Gunakan akun Laravel yang memiliki akses scanner.</p>
        </div>
        <div class="login-modal-body">
          ${v?`<div class="login-error">${r(v)}</div>`:""}
          <div class="filter-field">
            <label class="filter-label" for="identityInput">Username / Email</label>
            <input id="identityInput" class="filter-input" type="text" autocomplete="username" required />
          </div>
          <div class="filter-field">
            <label class="filter-label" for="passwordInput">Password</label>
            <input id="passwordInput" class="filter-input" type="password" autocomplete="current-password" required />
          </div>
        </div>
        <div class="login-modal-footer">
          <button id="loginCancel" class="btn-secondary" type="button" ${g?"disabled":""}>Cancel</button>
          <button class="btn-primary" type="submit" ${g?"disabled":""}>${g?"Login...":"Login"}</button>
        </div>
      </form>
    </div>
  `}function X(){var e,t,a,n,h,B,I,$,P;(e=document.getElementById("loginButton"))==null||e.addEventListener("click",re),(t=document.getElementById("logoutButton"))==null||t.addEventListener("click",()=>void Y()),(a=document.getElementById("refreshButton"))==null||a.addEventListener("click",()=>void u({reset:!0})),(n=document.getElementById("loadMoreButton"))==null||n.addEventListener("click",()=>void u({reset:!1})),(h=document.getElementById("loginCancel"))==null||h.addEventListener("click",oe),(B=document.getElementById("loginForm"))==null||B.addEventListener("submit",m=>void Q(m)),(I=document.getElementById("filtersForm"))==null||I.addEventListener("submit",m=>{m.preventDefault(),A(),u({reset:!0})}),($=document.getElementById("resetFiltersButton"))==null||$.addEventListener("click",()=>{s={q:"",category:"",pickedUpFrom:"",pickedUpTo:""},C(),u({reset:!0})});for(const m of["searchInput","categoryInput","fromInput","toInput"])(P=document.getElementById(m))==null||P.addEventListener("input",ee);p&&setTimeout(()=>{var m;return(m=document.getElementById("identityInput"))==null?void 0:m.focus()},0)}async function W(){try{const e=await fetch(`${L}/auth/session`,{credentials:"same-origin",cache:"no-store"});if(e.ok){l="authenticated",i="loading",p=!1,o(),await u({reset:!0});return}k(),e.status===403?(l="forbidden",i="forbidden",c="Akses ditolak."):(l="anonymous",i="login_required",p=!0,c="Login diperlukan."),o()}catch{l="anonymous",i=navigator.onLine?"error":"offline",c=navigator.onLine?"Gagal memeriksa session.":"Browser sedang offline.",p=navigator.onLine,k(),o()}}async function u(e){if(l==="authenticated"){if(!navigator.onLine){i="offline",c="Browser sedang offline.",k(),o();return}f==null||f.abort(),f=new AbortController,e.reset&&(E=null),(!e.silent||d.length===0)&&(i="loading",o());try{const t=Z(e.reset?null:E),a=await fetch(`${L}/api/race-pack-pickups?${t}`,{credentials:"same-origin",cache:"no-store",signal:f.signal});if(a.status===401){ne();return}if(a.status===403){k(),l="forbidden",i="forbidden",c="Akses ditolak.",o();return}const n=await a.json();if(!a.ok||!n.data){i="error",c=n.message||"Gagal memuat data pickup.",d.length===0&&k(),o();return}e.reset?ae(n.data.items):ie(n.data.items),D=n.data.page.has_more,E=n.data.page.next_cursor??null,S=new Date().toISOString(),i=d.length===0?"empty":"ready",c="Data pickup aktif.",o()}catch(t){if(t.name==="AbortError")return;i=navigator.onLine?"error":"offline",c=navigator.onLine?"Gagal memuat data pickup.":"Browser sedang offline.",d.length===0&&k(),o()}}}async function Q(e){var n,h;if(e.preventDefault(),g)return;const t=((n=document.getElementById("identityInput"))==null?void 0:n.value.trim())||"",a=((h=document.getElementById("passwordInput"))==null?void 0:h.value)||"";if(!(!t||!a)){g=!0,v="",o();try{const B=await R(),I=await fetch(`${L}/auth/login`,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json","X-CSRF-Token":B},body:JSON.stringify({identity:t,password:a})}),$=await I.json();if(!I.ok||$.outcome!=="valid"){v=$.message||"Login gagal.",g=!1,o();return}l="authenticated",i="loading",p=!1,g=!1,v="",o(),await u({reset:!0})}catch{v="Login gagal. Periksa koneksi server.",g=!1,o()}}}async function Y(){if(!b){b=!0,k(),o();try{const e=await R();if(!(await fetch(`${L}/auth/logout`,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json","X-CSRF-Token":e},body:JSON.stringify({})})).ok){b=!1,c="Logout gagal di server.",i="error",o();return}l="anonymous",i="login_required",w=null,b=!1,p=!0,o()}catch{b=!1,i="error",c="Logout gagal. Periksa koneksi server.",o()}}}async function R(){var a;if(w)return w;const e=await fetch(`${L}/auth/csrf`,{credentials:"same-origin",cache:"no-store"}),t=await e.json();if(!e.ok||!((a=t.data)!=null&&a.token))throw new Error("CSRF token unavailable");return w=t.data.token,w}function Z(e){const t=new URLSearchParams;t.set("limit",U.toString()),s.q&&t.set("q",s.q),s.category&&t.set("category",s.category);const a=T(s.pickedUpFrom),n=T(s.pickedUpTo);return a&&t.set("picked_up_from",a),n&&t.set("picked_up_to",n),e&&t.set("cursor",e),t}function ee(){A(),_&&window.clearTimeout(_),_=window.setTimeout(()=>void u({reset:!0}),300)}function A(){var e,t,a,n;s={q:((e=document.getElementById("searchInput"))==null?void 0:e.value.trim())||"",category:((t=document.getElementById("categoryInput"))==null?void 0:t.value.trim())||"",pickedUpFrom:((a=document.getElementById("fromInput"))==null?void 0:a.value)||"",pickedUpTo:((n=document.getElementById("toInput"))==null?void 0:n.value)||""},C()}function te(){const e=new URLSearchParams(window.location.search);return{q:e.get("q")||"",category:e.get("category")||"",pickedUpFrom:q(e.get("picked_up_from")),pickedUpTo:q(e.get("picked_up_to"))}}function C(){const e=new URLSearchParams;s.q&&e.set("q",s.q),s.category&&e.set("category",s.category);const t=T(s.pickedUpFrom),a=T(s.pickedUpTo);t&&e.set("picked_up_from",t),a&&e.set("picked_up_to",a);const n=e.toString(),h=`${window.location.pathname}${n?`?${n}`:""}`;window.history.replaceState({},"",h)}function T(e){if(!e)return"";const t=new Date(e);return Number.isNaN(t.getTime())?"":t.toISOString()}function q(e){if(!e)return"";const t=new Date(e);return Number.isNaN(t.getTime())?"":new Date(t.getTime()-t.getTimezoneOffset()*6e4).toISOString().slice(0,16)}function ae(e){const t=new Map;for(const a of e)t.set(`${a.target.type}:${a.target.id}`,a);for(const a of d){const n=`${a.target.type}:${a.target.id}`;t.has(n)||t.set(n,a)}d=Array.from(t.values()).sort(O)}function ie(e){const t=new Set(d.map(a=>`${a.target.type}:${a.target.id}`));for(const a of e)t.has(`${a.target.type}:${a.target.id}`)||d.push(a);d.sort(O)}function O(e,t){const a=new Date(t.order.picked_up_at).getTime()-new Date(e.order.picked_up_at).getTime();return a!==0?a:t.target.type.localeCompare(e.target.type)||t.target.id.localeCompare(e.target.id)}function k(){f==null||f.abort(),f=null,d=[],E=null,D=!1,S=null}function ne(){k(),l="anonymous",i="login_required",w=null,p=!0,c="Session berakhir. Silakan login ulang.",o()}function re(){p=!0,v="",o()}function oe(){p=!1,v="",l!=="authenticated"&&(i="login_required"),o()}function se(){if(!navigator.onLine)return"Offline";switch(i){case"checking":return"Memeriksa session";case"login_required":return"Perlu login";case"loading":return"Memuat";case"ready":return"Aktif";case"empty":return"Kosong";case"offline":return"Offline";case"forbidden":return"Akses ditolak";default:return"Error"}}function le(){return!navigator.onLine||i==="offline"||i==="error"||i==="forbidden"?"offline":i==="loading"||i==="checking"?"checking":"ready"}function F(e){const t=new Date(e);return Number.isNaN(t.getTime())?e:new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeStyle:"short"}).format(t)}window.addEventListener("beforeunload",()=>{M&&window.clearInterval(M)});N();
