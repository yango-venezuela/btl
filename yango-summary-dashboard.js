(() => {
  const SHEET_ID = "1HF0h65jgRPZiKYAro_bctnnSOaVARqd-KPjycfOUZDg";
  const DAILY_TRACKER_GID = "306964116";
  const DB_DAILY_GID = "949067172";
  const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const KPI_MAP = [
    { label: "Trips", key: "trips", icon: "↗", tone: "red", type: "number" },
    { label: "GMV", key: "gmv", icon: "$", tone: "dark", type: "money" },
    { label: "Installs", key: "installs", icon: "↓", tone: "blue", type: "number" },
    { label: "AOV", key: "aov", icon: "÷", tone: "purple", type: "money2" },
    { label: "New riders", key: "newRiders", icon: "+", tone: "green", type: "number" },
    { label: "Performance", key: "performance", icon: "●", tone: "orange", type: "money" },
  ];
  const FALLBACK = {
    source: "Snapshot Daily Tracker · fallback",
    months: [{
      key: "2026-07",
      label: "Julio 2026",
      cutoffDay: 19,
      dateFrom: "13/7/2026",
      dateTo: "19/7/2026",
      compareLabel: "Junio 2026 hasta día 19",
      kpis: {
        Trips: { value: "427.892", delta: null },
        GMV: { value: "$1.233.132", delta: null },
        Installs: { value: "40.160", delta: null },
        AOV: { value: "$2,88", delta: null },
        "New riders": { value: "11.390", delta: null },
        Performance: { value: "$32.495", delta: null }
      },
      mtd: [
        { metric: "Trips", budget: "960.109", bdgMtd: "515.646", actuals: "427.892", diffVsBdg: "-17%", prorated: "663.233", diffVsProrated: "-31%" },
        { metric: "GMV", budget: "$2.726.711", bdgMtd: "$1.464.434", actuals: "$1.233.132", diffVsBdg: "-16%", prorated: "$1.911.354", diffVsProrated: "-30%" },
        { metric: "AOV", budget: "$2,84", bdgMtd: "$2,84", actuals: "$2,88", diffVsBdg: "1%", prorated: "$2,88", diffVsProrated: "1%" },
        { metric: "Installs", budget: "81.643", bdgMtd: "55.085", actuals: "40.160", diffVsBdg: "-27%", prorated: "62.248", diffVsProrated: "-24%" },
        { metric: "New Riders", budget: "22.860", bdgMtd: "15.424", actuals: "11.390", diffVsBdg: "-26%", prorated: "17.655", diffVsProrated: "-23%" },
        { metric: "Performance", budget: "$91.463", bdgMtd: "$49.577", actuals: "$32.495", diffVsBdg: "-34%", prorated: "$50.367", diffVsProrated: "-45%" }
      ],
      daily: []
    }]
  };

  let payloadCache = null;
  let summaryActive = true;
  let originalHeader = null;

  function clean(value) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
  function norm(value) { return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ""); }
  function directCsvUrl(gid) { return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`; }

  function parseCsv(text) {
    const rows = [];
    let row = [], field = "", quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i], next = text[i + 1];
      if (quoted) {
        if (char === '"' && next === '"') { field += '"'; i += 1; }
        else if (char === '"') quoted = false;
        else field += char;
      } else if (char === '"') quoted = true;
      else if (char === ',') { row.push(field); field = ""; }
      else if (char === '\n' || char === '\r') {
        if (char === '\r' && next === '\n') i += 1;
        row.push(field); rows.push(row); row = []; field = "";
      } else field += char;
    }
    row.push(field); rows.push(row);
    return rows.filter(r => r.some(cell => clean(cell)));
  }

  function parseNumber(value) {
    let raw = clean(value).replace(/[$%\s]/g, "");
    if (!raw || raw === "—" || raw === "-") return null;
    const negative = /^-/.test(raw);
    raw = raw.replace(/^-/, "");
    const commaCount = (raw.match(/,/g) || []).length;
    const dotCount = (raw.match(/\./g) || []).length;
    const lastComma = raw.lastIndexOf(",");
    const lastDot = raw.lastIndexOf(".");
    let normalized = raw;
    if (commaCount && dotCount) normalized = lastComma > lastDot ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
    else if (commaCount > 1) normalized = raw.replace(/,/g, "");
    else if (dotCount > 1) normalized = raw.replace(/\./g, "");
    else if (commaCount === 1) normalized = /,\d{1,2}$/.test(raw) ? raw.replace(",", ".") : raw.replace(/,/g, "");
    else if (dotCount === 1) normalized = /\.\d{1,2}$/.test(raw) ? raw : raw.replace(/\./g, "");
    const num = Number(`${negative ? "-" : ""}${normalized}`);
    return Number.isFinite(num) ? num : null;
  }

  function formatNumber(value, type = "number") {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";
    if (type === "money2") return `$${Number(value).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (type === "money") return `$${Math.round(Number(value)).toLocaleString("de-DE")}`;
    if (type === "percent") return `${Number(value).toLocaleString("de-DE", { maximumFractionDigits: 1 })}%`;
    return Math.round(Number(value)).toLocaleString("de-DE");
  }

  function formatCell(value) {
    const raw = clean(value);
    if (!raw) return "—";
    const num = parseNumber(raw);
    if (num === null) return raw;
    if (raw.includes("%")) return formatNumber(num, "percent");
    if (raw.includes("$")) return Math.abs(num) < 20 && !Number.isInteger(num) ? formatNumber(num, "money2") : formatNumber(num, "money");
    return formatNumber(num);
  }

  function pctDelta(current, previous) {
    if (current === null || previous === null || !Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
    return ((current - previous) / previous) * 100;
  }
  function formatDelta(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toLocaleString("de-DE", { maximumFractionDigits: 1 })}%`;
  }
  function diffClass(value) {
    const num = typeof value === "number" ? value : parseNumber(value);
    if (num === null || num === 0) return "yds-neutral";
    return num < 0 ? "yds-neg" : "yds-pos";
  }
  function monthLabel(year, month) { return `${MONTH_NAMES[month - 1]} ${year}`; }
  function sameMonthKey(year, month) { return `${year}-${String(month).padStart(2, "0")}`; }
  function prevKey(key) {
    const [year, month] = key.split("-").map(Number);
    const date = new Date(year, month - 2, 1);
    return sameMonthKey(date.getFullYear(), date.getMonth() + 1);
  }
  function parseDayFromDate(value) {
    const match = clean(value).match(/^(\d{1,2})[/.\-]/);
    return match ? Number(match[1]) : null;
  }

  async function fetchCsv(gid) {
    const urls = [`/api/yango-summary-csv?gid=${gid}&_=${Date.now()}`, `${directCsvUrl(gid)}&_=${Date.now()}`];
    let lastError = null;
    for (const url of urls) {
      try {
        const response = await fetch(url, { cache: "no-store" });
        const text = await response.text();
        if (!response.ok || /^\s*</.test(text)) throw new Error(`Invalid CSV ${gid}`);
        const rows = parseCsv(text);
        if (rows.length > 3) return rows;
      } catch (error) { lastError = error; }
    }
    throw lastError || new Error(`No CSV for gid ${gid}`);
  }

  function findHeader(row, label, from = 0) {
    const wanted = norm(label);
    return row.findIndex((cell, index) => index >= from && norm(cell) === wanted);
  }
  function metricName(metric) {
    const key = norm(metric);
    if (key === "newriders") return "New Riders";
    if (key === "installtosfo") return "Install→SFO";
    if (key === "riderincentives") return "Rider incentives";
    if (key === "driverincentives") return "Driver incentives";
    return clean(metric);
  }

  function buildDailyTracker(rows) {
    const header = rows.find(row => row.some(cell => norm(cell) === "budget") && row.some(cell => norm(cell) === "actuals")) || [];
    const headerIndex = rows.indexOf(header);
    const budgetIdx = findHeader(header, "Budget", 0);
    const bdgMtdIdx = findHeader(header, "BdgMtD", budgetIdx + 1);
    const actualsIdx = findHeader(header, "Actuals", bdgMtdIdx + 1);
    const diffIdx = findHeader(header, "DiffvsBdg", actualsIdx + 1);
    const proratedIdx = findHeader(header, "Prorated", diffIdx + 1);
    const diffProratedIdx = findHeader(header, "DiffvsProrated", proratedIdx + 1);
    const metricIdx = Math.max(0, budgetIdx - 1);
    const dateFromRow = rows.find(row => row.some(cell => norm(cell) === "from"));
    const dateToRow = rows.find(row => row.some(cell => norm(cell) === "to"));
    const dateFromIdx = dateFromRow ? dateFromRow.findIndex(cell => norm(cell) === "from") : -1;
    const dateToIdx = dateToRow ? dateToRow.findIndex(cell => norm(cell) === "to") : -1;
    const dateTo = dateToIdx >= 0 ? clean(dateToRow[dateToIdx + 1]) : "";
    const mtd = [];
    for (let r = headerIndex + 1; r < rows.length && budgetIdx > 0; r += 1) {
      const metric = clean(rows[r][metricIdx]);
      if (!metric || ["from", "to", "weekly"].includes(norm(metric))) break;
      if (!clean(rows[r][budgetIdx]) && !clean(rows[r][actualsIdx])) continue;
      mtd.push({
        metric: metricName(metric),
        budget: formatCell(rows[r][budgetIdx]),
        bdgMtd: formatCell(rows[r][bdgMtdIdx]),
        actuals: formatCell(rows[r][actualsIdx]),
        diffVsBdg: formatCell(rows[r][diffIdx]),
        prorated: formatCell(rows[r][proratedIdx]),
        diffVsProrated: formatCell(rows[r][diffProratedIdx]),
      });
    }
    return { dateFrom: dateFromIdx >= 0 ? clean(dateFromRow[dateFromIdx + 1]) : "", dateTo, cutoffDay: parseDayFromDate(dateTo) || 19, mtd };
  }

  function buildDbMonths(rows) {
    const headerIndex = rows.findIndex(row => norm(row[1]) === "day" && norm(row[2]) === "month" && norm(row[3]) === "year");
    const start = headerIndex >= 0 ? headerIndex + 1 : 2;
    const groups = new Map();
    rows.slice(start).forEach(row => {
      const day = parseNumber(row[1]), month = parseNumber(row[2]), year = parseNumber(row[3]);
      if (!day || !month || !year) return;
      const key = sameMonthKey(year, month);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({
        day,
        label: `${day}/${month}/${year}`,
        trips: parseNumber(row[8]) || 0,
        gmv: parseNumber(row[9]) || 0,
        activeRiders: parseNumber(row[10]) || 0,
        driverIncentives: parseNumber(row[11]) || 0,
        riderIncentives: parseNumber(row[12]) || 0,
        newRiders: parseNumber(row[14]) || 0,
        installs: parseNumber(row[15]) || 0,
        sfo: parseNumber(row[16]) || 0,
        performance: parseNumber(row[26]) || 0,
      });
    });
    const monthly = {};
    Array.from(groups.entries()).forEach(([key, days]) => {
      days.sort((a, b) => a.day - b.day);
      const [year, month] = key.split("-").map(Number);
      monthly[key] = { key, label: monthLabel(year, month), days, maxDay: Math.max(...days.map(d => d.day)) };
    });
    return monthly;
  }

  function aggregate(month, cutoffDay) {
    if (!month) return null;
    const days = month.days.filter(day => day.day <= cutoffDay);
    const totals = days.reduce((acc, day) => {
      ["trips", "gmv", "installs", "newRiders", "performance", "sfo", "riderIncentives", "driverIncentives", "activeRiders"].forEach(key => { acc[key] += day[key] || 0; });
      return acc;
    }, { trips: 0, gmv: 0, installs: 0, newRiders: 0, performance: 0, sfo: 0, riderIncentives: 0, driverIncentives: 0, activeRiders: 0 });
    totals.aov = totals.trips ? totals.gmv / totals.trips : 0;
    totals.cpi = totals.installs ? totals.performance / totals.installs : 0;
    totals.days = days;
    return totals;
  }

  function generatedRows(current, previous) {
    const rows = [
      ["Trips", current.trips, previous?.trips, "number"],
      ["GMV", current.gmv, previous?.gmv, "money"],
      ["AOV", current.aov, previous?.aov, "money2"],
      ["Installs", current.installs, previous?.installs, "number"],
      ["New Riders", current.newRiders, previous?.newRiders, "number"],
      ["SFO", current.sfo, previous?.sfo, "number"],
      ["Performance", current.performance, previous?.performance, "money"],
      ["CPI", current.cpi, previous?.cpi, "money2"],
      ["Rider incentives", current.riderIncentives, previous?.riderIncentives, "money"],
      ["Driver incentives", current.driverIncentives, previous?.driverIncentives, "money"],
    ];
    return rows.map(([metric, value, prev, type]) => ({ metric, actuals: formatNumber(value, type), mom: formatDelta(pctDelta(value, prev)) }));
  }

  function mergePayload(dailyTrackerRows, dbRows) {
    const tracker = buildDailyTracker(dailyTrackerRows);
    const dbMonths = buildDbMonths(dbRows);
    const keys = Object.keys(dbMonths).sort().reverse();
    if (!keys.length) return FALLBACK;
    const latestKey = keys[0];
    const months = keys.map(key => {
      const month = dbMonths[key];
      const isLatest = key === latestKey;
      const cutoff = isLatest ? Math.min(tracker.cutoffDay || month.maxDay, month.maxDay) : month.maxDay;
      const current = aggregate(month, cutoff);
      const previousMonth = dbMonths[prevKey(key)];
      const previous = aggregate(previousMonth, Math.min(cutoff, previousMonth?.maxDay || cutoff));
      const kpis = {};
      KPI_MAP.forEach(kpi => { kpis[kpi.label] = { value: formatNumber(current[kpi.key], kpi.type), delta: pctDelta(current[kpi.key], previous && previous[kpi.key]) }; });
      const calculated = generatedRows(current, previous);
      const mtd = isLatest && tracker.mtd.length ? tracker.mtd.map(row => ({ ...row, mom: (calculated.find(item => norm(item.metric) === norm(row.metric)) || {}).mom || "—" })) : calculated;
      return {
        key,
        label: month.label,
        cutoffDay: cutoff,
        dateFrom: isLatest ? tracker.dateFrom : `1/${Number(key.slice(5, 7))}/${key.slice(0, 4)}`,
        dateTo: isLatest ? tracker.dateTo : `${cutoff}/${Number(key.slice(5, 7))}/${key.slice(0, 4)}`,
        compareLabel: previousMonth ? `${previousMonth.label} hasta día ${Math.min(cutoff, previousMonth.maxDay)}` : "Sin mes anterior",
        kpis,
        mtd,
        hasBudget: isLatest && tracker.mtd.length > 0,
        daily: current.days.slice(-10).map(day => ({ label: day.label, trips: formatNumber(day.trips), gmv: formatNumber(day.gmv, "money"), installs: formatNumber(day.installs), newRiders: formatNumber(day.newRiders) })),
      };
    });
    return { source: "Google Sheets · Daily Tracker + DB Daily", months };
  }

  function ensureStyles() {
    if (document.getElementById("yds-styles")) return;
    const style = document.createElement("style");
    style.id = "yds-styles";
    style.textContent = `#yango-summary-dashboard{margin-bottom:18px;scroll-margin-top:18px}.yds-hidden-by-summary{display:none!important}.yds-card-shell{background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:18px;box-shadow:0 18px 45px rgba(15,23,42,.06)}.yds-hero{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;background:linear-gradient(135deg,#e30613,#141827);color:white;border-radius:18px;padding:24px}.yds-eyebrow{margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;font-weight:900;opacity:.9}.yds-hero h2{margin:0;font-family:'YangoHeadline','YangoText',system-ui,sans-serif;font-size:30px;letter-spacing:-.03em}.yds-hero p{margin:6px 0 0;font-size:13px;opacity:.9}.yds-filter{min-width:230px;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.25);border-radius:14px;padding:10px 12px}.yds-filter label{display:block;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px}.yds-filter select{width:100%;border:0;border-radius:10px;padding:9px 10px;font-weight:900;color:#0f172a;background:white}.yds-meta{display:flex;gap:10px;flex-wrap:wrap;margin:13px 2px 16px;color:#64748b;font-size:12px}.yds-meta span{background:#f8fafc;border:1px solid #e2e8f0;border-radius:999px;padding:6px 10px}.yds-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.yds-kpi{border:1px solid #e2e8f0;border-radius:16px;padding:16px;background:#fff}.yds-kpi span{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;margin-bottom:12px;font-weight:900}.yds-kpi strong{display:block;font-family:'YangoHeadline','YangoText',system-ui,sans-serif;font-size:28px;line-height:1;letter-spacing:-.04em}.yds-kpi small{display:block;margin-top:6px;color:#64748b;font-size:12px;font-weight:800}.yds-kpi em{display:inline-flex;margin-top:10px;padding:5px 8px;border-radius:999px;font-size:11px;font-style:normal;font-weight:900;background:#f8fafc}.yds-red span{background:#fee2e2;color:#e30613}.yds-dark span{background:#e2e8f0;color:#0f172a}.yds-blue span{background:#e0f2fe;color:#0284c7}.yds-purple span{background:#f3e8ff;color:#7c3aed}.yds-green span{background:#dcfce7;color:#16a34a}.yds-orange span{background:#ffedd5;color:#ea580c}.yds-table-card{margin-top:16px;border:1px solid #e2e8f0;border-radius:18px;background:#fff;overflow:hidden;box-shadow:0 12px 28px rgba(15,23,42,.04)}.yds-table-head{padding:16px 18px 10px}.yds-table-head h3{margin:0;font-size:16px}.yds-table-head p{margin:4px 0 0;color:#94a3b8;font-size:12px}.yds-exec-scroll,.yds-scroll{overflow:auto}.yds-exec-table,.yds-table-card table{width:100%;border-collapse:separate;border-spacing:0;font-size:12.5px}.yds-exec-table th,.yds-table-card th{background:#f8fafc;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:.06em;font-size:10.5px;padding:11px 12px;border-top:1px solid #f1f5f9;border-bottom:1px solid #e2e8f0;white-space:nowrap}.yds-exec-table td,.yds-table-card td{padding:12px;border-bottom:1px solid #f1f5f9;color:#0f172a;font-weight:800;white-space:nowrap;vertical-align:middle}.yds-exec-table tbody tr:hover td{background:#fff7f7}.yds-sticky-metric{position:sticky;left:0;background:#fff;z-index:2;min-width:150px}.yds-exec-table tbody tr:hover .yds-sticky-metric{background:#fff7f7}.yds-pill{display:inline-flex;align-items:center;justify-content:center;min-width:62px;border-radius:999px;padding:5px 8px;font-size:11px;font-weight:900}.yds-budget-progress{display:flex;align-items:center;gap:8px;min-width:150px}.yds-budget-progress i{display:block;height:7px;min-width:54px;flex:1;background:#e2e8f0;border-radius:999px;overflow:hidden}.yds-budget-progress b{display:block;height:100%;background:linear-gradient(90deg,#e30613,#141827);border-radius:999px}.yds-budget-progress span{font-size:11px;color:#64748b;font-weight:900}.yds-pos{color:#16a34a!important;background:#dcfce7!important}.yds-neg{color:#e30613!important;background:#fee2e2!important}.yds-neutral{color:#64748b!important;background:#f1f5f9!important}.yds-daily{margin-top:14px}#yds-nav-shortcut{display:flex;align-items:center;gap:11px;width:100%;border:0;border-radius:10px;background:#0f172a;color:#fff;font-weight:800;font-size:13.5px;padding:10px 12px;cursor:pointer;text-align:left}#yds-nav-shortcut .yds-nav-icon{display:grid;place-items:center;width:22px;height:22px;border-radius:7px;background:#fee2e2;color:#e30613;flex:0 0 22px}#yds-nav-shortcut.yds-compact{justify-content:center;padding:10px 6px;gap:0}#yds-nav-shortcut.yds-compact .yds-nav-label{display:none}@media(max-width:900px){.yds-exec-table{min-width:860px}.yds-hero{flex-direction:column}.yds-filter{width:100%;box-sizing:border-box}}`;
    document.head.appendChild(style);
  }

  function progress(actual, target) {
    const a = parseNumber(actual), t = parseNumber(target);
    if (!a || !t) return 0;
    return Math.max(0, Math.min(120, (a / t) * 100));
  }
  function progressCell(actual, target) {
    const pct = progress(actual, target);
    return `<div class="yds-budget-progress"><i><b style="width:${pct}%"></b></i><span>${pct ? `${Math.round(pct)}%` : "—"}</span></div>`;
  }
  function renderBudgetTable(rows, hasBudget) {
    const allowed = ["trips", "gmv", "aov", "installs", "newriders", "sfo", "performance", "cpi", "riderincentives", "driverincentives"];
    const filtered = (rows || []).filter(row => allowed.includes(norm(row.metric)));
    if (!hasBudget) {
      return `<div class="yds-exec-scroll"><table class="yds-exec-table"><thead><tr><th class="yds-sticky-metric">Métrica</th><th>Actuals</th><th>vs mes anterior</th></tr></thead><tbody>${filtered.map(row => `<tr><td class="yds-sticky-metric"><strong>${row.metric}</strong></td><td>${row.actuals || "—"}</td><td><span class="yds-pill ${diffClass(row.mom)}">${row.mom || "—"}</span></td></tr>`).join("")}</tbody></table></div>`;
    }
    return `<div class="yds-exec-scroll"><table class="yds-exec-table"><thead><tr><th class="yds-sticky-metric">Métrica</th><th>Budget mes</th><th>Budget MTD</th><th>Actuals</th><th>Avance MTD</th><th>Diff vs Budget</th><th>Reforecast</th><th>Diff vs Reforecast</th><th>vs mes anterior</th></tr></thead><tbody>${filtered.map(row => `<tr><td class="yds-sticky-metric"><strong>${row.metric}</strong></td><td>${row.budget || "—"}</td><td>${row.bdgMtd || "—"}</td><td>${row.actuals || "—"}</td><td>${progressCell(row.actuals, row.bdgMtd)}</td><td><span class="yds-pill ${diffClass(row.diffVsBdg)}">${row.diffVsBdg || "—"}</span></td><td>${row.prorated || "—"}</td><td><span class="yds-pill ${diffClass(row.diffVsProrated)}">${row.diffVsProrated || "—"}</span></td><td><span class="yds-pill ${diffClass(row.mom)}">${row.mom || "—"}</span></td></tr>`).join("")}</tbody></table></div>`;
  }

  function render(payload) {
    const mount = ensureMount();
    if (!mount) return;
    const months = payload.months?.length ? payload.months : FALLBACK.months;
    const selectedKey = mount.dataset.selectedMonth && months.some(item => item.key === mount.dataset.selectedMonth) ? mount.dataset.selectedMonth : months[0].key;
    const month = months.find(item => item.key === selectedKey) || months[0];
    mount.dataset.selectedMonth = month.key;
    mount.innerHTML = `<section class="yds-card-shell"><div class="yds-hero"><div><p class="yds-eyebrow">Resumen Yango</p><h2>Daily Tracker</h2><p>Trips, GMV, installs, AOV, new riders y budget MTD en una sola vista.</p></div><div class="yds-filter"><label>Mes</label><select id="yds-month-select">${months.map(item => `<option value="${item.key}" ${item.key === month.key ? "selected" : ""}>${item.label}</option>`).join("")}</select></div></div><div class="yds-meta"><span>${payload.source || "Daily Tracker"}</span><span>Corte: día ${month.cutoffDay || "—"}</span><span>Comparación: ${month.compareLabel || "mes anterior"}</span></div><div class="yds-kpis">${KPI_MAP.map(item => { const kpi = month.kpis?.[item.label]; const delta = kpi?.delta ?? null; return `<article class="yds-kpi yds-${item.tone}"><span>${item.icon}</span><strong>${kpi?.value || "—"}</strong><small>${item.label}</small><em class="${delta === null ? "yds-neutral" : delta < 0 ? "yds-neg" : "yds-pos"}">${delta === null ? "Sin comparativo" : `${formatDelta(delta)} vs mes anterior`}</em></article>`; }).join("")}</div><article class="yds-table-card"><div class="yds-table-head"><h3>${month.hasBudget ? "Budget MTD · Actuals" : "Resultados del mes"}</h3><p>${month.hasBudget ? "Budget, actuals, avance y reforecast en el mismo formato ejecutivo." : "Mes histórico con actuals y variación contra el mes anterior."}</p></div>${renderBudgetTable(month.mtd || [], month.hasBudget)}</article>${(month.daily || []).length ? `<article class="yds-table-card yds-daily"><div class="yds-table-head"><h3>Daily pulse</h3><p>Últimos días del mes seleccionado</p></div><div class="yds-scroll"><table><thead><tr><th>Día</th><th>Trips</th><th>GMV</th><th>Installs</th><th>New riders</th></tr></thead><tbody>${month.daily.map(row => `<tr><td>${row.label}</td><td>${row.trips}</td><td>${row.gmv}</td><td>${row.installs}</td><td>${row.newRiders}</td></tr>`).join("")}</tbody></table></div></article>` : ""}</section>`;
    const select = mount.querySelector("#yds-month-select");
    if (select) select.onchange = event => { mount.dataset.selectedMonth = event.target.value; render(payload); activateSummary(); };
  }

  function findHeaderNodes() {
    const h1 = Array.from(document.querySelectorAll("h1")).find(node => clean(node.textContent));
    const header = h1?.parentElement?.parentElement || null;
    const sub = h1?.parentElement?.querySelector("p") || null;
    return { h1, sub, header };
  }
  function findContentContainer() {
    const { header } = findHeaderNodes();
    return header?.nextElementSibling || null;
  }
  function ensureMount() {
    ensureStyles();
    let mount = document.getElementById("yango-summary-dashboard");
    const content = findContentContainer();
    if (!content) return mount;
    if (!mount) { mount = document.createElement("div"); mount.id = "yango-summary-dashboard"; content.insertBefore(mount, content.firstChild); }
    return mount;
  }
  function activateSummary() {
    summaryActive = true;
    const mount = ensureMount();
    const content = findContentContainer();
    if (!mount || !content) return;
    Array.from(content.children).forEach(child => child.classList.toggle("yds-hidden-by-summary", child !== mount));
    const { h1, sub } = findHeaderNodes();
    if (h1 && !originalHeader) originalHeader = { title: h1.textContent, sub: sub?.textContent || "" };
    if (h1) h1.textContent = "Resumen Yango";
    if (sub) sub.textContent = "Daily Tracker, budget MTD y comparación vs mes anterior.";
    document.getElementById("yds-nav-shortcut")?.classList.add("yds-active");
  }
  function deactivateSummary() {
    if (!summaryActive) return;
    summaryActive = false;
    const content = findContentContainer();
    if (content) Array.from(content.children).forEach(child => child.classList.remove("yds-hidden-by-summary"));
    const { h1, sub } = findHeaderNodes();
    if (originalHeader && h1) h1.textContent = originalHeader.title;
    if (originalHeader && sub) sub.textContent = originalHeader.sub;
    document.getElementById("yds-nav-shortcut")?.classList.remove("yds-active");
  }
  function syncNavCompact() {
    const btn = document.getElementById("yds-nav-shortcut");
    if (!btn) return;
    btn.classList.toggle("yds-compact", btn.getBoundingClientRect().width < 92);
  }
  function addNavShortcut() {
    if (document.getElementById("yds-nav-shortcut")) { syncNavCompact(); return; }
    const vista = Array.from(document.querySelectorAll("button")).find(button => clean(button.textContent).toLowerCase().includes("vista global"));
    if (!vista || !vista.parentElement) return;
    const btn = document.createElement("button");
    btn.id = "yds-nav-shortcut";
    btn.innerHTML = `<span class="yds-nav-icon">▦</span><span class="yds-nav-label">Resumen Yango</span>`;
    btn.onclick = event => { event.stopPropagation(); render(payloadCache || FALLBACK); activateSummary(); document.getElementById("yango-summary-dashboard")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
    vista.parentElement.insertBefore(btn, vista);
    syncNavCompact();
  }
  async function loadData() {
    try {
      const [dailyRows, dbRows] = await Promise.all([fetchCsv(DAILY_TRACKER_GID), fetchCsv(DB_DAILY_GID)]);
      return mergePayload(dailyRows, dbRows);
    } catch (error) {
      console.warn("Resumen Yango: usando fallback", error.message);
      return FALLBACK;
    }
  }
  async function boot() {
    addNavShortcut();
    const mount = ensureMount();
    if (!mount) return;
    if (!payloadCache) {
      mount.innerHTML = `<section class="yds-card-shell"><div class="yds-hero"><div><p class="yds-eyebrow">Resumen Yango</p><h2>Daily Tracker</h2><p>Cargando data desde Google Sheets…</p></div></div></section>`;
      payloadCache = await loadData();
    }
    render(payloadCache);
    if (summaryActive) activateSummary();
  }
  document.addEventListener("click", event => {
    const button = event.target.closest && event.target.closest("button");
    if (!button || button.id === "yds-nav-shortcut") return;
    const navLike = button.textContent && ["Vista global", "Resultados", "Mapa", "Calendario", "Activaciones", "Admin agencia", "Material POP", "Mystery Shopper", "Inventario Branding", "Rifa Samsung", "Influencers", "Reporte Social Media", "Media", "Usuarios"].some(label => clean(button.textContent).includes(label));
    if (navLike) setTimeout(deactivateSummary, 0);
  }, true);
  window.addEventListener("resize", syncNavCompact);
  window.addEventListener("load", boot);
  document.addEventListener("DOMContentLoaded", boot);
  setInterval(() => { addNavShortcut(); if (!document.getElementById("yango-summary-dashboard")) boot(); if (summaryActive) activateSummary(); syncNavCompact(); }, 1500);
})();
