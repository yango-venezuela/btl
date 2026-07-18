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
    .trim()
    .toLowerCase();

  const isVisible = element => {
    if (!element) return false;
    const box = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return box.width > 0 && box.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  };

  const getPaymentDate = item => item.paymentDate || item.paidDate || item.payment_date || item.fechaPago || item.fecha_pago || item.fechaDePago || "";
  const getName = item => item.name || item.nombre || item.influencer || item.username || item.user || "";
  const getPaid = item => {
    const explicit = item.paid ?? item.isPaid ?? item.pagado ?? item.paymentDone;
    if (typeof explicit === "boolean") return explicit;
    if (typeof explicit === "string") {
      const value = normalize(explicit);
      if (["si", "sí", "yes", "true", "pagado", "paid"].includes(value)) return true;
      if (["no", "false", "pendiente", "unpaid"].includes(value)) return false;
    }
    const status = normalize(item.paymentStatus || item.estadoPago || item.statusPago || "");
    if (status.includes("pagado") || status === "paid") return true;
    if (status.includes("pendiente") || status.includes("no pag")) return false;
    return Boolean(getPaymentDate(item));
  };

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

  function matchedRows() {
    if (!cachedItems.length) return [];
    const rows = [...document.querySelectorAll("tbody tr")].filter(row => isVisible(row) || row.getAttribute(HIDDEN_ATTR) === "true");
    return rows.map(row => {
      const text = normalize(row.textContent || "");
      const item = cachedItems.find(candidate => itemKeys(candidate).some(key => text.includes(key)));
      return item ? { row, item } : null;
    }).filter(Boolean);
  }

  function looksLikeInfluencerScreen(matches) {
    if (matches.length >= 1) return true;
    const visibleText = normalize([...document.querySelectorAll("h1,h2,h3,button,label,span")]
      .filter(isVisible)
      .map(node => node.textContent || "")
      .join(" "));
    return visibleText.includes("influencer") || visibleText.includes("nuevo influencer") || visibleText.includes("microinfluencer");
  }

  function values() {
    return {
      paid: document.getElementById("influencer-paid-filter")?.value || "all",
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
    const matches = matchedRows();
    const { paid, from, to } = values();
    matches.forEach(({ row, item }) => {
      const paidOk = paid === "all" || (paid === "paid" ? getPaid(item) : !getPaid(item));
      const dateOk = inDateRange(getPaymentDate(item), from, to);
      const visible = paidOk && dateOk;
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
      #${PANEL_ID}.is-fallback { display: flex; flex-wrap: wrap; gap: 24px; align-items: end; margin: 0 0 22px; }
      .yango-pay-filter-control { display: grid; gap: 8px; min-width: 170px; color: #64748B; font-size: 16px; font-weight: 800; line-height: 1.15; }
      .yango-pay-filter-control select,
      .yango-pay-filter-control input { height: 58px; min-width: 170px; border: 1px solid #DFE7F1; border-radius: 12px; padding: 0 18px; background: #fff; color: #0F172A; font: inherit; font-size: 22px; font-weight: 900; box-shadow: none; }
      .yango-pay-filter-clear { height: 58px; align-self: end; border: 1px solid #DFE7F1; border-radius: 12px; padding: 0 20px; background: #fff; color: #0F172A; font: inherit; font-size: 18px; font-weight: 900; cursor: pointer; }
      .yango-pay-filter-clear:hover { background: #F8FAFC; }
      @media (max-width: 980px) {
        #${PANEL_ID}.is-fallback { gap: 14px; }
        .yango-pay-filter-control { min-width: 150px; font-size: 13px; }
        .yango-pay-filter-control select,
        .yango-pay-filter-control input { height: 48px; min-width: 150px; font-size: 18px; }
        .yango-pay-filter-clear { height: 48px; font-size: 16px; }
      }
    `;
    document.head.appendChild(style);
  }

  function findExistingFilterRow() {
    const containers = [...document.querySelectorAll("div,section")].filter(isVisible).map(element => {
      const text = normalize(element.textContent || "").replace(/\s+/g, " ");
      const keywords = ["tipo", "plataforma", "entregable", "ordenar por", "publicado desde", "publicado hasta"];
      const hits = keywords.filter(keyword => text.includes(keyword)).length;
      const box = element.getBoundingClientRect();
      return { element, text, hits, area: box.width * box.height, height: box.height };
    }).filter(item => item.hits >= 4 && item.height < 260);

    if (containers.length) {
      containers.sort((a, b) => a.area - b.area || b.hits - a.hits);
      return containers[0].element;
    }

    const publicadoHasta = [...document.querySelectorAll("label,div")].find(node => {
      const text = normalize(node.textContent || "");
      return isVisible(node) && text.includes("publicado hasta");
    });
    if (publicadoHasta) {
      let node = publicadoHasta.parentElement;
      for (let i = 0; i < 4 && node; i += 1, node = node.parentElement) {
        const text = normalize(node.textContent || "");
        if (text.includes("tipo") && text.includes("plataforma")) return node;
      }
      return publicadoHasta.parentElement;
    }
    return null;
  }

  function findFallbackAnchor() {
    const title = [...document.querySelectorAll("h1,h2,h3")].find(node => isVisible(node) && normalize(node.textContent).includes("influencer"));
    let node = title;
    for (let i = 0; i < 5 && node; i += 1, node = node.parentElement) {
      const text = normalize(node.textContent || "");
      if (text.includes("tracking") && text.includes("promo code")) return node;
    }
    return title?.parentElement || document.body;
  }

  function ensurePanel() {
    ensureStyles();
    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement("div");
      panel.id = PANEL_ID;
      panel.innerHTML = `
        <label class="yango-pay-filter-control">Pagado
          <select id="influencer-paid-filter">
            <option value="all">Todos</option>
            <option value="paid">Pagados</option>
            <option value="unpaid">Pendientes</option>
          </select>
        </label>
        <label class="yango-pay-filter-control">Fecha pago desde
          <input id="influencer-payment-from" type="date" />
        </label>
        <label class="yango-pay-filter-control">Fecha pago hasta
          <input id="influencer-payment-to" type="date" />
        </label>
        <button id="influencer-payment-clear" class="yango-pay-filter-clear" type="button">Limpiar</button>
      `;
      ["influencer-paid-filter", "influencer-payment-from", "influencer-payment-to"].forEach(id => {
        panel.querySelector(`#${id}`).addEventListener("change", applyFilter);
      });
      panel.querySelector("#influencer-payment-clear").addEventListener("click", () => {
        panel.querySelector("#influencer-paid-filter").value = "all";
        panel.querySelector("#influencer-payment-from").value = "";
        panel.querySelector("#influencer-payment-to").value = "";
        resetRows();
        applyFilter();
      });
    }

    const filterRow = findExistingFilterRow();
    if (filterRow) {
      if (panel.parentElement !== filterRow) filterRow.appendChild(panel);
      panel.className = "is-inline";
    } else {
      const anchor = findFallbackAnchor();
      if (panel.parentElement !== anchor.parentElement) anchor.insertAdjacentElement("afterend", panel);
      panel.className = "is-fallback";
    }
    return panel;
  }

  async function syncFilter() {
    if (syncing) return;
    syncing = true;
    try {
      await loadInfluencers();
      const matches = matchedRows();
      const active = looksLikeInfluencerScreen(matches);
      const panel = active ? ensurePanel() : document.getElementById(PANEL_ID);
      if (panel) panel.style.display = active ? "" : "none";
      if (active) applyFilter();
      else resetRows();
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
