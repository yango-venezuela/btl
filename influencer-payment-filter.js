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
  const getName = item => item.name || item.nombre || item.influencer || item.username || item.user || "";

  const toDateKey = value => {
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

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
    }
    return "";
  };

  const inDateRange = (date, from, to) => {
    if (!from && !to) return true;
    const value = toDateKey(date);
    if (!value) return false;
    return (!from || value >= from) && (!to || value <= to);
  };

  const itemKeys = item => {
    const preferred = [getName(item), item.igUsername, item.instagram, item.tiktokUsername, item.tiktok, item.handle, item.link];
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

  function matchedRows(root = document) {
    if (!cachedItems.length) return [];
    const rows = [...root.querySelectorAll("tbody tr")].filter(row => isVisible(row) || row.getAttribute(HIDDEN_ATTR) === "true");
    return rows.map(row => {
      const text = normalize(row.textContent || "");
      const item = cachedItems.find(candidate => itemKeys(candidate).some(key => text.includes(key)));
      return item ? { row, item } : null;
    }).filter(Boolean);
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

  function applyFilter() {
    const root = influencerRoot();
    if (!root) return resetRows();
    const matches = matchedRows(root);
    const { from, to } = values();
    matches.forEach(({ row, item }) => {
      const visible = inDateRange(getPaymentDate(item), from, to);
      row.style.display = visible ? "" : "none";
      if (visible) row.removeAttribute(HIDDEN_ATTR);
      else row.setAttribute(HIDDEN_ATTR, "true");
    });
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
