(() => {
  const KEY = "yango_samsung_raffle_h1";
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
    await sleep(850);
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

  function isRaffleVisible() {
    return document.body && document.body.innerText && document.body.innerText.includes("Rifa Samsung");
  }

  function syncButton() {
    const existing = document.getElementById("samsung-raffle-export-btn");
    if (!isRaffleVisible()) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return;
    const button = document.createElement("button");
    button.id = "samsung-raffle-export-btn";
    button.type = "button";
    button.textContent = "Descargar data Rifa Samsung";
    button.style.cssText = [
      "position:fixed",
      "right:24px",
      "bottom:24px",
      "z-index:9999",
      "border:0",
      "border-radius:999px",
      "padding:12px 16px",
      "background:#111827",
      "color:#fff",
      "font-weight:900",
      "font-size:13px",
      "box-shadow:0 14px 36px rgba(15,23,42,.22)",
      "cursor:pointer"
    ].join(";");
    button.addEventListener("click", () => handleDownload(button));
    document.body.appendChild(button);
  }

  const observer = new MutationObserver(syncButton);
  window.addEventListener("load", () => {
    syncButton();
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
})();
