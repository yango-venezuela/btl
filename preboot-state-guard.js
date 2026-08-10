(() => {
  if (typeof window === "undefined" || window.__yangoPrebootStateGuardV7) return;
  window.__yangoPrebootStateGuardV7 = true;

  const COLLECTION_KEY = /(^|[_:\-\s])(qr|qrs|promo|promos|promoCodes|code|codes|result|results|resultado|resultados|activation|activations|activacion|activaciones|calendar|calendario|agency|agencia|proof|proofs|photo|photos|foto|fotos|evidencia|evidencias|report|reports|reporte|reportes|items|rows)([_:\-\s]|$)/i;
  const COLLECTION_HINT = /(qr|promo|result|resultado|activation|activacion|calendar|calendario|agency|agencia|proof|photo|foto|evidencia|report|reporte)/i;
  const DASHBOARD_HINT = /yango|btl|mkt|agency|agencia|proof|photo|foto|evidencia|promotor|flyer|activ|calendar|calendario|acts|qr|promo|code|result|resultado/i;
  const DATE_FIELDS = ["date", "fecha", "calendarDate", "activationDate", "createdAt", "updatedAt"];
  const FALLBACK_DATE = "2026-01-01";

  const text = value => String(value == null ? "" : value);
  const stringify = value => { try { return JSON.stringify(value); } catch (_error) { return String(value); } };
  const isObject = value => value && typeof value === "object" && !Array.isArray(value);
  const isCollectionKey = key => COLLECTION_KEY.test(text(key)) || COLLECTION_HINT.test(text(key));

  function normalizeDate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    if (typeof value === "number" && Number.isFinite(value) && value > 20000 && value < 80000) return new Date(Date.UTC(1899, 11, 30 + value)).toISOString().slice(0, 10);
    const raw = text(value).trim();
    if (!raw || /^(undefined|null|nan)$/i.test(raw)) return "";
    let match = raw.match(/(20\d{2}|19\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (match) return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
    match = raw.match(/(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|19\d{2})/);
    if (match) return `${match[3]}-${String(match[2]).padStart(2, "0")}-${String(match[1]).padStart(2, "0")}`;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
  }

  function normalizeCollections(value, key = "") {
    if (value == null) return isCollectionKey(key) ? [] : value;
    if (Array.isArray(value)) return value.map(item => normalizeCollections(item));
    if (!isObject(value)) return value;
    const next = { ...value };
    Object.keys(next).forEach(childKey => {
      if (next[childKey] == null && isCollectionKey(childKey)) next[childKey] = [];
      else next[childKey] = normalizeCollections(next[childKey], childKey);
    });
    if (DASHBOARD_HINT.test(stringify(next).slice(0, 6000))) {
      const date = normalizeDate(next.date || next.fecha || next.calendarDate || next.activationDate || next.createdAt || next.updatedAt);
      if (date) {
        next.date = text(next.date || date) || date;
        next.fecha = text(next.fecha || date) || date;
        next.calendarDate = text(next.calendarDate || date) || date;
        next.activationDate = text(next.activationDate || date) || date;
        next.createdAt = text(next.createdAt || date) || date;
        next.updatedAt = text(next.updatedAt || date) || date;
      }
    }
    return next;
  }

  function parse(value, key = "") {
    try { return normalizeCollections(JSON.parse(value), key); } catch (_error) { return null; }
  }

  function sanitizeStoredString(key, raw) {
    if (!DASHBOARD_HINT.test(text(key)) && !isCollectionKey(key)) return raw;
    if (raw == null || raw === "null" || raw === "undefined") return isCollectionKey(key) ? "[]" : raw;
    const parsed = parse(raw, key);
    if (parsed == null) return raw;
    return stringify(parsed);
  }

  function sanitizeLocalStorage() {
    try {
      const keys = [];
      for (let index = 0; index < localStorage.length; index += 1) keys.push(localStorage.key(index));
      keys.filter(Boolean).forEach(key => {
        const raw = localStorage.getItem(key);
        const clean = sanitizeStoredString(key, raw);
        if (clean !== raw && clean != null) localStorage.setItem(key, clean);
      });
    } catch (_error) {}
  }

  try {
    const originalGetItem = Storage && Storage.prototype && Storage.prototype.getItem;
    const originalSetItem = Storage && Storage.prototype && Storage.prototype.setItem;
    if (originalGetItem && !Storage.prototype.__yangoSafeGetItemV7) {
      Object.defineProperty(Storage.prototype, "__yangoSafeGetItemV7", { value: true, configurable: true });
      Storage.prototype.getItem = function safeGetItem(key) {
        const raw = originalGetItem.call(this, key);
        return sanitizeStoredString(key, raw);
      };
    }
    if (originalSetItem && !Storage.prototype.__yangoSafeSetItemV7) {
      Object.defineProperty(Storage.prototype, "__yangoSafeSetItemV7", { value: true, configurable: true });
      Storage.prototype.setItem = function safeSetItem(key, value) {
        return originalSetItem.call(this, key, sanitizeStoredString(key, value));
      };
    }
  } catch (_error) {}

  try {
    const originalParse = JSON.parse;
    if (originalParse && !JSON.__yangoSafeParseV7) {
      Object.defineProperty(JSON, "__yangoSafeParseV7", { value: true, configurable: true });
      JSON.parse = function safeJsonParse(value, reviver) {
        return normalizeCollections(originalParse.call(JSON, value, reviver));
      };
    }
  } catch (_error) {}

  const comparable = item => {
    const obj = isObject(item) ? normalizeCollections(item) : {};
    const date = DATE_FIELDS.map(field => normalizeDate(obj[field])).find(Boolean) || FALLBACK_DATE;
    const name = text(obj.name || obj.nombre || obj.title || obj.titulo || obj.location || obj.ubicacion || "");
    return { date, name };
  };

  try {
    const originalSort = Array.prototype.sort;
    if (originalSort && !Array.prototype.__yangoSafeSortV7) {
      Object.defineProperty(Array.prototype, "__yangoSafeSortV7", { value: true, configurable: true });
      Array.prototype.sort = function safeSort(compareFn) {
        try { return originalSort.call(this, compareFn); }
        catch (error) {
          const message = text(error && error.message);
          if (!/localeCompare|date|undefined|null/i.test(message)) throw error;
          for (let index = 0; index < this.length; index += 1) this[index] = normalizeCollections(this[index]);
          return originalSort.call(this, (a, b) => {
            const aa = comparable(a), bb = comparable(b);
            return bb.date.localeCompare(aa.date) || aa.name.localeCompare(bb.name);
          });
        }
      };
    }
  } catch (_error) {}

  try {
    const originalFetch = window.fetch && window.fetch.bind(window);
    if (originalFetch && !window.__yangoSafeFetchV7) {
      window.__yangoSafeFetchV7 = true;
      window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        try {
          const url = text(args[0] && args[0].url || args[0]);
          if (!/\/api\/state(?:\?|$|\/)/.test(url)) return response;
          const payload = await response.clone().json();
          if (payload && typeof payload === "object") {
            if (payload.values && typeof payload.values === "object") {
              Object.keys(payload.values).forEach(key => {
                payload.values[key] = normalizeCollections(payload.values[key], key);
              });
            }
            if (Object.prototype.hasOwnProperty.call(payload, "value")) payload.value = normalizeCollections(payload.value, "value");
            return new Response(JSON.stringify(payload), { status: response.status, statusText: response.statusText, headers: response.headers });
          }
        } catch (_error) {}
        return response;
      };
    }
  } catch (_error) {}

  function recoverFromErrorScreen() {
    try {
      const body = document.body && document.body.innerText ? document.body.innerText : "";
      if (!/Algo salió mal/i.test(body)) return;
      if (!/qr\.reduce|reading 'reduce'|localeCompare|date|undefined|null/i.test(body)) return;
      const attempts = Number(sessionStorage.getItem("yango_preboot_recovery_attempts") || "0");
      if (attempts >= 2) return;
      sessionStorage.setItem("yango_preboot_recovery_attempts", String(attempts + 1));
      sanitizeLocalStorage();
      setTimeout(() => window.location.reload(), 350);
    } catch (_error) {}
  }

  sanitizeLocalStorage();
  window.addEventListener("error", event => {
    if (/qr\.reduce|reading 'reduce'|localeCompare|date|undefined|null/i.test(text(event && event.message))) sanitizeLocalStorage();
  }, true);
  window.addEventListener("unhandledrejection", event => {
    const reason = event && event.reason;
    if (/qr\.reduce|reading 'reduce'|localeCompare|date|undefined|null/i.test(text(reason && reason.message || reason))) sanitizeLocalStorage();
  }, true);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", recoverFromErrorScreen);
  else recoverFromErrorScreen();
  try { new MutationObserver(recoverFromErrorScreen).observe(document.documentElement, { childList: true, subtree: true }); } catch (_error) {}
})();