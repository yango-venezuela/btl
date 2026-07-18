(() => {
  const KEY = "yango_samsung_raffle_h1";
  const BUTTON_ID = "samsung-raffle-export-btn";
  const STATUS_LABELS = {
    pending: "Pendiente contacto",
    contacted: "Contactado",
    no_response: "No ha respondido",
    responded: "Respondió",
    address: "Dirección recibida",
    delivered: "Entregado"
  };
  const HEADERS = ["Rank", "UID", "Telefono", "Trips completados", "Premio", "Grupo", "Estatus", "Direccion", "Notas", "Actualizado"];

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const clean = value => String(value ?? "").replaceAll('"', '""');
  const csvCell = value => `"${clean(value)}"`;
  const rowValue = (item, key) => {
    if (key === "Telefono") return item.phone ? `="${item.phone}"` : "";
    if (key === "Estatus") return STATUS_LABELS[item.status] || item.status || "";
    if (key === "Rank") return item.rank || "";
    if (key === "UID") return item.uid ? `="${item.uid}"` : "";
    if (key === "Trips completados") return item.completedTrips || 0;
    if (key === "Premio") return item.prize || "";
    if (key === "Grupo") return item.prizeGroup || "";
    if (key === "Direccion") return item.address || "";
    if (key === "Notas") return item.notes || "";
    if (key === "Actualizado") return item.updatedAt || "";
    return "";
  };

  async function loadRaffleData() {
    await sleep(500);
    try {
      const res = await fetch(`/api/state?keys=${encodeURIComponent(KEY)}`, { cache: "no-store" });
      if (res.ok) {
        const payload = await res.json();
        const rows = payload && payload.values && payload.values[KEY];
        if (Array.isArray(rows) && rows.length) return rows;
      }
    } catch (error) {}
    try {
      const local = JSON.parse(localStorage.getItem(KEY) || "[]");
      if (Array.isArray(local) && local.length) return local;
    } catch (error) {}
    return [];
  }

  function downloadRows(rows) {
    const sorted = [...rows].sort((a, b) => (Number(a.rank) || 0) - (Number(b.rank) || 0));
    const csv = [HEADERS, ...sorted.map(item => HEADERS.map(header => rowValue(item, header)))].map(row => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `yango_rifa_samsung_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleDownload(button) {
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Preparando...";
    const rows = await loadRaffleData();
    if (!rows.length) {
      alert("No encontré data de Rifa Samsung para descargar todavía.");
    } else {
      downloadRows(rows);
    }
    button.disabled = false;
    button.textContent = original;
  }

  function activeRaffleSection() {
    const headers = [...document.querySelectorAll("h1, h2, h3, div")];
    const visibleTitle = headers.find(node => {
      const text = (node.textContent || "").trim();
      const box = node.getBoundingClientRect();
      return text === "Rifa Samsung · Junio 2026" && box.width > 0 && box.height > 0;
    });
    if (!visibleTitle) return null;
    return visibleTitle.closest("div[style]") || visibleTitle.parentElement;
  }

  function targetContainer(section) {
    if (!section) return null;
    let node = section;
    for (let i = 0; i < 4 && node && node.parentElement; i += 1) {
      const text = node.textContent || "";
      if (text.includes("Top 40 usuarios") && text.includes("Rifa Samsung · Junio 2026")) return node;
      node = node.parentElement;
    }
    return section;
  }

  function syncButton() {
    const existing = document.getElementById(BUTTON_ID);
    const section = targetContainer(activeRaffleSection());
    if (!section) {
      if (existing) existing.remove();
      return;
    }
    if (existing && section.contains(existing)) return;
    if (existing) existing.remove();

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = "Descargar data";
    button.style.cssText = [
      "border:0",
      "border-radius:999px",
      "padding:10px 14px",
      "background:#ffffff",
      "color:#111827",
      "font-weight:950",
      "font-size:12px",
      "box-shadow:0 10px 24px rgba(15,23,42,.16)",
      "cursor:pointer",
      "white-space:nowrap",
      "margin-left:auto"
    ].join(";");
    button.addEventListener("click", () => handleDownload(button));

    section.style.display = section.style.display || "flex";
    section.style.alignItems = section.style.alignItems || "center";
    section.style.gap = section.style.gap || "12px";
    section.appendChild(button);
  }

  const observer = new MutationObserver(syncButton);
  window.addEventListener("load", () => {
    syncButton();
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
})();
