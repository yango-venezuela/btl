(() => {
  const KEY = "yango_influencers_h1";
  const PANEL_ID = "influencer-payment-filter-panel";
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
    const rows = [...document.querySelectorAll("tbody tr")].filter(isVisible);
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

  function ensurePanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;

    panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.style.cssText = [
      "display:none",
      "position:fixed",
      "right:22px",
      "top:82px",
      "z-index:2147483000",
      "grid-template-columns:minmax(140px,.8fr) minmax(145px,.8fr) minmax(145px,.8fr) auto",
      "gap:10px",
      "align-items:end",
      "padding:12px",
      "border:1px solid #E2E8F0",
      "border-radius:18px",
      "background:rgba(255,255,255,.98)",
      "box-shadow:0 16px 45px rgba(15,23,42,.13)",
      "font-family:inherit"
    ].join(";");

    panel.innerHTML = `
      <label style="display:grid;gap:5px;font-size:10px;font-weight:900;color:#64748B;text-transform:uppercase;letter-spacing:.04em;">Pagado
        <select id="influencer-paid-filter" style="height:36px;border:1px solid #CBD5E1;border-radius:12px;padding:7px 10px;font-weight:800;color:#0F172A;background:#fff;">
          <option value="all">Todos</option>
          <option value="paid">Pagados</option>
          <option value="unpaid">Pendientes</option>
        </select>
      </label>
      <label style="display:grid;gap:5px;font-size:10px;font-weight:900;color:#64748B;text-transform:uppercase;letter-spacing:.04em;">Fecha pago desde
        <input id="influencer-payment-from" type="date" style="height:36px;border:1px solid #CBD5E1;border-radius:12px;padding:7px 10px;font-weight:800;color:#0F172A;background:#fff;" />
      </label>
      <label style="display:grid;gap:5px;font-size:10px;font-weight:900;color:#64748B;text-transform:uppercase;letter-spacing:.04em;">Fecha pago hasta
        <input id="influencer-payment-to" type="date" style="height:36px;border:1px solid #CBD5E1;border-radius:12px;padding:7px 10px;font-weight:800;color:#0F172A;background:#fff;" />
      </label>
      <button id="influencer-payment-clear" type="button" style="height:36px;border:1px solid #CBD5E1;border-radius:12px;padding:7px 12px;background:#F8FAFC;color:#0F172A;font-weight:900;cursor:pointer;">Limpiar</button>
    `;

    document.body.appendChild(panel);
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
    return panel;
  }

  async function syncFilter() {
    if (syncing) return;
    syncing = true;
    try {
      await loadInfluencers();
      const matches = matchedRows();
      const panel = ensurePanel();
      const active = looksLikeInfluencerScreen(matches);
      panel.style.display = active ? "grid" : "none";
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
