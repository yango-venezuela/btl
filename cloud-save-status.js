(() => {
  if (typeof window === "undefined" || window.__yangoCloudSaveStatusV1) return;
  window.__yangoCloudSaveStatusV1 = true;

  const STATUS_ID = "yango-cloud-save-status";
  const STYLE_ID = "yango-cloud-save-status-style";
  const HEALTH_URL = "/api/health";
  let lastOk = false;

  const escapeHtml = value => String(value || "").replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char] || char));

  const ensureStyle = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = "#" + STATUS_ID + "{position:fixed;left:18px;bottom:18px;z-index:2147483647;display:flex;align-items:center;gap:8px;max-width:min(460px,calc(100vw - 36px));border-radius:999px;padding:11px 14px;font:800 12px/1.2 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;box-shadow:0 18px 40px rgba(15,23,42,.22);border:1px solid rgba(255,255,255,.72);backdrop-filter:blur(12px);}"
      + "#" + STATUS_ID + ".ok{background:#ecfdf3;color:#067647;border-color:#abefc6;}"
      + "#" + STATUS_ID + ".bad{background:#fff1f3;color:#b42318;border-color:#fecdd3;}"
      + "#" + STATUS_ID + ".checking{background:#f8fafc;color:#475467;border-color:#e4e7ec;}"
      + "#" + STATUS_ID + " .dot{width:9px;height:9px;border-radius:999px;display:inline-block;background:currentColor;box-shadow:0 0 0 4px rgba(180,35,24,.14);}"
      + "body.yango-cloud-save-offline::before{content:\"NO SE ESTA GUARDANDO EN LA NUBE\";position:fixed;top:0;left:0;right:0;z-index:2147483646;background:#b42318;color:#fff;text-align:center;font:900 12px/1 system-ui,sans-serif;letter-spacing:.08em;padding:8px 12px;}"
      + "body.yango-cloud-save-offline{padding-top:28px;}";
    document.head.appendChild(style);
  };

  const ensureBadge = () => {
    ensureStyle();
    let badge = document.getElementById(STATUS_ID);
    if (!badge) {
      badge = document.createElement("div");
      badge.id = STATUS_ID;
      badge.className = "checking";
      badge.innerHTML = "<span class=\"dot\"></span><span>Verificando guardado en la nube...</span>";
      document.body.appendChild(badge);
    }
    return badge;
  };

  const setStatus = (ok, message) => {
    lastOk = Boolean(ok);
    const badge = ensureBadge();
    badge.className = ok ? "ok" : "bad";
    badge.innerHTML = "<span class=\"dot\"></span><span>" + escapeHtml(message) + "</span>";
    document.body.classList.toggle("yango-cloud-save-offline", !ok);
    window.dispatchEvent(new CustomEvent("yango:cloud-save-status", { detail: { ok, message } }));
  };

  const check = async () => {
    try {
      const res = await fetch(HEALTH_URL + "?t=" + Date.now(), { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data && data.ok && data.database === "connected") {
        setStatus(true, "Guardado en la nube OK");
      } else {
        const reason = data && data.error ? ": " + String(data.error).slice(0, 80) : "";
        setStatus(false, "No se esta guardando en la nube" + reason);
      }
    } catch (error) {
      setStatus(false, "No se esta guardando en la nube: " + String(error && error.message || error).slice(0, 80));
    }
  };

  const originalFetch = window.fetch ? window.fetch.bind(window) : null;
  if (originalFetch) {
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      try {
        const url = String(args[0] && args[0].url || args[0] || "");
        const method = String(args[1] && args[1].method || "GET").toUpperCase();
        if (/\/api\/state\//.test(url) && ["PUT", "POST", "PATCH"].includes(method)) {
          if (!response.ok) setStatus(false, "No se guardo en la nube (API " + response.status + ")");
          else if (!lastOk) setTimeout(check, 300);
        }
      } catch (_error) {}
      return response;
    };
  }

  setTimeout(check, 600);
  setTimeout(check, 3500);
  setInterval(check, 30000);
})();
