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

  const isVisible = element => {
    if (!element) return false;
    const box = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return box.width > 0 && box.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  };

  const getPaymentDate = item => item.paymentDate || item.paidDate || item.payment_date || item.fechaPago || item.fecha_pago || item.fechaDePago || "";
  const getName = item => item.name || item.nombre || item.influencer || item.username || item.user || "";

  const inDateRange = (date, from, to) => {
    if (!from && !to) return true;
    if (!date) return false;
    const value = String(date).slice(0, 10);
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
      #${PANEL_ID} .yango-pay-filter-control {
        display: grid !important;
        gap: 7px !important;
        min-width: 240px !important;
        align-self: end !important;
      }
      #${PANEL_ID} .yango-pay-filter-title {
        margin: 0 !important;
        padding: 0 !important;
        color: #526179 !important;
        font-family: inherit !important;
        font-size: 18px !important;
        font-weight: 600 !important;
        line-height: 1.15 !important;
        letter-spacing: 0 !important;
        text-transform: none !important;
      }
      #${PANEL_ID} .yango-pay-filter-control input {
        box-sizing: border-box !important;
        width: 240px;
        height: 58px;
        border: 1px solid #DFE7F1;
        border-radius: 12px;
        padding: 0 18px;
        background: #fff;
        color: #0F172A;
        font-family: inherit;
        font-size: 22px;
        font-weight: 800;
        box-shadow: none;
        outline: none;
      }
      @media (max-width: 980px) {
        #${PANEL_ID}.is-under-row { gap: 14px; }
        #${PANEL_ID} .yango-pay-filter-control { min-width: 190px !important; }
        #${PANEL_ID} .yango-pay-filter-title { font-size: 15px !important; }
        #${PANEL_ID} .yango-pay-filter-control input { width: 190px; height: 48px; font-size: 18px; }
      }
    `;
    document.head.appendChild(style);
  }

  function copyPublishedDateInputStyle(root) {
    const panel = document.getElementById(PANEL_ID);
    if (!panel || !root) return;
    const refInput = [...root.querySelectorAll("input[type='date']")].find(isVisible);
    if (!refInput) return;

    const inputStyle = window.getComputedStyle(refInput);
    const inputBox = refInput.getBoundingClientRect();

    panel.querySelectorAll(".yango-pay-filter-control").forEach(control => {
      control.style.minWidth = `${Math.round(inputBox.width)}px`;
    });

    panel.querySelectorAll("input").forEach(input => {
      input.style.width = `${Math.round(inputBox.width)}px`;
      input.style.height = `${Math.round(inputBox.height)}px`;
      input.style.border = inputStyle.border;
      input.style.borderRadius = inputStyle.borderRadius;
      input.style.padding = inputStyle.padding;
      input.style.background = inputStyle.backgroundColor;
      input.style.color = inputStyle.color;
      input.style.fontFamily = inputStyle.fontFamily;
      input.style.fontSize = inputStyle.fontSize;
      input.style.fontWeight = inputStyle.fontWeight;
      input.style.boxShadow = inputStyle.boxShadow;
    });
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

  function ensurePanel(target, mode, root) {
    ensureStyles();
    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement("div");
      panel.id = PANEL_ID;
      panel.innerHTML = `
        <div class="yango-pay-filter-control">
          <span class="yango-pay-filter-title">Fecha pago desde</span>
          <input id="influencer-payment-from" type="date" />
        </div>
        <div class="yango-pay-filter-control">
          <span class="yango-pay-filter-title">Fecha pago hasta</span>
          <input id="influencer-payment-to" type="date" />
        </div>
      `;
      ["influencer-payment-from", "influencer-payment-to"].forEach(id => {
        panel.querySelector(`#${id}`).addEventListener("change", applyFilter);
      });
    }

    if (mode === "inline") {
      if (panel.parentElement !== target) target.appendChild(panel);
      panel.className = "is-inline";
    } else {
      if (panel.previousElementSibling !== target) target.insertAdjacentElement("beforebegin", panel);
      panel.className = "is-under-row";
    }
    panel.style.display = "";
    copyPublishedDateInputStyle(root);
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
