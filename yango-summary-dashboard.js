(() => {
  const SHEET_ID = "1HF0h65jgRPZiKYAro_bctnnSOaVARqd-KPjycfOUZDg";
  const DAILY_TRACKER_GID = "306964116";
  const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${DAILY_TRACKER_GID}`;
  const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const FALLBACK = {
    source: "Snapshot Daily Tracker",
    updatedAt: "2026-07-21T14:45:00.000Z",
    months: [
      {
        key: "2026-07",
        label: "Julio 2026",
        dateFrom: "2026-07-13",
        dateTo: "2026-07-19",
        mtd: [
          { metric: "Trips", budget: "960.109", bdgMtd: "515.646", actuals: "427.892", diffVsBdg: "-17%", prorated: "663.233", diffVsProrated: "-31%" },
          { metric: "GMV", budget: "$2.726.711", bdgMtd: "$1.464.434", actuals: "$1.233.132", diffVsBdg: "-16%", prorated: "$1.911.354", diffVsProrated: "-30%" },
          { metric: "AOV", budget: "$2,84", bdgMtd: "$2,84", actuals: "$2,88", diffVsBdg: "1%", prorated: "$2,88", diffVsProrated: "1%" },
          { metric: "Installs", budget: "81.643", bdgMtd: "55.085", actuals: "40.160", diffVsBdg: "-27%", prorated: "62.248", diffVsProrated: "-24%" },
          { metric: "New Riders", budget: "22.860", bdgMtd: "15.424", actuals: "11.390", diffVsBdg: "-26%", prorated: "17.655", diffVsProrated: "-23%" },
          { metric: "Install→SFO", budget: "28%", bdgMtd: "28%", actuals: "28%", diffVsBdg: "1%", prorated: "28%", diffVsProrated: "1%" },
          { metric: "Performance", budget: "$91.463", bdgMtd: "$49.577", actuals: "$32.495", diffVsBdg: "-34%", prorated: "$50.367", diffVsProrated: "-45%" },
          { metric: "CPI", budget: "$0,90", bdgMtd: "$0,90", actuals: "$0,81", diffVsBdg: "-10%", prorated: "$0,81", diffVsProrated: "-10%" },
          { metric: "Incentives", budget: "$680.072", bdgMtd: "$368.499", actuals: "$241.908", diffVsBdg: "-34%", prorated: "$374.957", diffVsProrated: "-45%" },
          { metric: "Rider incentives", budget: "$103.070", bdgMtd: "$56.417", actuals: "$70.026", diffVsBdg: "24%", prorated: "$108.540", diffVsProrated: "5%" },
          { metric: "Driver incentives", budget: "$577.002", bdgMtd: "$312.082", actuals: "$171.882", diffVsBdg: "-45%", prorated: "$266.417", diffVsProrated: "-54%" }
        ],
        weekly: [
          { metric: "Trips", budget: "218.573", actuals: "180.923", diffVsBdg: "-17%", previous: "148.499", diffVsPrevious: "22%" },
          { metric: "GMV", budget: "$620.747", actuals: "$520.767", diffVsBdg: "-16%", previous: "$421.149", diffVsPrevious: "24%" },
          { metric: "AOV", budget: "$2,84", actuals: "$2,88", diffVsBdg: "1%", previous: "$2,84", diffVsPrevious: "1%" },
          { metric: "Installs", budget: "23.419", actuals: "18.614", diffVsBdg: "-21%", previous: "14.065", diffVsPrevious: "32%" },
          { metric: "New Riders", budget: "6.557", actuals: "4.791", diffVsBdg: "-27%", previous: "3.809", diffVsPrevious: "26%" },
          { metric: "Install→SFO", budget: "28%", actuals: "26%", diffVsBdg: "-8%", previous: "27%", diffVsPrevious: "-5%" },
          { metric: "Performance", budget: "$21.077", actuals: "$15.898", diffVsBdg: "-25%", previous: "$13.956", diffVsPrevious: "14%" },
          { metric: "CPI", budget: "$0,90", actuals: "$0,85", diffVsBdg: "-5%", previous: "$0,99", diffVsPrevious: "-14%" },
          { metric: "Incentives", budget: "$154.764", actuals: "$20.448", diffVsBdg: "-87%", previous: "$131.648", diffVsPrevious: "-84%" },
          { metric: "Rider incentives", budget: "$23.482", actuals: "$20.189", diffVsBdg: "-14%", previous: "$19.901", diffVsPrevious: "1%" },
          { metric: "Driver incentives", budget: "$131.282", actuals: "$259", diffVsBdg: "-100%", previous: "$111.747", diffVsPrevious: "-100%" }
        ],
        daily: []
      }
    ]
  };

  const KPI_MAP = [
    { label: "Trips", metric: "Trips", icon: "↗", tone: "red" },
    { label: "GMV", metric: "GMV", icon: "$", tone: "dark" },
    { label: "Installs", metric: "Installs", icon: "↓", tone: "blue" },
    { label: "AOV", metric: "AOV", icon: "÷", tone: "purple" },
    { label: "New riders", metric: "New Riders", icon: "+", tone: "green" },
    { label: "Performance", metric: "Performance", icon: "●", tone: "orange" }
  ];

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];
      if (quoted) {
        if (char === '"' && next === '"') {
          field += '"';
          i += 1;
        } else if (char === '"') {
          quoted = false;
        } else {
          field += char;
        }
      } else if (char === '"') {
        quoted = true;
      } else if (char === ',') {
        row.push(field);
        field = "";
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && next === '\n') i += 1;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += char;
      }
    }
    row.push(field);
    rows.push(row);
    return rows.filter(r => r.some(cell => String(cell || "").trim()));
  }

  function clean(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function norm(value) {
    return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function monthKeyAndLabel(rawDate) {
    const value = clean(rawDate);
    const parts = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!parts) {
      const now = new Date();
      return { key: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`, label: `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}` };
    }
    const month = Number(parts[1]);
    const year = Number(parts[3]);
    return { key: `${year}-${String(month).padStart(2, "0")}`, label: `${MONTH_NAMES[month - 1]} ${year}` };
  }

  function normalizeDisplay(value) {
    const raw = clean(value);
    if (!raw) return "—";
    return raw.replace(/,/g, "§").replace(/\./g, ",").replace(/§/g, ".");
  }

  function findHeader(row, label, from = 0) {
    const wanted = norm(label);
    return row.findIndex((cell, index) => index >= from && norm(cell) === wanted);
  }

  function rowMetric(row, metricIdx) {
    return clean(row[metricIdx]);
  }

  function buildPayloadFromRows(rows) {
    const header = rows[2] || [];
    const month = monthKeyAndLabel(header[10]);
    const budgetIdx = findHeader(header, "Budget", 30);
    const bdgMtdIdx = findHeader(header, "BdgMtD", budgetIdx + 1);
    const actualsIdx = findHeader(header, "Actuals", bdgMtdIdx + 1);
    const diffIdx = findHeader(header, "DiffvsBdg", actualsIdx + 1);
    const proratedIdx = findHeader(header, "Prorated", diffIdx + 1);
    const diffProratedIdx = findHeader(header, "DiffvsProrated", proratedIdx + 1);
    const metricIdx = budgetIdx - 1;
    const dateFromRow = rows.find(row => norm(row[35]) === "from");
    const dateToRow = rows.find(row => norm(row[35]) === "to");

    const mtd = [];
    if (budgetIdx > 0) {
      for (let r = 3; r < rows.length; r += 1) {
        const metric = rowMetric(rows[r], metricIdx);
        if (!metric || ["from", "to", "weekly"].includes(norm(metric))) break;
        if (!clean(rows[r][budgetIdx]) && !clean(rows[r][actualsIdx])) continue;
        mtd.push({
          metric: metric === "NewRiders" ? "New Riders" : metric === "InstalltoSFO" ? "Install→SFO" : metric,
          budget: normalizeDisplay(rows[r][budgetIdx]),
          bdgMtd: normalizeDisplay(rows[r][bdgMtdIdx]),
          actuals: normalizeDisplay(rows[r][actualsIdx]),
          diffVsBdg: normalizeDisplay(rows[r][diffIdx]),
          prorated: normalizeDisplay(rows[r][proratedIdx]),
          diffVsProrated: normalizeDisplay(rows[r][diffProratedIdx])
        });
      }
    }

    const weeklyHeaderIndex = rows.findIndex(row => row.some(cell => norm(cell) === "weekly"));
    const weekly = [];
    if (weeklyHeaderIndex >= 0) {
      const weeklyHeader = rows[weeklyHeaderIndex];
      const weeklyMetricIdx = weeklyHeader.findIndex(cell => norm(cell) === "weekly");
      const weeklyBudgetIdx = findHeader(weeklyHeader, "Budget", weeklyMetricIdx + 1);
      const weeklyActualsIdx = findHeader(weeklyHeader, "Actuals", weeklyBudgetIdx + 1);
      const weeklyDiffIdx = findHeader(weeklyHeader, "DiffvsBdg", weeklyActualsIdx + 1);
      const weeklyPreviousIdx = findHeader(weeklyHeader, "W-1 Actuals", weeklyDiffIdx + 1);
      const weeklyWowIdx = findHeader(weeklyHeader, "Diff vs WoW", weeklyPreviousIdx + 1);
      for (let r = weeklyHeaderIndex + 1; r < rows.length; r += 1) {
        const metric = rowMetric(rows[r], weeklyMetricIdx);
        if (!metric) break;
        if (!clean(rows[r][weeklyBudgetIdx]) && !clean(rows[r][weeklyActualsIdx])) continue;
        weekly.push({
          metric: metric === "NewRiders" ? "New Riders" : metric === "InstalltoSFO" ? "Install→SFO" : metric,
          budget: normalizeDisplay(rows[r][weeklyBudgetIdx]),
          actuals: normalizeDisplay(rows[r][weeklyActualsIdx]),
          diffVsBdg: normalizeDisplay(rows[r][weeklyDiffIdx]),
          previous: normalizeDisplay(rows[r][weeklyPreviousIdx]),
          diffVsPrevious: normalizeDisplay(rows[r][weeklyWowIdx])
        });
      }
    }

    const daily = [];
    const startDate = header[10];
    const dateParts = clean(startDate).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    const baseMonth = dateParts ? Number(dateParts[1]) : null;
    const baseYear = dateParts ? Number(dateParts[3]) : null;
    for (let r = 5; r < rows.length; r += 1) {
      const dateLabel = clean(rows[r][10]);
      if (!dateLabel || norm(dateLabel).includes("variabletotalmes")) break;
      const dayMatch = dateLabel.match(/-(\d{1,2})$/);
      if (!dayMatch) continue;
      const day = Number(dayMatch[1]);
      daily.push({
        date: baseMonth && baseYear ? `${baseYear}-${String(baseMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}` : dateLabel,
        label: dateLabel,
        trips: normalizeDisplay(rows[r][12]),
        gmv: normalizeDisplay(rows[r][14]),
        installs: normalizeDisplay(rows[r][17]),
        newRiders: normalizeDisplay(rows[r][19])
      });
    }

    return {
      source: "Google Sheets · Daily Tracker",
      updatedAt: new Date().toISOString(),
      months: [{
        key: month.key,
        label: month.label,
        dateFrom: normalizeDisplay(dateFromRow && dateFromRow[36]),
        dateTo: normalizeDisplay(dateToRow && dateToRow[36]),
        mtd: mtd.length ? mtd : FALLBACK.months[0].mtd,
        weekly: weekly.length ? weekly : FALLBACK.months[0].weekly,
        daily
      }]
    };
  }

  function valueFor(month, metric) {
    const wanted = norm(metric);
    const row = (month.mtd || []).find(item => norm(item.metric) === wanted);
    return row ? row.actuals : "—";
  }

  function diffClass(value) {
    const raw = clean(value);
    if (!raw || raw === "—") return "";
    if (raw.includes("-")) return "yds-neg";
    if (raw === "0%") return "";
    return "yds-pos";
  }

  function tableRows(rows, columns) {
    return rows.map(row => `<tr>${columns.map(col => `<td class="${col.diff ? diffClass(row[col.key]) : ""}">${row[col.key] || "—"}</td>`).join("")}</tr>`).join("");
  }

  function render(payload) {
    const mount = ensureMount();
    if (!mount) return;
    const months = payload.months || FALLBACK.months;
    const selectedKey = mount.dataset.selectedMonth || months[0].key;
    const month = months.find(item => item.key === selectedKey) || months[0];
    mount.dataset.selectedMonth = month.key;

    mount.innerHTML = `
      <section class="yds-card-shell">
        <div class="yds-hero">
          <div>
            <p class="yds-eyebrow">Resumen Yango</p>
            <h2>Daily Tracker</h2>
            <p>Trips, GMV, installs, AOV, new riders y budget MTD en una sola vista.</p>
          </div>
          <div class="yds-filter">
            <label>Mes</label>
            <select id="yds-month-select">${months.map(item => `<option value="${item.key}" ${item.key === month.key ? "selected" : ""}>${item.label}</option>`).join("")}</select>
          </div>
        </div>
        <div class="yds-meta">
          <span>${payload.source || "Daily Tracker"}</span>
          <span>${month.dateFrom && month.dateFrom !== "—" ? `Rango: ${month.dateFrom} → ${month.dateTo || "—"}` : "Actualizado desde Daily Tracker"}</span>
        </div>
        <div class="yds-kpis">
          ${KPI_MAP.map(item => `<article class="yds-kpi yds-${item.tone}"><span>${item.icon}</span><strong>${valueFor(month, item.metric)}</strong><small>${item.label}</small></article>`).join("")}
        </div>
        <div class="yds-tables">
          <article class="yds-table-card">
            <div class="yds-table-head"><h3>Budget MTD · Actuals</h3><p>Vista tipo reforecast del mes</p></div>
            <div class="yds-scroll"><table><thead><tr><th>Métrica</th><th>Budget</th><th>Budget MTD</th><th>Actuals</th><th>Diff vs Bdg</th><th>Prorated</th><th>Diff vs Prorated</th></tr></thead><tbody>${tableRows(month.mtd || [], [{key:"metric"},{key:"budget"},{key:"bdgMtd"},{key:"actuals"},{key:"diffVsBdg", diff:true},{key:"prorated"},{key:"diffVsProrated", diff:true}])}</tbody></table></div>
          </article>
          <article class="yds-table-card">
            <div class="yds-table-head"><h3>Weekly performance</h3><p>Budget, actuals y cambio vs semana anterior</p></div>
            <div class="yds-scroll"><table><thead><tr><th>Métrica</th><th>Budget</th><th>Actuals</th><th>Diff vs Bdg</th><th>W-1 Actuals</th><th>Diff vs WoW</th></tr></thead><tbody>${tableRows(month.weekly || [], [{key:"metric"},{key:"budget"},{key:"actuals"},{key:"diffVsBdg", diff:true},{key:"previous"},{key:"diffVsPrevious", diff:true}])}</tbody></table></div>
          </article>
        </div>
        ${(month.daily || []).length ? `<article class="yds-table-card yds-daily"><div class="yds-table-head"><h3>Daily pulse</h3><p>Últimos días cargados en Daily Tracker</p></div><div class="yds-scroll"><table><thead><tr><th>Día</th><th>Trips</th><th>GMV</th><th>Installs</th><th>New riders</th></tr></thead><tbody>${(month.daily || []).slice(-10).map(row => `<tr><td>${row.label}</td><td>${row.trips}</td><td>${row.gmv}</td><td>${row.installs}</td><td>${row.newRiders}</td></tr>`).join("")}</tbody></table></div></article>` : ""}
      </section>
    `;

    const select = mount.querySelector("#yds-month-select");
    if (select) select.onchange = event => {
      mount.dataset.selectedMonth = event.target.value;
      render(payload);
    };
  }

  function ensureStyles() {
    if (document.getElementById("yds-styles")) return;
    const style = document.createElement("style");
    style.id = "yds-styles";
    style.textContent = `
      #yango-summary-dashboard{margin-bottom:18px;scroll-margin-top:18px}.yds-card-shell{background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:18px;box-shadow:0 18px 45px rgba(15,23,42,.06)}.yds-hero{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;background:linear-gradient(135deg,#e30613,#141827);color:white;border-radius:18px;padding:24px}.yds-eyebrow{margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;font-weight:900;opacity:.9}.yds-hero h2{margin:0;font-family:'YangoHeadline','YangoText',system-ui,sans-serif;font-size:30px;letter-spacing:-.03em}.yds-hero p{margin:6px 0 0;font-size:13px;opacity:.9}.yds-filter{min-width:210px;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.25);border-radius:14px;padding:10px 12px}.yds-filter label{display:block;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px}.yds-filter select{width:100%;border:0;border-radius:10px;padding:9px 10px;font-weight:900;color:#0f172a;background:white}.yds-meta{display:flex;gap:10px;flex-wrap:wrap;margin:13px 2px 16px;color:#64748b;font-size:12px}.yds-meta span{background:#f8fafc;border:1px solid #e2e8f0;border-radius:999px;padding:6px 10px}.yds-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}.yds-kpi{border:1px solid #e2e8f0;border-radius:16px;padding:16px;background:#fff}.yds-kpi span{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;margin-bottom:12px;font-weight:900}.yds-kpi strong{display:block;font-family:'YangoHeadline','YangoText',system-ui,sans-serif;font-size:28px;line-height:1;letter-spacing:-.04em}.yds-kpi small{display:block;margin-top:6px;color:#64748b;font-size:12px;font-weight:700}.yds-red span{background:#fee2e2;color:#e30613}.yds-dark span{background:#e2e8f0;color:#0f172a}.yds-blue span{background:#e0f2fe;color:#0284c7}.yds-purple span{background:#f3e8ff;color:#7c3aed}.yds-green span{background:#dcfce7;color:#16a34a}.yds-orange span{background:#ffedd5;color:#ea580c}.yds-tables{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:14px;margin-top:16px}.yds-table-card{border:1px solid #e2e8f0;border-radius:16px;background:#fff;overflow:hidden}.yds-table-head{padding:15px 16px 10px}.yds-table-head h3{margin:0;font-size:15px}.yds-table-head p{margin:3px 0 0;color:#94a3b8;font-size:12px}.yds-scroll{overflow:auto}.yds-table-card table{width:100%;border-collapse:collapse;font-size:12.5px}.yds-table-card th{position:sticky;top:0;background:#f8fafc;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:.04em;font-size:10.5px;padding:10px 12px;border-top:1px solid #f1f5f9;border-bottom:1px solid #e2e8f0;white-space:nowrap}.yds-table-card td{padding:10px 12px;border-bottom:1px solid #f8fafc;white-space:nowrap;color:#0f172a;font-weight:700}.yds-table-card td:first-child{color:#475569;font-weight:900}.yds-pos{color:#16a34a!important}.yds-neg{color:#e30613!important}.yds-daily{margin-top:14px}@media(max-width:720px){.yds-hero{flex-direction:column}.yds-filter{width:100%;box-sizing:border-box}.yds-tables{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
  }

  function findContentContainer() {
    const h1 = Array.from(document.querySelectorAll("h1")).find(node => clean(node.textContent));
    if (!h1) return null;
    const header = h1.parentElement && h1.parentElement.parentElement;
    if (header && header.nextElementSibling) return header.nextElementSibling;
    return h1.closest("div") && h1.closest("div").parentElement;
  }

  function ensureMount() {
    ensureStyles();
    let mount = document.getElementById("yango-summary-dashboard");
    if (mount) return mount;
    const content = findContentContainer();
    if (!content) return null;
    mount = document.createElement("div");
    mount.id = "yango-summary-dashboard";
    content.insertBefore(mount, content.firstChild);
    return mount;
  }

  function addNavShortcut() {
    if (document.getElementById("yds-nav-shortcut")) return;
    const vista = Array.from(document.querySelectorAll("button")).find(button => clean(button.textContent).toLowerCase().includes("vista global"));
    if (!vista || !vista.parentElement) return;
    const btn = vista.cloneNode(true);
    btn.id = "yds-nav-shortcut";
    btn.style.background = "#0f172a";
    btn.style.color = "#fff";
    btn.textContent = "Resumen Yango";
    btn.onclick = () => document.getElementById("yango-summary-dashboard")?.scrollIntoView({ behavior: "smooth", block: "start" });
    vista.parentElement.insertBefore(btn, vista);
  }

  async function loadData() {
    try {
      const response = await fetch(`${CSV_URL}&_=${Date.now()}`, { cache: "no-store" });
      const text = await response.text();
      if (!response.ok || /^\s*</.test(text)) throw new Error("Google Sheets no devolvió CSV público");
      const rows = parseCsv(text);
      const payload = buildPayloadFromRows(rows);
      if (!payload.months[0].mtd.length) throw new Error("Daily Tracker vacío");
      return payload;
    } catch (error) {
      return { ...FALLBACK, source: `${FALLBACK.source} · fallback` };
    }
  }

  let payloadCache = null;
  async function boot() {
    addNavShortcut();
    const mount = ensureMount();
    if (!mount) return;
    if (!payloadCache) {
      mount.innerHTML = `<section class="yds-card-shell"><div class="yds-hero"><div><p class="yds-eyebrow">Resumen Yango</p><h2>Daily Tracker</h2><p>Cargando data desde Google Sheets…</p></div></div></section>`;
      payloadCache = await loadData();
    }
    render(payloadCache);
  }

  window.addEventListener("load", boot);
  document.addEventListener("DOMContentLoaded", boot);
  setInterval(() => {
    addNavShortcut();
    if (!document.getElementById("yango-summary-dashboard")) boot();
  }, 1500);
})();
