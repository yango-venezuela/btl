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

(() => {
  if (typeof window === "undefined" || window.__yangoDashboardStateSanitizerV1) return;
  window.__yangoDashboardStateSanitizerV1 = true;

  const INFLUENCER_KEY = "yango_influencers_h1";
  const ACTIVATION_KEY_HINTS = /activations|activaciones|calendar|calendario|btl_acts/i;
  const ALLOWED_DELIVERABLES = new Map(["Stories", "Reel", "Post", "TikTok", "Live"].map(value => [value.toLowerCase(), value]));
  const VALID_STATUSES = new Set(["planned", "done", "missed", "cancelled", "canceled", "pending", "completed", "active", "paused"]);

  const stableText = value => {
    try { return JSON.stringify(value); } catch (_error) { return String(value); }
  };

  const parseJson = value => {
    try { return JSON.parse(value); } catch (_error) { return null; }
  };

  const normalizeText = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const normalizeDeliverables = value => {
    const raw = Array.isArray(value) ? value : String(value || "").split("+");
    const output = [];
    raw.forEach(item => {
      const text = String(item || "").trim();
      if (!text) return;
      const canonical = ALLOWED_DELIVERABLES.get(text.toLowerCase()) || text;
      if (!output.some(existing => String(existing).toLowerCase() === String(canonical).toLowerCase())) output.push(canonical);
    });
    return output.length ? output : ["Stories"];
  };

  const influencerId = item => normalizeText(item && (item.id || item.name || item.nombre || item.handle || item.igUsername || item.instagram || item.tiktokUsername));

  const sanitizeInfluencers = value => {
    if (!Array.isArray(value)) return value;
    const map = new Map();
    value.forEach(item => {
      if (!item || typeof item !== "object") return;
      const id = influencerId(item);
      if (!id) return;
      const next = { ...item, deliverables: normalizeDeliverables(item.deliverables || item.entregables) };
      const current = map.get(id);
      if (!current || stableText(next).length >= stableText(current).length) map.set(id, next);
    });
    return Array.from(map.values());
  };

  const looksLikeActivation = item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const sample = normalizeText([item.title, item.name, item.location, item.zone, item.zona, item.type, item.tipo, item.date, item.fecha, item.calendarDate].join(" "));
    return /activacion|activation|petare|sabana|centro|este|oeste|norte|sur|flyer|cafe|helado|universidad|evento/.test(sample);
  };

  const normalizeStatus = status => {
    const text = normalizeText(status);
    if (VALID_STATUSES.has(text)) return text;
    if (/se dio|hecha|realizada|done|complete|completed|aprob|valid/.test(text)) return "done";
    if (/no se dio|cancel|missed|paus|pausa/.test(text)) return "missed";
    return "planned";
  };

  const sanitizeActivationItem = item => looksLikeActivation(item) ? { ...item, status: normalizeStatus(item.status || item.estado) } : item;

  const sanitizeActivations = value => {
    if (Array.isArray(value)) return value.map(sanitizeActivationItem);
    if (!value || typeof value !== "object") return value;
    let changed = false;
    const next = { ...value };
    Object.keys(next).forEach(key => {
      if (Array.isArray(next[key]) && next[key].some(looksLikeActivation)) {
        next[key] = next[key].map(sanitizeActivationItem);
        changed = true;
      }
    });
    return changed ? next : value;
  };

  const sanitizeByKey = (key, value) => {
    if (key === INFLUENCER_KEY || /influ/i.test(key)) return sanitizeInfluencers(value);
    if (ACTIVATION_KEY_HINTS.test(key)) return sanitizeActivations(value);
    return value;
  };

  const putState = async (key, value) => {
    const res = await fetch(`/api/state/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value })
    });
    return res.ok;
  };

  const sanitizeLocalStorage = async () => {
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) keys.push(localStorage.key(index));
    for (const key of keys.filter(Boolean)) {
      if (!/yango|btl|mkt|activ|calendar|calendario|influ/i.test(key)) continue;
      const parsed = parseJson(localStorage.getItem(key));
      if (parsed == null) continue;
      const cleaned = sanitizeByKey(key, parsed);
      if (stableText(cleaned) !== stableText(parsed)) {
        localStorage.setItem(key, stableText(cleaned));
        if (/yango_|btl_|mkt_/i.test(key)) await putState(key, cleaned);
      }
    }
  };

  const sanitizeRemoteState = async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) return;
      const payload = await res.json();
      const values = payload && payload.values || {};
      for (const [key, value] of Object.entries(values)) {
        const cleaned = sanitizeByKey(key, value);
        if (stableText(cleaned) !== stableText(value)) await putState(key, cleaned);
      }
    } catch (error) {
      console.warn("No pude limpiar el estado compartido:", error);
    }
  };

  const run = async () => {
    await sanitizeLocalStorage();
    await sanitizeRemoteState();
    await sanitizeLocalStorage();
    window.dispatchEvent(new CustomEvent("yango:state-sanitized"));
  };

  setTimeout(run, 300);
  setTimeout(run, 2000);
  setInterval(run, 45000);
})();
