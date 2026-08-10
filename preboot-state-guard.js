(() => {
  if (typeof window === "undefined" || window.__yangoPrebootStateGuardV5) return;
  window.__yangoPrebootStateGuardV5 = true;

  const RELEVANT_KEY = /yango|btl|mkt|agency|agencia|proof|photo|foto|evidencia|promotor|flyer|activ|calendar|calendario|acts/i;
  const RELEVANT_VALUE = /activacion|activation|agencia|agency|promotora|promotoras|foto|fotos|photo|photos|evidencia|proof|flyers|petare|sabana|centro|chacaito|altamira|hoyada|junquito|montalban|montalbán|vega|calendario|calendar/i;
  const SORTABLE_FIELDS = ["date", "fecha", "calendarDate", "activationDate", "createdAt", "updatedAt", "name", "nombre", "title", "titulo", "location", "ubicacion", "zone", "zona", "type", "tipo", "status", "estado"];
  const VALID_STATUSES = new Set(["planned", "done", "missed", "cancelled", "canceled", "pending", "completed", "active", "paused"]);
  const VALID_TYPES = new Map([
    ["flyers", "Flyers"], ["flyer", "Flyers"],
    ["cafe", "Café"], ["café", "Café"],
    ["helados", "Helados"], ["helado", "Helados"],
    ["materialpop", "Material POP"], ["material pop", "Material POP"], ["pop", "Material POP"],
    ["universidad", "Universidad"], ["universidades", "Universidad"],
    ["evento", "Evento"], ["eventos", "Evento"]
  ]);

  const FALLBACK_DATE = "2026-01-01";
  const stringify = value => { try { return JSON.stringify(value); } catch (_error) { return String(value); } };
  const parseJson = value => { try { return JSON.parse(value); } catch (_error) { return null; } };
  const text = value => String(value == null ? "" : value);
  const norm = value => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const compact = value => norm(value).replace(/[^a-z0-9]+/g, "");
  const isObject = value => value && typeof value === "object" && !Array.isArray(value);

  const normalizeDate = value => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    if (typeof value === "number" && Number.isFinite(value)) {
      if (value > 20000 && value < 80000) return new Date(Date.UTC(1899, 11, 30 + value)).toISOString().slice(0, 10);
      return "";
    }
    const raw = text(value).trim();
    if (!raw || /^(undefined|null|nan)$/i.test(raw)) return "";
    const iso = raw.match(/(20\d{2}|19\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`;
    const local = raw.match(/(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|19\d{2})/);
    if (local) return `${local[3]}-${String(local[2]).padStart(2, "0")}-${String(local[1]).padStart(2, "0")}`;
    const yearless = raw.match(/(?:^|[^\d])(\d{1,2})[-/.](\d{1,2})(?![-/.]\d)/);
    if (yearless) return `2026-${String(yearless[2]).padStart(2, "0")}-${String(yearless[1]).padStart(2, "0")}`;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
  };

  const normalizeType = value => VALID_TYPES.get(norm(value)) || VALID_TYPES.get(compact(value)) || "Flyers";
  const normalizeStatus = value => {
    const current = norm(value);
    if (VALID_STATUSES.has(current)) return current;
    if (/se dio|hecha|realizada|done|complete|completed|aprob|valid/.test(current)) return "done";
    if (/no se dio|cancel|missed|paus|pausa/.test(current)) return "missed";
    return "planned";
  };

  const relevantValue = value => value && typeof value === "object" && RELEVANT_VALUE.test(stringify(value).slice(0, 8000));
  const looksSortableDashboardItem = item => isObject(item) && (SORTABLE_FIELDS.some(field => Object.prototype.hasOwnProperty.call(item, field)) || relevantValue(item));
  const firstDate = item => normalizeDate(item && (item.date ?? item.fecha ?? item.calendarDate ?? item.activationDate ?? item.createdAt ?? item.updatedAt));

  const scrub = (value, forced = false) => {
    if (Array.isArray(value)) return value.map(item => scrub(item, forced || relevantValue(item))).filter(item => item != null);
    if (!isObject(value)) return value;
    const relevant = forced || relevantValue(value) || looksSortableDashboardItem(value);
    const next = { ...value };
    Object.keys(next).forEach(key => {
      if (next[key] && typeof next[key] === "object") next[key] = scrub(next[key], relevant || RELEVANT_KEY.test(key));
    });
    if (!relevant) return next;
    const date = firstDate(next) || FALLBACK_DATE;
    next.date = date;
    next.fecha = text(next.fecha || date) || date;
    next.calendarDate = text(next.calendarDate || date) || date;
    next.activationDate = text(next.activationDate || date) || date;
    next.createdAt = text(next.createdAt || date) || date;
    next.updatedAt = text(next.updatedAt || date) || date;
    next.name = text(next.name || next.nombre || next.title || next.titulo || next.location || next.ubicacion || "Sin nombre") || "Sin nombre";
    next.nombre = text(next.nombre || next.name) || next.name;
    next.title = text(next.title || next.titulo || next.name) || next.name;
    next.titulo = text(next.titulo || next.title) || next.title;
    next.location = text(next.location || next.ubicacion || next.zone || next.zona || "");
    next.ubicacion = text(next.ubicacion || next.location);
    next.zone = text(next.zone || next.zona || next.location);
    next.zona = text(next.zona || next.zone);
    next.type = normalizeType(next.type || next.tipo || next.activationType || next.tipoActivacion);
    next.tipo = normalizeType(next.tipo || next.type || next.activationType || next.tipoActivacion);
    next.status = normalizeStatus(next.status || next.estado);
    next.estado = text(next.estado || next.status) || next.status;
    return next;
  };

  const sanitizeStateValues = values => {
    if (!values || typeof values !== "object") return values;
    const next = { ...values };
    Object.keys(next).forEach(key => {
      if (RELEVANT_KEY.test(key) || relevantValue(next[key])) next[key] = scrub(next[key], true);
    });
    return next;
  };

  const sanitizeLocalStorage = () => {
    try {
      const keys = [];
      for (let index = 0; index < localStorage.length; index += 1) keys.push(localStorage.key(index));
      keys.filter(Boolean).forEach(key => {
        if (!RELEVANT_KEY.test(key)) return;
        const parsed = parseJson(localStorage.getItem(key));
        if (parsed == null) return;
        const cleaned = scrub(parsed, true);
        if (stringify(cleaned) !== stringify(parsed)) localStorage.setItem(key, stringify(cleaned));
      });
    } catch (_error) {}
  };

  const safeComparable = item => {
    const clean = isObject(item) ? scrub(item, true) : { date: FALLBACK_DATE, name: text(item) };
    return {
      date: normalizeDate(clean.date || clean.fecha || clean.calendarDate || clean.activationDate || clean.createdAt || clean.updatedAt) || FALLBACK_DATE,
      name: text(clean.name || clean.nombre || clean.title || clean.titulo || clean.location || clean.ubicacion || "")
    };
  };
  const safeDateSort = (a, b) => {
    const aa = safeComparable(a);
    const bb = safeComparable(b);
    return bb.date.localeCompare(aa.date) || aa.name.localeCompare(bb.name);
  };
  const isDashboardArray = array => {
    try { return array && array.length && Array.prototype.some.call(array, item => !item || looksSortableDashboardItem(item) || relevantValue(item)); }
    catch (_error) { return false; }
  };
  const scrubArrayInPlace = array => {
    try {
      for (let index = 0; index < array.length; index += 1) {
        const item = array[index];
        array[index] = isObject(item) ? scrub(item, true) : item;
      }
    } catch (_error) {}
    return array;
  };

  sanitizeLocalStorage();

  try {
    const originalSetItem = Storage && Storage.prototype && Storage.prototype.setItem;
    if (originalSetItem && !Storage.prototype.__yangoSafeSetItemV5) {
      Object.defineProperty(Storage.prototype, "__yangoSafeSetItemV5", { value: true, configurable: true });
      Storage.prototype.setItem = function safeSetItem(key, value) {
        if (RELEVANT_KEY.test(String(key || ""))) {
          const parsed = parseJson(value);
          if (parsed != null) return originalSetItem.call(this, key, stringify(scrub(parsed, true)));
        }
        return originalSetItem.call(this, key, value);
      };
    }
  } catch (_error) {}

  const originalSort = Array.prototype.sort;
  if (originalSort && !Array.prototype.__yangoSafeDashboardSortV5) {
    Object.defineProperty(Array.prototype, "__yangoSafeDashboardSortV5", { value: true, configurable: true });
    Array.prototype.sort = function safeDashboardSort(compareFn) {
      const dashboardArray = isDashboardArray(this);
      try {
        if (dashboardArray) scrubArrayInPlace(this);
        return originalSort.call(this, compareFn);
      } catch (error) {
        const message = text(error && error.message);
        if (dashboardArray || /localeCompare|Cannot read properties of undefined|undefined is not an object|reading 'date'|evaluating 'b\.date\.localeCompare'/.test(message)) {
          scrubArrayInPlace(this);
          try { return originalSort.call(this, safeDateSort); } catch (_safeError) { return originalSort.call(this); }
        }
        throw error;
      }
    };
  }

  const originalToSorted = Array.prototype.toSorted;
  if (originalToSorted && !Array.prototype.__yangoSafeDashboardToSortedV5) {
    Object.defineProperty(Array.prototype, "__yangoSafeDashboardToSortedV5", { value: true, configurable: true });
    Array.prototype.toSorted = function safeDashboardToSorted(compareFn) {
      const copy = Array.from(this || []);
      try {
        if (isDashboardArray(copy)) scrubArrayInPlace(copy);
        return originalSort.call(copy, compareFn);
      } catch (error) {
        const message = text(error && error.message);
        if (isDashboardArray(copy) || /localeCompare|Cannot read properties of undefined|undefined is not an object|reading 'date'|evaluating 'b\.date\.localeCompare'/.test(message)) {
          scrubArrayInPlace(copy);
          try { return originalSort.call(copy, safeDateSort); } catch (_safeError) { return originalSort.call(copy); }
        }
        throw error;
      }
    };
  }

  const originalFetch = window.fetch && window.fetch.bind(window);
  if (originalFetch && !window.__yangoSafeFetchV5) {
    window.__yangoSafeFetchV5 = true;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      try {
        const url = String(args[0] && args[0].url || args[0] || "");
        if (!/\/api\/state(?:\?|$|\/)/.test(url)) return response;
        const clone = response.clone();
        const payload = await clone.json();
        if (!payload || typeof payload !== "object") return response;
        if (payload.values) payload.values = sanitizeStateValues(payload.values);
        if (payload.value) payload.value = scrub(payload.value, true);
        return new Response(JSON.stringify(payload), { status: response.status, statusText: response.statusText, headers: response.headers });
      } catch (_error) {
        return response;
      }
    };
  }

  const recoverFromErrorScreen = () => {
    try {
      const body = document.body && document.body.innerText ? document.body.innerText : "";
      if (!/Algo salió mal/i.test(body)) return;
      if (!/localeCompare|reading 'date'|evaluating 'b\.date|Cannot read properties of undefined|undefined is not an object/i.test(body)) return;
      const attempts = Number(sessionStorage.getItem("yango_date_recovery_attempts") || "0");
      if (attempts >= 1) return;
      sessionStorage.setItem("yango_date_recovery_attempts", String(attempts + 1));
      sanitizeLocalStorage();
      setTimeout(() => window.location.reload(), 350);
    } catch (_error) {}
  };

  window.addEventListener("error", event => {
    if (/localeCompare|reading 'date'|evaluating 'b\.date|Cannot read properties of undefined|undefined is not an object/i.test(text(event && event.message))) sanitizeLocalStorage();
  }, true);
  window.addEventListener("unhandledrejection", event => {
    const reason = event && event.reason;
    if (/localeCompare|reading 'date'|evaluating 'b\.date|Cannot read properties of undefined|undefined is not an object/i.test(text(reason && reason.message || reason))) sanitizeLocalStorage();
  }, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      recoverFromErrorScreen();
      try { new MutationObserver(recoverFromErrorScreen).observe(document.body, { childList: true, subtree: true }); } catch (_error) {}
    });
  } else {
    recoverFromErrorScreen();
    try { new MutationObserver(recoverFromErrorScreen).observe(document.body, { childList: true, subtree: true }); } catch (_error) {}
  }
})();