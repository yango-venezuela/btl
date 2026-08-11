(() => {
  if (typeof window === "undefined" || window.__yangoPrebootStateGuardV8) return;
  window.__yangoPrebootStateGuardV8 = true;

  const COLLECTION_KEY = /(^|[_:\-\s])(qr|qrs|promo|promos|promoCodes|code|codes|result|results|resultado|resultados|activation|activations|activacion|activaciones|calendar|calendario|agency|agencia|proof|proofs|photo|photos|foto|fotos|evidencia|evidencias|report|reports|reporte|reportes|items|rows)([_:\-\s]|$)/i;
  const COLLECTION_HINT = /(qr|promo|result|resultado|activation|activacion|calendar|calendario|agency|agencia|proof|photo|foto|evidencia|report|reporte)/i;
  const DASHBOARD_HINT = /yango|btl|mkt|agency|agencia|proof|photo|foto|evidencia|promotor|flyer|activ|calendar|calendario|acts|qr|promo|code|result|resultado/i;
  const DATE_FIELDS = ["date", "fecha", "calendarDate", "activationDate", "createdAt", "updatedAt"];
  const FALLBACK_DATE = "2026-01-01";
  const RETIRED_KEY = /samsung|raffle|rifa/i;
  const RETIRED_TEXT = /rifa samsung|samsung raffle|raffle samsung|\brifa\b|samsung/i;
  const PANEL_HINT = /(?:[?&](?:panel|usuario|user|role|rol)=|\/)(luis|giselle|gise|agency|agencia|panel|usuario|user|role|rol)(?:[/?&#]|$)/i;

  const text = value => String(value == null ? "" : value);
  const stringify = value => { try { return JSON.stringify(value); } catch (_error) { return String(value); } };
  const isObject = value => value && typeof value === "object" && !Array.isArray(value);
  const isCollectionKey = key => COLLECTION_KEY.test(text(key)) || COLLECTION_HINT.test(text(key));
  const isCollaboratorPanel = () => PANEL_HINT.test(window.location.href || "");

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
    if (RETIRED_KEY.test(text(key))) return "[]";
    if (!DASHBOARD_HINT.test(text(key)) && !isCollectionKey(key)) return raw;
    if (raw == null || raw === "null" || raw === "undefined") return isCollectionKey(key) ? "[]" : raw;
    const parsed = parse(raw, key);
    if (parsed == null) return raw;
    return stringify(parsed);
  }

  function storageKeys() {
    const keys = [];
    try {
      for (let index = 0; index < localStorage.length; index += 1) keys.push(localStorage.key(index));
    } catch (_error) {}
    return keys.filter(Boolean);
  }

  function cleanRetiredStorage() {
    try {
      storageKeys().forEach(key => { if (RETIRED_KEY.test(key)) localStorage.removeItem(key); });
    } catch (_error) {}
  }

  function sanitizeLocalStorage() {
    try {
      storageKeys().forEach(key => {
        if (RETIRED_KEY.test(key)) {
          localStorage.removeItem(key);
          return;
        }
        const raw = localStorage.getItem(key);
        const clean = sanitizeStoredString(key, raw);
        if (clean !== raw && clean != null) localStorage.setItem(key, clean);
      });
    } catch (_error) {}
  }

  function hideRetiredUi() {
    try {
      const nodes = Array.from(document.querySelectorAll("button,a,[role='button'],li,nav div,aside div,section,h1,h2,h3,h4,span,p"));
      nodes.forEach(node => {
        const label = text(node.textContent).replace(/\s+/g, " ").trim();
        if (!label || !RETIRED_TEXT.test(label)) return;
        const target = node.closest("button,a,li,[role='button'],section") || node;
        target.style.setProperty("display", "none", "important");
        target.setAttribute("aria-hidden", "true");
      });
    } catch (_error) {}
  }

  function dispatchSharedEvents(keys, changed) {
    try { window.dispatchEvent(new CustomEvent("yango:shared-state-hydrated", { detail: { keys, mirror: true, changed } })); } catch (_error) {}
    try { window.dispatchEvent(new CustomEvent("yango:collaborator-mirror-hydrated", { detail: { keys, changed } })); } catch (_error) {}
    keys.forEach(key => {
      try { window.dispatchEvent(new StorageEvent("storage", { key, newValue: localStorage.getItem(key), storageArea: localStorage })); } catch (_error) {}
    });
  }

  async function hydrateCollaboratorMirror() {
    if (!isCollaboratorPanel() || !window.fetch || window.location.protocol === "file:") return;
    if (window.__yangoCollaboratorMirrorRunning) return;
    window.__yangoCollaboratorMirrorRunning = true;
    window.__yangoCollaboratorMirrorPending = true;
    try {
      cleanRetiredStorage();
      const response = await window.fetch(`/api/state?mirror=1&t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json();
      const values = payload && payload.values && typeof payload.values === "object" ? payload.values : {};
      const keys = Object.keys(values).filter(key => !RETIRED_KEY.test(key));
      let changed = false;
      keys.forEach(key => {
        const value = normalizeCollections(values[key], key);
        const next = stringify(value);
        if (localStorage.getItem(key) !== next) {
          localStorage.setItem(key, next);
          changed = true;
        }
      });
      cleanRetiredStorage();
      dispatchSharedEvents(keys, changed);
      if (changed && !sessionStorage.getItem("yango_collaborator_mirror_reloaded")) {
        sessionStorage.setItem("yango_collaborator_mirror_reloaded", "1");
        setTimeout(() => window.location.reload(), 80);
      }
    } catch (_error) {
      // If the network is momentarily down, the normal sync script will retry after boot.
    } finally {
      window.__yangoCollaboratorMirrorPending = false;
      window.__yangoCollaboratorMirrorRunning = false;
    }
  }

  try {
    const originalGetItem = Storage && Storage.prototype && Storage.prototype.getItem;
    const originalSetItem = Storage && Storage.prototype && Storage.prototype.setItem;
    if (originalGetItem && !Storage.prototype.__yangoSafeGetItemV8) {
      Object.defineProperty(Storage.prototype, "__yangoSafeGetItemV8", { value: true, configurable: true });
      Storage.prototype.getItem = function safeGetItem(key) {
        const raw = originalGetItem.call(this, key);
        return sanitizeStoredString(key, raw);
      };
    }
    if (originalSetItem && !Storage.prototype.__yangoSafeSetItemV8) {
      Object.defineProperty(Storage.prototype, "__yangoSafeSetItemV8", { value: true, configurable: true });
      Storage.prototype.setItem = function safeSetItem(key, value) {
        if (RETIRED_KEY.test(text(key))) return originalSetItem.call(this, key, "[]");
        return originalSetItem.call(this, key, sanitizeStoredString(key, value));
      };
    }
  } catch (_error) {}

  try {
    const originalParse = JSON.parse;
    if (originalParse && !JSON.__yangoSafeParseV8) {
      Object.defineProperty(JSON, "__yangoSafeParseV8", { value: true, configurable: true });
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
    if (originalSort && !Array.prototype.__yangoSafeSortV8) {
      Object.defineProperty(Array.prototype, "__yangoSafeSortV8", { value: true, configurable: true });
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
    if (originalFetch && !window.__yangoSafeFetchV8) {
      window.__yangoSafeFetchV8 = true;
      window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        try {
          const url = text(args[0] && args[0].url || args[0]);
          if (!/\/api\/state(?:\?|$|\/)/.test(url)) return response;
          const payload = await response.clone().json();
          if (payload && typeof payload === "object") {
            if (payload.values && typeof payload.values === "object") {
              Object.keys(payload.values).forEach(key => {
                if (RETIRED_KEY.test(key)) delete payload.values[key];
                else payload.values[key] = normalizeCollections(payload.values[key], key);
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
      hideRetiredUi();
      const body = document.body && document.body.innerText ? document.body.innerText : "";
      if (!/Algo salió mal/i.test(body)) return;
      if (!/qr\.reduce|reading 'reduce'|localeCompare|date|undefined|null/i.test(body)) return;
      const attempts = Number(sessionStorage.getItem("yango_preboot_recovery_attempts") || "0");
      if (attempts >= 2) return;
      sessionStorage.setItem("yango_preboot_recovery_attempts", String(attempts + 1));
      sanitizeLocalStorage();
      if (isCollaboratorPanel()) hydrateCollaboratorMirror();
      setTimeout(() => window.location.reload(), 350);
    } catch (_error) {}
  }

  cleanRetiredStorage();
  sanitizeLocalStorage();
  if (isCollaboratorPanel()) {
    window.__yangoCollaboratorPanel = true;
    hydrateCollaboratorMirror();
  }
  window.addEventListener("error", event => {
    if (/qr\.reduce|reading 'reduce'|localeCompare|date|undefined|null/i.test(text(event && event.message))) sanitizeLocalStorage();
  }, true);
  window.addEventListener("unhandledrejection", event => {
    const reason = event && event.reason;
    if (/qr\.reduce|reading 'reduce'|localeCompare|date|undefined|null/i.test(text(reason && reason.message || reason))) sanitizeLocalStorage();
  }, true);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", recoverFromErrorScreen);
  else recoverFromErrorScreen();
  try { new MutationObserver(() => { hideRetiredUi(); recoverFromErrorScreen(); }).observe(document.documentElement, { childList: true, subtree: true }); } catch (_error) {}
  setTimeout(hideRetiredUi, 300);
  setTimeout(hideRetiredUi, 1500);
})();