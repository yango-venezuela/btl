(() => {
  const KEY = "yango_influencers_h1";
  const PANEL_ID = "influencer-payment-filter-panel";
  const STYLE_ID = "influencer-payment-filter-style";
  const HIDDEN_ATTR = "data-yango-payment-filter-hidden";
  let cachedItems = [];
  let syncing = false;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const compact = value => normalize(value).replace(/\s/g, "");
  const pad2 = value => String(value).padStart(2, "0");

  const isVisible = element => {
    if (!element) return false;
    const box = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return box.width > 0 && box.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  };

  const getNested = (obj, path) => path.split(".").reduce((value, key) => value && value[key], obj);
  const getPaymentDate = item => {
    if (!item) return "";
    const keys = [
      "paymentDate", "paidDate", "payment_date", "paid_date", "payDate", "datePaid", "paidAt", "paymentAt",
      "fechaPago", "fecha_pago", "fechaDePago", "fecha_pagado", "fechaPagado", "fechaPagoInfluencer",
      "pagoFecha", "pago_fecha", "date_payment", "payment.date", "payment.fecha", "pago.fecha"
    ];
    for (const key of keys) {
      const value = key.includes(".") ? getNested(item, key) : item[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
    return "";
  };
  const getName = item => item?.name || item?.nombre || item?.influencer || item?.username || item?.user || "";

  const inferYear = (from, to) => {
    const picked = from || to || "";
    const match = String(picked).match(/^(20\d{2}|19\d{2})/);
    return match ? match[1] : String(new Date().getFullYear());
  };

  const toDateKey = (value, fallbackYear) => {
    if (value === undefined || value === null || value === "") return "";
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      if (value > 20000 && value < 80000) {
        const date = new Date(Date.UTC(1899, 11, 30 + value));
        return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
      }
      return "";
    }
    const raw = String(value).trim();
    if (!raw) return "";

    const iso = raw.match(/(20\d{2}|19\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (iso) return `${iso[1]}-${pad2(iso[2])}-${pad2(iso[3])}`;

    const local = raw.match(/(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|19\d{2})/);
    if (local) return `${local[3]}-${pad2(local[2])}-${pad2(local[1])}`;

    const yearless = raw.match(/(?:^|[^\d])(\d{1,2})[-/.](\d{1,2})(?![-/.]\d)/);
    if (yearless) return `${fallbackYear || new Date().getFullYear()}-${pad2(yearless[2])}-${pad2(yearless[1])}`;

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
    }
    return "";
  };

  const inDateRange = (date, from, to) => {
    if (!from && !to) return true;
    const value = toDateKey(date, inferYear(from, to));
    if (!value) return false;
    return (!from || value >= from) && (!to || value <= to);
  };

  const parseNumber = value => {
    const cleaned = String(value || "").replace(/[^\d,.-]/g, "").trim();
    if (!cleaned) return 0;
    if (cleaned.includes(",") && cleaned.includes(".")) return Number(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
    if (cleaned.includes(",")) return Number(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
    return Number(cleaned.replace(/,/g, "")) || 0;
  };
  const fmt = value => new Intl.NumberFormat("es-VE", { maximumFractionDigits: 0 }).format(Math.round(value || 0));
  const fmtMoney = value => `$${fmt(value)}`;
  const fmtPercent = value => `${new Intl.NumberFormat("es-VE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value || 0)}%`;

  function datesFromElement(element, fallbackYear) {
    if (!element) return [];
    const dates = [];
    element.querySelectorAll("input[type='date']").forEach(input => {
      if (input.value) dates.push(input.value);
    });
    const text = element.textContent || "";
    const patterns = [
      /(20\d{2}|19\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/g,
      /(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|19\d{2})/g,
      /(?:^|[^\d])(\d{1,2})[-/.](\d{1,2})(?![-/.]\d)/g
    ];
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text))) dates.push(match[0]);
    });
    return [...new Set(dates)].filter(value => toDateKey(value, fallbackYear));
  }

  function rowPaymentDate(row, item, fallbackYear) {
    const itemDate = getPaymentDate(item);
    if (toDateKey(itemDate, fallbackYear)) return itemDate;

    const table = row.closest("table");
    if (table && row.cells && row.cells.length) {
      const headers = [...table.querySelectorAll("thead th")].map(th => normalize(th.textContent || ""));
      const paymentIndex = headers.findIndex(text => text.includes("pago") || text.includes("pagado"));
      if (paymentIndex >= 0 && row.cells[paymentIndex]) {
        const cellDates = datesFromElement(row.cells[paymentIndex], fallbackYear);
        if (cellDates.length) return cellDates[0];
      }
    }

    const paymentNodes = [...row.querySelectorAll("td, label, div, span")].filter(node => {
      const text = normalize(node.textContent || "");
      return (text.includes("pago") || text.includes("pagado")) && datesFromElement(node, fallbackYear).length;
    });
    if (paymentNodes.length) return datesFromElement(paymentNodes[0], fallbackYear)[0];

    const rowDates = datesFromElement(row, fallbackYear);
    if (rowDates.length === 1) return rowDates[0];
    if (rowDates.length > 1) return rowDates[rowDates.length - 1];
    return "";
  }

  const itemKeys = item => {
    const preferred = [getName(item), item?.igUsername, item?.instagram, item?.tiktokUsername, item?.tiktok, item?.handle, item?.link];
    return preferred
      .concat(Object.values(item || {}).filter(value => typeof value === "string" || typeof value === "number"))
      .map(normalize)
      .filter(value => value && value.length >= 3 && !value.startsWith("http") && value !== "influencer" && value !== "microinfluencer");
  };

  async function loadInfluencers() {
    try {
      const res = await fetch(`/api/state?keys=${encodeURIComponent(KEY)}`, { cache: "no-store" });
      if (res.ok) {
        const payload = await res.json();
        const rows = payload && payload.values && payload.values[KEY];
        if (Array.isArray(rows)) {
          cachedItems = rows;
          return rows;
        }
      }
    } catch (error) {}
    try {
      const local = JSON.parse(localStorage.getItem(KEY) || "[]");
      if (Array.isArray(local)) {
        cachedItems = local;
        return local;
      }
    } catch (error) {}
    return cachedItems;
  }

  function influencerTitle() {
    return [...document.querySelectorAll("h1,h2,h3")].find(node => {
      if (!isVisible(node)) return false;
      const text = normalize(node.textContent || "");
      const tight = compact(node.textContent || "");
      return tight.includes("ig,tiktokeinfluencers") || text.includes("tracking de ig") || (text.includes("influencers") && (text.includes("tiktok") || text.includes("ig")));
    }) || null;
  }

  function influencerRoot() {
    const title = influencerTitle();
    if (!title) return null;
    let best = title.parentElement || title;
    let node = title;
    for (let i = 0; i < 9 && node && node.parentElement; i += 1) {
      const text = normalize(node.textContent || "");
      if (text.includes("tipo") && text.includes("plataforma") && text.includes("entregable") && text.includes("ordenar por")) best = node;
      if (text.includes("influencers") && text.includes("publicado desde") && text.includes("publicado hasta")) best = node;
      node = node.parentElement;
    }
    return best;
  }

  function matchedRows(root = document, fallbackYear) {
    const rows = [...root.querySelectorAll("tbody tr")].filter(row => isVisible(row) || row.getAttribute(HIDDEN_ATTR) === "true");
    return rows.map(row => {
      const text = normalize(row.textContent || "");
      const item = cachedItems.find(candidate => itemKeys(candidate).some(key => text.includes(key))) || null;
      return { row, item };
    }).filter(({ row, item }) => item || datesFromElement(row, fallbackYear).length || normalize(row.textContent || "").includes("pago"));
  }

  function values() {
    return {
      from: document.getElementById("influencer-payment-from")?.value || "",
      to: document.getElementById("influencer-payment-to")?.value || ""
    };
  }

  function resetRows() {
    document.querySelectorAll(`[${HIDDEN_ATTR}="true"]`).forEach(row => {
      row.style.display = "";
      row.removeAttribute(HIDDEN_ATTR);
    });
  }

  function extractMoney(row, index) {
    const cells = row.cells ? [...row.cells] : [];
    const source = cells[index] || row;
    const matches = [...(source.textContent || "").matchAll(/\$\s*([\d.,]+)/g)].map(match => parseNumber(match[1]));
    return matches[0] || 0;
  }

  function extractReach(row, label) {
    const re = new RegExp(`${label}\\s*:\\s*([\\d.,]+)\\s*reach`, "i");
    const match = (row.textContent || "").match(re);
    return match ? parseNumber(match[1]) : 0;
  }

  function extractErs(row) {
    return [...(row.textContent || "").matchAll(/ER\s*([\d.,]+)\s*%/gi)].map(match => parseNumber(match[1])).filter(Number.isFinite);
  }

  function sumItemNumber(item, patterns) {
    if (!item) return 0;
    const stack = [item];
    let total = 0;
    while (stack.length) {
      const obj = stack.pop();
      if (!obj || typeof obj !== "object") continue;
      Object.entries(obj).forEach(([key, value]) => {
        const k = normalize(key);
        if (value && typeof value === "object") stack.push(value);
        else if (patterns.every(pattern => k.includes(pattern))) total += parseNumber(value);
      });
    }
    return total;
  }

  function rowType(row, item) {
    const source = normalize([item?.type, item?.tipo, item?.category, item?.categoria, row.textContent].filter(Boolean).join(" "));
    if (source.includes("microinfluencer")) return "micro";
    if (source.includes("influencer")) return "influencer";
    return "";
  }

  function setCardValue(root, label, value, beforeY) {
    const normalizedLabel = normalize(label);
    const labels = [...root.querySelectorAll("div,span,p")].filter(node => {
      if (!isVisible(node) || node.closest("table") || node.closest("tbody")) return false;
      const text = normalize(node.textContent || "");
      const box = node.getBoundingClientRect();
      return text === normalizedLabel && (!beforeY || box.top < beforeY);
    });
    const labelNode = labels[0];
    if (!labelNode) return;
    const siblings = labelNode.parentElement ? [...labelNode.parentElement.children] : [];
    const labelIndex = siblings.indexOf(labelNode);
    const valueNode = labelIndex > 0 ? siblings[labelIndex - 1] : null;
    if (valueNode) valueNode.textContent = value;
  }

  function updateSummary(root, allMatches, filteredMatches) {
    const rowTop = filterRow(root)?.getBoundingClientRect().top || null;
    const rows = filteredMatches.map(match => match.row);
    const totalRows = rows.length;
    const typeCounts = filteredMatches.reduce((acc, { row, item }) => {
      const type = rowType(row, item);
      if (type === "micro") acc.micro += 1;
      else if (type === "influencer") acc.influencer += 1;
      return acc;
    }, { influencer: 0, micro: 0 });
    const published = rows.filter(row => normalize(row.textContent || "").includes("publico") || normalize(row.textContent || "").includes("publicó") || normalize(row.textContent || "").includes("publicado")).length;
    const reachIg = rows.reduce((sum, row) => sum + extractReach(row, "IG"), 0);
    const reachTiktok = rows.reduce((sum, row) => sum + extractReach(row, "TikTok"), 0);
    const budgets = rows.map(row => extractMoney(row, 3)).filter(value => value > 0);
    const cpms = rows.map(row => extractMoney(row, 4)).filter(value => value > 0);
    const ers = rows.flatMap(extractErs);
    const promo = filteredMatches.reduce((sum, { item }) => sum + sumItemNumber(item, ["promo"]), 0) || filteredMatches.reduce((sum, { item }) => sum + sumItemNumber(item, ["redencion"]), 0);

    setCardValue(root, "Influencers", fmt(typeCounts.influencer), rowTop);
    setCardValue(root, "Micros", fmt(typeCounts.micro), rowTop);
    setCardValue(root, "Publicados", `${fmt(published)}/${fmt(totalRows)}`, rowTop);
    setCardValue(root, "Reach IG", fmt(reachIg), rowTop);
    setCardValue(root, "Reach TikTok", fmt(reachTiktok), rowTop);
    setCardValue(root, "Engagement rate", fmtPercent(ers.length ? ers.reduce((a, b) => a + b, 0) / ers.length : 0), rowTop);
    setCardValue(root, "Redenciones Promo Code", fmt(promo), rowTop);
    setCardValue(root, "Presupuesto", fmtMoney(budgets.reduce((a, b) => a + b, 0)), rowTop);
    setCardValue(root, "CPM promedio", fmtMoney(cpms.length ? cpms.reduce((a, b) => a + b, 0) / cpms.length : 0), rowTop);
  }

  function applyFilter() {
    const root = influencerRoot();
    if (!root) return resetRows();
    const { from, to } = values();
    const fallbackYear = inferYear(from, to);
    const matches = matchedRows(root, fallbackYear);
    matches.forEach(({ row, item }) => {
      const visible = inDateRange(rowPaymentDate(row, item, fallbackYear), from, to);
      row.style.display = visible ? "" : "none";
      if (visible) row.removeAttribute(HIDDEN_ATTR);
      else row.setAttribute(HIDDEN_ATTR, "true");
    });
    const filtered = matches.filter(({ row }) => isVisible(row) && row.style.display !== "none");
    updateSummary(root, matches, filtered);
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID} { display: none; }
      #${PANEL_ID}.is-inline { display: contents; }
      #${PANEL_ID}.is-under-row { display: flex; flex-wrap: wrap; align-items: end; gap: 20px 24px; margin: 0 0 22px; }
    `;
    document.head.appendChild(style);
  }

  function filterRow(root) {
    if (!root) return null;
    const candidates = [...root.querySelectorAll("div,section")].filter(isVisible).map(element => {
      const text = normalize(element.textContent || "");
      const keywords = ["tipo", "plataforma", "entregable", "ordenar por", "publicado desde", "publicado hasta"];
      const hits = keywords.filter(keyword => text.includes(keyword)).length;
      const box = element.getBoundingClientRect();
      return { element, hits, area: box.width * box.height, height: box.height, width: box.width, top: box.top };
    }).filter(item => item.hits >= 4 && item.height > 35 && item.height < 340 && item.width > 420);

    if (!candidates.length) return null;
    candidates.sort((a, b) => b.hits - a.hits || a.area - b.area || a.top - b.top);
    return candidates[0].element;
  }

  function fallbackAnchor(root) {
    if (!root) return null;
    const influencersCardTitle = [...root.querySelectorAll("h1,h2,h3")].find(node => isVisible(node) && normalize(node.textContent || "") === "influencers");
    if (influencersCardTitle) {
      let node = influencersCardTitle;
      for (let i = 0; i < 4 && node && node.parentElement; i += 1) node = node.parentElement;
      return node || influencersCardTitle;
    }
    const table = root.querySelector("table");
    return table || root;
  }

  function smallestControlForText(root, textNeedle) {
    const needle = normalize(textNeedle);
    const matches = [...root.querySelectorAll("label,div")].filter(node => {
      if (!isVisible(node)) return false;
      const text = normalize(node.textContent || "");
      return text.includes(needle) && node.querySelector("input[type='date']");
    }).map(node => {
      const box = node.getBoundingClientRect();
      return { node, area: box.width * box.height };
    });
    if (!matches.length) return null;
    matches.sort((a, b) => a.area - b.area);
    return matches[0].node;
  }

  function replaceTextNode(root, from, to) {
    const target = normalize(from);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (normalize(node.nodeValue).includes(target)) {
        node.nodeValue = node.nodeValue.replace(new RegExp(from, "i"), to);
        return true;
      }
    }
    return false;
  }

  function cloneDateControl(root, fromLabel, toLabel, inputId) {
    const source = smallestControlForText(root, fromLabel);
    if (!source) return null;
    const clone = source.cloneNode(true);
    clone.removeAttribute("id");
    clone.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));
    clone.querySelectorAll("[name]").forEach(node => node.removeAttribute("name"));
    clone.querySelectorAll("[for]").forEach(node => node.removeAttribute("for"));
    replaceTextNode(clone, fromLabel, toLabel);
    const input = clone.querySelector("input[type='date']");
    if (!input) return null;
    input.id = inputId;
    input.value = document.getElementById(inputId)?.value || "";
    input.removeAttribute("name");
    input.addEventListener("change", applyFilter);
    return clone;
  }

  function buildPanel(root) {
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    const from = cloneDateControl(root, "Publicado desde", "Fecha pago desde", "influencer-payment-from");
    const to = cloneDateControl(root, "Publicado hasta", "Fecha pago hasta", "influencer-payment-to");
    if (!from || !to) return null;
    panel.appendChild(from);
    panel.appendChild(to);
    return panel;
  }

  function ensurePanel(target, mode, root) {
    ensureStyles();
    let panel = document.getElementById(PANEL_ID);
    if (!panel || !panel.querySelector("#influencer-payment-from") || !panel.querySelector("#influencer-payment-to")) {
      const oldFrom = document.getElementById("influencer-payment-from")?.value || "";
      const oldTo = document.getElementById("influencer-payment-to")?.value || "";
      if (panel) panel.remove();
      panel = buildPanel(root);
      if (!panel) return null;
      panel.querySelector("#influencer-payment-from").value = oldFrom;
      panel.querySelector("#influencer-payment-to").value = oldTo;
    }

    if (mode === "inline") {
      if (panel.parentElement !== target) target.appendChild(panel);
      panel.className = "is-inline";
    } else {
      if (panel.previousElementSibling !== target) target.insertAdjacentElement("beforebegin", panel);
      panel.className = "is-under-row";
    }
    panel.style.display = "";
    return panel;
  }

  async function syncFilter() {
    if (syncing) return;
    syncing = true;
    try {
      await loadInfluencers();
      const root = influencerRoot();
      const panel = document.getElementById(PANEL_ID);
      if (!root) {
        if (panel) panel.style.display = "none";
        resetRows();
        return;
      }
      const row = filterRow(root);
      if (row) ensurePanel(row, "inline", root);
      else {
        const anchor = fallbackAnchor(root);
        if (!anchor) {
          if (panel) panel.style.display = "none";
          return;
        }
        ensurePanel(anchor, "under", root);
      }
      applyFilter();
    } finally {
      syncing = false;
    }
  }

  const observer = new MutationObserver(() => window.requestAnimationFrame(syncFilter));
  window.addEventListener("load", async () => {
    await sleep(500);
    await syncFilter();
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    setInterval(syncFilter, 2500);
  });
})();
