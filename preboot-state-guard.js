(() => {
  if (typeof window === "undefined" || window.__yangoPrebootStateGuardV1) return;
  window.__yangoPrebootStateGuardV1 = true;

  const RIFA_KEY = /samsung|raffle|rifa/i;
  const RELEVANT_KEY = /yango|btl|mkt|agency|agencia|proof|photo|foto|evidencia|promotor|flyer|activ|calendar|calendario|acts/i;
  const RELEVANT_VALUE = /activacion|activation|agencia|agency|promotora|promotoras|foto|fotos|photo|photos|evidencia|proof|flyers|petare|sabana|centro|chacaito|altamira|hoyada|junquito|montalban|vega|calendario|calendar/i;
  const VALID_STATUSES = new Set(["planned", "done", "missed", "cancelled", "canceled", "pending", "completed", "active", "paused"]);
  const VALID_TYPES = new Map([
    ["flyers", "Flyers"], ["flyer", "Flyers"],
    ["cafe", "Café"], ["café", "Café"],
    ["helados", "Helados"], ["helado", "Helados"],
    ["materialpop", "Material POP"], ["material pop", "Material POP"], ["pop", "Material POP"],
    ["universidad", "Universidad"], ["universidades", "Universidad"],
    ["evento", "Evento"], ["eventos", "Evento"]
  ]);

  const stringify = value => {
    try { return JSON.stringify(value); } catch (_error) { return String(value); }
  };
  const parseJson = value => {
    try { return JSON.parse(value); } catch (_error) { return null; }
  };
  const text = value => String(value == null ? "" : value);
  const norm = value => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const compact = value => norm(value).replace(/[^a-z0-9]+/g, "");

  const normalizeDate = value => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    if (typeof value === "number" && Number.isFinite(value)) {
      if (value > 20000 && value < 80000) return new Date(Date.UTC(1899, 11, 30 + value)).toISOString().slice(0, 10);
      return "";
    }
    const raw = text(value).trim();
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

  const normalizeType = value => VALID_TYPES.get(norm(value)) || VALID_TYPES.get(compact(value)) || "Flyers";
  const normalizeStatus = value => {
    const current = norm(value);
    if (VALID_STATUSES.has(current)) return current;
    if (/se dio|hecha|realizada|done|complete|completed|aprob|valid/.test(current)) return "done";
    if (/no se dio|cancel|missed|paus|pausa/.test(current)) return "missed";
    return "planned";
  };
  const relevantValue = value => value && typeof value === "object" && RELEVANT_VALUE.test(stringify(value).slice(0, 6000));

  const scrub = (value, forced = false) => {
    if (Array.isArray(value)) return value.map(item => scrub(item, forced || relevantValue(item))).filter(item => item != null);
    if (!value || typeof value !== "object") return value;
    const relevant = forced || relevantValue(value);
    const next = { ...value };
    Object.keys(next).forEach(key => {
      if (next[key] && typeof next[key] === "object") next[key] = scrub(next[key], relevant || RELEVANT_KEY.test(key));
    });
    if (!relevant) return next;

    const date = normalizeDate(next.date || next.fecha || next.calendarDate || next.activationDate || next.createdAt || next.updatedAt) || "2026-01-01";
    next.date = date;
    next.fecha = text(next.fecha || date);
    next.name = text(next.name || next.nombre || next.title || next.titulo || next.location || next.ubicacion || "Sin nombre");
    next.nombre = text(next.nombre || next.name);
    next.title = text(next.title || next.titulo || next.name);
    next.titulo = text(next.titulo || next.title);
    next.location = text(next.location || next.ubicacion || next.zone || next.zona || "");
    next.ubicacion = text(next.ubicacion || next.location);
    next.zone = text(next.zone || next.zona || next.location);
    next.zona = text(next.zona || next.zone);
    next.type = normalizeType(next.type || next.tipo || next.activationType || next.tipoActivacion);
    next.tipo = normalizeType(next.tipo || next.type || next.activationType || next.tipoActivacion);
    next.status = normalizeStatus(next.status || next.estado);
    next.estado = text(next.estado || next.status);
    return next;
  };

  const sanitizeStateValues = values => {
    if (!values || typeof values !== "object") return values;
    const next = { ...values };
    Object.keys(next).forEach(key => {
      if (RIFA_KEY.test(key)) {
        next[key] = [];
        return;
      }
      if (RELEVANT_KEY.test(key) || relevantValue(next[key])) next[key] = scrub(next[key], true);
    });
    return next;
  };

  const sanitizeLocalStorage = () => {
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) keys.push(localStorage.key(index));
    keys.filter(Boolean).forEach(key => {
      if (RIFA_KEY.test(key)) {
        localStorage.removeItem(key);
        return;
      }
      if (!RELEVANT_KEY.test(key)) return;
      const parsed = parseJson(localStorage.getItem(key));
      if (parsed == null) return;
      const cleaned = scrub(parsed, true);
      if (stringify(cleaned) !== stringify(parsed)) localStorage.setItem(key, stringify(cleaned));
    });
  };

  sanitizeLocalStorage();

  const originalFetch = window.fetch && window.fetch.bind(window);
  if (originalFetch) {
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
        return new Response(JSON.stringify(payload), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      } catch (_error) {
        return response;
      }
    };
  }
})();
