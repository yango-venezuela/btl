(() => {
  let summarySelected = false;
  let previousHeader = null;

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function ensureStyle() {
    if (document.getElementById("yds-standalone-style")) return;
    const style = document.createElement("style");
    style.id = "yds-standalone-style";
    style.textContent = `
      #yds-nav-group{display:flex;flex-direction:column;gap:7px;margin:10px 0 14px;padding:10px 0 12px;border-bottom:1px solid #f1f5f9}
      #yds-nav-group-label{font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;padding:0 10px}
      #yds-nav-group #yds-nav-shortcut{display:flex!important;align-items:center!important;gap:11px!important;width:100%!important;min-height:44px!important;box-sizing:border-box!important;padding:10px 12px!important;border-radius:12px!important;border:1px solid #e2e8f0!important;background:#fff!important;color:#0f172a!important;font-weight:900!important;font-size:13.5px!important;cursor:pointer!important;text-align:left!important;box-shadow:0 8px 20px rgba(15,23,42,.04)!important;overflow:hidden!important}
      #yds-nav-group #yds-nav-shortcut:hover{border-color:#fecaca!important;background:#fff7f7!important}
      #yds-nav-shortcut .yds-nav-icon{display:grid;place-items:center;width:26px;height:26px;border-radius:9px;background:#fee2e2;color:#e30613;flex:0 0 26px;font-size:14px;font-weight:900;line-height:1}
      #yds-nav-shortcut .yds-nav-label{display:inline!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #yds-nav-shortcut.yds-standalone-active{background:#fef2f2!important;color:#e30613!important;border-color:#fecaca!important}
      #yds-nav-shortcut.yds-compact{width:42px!important;height:42px!important;min-height:42px!important;padding:0!important;margin:0 auto!important;justify-content:center!important;border-radius:12px!important;background:#fff!important;gap:0!important}
      #yds-nav-shortcut.yds-compact .yds-nav-label{display:none!important}
      #yds-nav-shortcut.yds-compact .yds-nav-icon{margin:0!important}
      #yds-nav-group.yds-group-compact{align-items:center;padding:8px 0 10px}
      #yds-nav-group.yds-group-compact #yds-nav-group-label{display:none}
      #yango-summary-dashboard.yds-standalone-off{display:none!important}
      .yds-hidden-by-summary{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function headerNodes() {
    const h1 = Array.from(document.querySelectorAll("h1")).find((node) => clean(node.textContent));
    const header = h1 && h1.parentElement && h1.parentElement.parentElement;
    const sub = h1 && h1.parentElement && h1.parentElement.querySelector("p");
    return { h1, sub, header };
  }

  function contentContainer() {
    const { header } = headerNodes();
    return header && header.nextElementSibling;
  }

  function mount() {
    return document.getElementById("yango-summary-dashboard");
  }

  function findSidebar(btn) {
    let node = btn.parentElement;
    while (node && node !== document.body) {
      const text = clean(node.textContent);
      if (text.includes("Vista global") && text.includes("BTL")) return node;
      node = node.parentElement;
    }
    return btn.closest("aside") || btn.parentElement;
  }

  function findLogoBlock(sidebar) {
    return Array.from(sidebar.children).find((child) => {
      const text = clean(child.textContent).toLowerCase();
      return text.includes("yango mkt") || (text.includes("yango") && text.includes("venezuela"));
    });
  }

  function findBtlBlock(sidebar) {
    return Array.from(sidebar.children).find((child) => clean(child.textContent).toLowerCase() === "btl");
  }

  function placeNavGroup() {
    ensureStyle();
    const btn = document.getElementById("yds-nav-shortcut");
    if (!btn) return;

    const sidebar = findSidebar(btn);
    if (!sidebar) return;

    let group = document.getElementById("yds-nav-group");
    if (!group) {
      group = document.createElement("div");
      group.id = "yds-nav-group";
      group.innerHTML = '<div id="yds-nav-group-label">General</div>';
    }

    btn.innerHTML = '<span class="yds-nav-icon">▦</span><span class="yds-nav-label">Resumen Yango</span>';

    const logo = findLogoBlock(sidebar);
    const btl = findBtlBlock(sidebar);
    const desiredBefore = logo ? logo.nextElementSibling : btl || sidebar.firstElementChild;

    if (group.parentElement !== sidebar) {
      sidebar.insertBefore(group, desiredBefore || btl || sidebar.firstElementChild);
    } else if (logo && group.previousElementSibling !== logo) {
      sidebar.insertBefore(group, logo.nextElementSibling);
    } else if (!logo && btl && group.nextElementSibling !== btl) {
      sidebar.insertBefore(group, btl);
    }

    if (btn.parentElement !== group) group.appendChild(btn);

    const compact = btn.getBoundingClientRect().width < 92 || sidebar.getBoundingClientRect().width < 120;
    btn.classList.toggle("yds-compact", compact);
    group.classList.toggle("yds-group-compact", compact);
    btn.classList.toggle("yds-standalone-active", summarySelected);
  }

  function hideSummary() {
    const el = mount();
    const content = contentContainer();
    if (el) el.classList.add("yds-standalone-off");
    if (content) {
      Array.from(content.children).forEach((child) => child.classList.remove("yds-hidden-by-summary"));
    }
    const { h1, sub } = headerNodes();
    if (h1 && clean(h1.textContent) === "Resumen Yango" && previousHeader) h1.textContent = previousHeader.title;
    if (sub && previousHeader && clean(sub.textContent).includes("Daily Tracker")) sub.textContent = previousHeader.sub;
    document.getElementById("yds-nav-shortcut")?.classList.remove("yds-standalone-active");
  }

  function showSummary() {
    summarySelected = true;
    const el = mount();
    const content = contentContainer();
    const { h1, sub } = headerNodes();
    if (h1 && clean(h1.textContent) !== "Resumen Yango") {
      previousHeader = { title: h1.textContent, sub: sub ? sub.textContent : "" };
    }
    if (el) el.classList.remove("yds-standalone-off");
    if (content && el) {
      Array.from(content.children).forEach((child) => {
        child.classList.toggle("yds-hidden-by-summary", child !== el);
      });
    }
    if (h1) h1.textContent = "Resumen Yango";
    if (sub) sub.textContent = "Daily Tracker, budget MTD y comparación vs mes anterior.";
    document.getElementById("yds-nav-shortcut")?.classList.add("yds-standalone-active");
  }

  function bindClicks() {
    const btn = document.getElementById("yds-nav-shortcut");
    if (btn && btn.dataset.ydsStandaloneBound !== "true") {
      btn.dataset.ydsStandaloneBound = "true";
      btn.addEventListener("click", () => {
        summarySelected = true;
        setTimeout(showSummary, 30);
      });
    }
  }

  document.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest && event.target.closest("button");
      if (!button || button.id === "yds-nav-shortcut") return;
      const text = clean(button.textContent);
      const isPanelNav = [
        "Vista global",
        "Resultados",
        "Mapa",
        "Calendario",
        "Activaciones",
        "Admin agencia",
        "Material POP",
        "Mystery Shopper",
        "Inventario Branding",
        "Rifa Samsung",
        "Influencers",
        "Reporte Social Media",
        "Media",
        "Usuarios",
      ].some((label) => text.includes(label));
      if (isPanelNav) {
        summarySelected = false;
        setTimeout(hideSummary, 40);
      }
    },
    true,
  );

  function tick() {
    placeNavGroup();
    bindClicks();
    if (summarySelected) showSummary();
    else hideSummary();
  }

  window.addEventListener("resize", tick);
  window.addEventListener("load", tick);
  document.addEventListener("DOMContentLoaded", tick);
  setInterval(tick, 300);
})();

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

  let payloadCache = null;
  let renderLock = false;

  function clean(value) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
  function norm(value) { return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ""); }
  function csvUrl(gid) { return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`; }
  function exportUrl(gid) { return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`; }

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
    if (commaCount && dotCount) {
      normalized = lastComma > lastDot ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
    } else if (commaCount > 1) normalized = raw.replace(/,/g, "");
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
    const raw = clean(value);
    const match = raw.match(/^(\d{1,2})[/.\-]/);
    return match ? Number(match[1]) : null;
  }

  async function fetchCsv(gid) {
    const urls = [`${csvUrl(gid)}&_=${Date.now()}`, `${exportUrl(gid)}&_=${Date.now()}`];
    let lastError = null;
    for (const url of urls) {
      try {
        const response = await fetch(url, { cache: "no-store" });
        const text = await response.text();
        if (!response.ok || /^\s*</.test(text)) throw new Error(`Invalid CSV ${gid}`);
        const rows = parseCsv(text);
        if (rows.length > 3) return rows;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error(`No CSV for ${gid}`);
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
    const budgetIdx = findHeader(header, "Budget", 0);
    const bdgMtdIdx = findHeader(header, "BdgMtD", budgetIdx + 1);
    const actualsIdx = findHeader(header, "Actuals", bdgMtdIdx + 1);
    const diffIdx = findHeader(header, "DiffvsBdg", actualsIdx + 1);
    const proratedIdx = findHeader(header, "Prorated", diffIdx + 1);
    const diffProratedIdx = findHeader(header, "DiffvsProrated", proratedIdx + 1);
    const metricIdx = Math.max(0, budgetIdx - 1);
    const headerIndex = rows.indexOf(header);
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
    return {
      dateFrom: dateFromIdx >= 0 ? clean(dateFromRow[dateFromIdx + 1]) : "",
      dateTo,
      cutoffDay: parseDayFromDate(dateTo) || 19,
      mtd,
    };
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
      monthly[key] = { key, label: monthLabel(year, month), days, maxDay: Math.max(...days.map(day => day.day)) };
    });
    return monthly;
  }

  function aggregate(month, cutoffDay) {
    if (!month) return null;
    const days = month.days.filter(day => day.day <= cutoffDay);
    const totals = days.reduce((acc, day) => {
      Object.keys(acc).forEach(key => { acc[key] += day[key] || 0; });
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
    return rows.map(([metric, value, prev, type]) => ({
      metric,
      budget: "—",
      bdgMtd: "—",
      actuals: formatNumber(value, type),
      diffVsBdg: "—",
      prorated: "—",
      diffVsProrated: "—",
      mom: formatDelta(pctDelta(value, prev)),
    }));
  }

  function mergePayload(dailyRows, dbRows) {
    const tracker = buildDailyTracker(dailyRows);
    const dbMonths = buildDbMonths(dbRows);
    const keys = Object.keys(dbMonths).sort().reverse();
    const latestKey = keys[0];
    const months = keys.map(key => {
      const month = dbMonths[key];
      const isLatest = key === latestKey;
      const cutoff = isLatest ? Math.min(tracker.cutoffDay || month.maxDay, month.maxDay) : month.maxDay;
      const current = aggregate(month, cutoff);
      const previousMonth = dbMonths[prevKey(key)];
      const previous = aggregate(previousMonth, Math.min(cutoff, previousMonth?.maxDay || cutoff));
      const kpis = {};
      KPI_MAP.forEach(kpi => {
        kpis[kpi.label] = { value: formatNumber(current[kpi.key], kpi.type), delta: pctDelta(current[kpi.key], previous && previous[kpi.key]) };
      });
      const calculated = generatedRows(current, previous);
      const mtd = isLatest && tracker.mtd.length ? tracker.mtd.map(row => ({
        ...row,
        mom: (calculated.find(item => norm(item.metric) === norm(row.metric)) || {}).mom || "—",
      })) : calculated;
      return {
        key,
        label: month.label,
        cutoffDay: cutoff,
        dateFrom: isLatest ? tracker.dateFrom : `1/${Number(key.slice(5, 7))}/${key.slice(0, 4)}`,
        dateTo: isLatest ? tracker.dateTo : `${cutoff}/${Number(key.slice(5, 7))}/${key.slice(0, 4)}`,
        compareLabel: previousMonth ? `${previousMonth.label} hasta día ${Math.min(cutoff, previousMonth.maxDay)}` : "Sin mes anterior",
        kpis,
        mtd,
        daily: current.days.slice(-10).map(day => ({ label: day.label, trips: formatNumber(day.trips), gmv: formatNumber(day.gmv, "money"), installs: formatNumber(day.installs), newRiders: formatNumber(day.newRiders) })),
      };
    });
    return { source: "Google Sheets · Daily Tracker + DB Daily", months };
  }

  function ensureStyles() {
    if (document.getElementById("yds-history-polish-style")) return;
    const style = document.createElement("style");
    style.id = "yds-history-polish-style";
    style.textContent = `
      #yango-summary-dashboard[data-yds-history-fix="true"] .yds-tables{display:block;margin-top:16px}
      #yango-summary-dashboard[data-yds-history-fix="true"] .yds-table-card{margin-top:14px;border:1px solid #e2e8f0;border-radius:18px;background:#fff;overflow:hidden;box-shadow:0 12px 28px rgba(15,23,42,.04)}
      .yds-exec-table{width:100%;border-collapse:separate;border-spacing:0;font-size:12.5px}
      .yds-exec-table th{background:#f8fafc;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:.06em;font-size:10.5px;padding:11px 12px;border-top:1px solid #f1f5f9;border-bottom:1px solid #e2e8f0;white-space:nowrap}
      .yds-exec-table td{padding:12px;border-bottom:1px solid #f1f5f9;color:#0f172a;font-weight:800;white-space:nowrap;vertical-align:middle}
      .yds-exec-table tbody tr:hover td{background:#fff7f7}
      .yds-exec-table .yds-sticky-metric{position:sticky;left:0;background:#fff;z-index:2;min-width:150px}
      .yds-exec-table tbody tr:hover .yds-sticky-metric{background:#fff7f7}
      .yds-table-note{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;color:#64748b;font-size:12px}
      .yds-pill{display:inline-flex;align-items:center;justify-content:center;min-width:62px;border-radius:999px;padding:5px 8px;font-size:11px;font-weight:900}
      .yds-budget-progress{display:flex;align-items:center;gap:8px;min-width:150px}.yds-budget-progress i{display:block;height:7px;min-width:54px;flex:1;background:#e2e8f0;border-radius:999px;overflow:hidden}.yds-budget-progress b{display:block;height:100%;background:linear-gradient(90deg,#e30613,#141827);border-radius:999px}.yds-budget-progress span{font-size:11px;color:#64748b;font-weight:900}
      @media(max-width:900px){.yds-exec-scroll{overflow:auto}.yds-exec-table{min-width:860px}}
    `;
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
  function tableRows(rows, mode) {
    return rows.filter(row => ["trips", "gmv", "aov", "installs", "newriders", "sfo", "performance", "cpi", "riderincentives", "driverincentives"].includes(norm(row.metric))).map(row => {
      if (mode === "mtd") {
        return `<tr><td class="yds-sticky-metric"><strong>${row.metric}</strong></td><td>${row.budget || "—"}</td><td>${row.bdgMtd || "—"}</td><td>${row.actuals || "—"}</td><td>${progressCell(row.actuals, row.bdgMtd)}</td><td><span class="yds-pill ${diffClass(row.diffVsBdg)}">${row.diffVsBdg || "—"}</span></td><td>${row.prorated || "—"}</td><td><span class="yds-pill ${diffClass(row.diffVsProrated)}">${row.diffVsProrated || "—"}</span></td><td><span class="yds-pill ${diffClass(row.mom)}">${row.mom || "—"}</span></td></tr>`;
      }
      return `<tr><td class="yds-sticky-metric"><strong>${row.metric}</strong></td><td>${row.actuals || "—"}</td><td><span class="yds-pill ${diffClass(row.mom)}">${row.mom || "—"}</span></td></tr>`;
    }).join("");
  }
  function tableCard(title, subtitle, rows, mode) {
    const head = mode === "mtd"
      ? "<tr><th class='yds-sticky-metric'>Métrica</th><th>Budget</th><th>Budget MTD</th><th>Actuals</th><th>Avance</th><th>Diff vs Bdg</th><th>Reforecast</th><th>Diff vs Reforecast</th><th>vs mes ant.</th></tr>"
      : "<tr><th class='yds-sticky-metric'>Métrica</th><th>Actuals</th><th>vs mes ant.</th></tr>";
    return `<article class="yds-table-card"><div class="yds-table-head"><h3>${title}</h3><p>${subtitle}</p></div><div class="yds-exec-scroll"><table class="yds-exec-table"><thead>${head}</thead><tbody>${tableRows(rows, mode)}</tbody></table></div></article>`;
  }

  function render(payload) {
    const mount = document.getElementById("yango-summary-dashboard");
    if (!mount || !payload?.months?.length) return;
    ensureStyles();
    const selectedKey = mount.dataset.selectedMonth && payload.months.some(item => item.key === mount.dataset.selectedMonth) ? mount.dataset.selectedMonth : payload.months[0].key;
    const month = payload.months.find(item => item.key === selectedKey) || payload.months[0];
    mount.dataset.selectedMonth = month.key;
    mount.dataset.ydsHistoryFix = "true";
    mount.innerHTML = `<section class="yds-card-shell"><div class="yds-hero"><div><p class="yds-eyebrow">Resumen Yango</p><h2>Daily Tracker</h2><p>Trips, GMV, installs, AOV, new riders y budget MTD en una sola vista.</p></div><div class="yds-filter"><label>Mes</label><select id="yds-month-select">${payload.months.map(item => `<option value="${item.key}" ${item.key === month.key ? "selected" : ""}>${item.label}</option>`).join("")}</select></div></div><div class="yds-meta"><span>${payload.source}</span><span>Corte: día ${month.cutoffDay || "—"}</span><span>Comparación: ${month.compareLabel}</span></div><div class="yds-kpis">${KPI_MAP.map(item => { const kpi = month.kpis[item.label]; const delta = kpi?.delta ?? null; return `<article class="yds-kpi yds-${item.tone}"><span>${item.icon}</span><strong>${kpi?.value || "—"}</strong><small>${item.label}</small><em class="${delta === null ? "yds-neutral" : delta < 0 ? "yds-neg" : "yds-pos"}">${delta === null ? "Sin comparativo" : `${formatDelta(delta)} vs mes anterior`}</em></article>`; }).join("")}</div><div class="yds-tables">${tableCard("Budget MTD · Actuals", "Budget, actual y avance de cada métrica con el reforecast al lado.", month.mtd || [], "mtd")}</div>${(month.daily || []).length ? `<article class="yds-table-card yds-daily"><div class="yds-table-head"><h3>Daily pulse</h3><p>Últimos días del mes seleccionado</p></div><div class="yds-scroll"><table><thead><tr><th>Día</th><th>Trips</th><th>GMV</th><th>Installs</th><th>New riders</th></tr></thead><tbody>${month.daily.map(row => `<tr><td>${row.label}</td><td>${row.trips}</td><td>${row.gmv}</td><td>${row.installs}</td><td>${row.newRiders}</td></tr>`).join("")}</tbody></table></div></article>` : ""}</section>`;
    const select = mount.querySelector("#yds-month-select");
    if (select) select.onchange = event => { mount.dataset.selectedMonth = event.target.value; render(payload); };
  }

  async function load() {
    const [dailyRows, dbRows] = await Promise.all([fetchCsv(DAILY_TRACKER_GID), fetchCsv(DB_DAILY_GID)]);
    return mergePayload(dailyRows, dbRows);
  }

  async function boot() {
    if (renderLock) return;
    const mount = document.getElementById("yango-summary-dashboard");
    if (!mount) return;
    if (mount.dataset.ydsHistoryFix === "true" && payloadCache) return;
    renderLock = true;
    try {
      payloadCache = payloadCache || await load();
      render(payloadCache);
    } catch (error) {
      console.warn("Resumen Yango histórico no pudo cargar:", error.message);
    } finally {
      renderLock = false;
    }
  }

  window.addEventListener("load", () => setTimeout(boot, 900));
  document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 900));
  setInterval(boot, 2500);
})();
