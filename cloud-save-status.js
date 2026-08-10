(() => {
  if (typeof window === "undefined" || window.__yangoCloudSaveAndStateGuardV4) return;
  window.__yangoCloudSaveAndStateGuardV4 = true;

  const STATUS_ID = "yango-cloud-save-status";
  const STYLE_ID = "yango-cloud-save-status-style";
  const HEALTH_URL = "/api/health";
  const RELOAD_MARKER = "yango_locale_compare_guard_reloaded_v4";
  let lastOk = false;

  const escapeHtml = value => String(value || "").replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char] || char));
  const stableStringify = value => {
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
  const normalizeCompact = value => normalizeText(value).replace(/[^a-z0-9]+/g, "");

  const VALID_TYPES = new Map([
    ["flyers", "Flyers"], ["flyer", "Flyers"],
    ["cafe", "Café"], ["café", "Café"],
    ["helados", "Helados"], ["helado", "Helados"],
    ["materialpop", "Material POP"], ["material pop", "Material POP"], ["pop", "Material POP"],
    ["universidad", "Universidad"], ["universidades", "Universidad"],
    ["evento", "Evento"], ["eventos", "Evento"]
  ]);
  const VALID_STATUSES = new Set(["planned", "done", "missed", "cancelled", "canceled", "pending", "completed", "active", "paused"]);

  const normalizeDate = value => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    if (typeof value === "number" && Number.isFinite(value)) {
      if (value > 20000 && value < 80000) return new Date(Date.UTC(1899, 11, 30 + value)).toISOString().slice(0, 10);
      return "";
    }
    const raw = String(value || "").trim();
    if (!raw) return "";
    const iso = raw.match(/(20\d{2}|19\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`;
    const local = raw.match(/(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|19\d{2})/);
    if (local) return `${local[3]}-${String(local[2]).padStart(2, "0")}-${String(local[1]).padStart(2, "0")}`;
    const yearless = raw.match(/(?:^|[^\d])(\d{1,2})[-/.](\d{1,2})(?![-/.]\d)/);
    if (yearless) return `2026-${String(yearless[2]).padStart(2, "0")}-${String(yearless[1]).padStart(2, "0")}`;
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    return "";
  };

  const normalizeStatus = status => {
    const text = normalizeText(status);
    if (VALID_STATUSES.has(text)) return text;
    if (/se dio|hecha|realizada|done|complete|completed|aprob|valid/.test(text)) return "done";
    if (/no se dio|cancel|missed|paus|pausa/.test(text)) return "missed";
    return "planned";
  };

  const normalizeType = type => {
    const text = normalizeText(type);
    const compact = normalizeCompact(type);
    return VALID_TYPES.get(text) || VALID_TYPES.get(compact) || "Flyers";
  };

  const looksRelevantKey = key => /yango|btl|mkt|agency|agencia|proof|photo|foto|evidencia|promotor|flyer|activ|calendar|calendario|acts/i.test(String(key || ""));
  const looksRelevantObject = value => {
    if (!value || typeof value !== "object") return false;
    const sample = stableStringify(value).slice(0, 4000);
    return /activacion|activation|agencia|agency|promotora|promotoras|foto|fotos|photo|photos|evidencia|proof|flyers|petare|sabana|centro|chacaito|altamira|hoyada|junquito|montalban|vega|calendario|calendar/i.test(sample);
  };

  const asString = value => value == null ? "" : String(value);

  const scrubItem = (item, forceRelevant = false) => {
    if (Array.isArray(item)) return item.map(child => scrubItem(child, forceRelevant || looksRelevantObject(child)));
    if (!item || typeof item !== "object") return item;

    const relevant = forceRelevant || looksRelevantObject(item);
    const next = { ...item };
    Object.keys(next).forEach(key => {
      if (next[key] && typeof next[key] === "object") next[key] = scrubItem(next[key], relevant || looksRelevantKey(key));
    });

    if (relevant) {
      const date = normalizeDate(next.date || next.fecha || next.calendarDate || next.activationDate || next.createdAt || next.updatedAt) || "2026-01-01";
      next.date = date;
      if (!next.fecha) next.fecha = date;
      next.name = asString(next.name || next.nombre || next.title || next.titulo || next.location || next.ubicacion || "");
      next.nombre = asString(next.nombre || next.name);
      next.title = asString(next.title || next.titulo || next.name || next.nombre);
      next.titulo = asString(next.titulo || next.title);
      next.location = asString(next.location || next.ubicacion || next.zone || next.zona || "");
      next.ubicacion = asString(next.ubicacion || next.location);
      next.zone = asString(next.zone || next.zona || next.location);
      next.zona = asString(next.zona || next.zone);
      next.type = normalizeType(next.type || next.tipo || next.activationType || next.tipoActivacion);
      next.tipo = normalizeType(next.tipo || next.type || next.activationType || next.tipoActivacion);
      next.status = normalizeStatus(next.status || next.estado);
      next.estado = asString(next.estado || next.status);
    }

    return next;
  };

  const sanitizeValue = (key, value) => {
    if (!looksRelevantKey(key) && !looksRelevantObject(value)) return value;
    return scrubItem(value, true);
  };

  const sanitizeLocalStorage = () => {
    const changed = [];
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) keys.push(localStorage.key(index));
    keys.filter(Boolean).forEach(key => {
      if (!looksRelevantKey(key)) return;
      const parsed = parseJson(localStorage.getItem(key));
      if (parsed == null) return;
      const cleaned = sanitizeValue(key, parsed);
      const before = stableStringify(parsed);
      const after = stableStringify(cleaned);
      if (before !== after) {
        localStorage.setItem(key, after);
        changed.push({ key, value: cleaned });
      }
    });
    return changed;
  };

  const putState = async (key, value) => {
    try {
      const response = await fetch(`/api/state/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value })
      });
      return response.ok;
    } catch (_error) {
      return false;
    }
  };

  const sanitizeRemoteState = async () => {
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json();
      const values = payload && payload.values || {};
      for (const [key, value] of Object.entries(values)) {
        const cleaned = sanitizeValue(key, value);
        if (stableStringify(cleaned) !== stableStringify(value)) await putState(key, cleaned);
      }
    } catch (error) {
      console.warn("No pude limpiar estado remoto:", error);
    }
  };

  const syncCleanups = async () => {
    const changed = sanitizeLocalStorage();
    for (const entry of changed) {
      if (/^yango_|^btl_|^mkt_/i.test(entry.key)) await putState(entry.key, entry.value);
    }
  };

  const recoverFromLocaleCompare = async error => {
    const message = String(error && (error.message || error.reason && error.reason.message || error.reason) || error || "");
    if (!/localeCompare|Cannot read properties of undefined|undefined is not an object/i.test(message)) return;
    sanitizeLocalStorage();
    await sanitizeRemoteState();
    sanitizeLocalStorage();
    if (!sessionStorage.getItem(RELOAD_MARKER)) {
      sessionStorage.setItem(RELOAD_MARKER, "1");
      window.location.reload();
    }
  };

  window.addEventListener("error", event => recoverFromLocaleCompare(event.error || event.message));
  window.addEventListener("unhandledrejection", event => recoverFromLocaleCompare(event.reason));

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
      if (res.ok && data && data.ok && data.database === "connected") setStatus(true, "Guardado en la nube OK");
      else setStatus(false, "No se esta guardando en la nube" + (data && data.error ? ": " + String(data.error).slice(0, 80) : ""));
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

  sanitizeLocalStorage();
  setTimeout(syncCleanups, 150);
  setTimeout(syncCleanups, 1000);
  setTimeout(sanitizeRemoteState, 1800);
  setTimeout(syncCleanups, 3200);
  setInterval(syncCleanups, 30000);
  setTimeout(check, 600);
  setTimeout(check, 3500);
  setInterval(check, 30000);
})();
