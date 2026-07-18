(() => {
  const KEY = "yango_influencers_h1";
  const FILTER_ID = "influencer-payment-filter-panel";
  let cachedItems = [];

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const byName = value => String(value || "").trim().toLowerCase();
  const inDateRange = (date, from, to) => {
    if (!from && !to) return true;
    if (!date) return false;
    const value = String(date).slice(0, 10);
    return (!from || value >= from) && (!to || value <= to);
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

  function activeInfluencerSection() {
    const nodes = [...document.querySelectorAll("h1, h2, h3, div")];
    const title = nodes.find(node => {
      const text = (node.textContent || "").trim();
      const box = node.getBoundingClientRect();
      return (text === "Tracking de IG, TikTok e Influencers" || text === "IG, TikTok e Influencers") && box.width > 0 && box.height > 0;
    });
    if (!title) return null;
    let node = title;
    for (let i = 0; i < 5 && node && node.parentElement; i += 1) {
      const text = node.textContent || "";
      if (text.includes("Nuevo influencer") || text.includes("Controla acuerdos")) return node;
      node = node.parentElement;
    }
    return title.parentElement;
  }

  function tableRows() {
    return [...document.querySelectorAll("tbody tr")].filter(row => {
      const text = row.textContent || "";
      return cachedItems.some(item => item.name && text.toLowerCase().includes(byName(item.name)));
    });
  }

  function values() {
    return {
      paid: document.getElementById("influencer-paid-filter")?.value || "all",
      from: document.getElementById("influencer-payment-from")?.value || "",
      to: document.getElementById("influencer-payment-to")?.value || ""
    };
  }

  function applyFilter() {
    const { paid, from, to } = values();
    const keepByName = new Map(cachedItems.map(item => {
      const paidOk = paid === "all" || (paid === "paid" ? Boolean(item.paid) : !item.paid);
      const dateOk = inDateRange(item.paymentDate, from, to);
      return [byName(item.name), paidOk && dateOk];
    }));
    tableRows().forEach(row => {
      const rowText = row.textContent.toLowerCase();
      const match = [...keepByName.keys()].find(name => name && rowText.includes(name));
      row.style.display = match && keepByName.get(match) ? "" : "none";
    });
  }

  async function syncFilter() {
    const existing = document.getElementById(FILTER_ID);
    const section = activeInfluencerSection();
    if (!section) {
      if (existing) existing.remove();
      tableRows().forEach(row => { row.style.display = ""; });
      return;
    }
    await loadInfluencers();
    if (existing) {
      applyFilter();
      return;
    }

    const panel = document.createElement("div");
    panel.id = FILTER_ID;
    panel.style.cssText = [
      "display:grid",
      "grid-template-columns:minmax(150px,.8fr) minmax(150px,.8fr) minmax(150px,.8fr) auto",
      "gap:10px",
      "align-items:end",
      "margin:12px 0",
      "padding:12px",
      "border:1px solid #E2E8F0",
      "border-radius:16px",
      "background:#fff"
    ].join(";");

    panel.innerHTML = `
      <label style="display:grid;gap:5px;font-size:11px;font-weight:900;color:#64748B;text-transform:uppercase;letter-spacing:.04em;">Pagado
        <select id="influencer-paid-filter" style="height:38px;border:1px solid #CBD5E1;border-radius:12px;padding:7px 10px;font-weight:800;color:#0F172A;background:#fff;">
          <option value="all">Todos</option>
          <option value="paid">Pagados</option>
          <option value="unpaid">Pendientes de pago</option>
        </select>
      </label>
      <label style="display:grid;gap:5px;font-size:11px;font-weight:900;color:#64748B;text-transform:uppercase;letter-spacing:.04em;">Fecha pago desde
        <input id="influencer-payment-from" type="date" style="height:38px;border:1px solid #CBD5E1;border-radius:12px;padding:7px 10px;font-weight:800;color:#0F172A;background:#fff;" />
      </label>
      <label style="display:grid;gap:5px;font-size:11px;font-weight:900;color:#64748B;text-transform:uppercase;letter-spacing:.04em;">Fecha pago hasta
        <input id="influencer-payment-to" type="date" style="height:38px;border:1px solid #CBD5E1;border-radius:12px;padding:7px 10px;font-weight:800;color:#0F172A;background:#fff;" />
      </label>
      <button id="influencer-payment-clear" type="button" style="height:38px;border:1px solid #CBD5E1;border-radius:12px;padding:7px 12px;background:#F8FAFC;color:#0F172A;font-weight:900;cursor:pointer;">Limpiar</button>
    `;

    const anchor = section.parentElement || section;
    anchor.insertAdjacentElement("afterend", panel);
    ["influencer-paid-filter", "influencer-payment-from", "influencer-payment-to"].forEach(id => {
      panel.querySelector(`#${id}`).addEventListener("change", applyFilter);
    });
    panel.querySelector("#influencer-payment-clear").addEventListener("click", () => {
      panel.querySelector("#influencer-paid-filter").value = "all";
      panel.querySelector("#influencer-payment-from").value = "";
      panel.querySelector("#influencer-payment-to").value = "";
      applyFilter();
    });
    applyFilter();
  }

  const observer = new MutationObserver(() => syncFilter());
  window.addEventListener("load", async () => {
    await sleep(700);
    await syncFilter();
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
})();
