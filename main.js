/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Zero-Day Scanner — Frontend Logic v2
   Improvements:
   - Crawl depth selector
   - Soft-404 detection display
   - Accurate redirect chain display
   - Better broken tab (Reason + Redirect-To columns)
   - Improved filter chips
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/* ─── Global State ───────────────────────────────────── */
let currentScanId   = null;
let currentResult   = null;
let activeTab       = "subdomains";
let allData         = { subdomains: [], links: [], broken: [], forms: [] };
let activeChipStatus = "all";
let selectedDepth   = 2;

/* ─── Live Clock ─────────────────────────────────────── */
function updateClock() {
  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  document.getElementById("liveTime").textContent =
    `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}  ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
setInterval(updateClock, 1000);
updateClock();

/* ─── Matrix Rain Canvas ─────────────────────────────── */
(function initMatrix() {
  const canvas = document.getElementById("matrixCanvas");
  const ctx    = canvas.getContext("2d");
  const chars  = "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホ";
  let cols, drops;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    cols  = Math.floor(canvas.width / 16);
    drops = Array(cols).fill(1);
  }

  function drawMatrix() {
    ctx.fillStyle = "rgba(2, 11, 20, 0.05)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#00ff88";
    ctx.font      = "13px Share Tech Mono";
    drops.forEach((y, i) => {
      const ch = chars[Math.floor(Math.random() * chars.length)];
      ctx.fillText(ch, i * 16, y * 16);
      if (y * 16 > canvas.height && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    });
  }

  resize();
  window.addEventListener("resize", resize);
  setInterval(drawMatrix, 60);
})();

/* ─── Crawl Depth Selector ───────────────────────────── */
function setDepth(d) {
  selectedDepth = d;
  document.querySelectorAll(".depth-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(`depth-${d}`).classList.add("active");
  document.getElementById(`depth-${d}`).textContent = d + " ✓";
  [1, 2, 3].forEach(n => {
    if (n !== d) document.getElementById(`depth-${n}`).textContent = n;
  });
  const hints = {
    1: "Only scans the target page (fastest)",
    2: "Crawls main page + same-domain links (recommended)",
    3: "Deep crawl: 3 levels — slower but finds more 404s"
  };
  document.getElementById("depthHint").textContent = hints[d];
}

/* ─── Tab Switching ──────────────────────────────────── */
function switchTab(name) {
  activeTab = name;
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.add("hidden"));
  document.getElementById(`tab-${name}`).classList.add("active");
  document.getElementById(`content-${name}`).classList.remove("hidden");
}

/* ─── Status Helpers ─────────────────────────────────── */
function pillClass(status, soft404 = false) {
  if (soft404)              return "pill-soft404";
  if (!status)              return "pill-error";
  if (status === 200)       return "pill-ok";
  if (status >= 300 && status < 400) return "pill-warn";
  if (status === 403)       return "pill-error";
  if (status === 404)       return "pill-error";
  if (status === 410)       return "pill-error";
  if (status >= 500)        return "pill-error";
  return "pill-info";
}

function statusLabel(r) {
  if (r.soft404)   return "SOFT 404";
  if (!r.status)   return r.error || "TIMEOUT";
  const MAP = {
    200: "200 OK", 201: "201 CREATED",
    301: "301 MOVED", 302: "302 FOUND", 303: "303 OTHER", 307: "307 TEMP", 308: "308 PERM",
    400: "400 BAD REQ", 401: "401 UNAUTH", 403: "403 FORBIDDEN",
    404: "404 NOT FOUND", 405: "405 NO METHOD", 410: "410 GONE",
    429: "429 RATE LIMIT", 500: "500 SERVER ERR",
    502: "502 BAD GATE", 503: "503 UNAVAIL"
  };
  return MAP[r.status] || `${r.status}`;
}

function riskLevel(r) {
  if (r.soft404)         return ["MEDIUM", "risk-medium"];
  if (!r.status)         return ["HIGH",   "risk-high"];
  if (r.status === 403)  return ["MEDIUM", "risk-medium"];
  if (r.status === 404)  return ["HIGH",   "risk-high"];
  if (r.status === 410)  return ["MEDIUM", "risk-medium"];
  if (r.status >= 500)   return ["HIGH",   "risk-high"];
  if (r.status >= 300)   return ["LOW",    "risk-low"];
  return ["NONE", "risk-none"];
}

function issueText(r) {
  // Use the reason from the backend if available
  if (r.reason && r.reason !== "OK") return r.reason;
  if (r.soft404)  return "Soft-404: Page returns 200 but content says 'not found'";
  if (!r.status)  return r.error || "Connection failed / Timeout";
  if (r.status === 403) return "Access forbidden — possible auth bypass risk";
  if (r.status === 404) return "Page not found — broken link (true 404)";
  if (r.status === 410) return "Resource permanently gone (410)";
  if (r.status >= 500)  return "Server error — potential instability";
  if (r.status >= 300)  return `Redirect detected`;
  return "Unknown issue";
}

/* ─── Animate Counter ────────────────────────────────── */
function animateCounter(el, target) {
  const duration = 600;
  const start    = performance.now();
  const from     = parseInt(el.textContent) || 0;
  function step(now) {
    const t   = Math.min((now - start) / duration, 1);
    const val = Math.round(from + (target - from) * easeOut(t));
    el.textContent = val;
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

/* ─── Render Subdomains Table ────────────────────────── */
function renderSubdomains(subs) {
  const tbody = document.getElementById("subdomains-body");
  tbody.innerHTML = "";
  if (!subs.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No live subdomains found</td></tr>`;
    return;
  }
  subs.forEach((s, i) => {
    const pc   = pillClass(s.status, s.soft404);
    const sl   = statusLabel(s);
    const delay = Math.min(i * 30, 800);
    const row  = document.createElement("tr");
    row.style.animationDelay = `${delay}ms`;
    row.dataset.search = `${s.subdomain} ${s.ip} ${s.status}`.toLowerCase();
    row.innerHTML = `
      <td class="num">${i + 1}</td>
      <td class="url-cell"><a href="https://${s.subdomain}" target="_blank" rel="noopener">${s.subdomain}</a></td>
      <td style="color:var(--muted);font-size:11px">${s.ip || "—"}</td>
      <td><span class="status-pill ${pc}">${sl}</span></td>
      <td><span class="status-pill ${pc}">${s.label || sl}</span></td>
      <td style="color:var(--muted)">${s.time_ms ? s.time_ms + " ms" : "—"}</td>
      <td style="color:var(--muted);font-size:11px">${s.server || "—"}</td>`;
    tbody.appendChild(row);
  });
  document.getElementById("badge-subdomains").textContent = subs.length;
}

/* ─── Render Links Table ─────────────────────────────── */
function renderLinks(links) {
  const tbody = document.getElementById("links-body");
  tbody.innerHTML = "";
  links.forEach((r, i) => {
    const pc  = pillClass(r.status, r.soft404);
    const sl  = statusLabel(r);
    const ct  = (r.content_type || "—").split(";")[0];
    const delay = Math.min(i * 20, 1000);
    const row = document.createElement("tr");
    row.style.animationDelay = `${delay}ms`;
    row.dataset.search = `${r.url} ${r.status} ${r.soft404 ? "soft404" : ""}`.toLowerCase();
    row.dataset.status = r.status ? String(r.status) : "error";
    row.dataset.soft404 = r.soft404 ? "1" : "0";

    let reasonHtml = "—";
    if (r.soft404) {
      reasonHtml = `<span style="color:#ff8800;font-size:10px">⚠ Soft-404 (body says not found)</span>`;
    } else if (r.redirected) {
      const dest = (r.redirect_to || r.final_url || "").substring(0, 50);
      reasonHtml = `<span style="color:var(--yellow);font-size:10px">→ ${dest}${dest.length >= 50 ? "…" : ""}</span>`;
    } else if (r.reason && r.reason !== "OK") {
      reasonHtml = `<span style="color:var(--muted);font-size:10px">${r.reason.substring(0,60)}</span>`;
    }

    row.innerHTML = `
      <td class="num">${i + 1}</td>
      <td class="url-cell" title="${r.url}"><a href="${r.url}" target="_blank" rel="noopener">${r.url}</a></td>
      <td><span class="status-pill ${pc}">${sl}</span></td>
      <td>${reasonHtml}</td>
      <td style="color:var(--muted)">${r.time_ms ?? "—"}</td>
      <td style="color:var(--muted);font-size:11px">${ct}</td>`;
    tbody.appendChild(row);
  });
  document.getElementById("badge-links").textContent = links.length;
}

/* ─── Render Broken Table ────────────────────────────── */
function renderBroken(broken) {
  const tbody = document.getElementById("broken-body");
  tbody.innerHTML = "";
  if (!broken.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state" style="color:var(--green)">✓ No broken links or errors detected</td></tr>`;
    document.getElementById("badge-broken").textContent = 0;
    return;
  }
  broken.forEach((r, i) => {
    const pc        = pillClass(r.status, r.soft404);
    const sl        = statusLabel(r);
    const [rl, rc]  = riskLevel(r);
    const issue     = issueText(r);
    const delay     = Math.min(i * 30, 800);
    const row       = document.createElement("tr");
    row.style.animationDelay = `${delay}ms`;
    row.dataset.search  = `${r.url} ${r.status} ${rl} ${r.soft404 ? "soft404" : ""}`.toLowerCase();
    row.dataset.status  = r.status ? String(r.status) : "error";
    row.dataset.soft404 = r.soft404 ? "1" : "0";

    const redirectCell = r.redirected
      ? `<span style="color:var(--yellow);font-size:10px">${(r.redirect_to||"").substring(0,45)}${(r.redirect_to||"").length > 45 ? "…" : ""}</span>`
      : "—";

    row.innerHTML = `
      <td class="num">${i + 1}</td>
      <td class="url-cell" title="${r.url}"><a href="${r.url}" target="_blank" rel="noopener">${r.url}</a></td>
      <td><span class="status-pill ${pc}">${sl}</span></td>
      <td style="color:var(--muted);font-size:11px;max-width:220px">${issue}</td>
      <td style="font-size:10px">${redirectCell}</td>
      <td><span class="risk-badge ${rc}">${rl}</span></td>`;
    tbody.appendChild(row);
  });
  document.getElementById("badge-broken").textContent = broken.length;
}

/* ─── Render Forms ───────────────────────────────────── */
function renderForms(forms) {
  const grid = document.getElementById("forms-grid");
  grid.innerHTML = "";
  if (!forms.length) {
    grid.innerHTML = `<div class="empty-state">No HTML forms detected on the scanned page</div>`;
    document.getElementById("badge-forms").textContent = 0;
    return;
  }
  forms.forEach((f, i) => {
    const card = document.createElement("div");
    card.className = "form-card";
    const inputTags = f.inputs.map(inp => {
      const cls = inp.type === "password" ? "password" : inp.type === "email" ? "email" : "";
      return `<span class="form-input-tag ${cls}">${inp.name || inp.type}</span>`;
    }).join("");
    card.innerHTML = `
      <div class="form-card-header">
        <span class="form-card-title">FORM #${i + 1}</span>
        <span class="form-method">${f.method}</span>
      </div>
      <div class="form-action">${f.action || "(current page)"}</div>
      <div class="form-inputs">${inputTags || '<span style="color:var(--muted);font-size:11px">No named inputs</span>'}</div>`;
    grid.appendChild(card);
  });
  document.getElementById("badge-forms").textContent = forms.length;
}

/* ─── Filter Table ───────────────────────────────────── */
function filterTable(tableId, query) {
  const rows = document.querySelectorAll(`#${tableId} tbody tr`);
  const q    = query.toLowerCase();
  rows.forEach(row => {
    const text = (row.dataset.search || row.textContent).toLowerCase();
    row.style.display = text.includes(q) ? "" : "none";
  });
}

/* ─── Filter by status chip (ALL LINKS tab) ──────────── */
function filterByStatus(tableId, filter, chipEl) {
  document.querySelectorAll(`#content-links .chip`).forEach(c => c.classList.remove("active"));
  chipEl.classList.add("active");
  activeChipStatus = filter;

  const rows = document.querySelectorAll(`#${tableId} tbody tr`);
  rows.forEach(row => {
    if (filter === "all") { row.style.display = ""; return; }
    const status  = row.dataset.status || "";
    const soft404 = row.dataset.soft404 === "1";
    if (filter === "200")      row.style.display = status === "200" && !soft404 ? "" : "none";
    else if (filter === "redirect") row.style.display = (parseInt(status) >= 300 && parseInt(status) < 400) ? "" : "none";
    else if (filter === "error")    row.style.display = (status === "error" || parseInt(status) >= 400) ? "" : "none";
    else if (filter === "soft404")  row.style.display = soft404 ? "" : "none";
  });
}

/* ─── Filter broken tab ──────────────────────────────── */
function filterBroken(filter, chipEl) {
  document.querySelectorAll(`#content-broken .chip`).forEach(c => c.classList.remove("active"));
  chipEl.classList.add("active");

  const rows = document.querySelectorAll(`#broken-table tbody tr`);
  rows.forEach(row => {
    if (filter === "all") { row.style.display = ""; return; }
    const status  = row.dataset.status || "";
    const soft404 = row.dataset.soft404 === "1";
    if (filter === "404")      row.style.display = status === "404" ? "" : "none";
    else if (filter === "soft404")  row.style.display = soft404 ? "" : "none";
    else if (filter === "error")    row.style.display = (status === "error" || parseInt(status) >= 500) ? "" : "none";
    else if (filter === "redirect") row.style.display = (parseInt(status) >= 300 && parseInt(status) < 400) ? "" : "none";
  });
}

/* ─── Export CSV ─────────────────────────────────────── */
function exportCSV(type) {
  let rows = [], headers = [];
  if (type === "subdomains") {
    headers = ["Subdomain", "IP", "Status Code", "Label", "Response Time (ms)", "Server"];
    rows    = allData.subdomains.map(s => [s.subdomain, s.ip || "", s.status || "", s.label || "", s.time_ms || "", s.server || ""]);
  } else if (type === "links") {
    headers = ["URL", "Status Code", "Soft-404", "Label", "Reason", "Redirected", "Redirect To", "Response Time (ms)", "Content-Type"];
    rows    = allData.links.map(r => [r.url, r.status || "", r.soft404 ? "YES" : "NO", r.label || "", r.reason || "", r.redirected, r.redirect_to || "", r.time_ms || "", (r.content_type || "").split(";")[0]]);
  } else if (type === "broken") {
    headers = ["URL", "Status Code", "Soft-404", "Reason", "Redirect To", "Risk Level"];
    rows    = allData.broken.map(r => [r.url, r.status || r.error || "", r.soft404 ? "YES" : "NO", issueText(r), r.redirect_to || "", riskLevel(r)[0]]);
  }

  const csv   = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob  = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link  = document.createElement("a");
  link.href   = URL.createObjectURL(blob);
  link.download = `zerodayscanner_${type}_${Date.now()}.csv`;
  link.click();
}

/* ─── Log to Terminal ────────────────────────────────── */
function termLog(msg, cls = "") {
  const body = document.getElementById("terminalBody");
  const line = document.createElement("div");
  line.className = `terminal-line ${cls}`;
  line.textContent = `> ${msg}`;
  body.appendChild(line);
  body.scrollTop = body.scrollHeight;
}

/* ─── Update Stats Bar ───────────────────────────────── */
function updateStats(summary) {
  document.getElementById("statsBar").classList.remove("hidden");
  animateCounter(document.getElementById("statTotalVal"),      summary.total_links || 0);
  animateCounter(document.getElementById("statOkVal"),         summary.ok || 0);
  animateCounter(document.getElementById("statRedirectsVal"),  summary.redirects || 0);
  animateCounter(document.getElementById("statBrokenVal"),     summary.not_found || 0);
  animateCounter(document.getElementById("statSoft404Val"),    summary.soft404 || 0);
  animateCounter(document.getElementById("statErrorsVal"),     (summary.timeout_errors || 0) + (summary.server_errors || 0));
  animateCounter(document.getElementById("statSubdomainsVal"), summary.total_subdomains || 0);
  animateCounter(document.getElementById("statFormsVal"),      summary.forms_found || 0);
}

/* ─── Set System Status ──────────────────────────────── */
function setStatus(state, label) {
  const dot = document.getElementById("systemStatus");
  const lbl = document.getElementById("systemStatusLabel");
  dot.className = `status-dot ${state}`;
  lbl.textContent = label;
}

/* ─── Main Scan Entry ────────────────────────────────── */
async function startScan() {
  const urlInput = document.getElementById("targetUrl");
  const target   = urlInput.value.trim();
  if (!target) {
    urlInput.focus();
    urlInput.style.boxShadow = "0 0 0 2px var(--red)";
    setTimeout(() => (urlInput.style.boxShadow = ""), 1500);
    return;
  }

  // Reset UI
  document.getElementById("resultsSection").classList.add("hidden");
  document.getElementById("statsBar").classList.add("hidden");
  document.getElementById("progressPanel").classList.remove("hidden");
  document.getElementById("terminalBody").innerHTML = "";
  document.getElementById("progressBar").style.width = "0%";
  document.getElementById("progressCounter").textContent = "0 / 0";
  document.getElementById("progressPhase").textContent = "PHASE 1 — SUBDOMAIN ENUMERATION";

  // Disable button
  const btn  = document.getElementById("scanBtn");
  const text = document.getElementById("scanBtnText");
  const icon = document.getElementById("scanBtnIcon");
  btn.disabled  = true;
  text.textContent = "SCANNING…";
  icon.outerHTML = `<div class="spinner" id="scanBtnIcon"></div>`;

  document.getElementById("scanOverlay").classList.remove("hidden");
  setStatus("scanning", "SCANNING…");

  termLog(`Initiating scan on ${target} [depth=${selectedDepth}]`, "success");
  termLog(`Crawl depth: ${selectedDepth} level(s) — will follow same-domain links`);

  try {
    const initRes = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: target, crawl_depth: selectedDepth })
    });
    const { scan_id, error } = await initRes.json();
    if (error) throw new Error(error);
    currentScanId = scan_id;

    const evtSource = new EventSource(`/api/stream/${scan_id}`);
    let subDone = 0, subTotal = 55;

    evtSource.onmessage = function(evt) {
      const msg = JSON.parse(evt.data);

      if (msg.type === "progress") {
        subDone  = msg.done;
        subTotal = msg.total;
        const pct = Math.round((subDone / subTotal) * 40);  // Phase 1 = 0–40%
        document.getElementById("progressBar").style.width   = pct + "%";
        document.getElementById("progressCounter").textContent = `${subDone} / ${subTotal}`;
        if (msg.sub) termLog(`Probing subdomain: ${msg.sub}…`);
      }

      else if (msg.type === "log") {
        const m = msg.message;
        const cls = m.includes("✓") || m.includes("[+]") ? "success"
                  : m.includes("Error") || m.includes("ERROR") ? "error"
                  : m.includes("[*]") ? ""
                  : "";
        termLog(m, cls);

        // Update progress phases
        if (m.includes("Crawling [depth")) {
          document.getElementById("progressPhase").textContent = "PHASE 2 — MULTI-LEVEL CRAWL";
          const cur = parseInt(document.getElementById("progressBar").style.width) || 40;
          if (cur < 55) document.getElementById("progressBar").style.width = "52%";
        } else if (m.includes("HTTP status scan")) {
          document.getElementById("progressPhase").textContent = "PHASE 3 — LINK STATUS CHECK";
          document.getElementById("progressBar").style.width = "55%";
        } else if (m.match(/Checked \d+\/\d+/)) {
          const match = m.match(/Checked (\d+)\/(\d+)/);
          if (match) {
            const pct = 55 + Math.round((parseInt(match[1]) / parseInt(match[2])) * 42);
            document.getElementById("progressBar").style.width = pct + "%";
            document.getElementById("progressCounter").textContent = `${match[1]} / ${match[2]}`;
            document.getElementById("progressPhase").textContent = "PHASE 3 — LINK STATUS CHECK";
          }
        }
      }

      else if (msg.type === "done") {
        evtSource.close();
        document.getElementById("progressBar").style.width = "100%";
        document.getElementById("progressCounter").textContent = "COMPLETE";
        document.getElementById("scanOverlay").classList.add("hidden");
        setTimeout(() => renderResults(msg.result), 300);
      }

      else if (msg.type === "error") {
        evtSource.close();
        termLog(`ERROR: ${msg.message}`, "error");
        resetScanBtn();
        setStatus("", "ERROR");
      }
    };

    evtSource.onerror = function() {
      evtSource.close();
      termLog("Stream disconnected. Fetching result…", "warn");
      pollResult(scan_id);
    };

  } catch(err) {
    termLog(`FATAL: ${err.message}`, "error");
    resetScanBtn();
    setStatus("", "SYSTEM READY");
  }
}

/* ─── Fallback polling ───────────────────────────────── */
async function pollResult(scan_id) {
  for (let i = 0; i < 120; i++) {
    await delay(2000);
    try {
      const r    = await fetch(`/api/result/${scan_id}`);
      const data = await r.json();
      if (data.ready) { renderResults(data.result); return; }
    } catch {}
  }
  termLog("Scan timed out. Please try again.", "error");
  resetScanBtn();
}

function delay(ms) { return new Promise(res => setTimeout(res, ms)); }

/* ─── Render Full Results ────────────────────────────── */
function renderResults(result) {
  currentResult = result;

  const links  = result.links || [];

  // IMPROVED: broken = 404, 403, 410, 5xx, errors, AND soft-404s
  const broken = links.filter(r =>
    !r.status ||
    r.status === 404 ||
    r.status === 403 ||
    r.status === 410 ||
    r.status >= 500 ||
    r.soft404 === true
  );

  allData = {
    subdomains: result.subdomains || [],
    links,
    broken,
    forms: result.forms || []
  };

  renderSubdomains(allData.subdomains);
  renderLinks(allData.links);
  renderBroken(allData.broken);
  renderForms(allData.forms);
  updateStats(result.summary || {});

  document.getElementById("progressPanel").classList.add("hidden");
  document.getElementById("resultsSection").classList.remove("hidden");

  // Auto-switch to broken tab if there are issues
  if (broken.length > 0) {
    switchTab("broken");
  } else {
    switchTab("subdomains");
  }

  setStatus("done", "SCAN COMPLETE");
  resetScanBtn();

  const s = result.summary || {};
  termLog(
    `✓ Done! Links:${links.length} | OK:${s.ok||0} | 404:${s.not_found||0} | ` +
    `Soft404:${s.soft404||0} | Redirect:${s.redirects||0} | Errors:${s.timeout_errors||0} | Pages crawled:${s.pages_crawled||1}`,
    "success"
  );
}

/* ─── Reset Button ───────────────────────────────────── */
function resetScanBtn() {
  const btn  = document.getElementById("scanBtn");
  btn.disabled = false;
  btn.innerHTML = `
    <span id="scanBtnText">INITIATE SCAN</span>
    <svg id="scanBtnIcon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/>
    </svg>`;
}

/* ─── Enter key on input ─────────────────────────────── */
document.getElementById("targetUrl").addEventListener("keydown", function(e) {
  if (e.key === "Enter") startScan();
});

document.getElementById("targetUrl").addEventListener("input", function() {
  this.style.boxShadow = "";
});
