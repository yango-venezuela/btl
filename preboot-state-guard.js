(() => {
  if (typeof window === "undefined" || window.__yangoPrebootStateGuardV10) return;
  window.__yangoPrebootStateGuardV10 = true;

  const ACTIVATION_KEY = /yango_activations|\bacts\b|activation|activacion|activaciones|calendar|calendario/i;
  const DASHBOARD_HINT = /yango|btl|mkt|agency|agencia|proof|photo|foto|evidencia|promotor|flyer|activ|calendar|calendario|acts|qr|promo|code|result|resultado/i;
  const COLLECTION_KEY = /(^|[_:\-\s])(qr|qrs|promo|promos|promoCodes|code|codes|result|results|resultado|resultados|activation|activations|activacion|activaciones|calendar|calendario|agency|agencia|proof|proofs|photo|photos|foto|fotos|evidencia|evidencias|report|reports|reporte|reportes|items|rows)([_:\-\s]|$)/i;
  const COLLECTION_HINT = /(qr|promo|result|resultado|activation|activacion|calendar|calendario|agency|agencia|proof|photo|foto|evidencia|report|reporte)/i;
  const RETIRED_KEY = /samsung|raffle|rifa/i;
  const RETIRED_TEXT = /rifa samsung|samsung raffle|raffle samsung|\brifa\b|samsung/i;
  const PANEL_HINT = /(?:[?&](?:panel|usuario|user|role|rol)=|\/)(luis|giselle|gise|agency|agencia|panel|usuario|user|role|rol)(?:[/?&#]|$)/i;
  const BROAD_ZONES = new Set(["petare", "centro", "este", "sureste", "universidades", "oeste", "sur", "norte", "satelites", "satélites", "sabana grande"]);
  const TYPE_MAP = new Map([
    ["flyers", "Flyers"], ["flyer", "Flyers"], ["cafe", "Café"], ["café", "Café"], ["helados", "Helados"], ["helado", "Helados"],
    ["materialpop", "Material POP"], ["material pop", "Material POP"], ["pop", "Material POP"], ["universidad", "Universidad"], ["universidades", "Universidad"], ["evento", "Evento"], ["eventos", "Evento"]
  ]);

  const text = value => String(value == null ? "" : value);
  const parseRaw = value => { try { return JSON.parse(value); } catch (_error) { return null; } };
  const stringify = value => { try { return JSON.stringify(value); } catch (_error) { return String(value); } };
  const isObject = value => value && typeof value === "object" && !Array.isArray(value);
  const clean = value => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  const compact = value => clean(value).replace(/[^a-z0-9]+/g, "");
  const isActivationKey = key => ACTIVATION_KEY.test(text(key));
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
    match = raw.match(/(?:^|\D)(\d{1,2})[-/.](\d{1,2})(?:\D|$)/);
    if (match) return `2026-${String(match[2]).padStart(2, "0")}-${String(match[1]).padStart(2, "0")}`;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
  }

  function normalizeType(value) {
    const key = compact(value);
    if (!key) return "Flyers";
    return TYPE_MAP.get(key) || TYPE_MAP.get(clean(value)) || text(value).trim();
  }

  function normalizeStatus(value) {
    const status = clean(value);
    if (/no se dio|cancel|rechaz|fall|missed/.test(status)) return "missed";
    if (/se dio|done|aprob|valid|complet|ejecut/.test(status)) return "done";
    return text(value || "Planificada");
  }

  function activationRawText(item) {
    if (!isObject(item)) return text(item);
    return [
      item.name, item.title, item.nombre, item.activationName, item.location, item.ubicacion, item.zone, item.zona,
      item.date, item.fecha, item.calendarDate, item.activationDate, item.createdAt, item.updatedAt, item.status, item.estado
    ].map(text).join(" ");
  }

  function activationDate(item) {
    if (!isObject(item)) return normalizeDate(item);
    const fields = [item.date, item.fecha, item.calendarDate, item.activationDate, item.createdAt, item.updatedAt];
    for (const field of fields) {
      const date = normalizeDate(field);
      if (date) return date;
    }
    return normalizeDate(activationRawText(item));
  }

  function activationIsJanuary(item) {
    const raw = clean(activationRawText(item));
    const date = activationDate(item);
    return /^\d{4}-01-/.test(date) || /(^|\s)(ene|enero|jan|january)\.?($|\s)/i.test(raw) || /(^|\D)\d{1,2}[\/.\-]0?1(?:[\/.\-]\d{2,4})?(?=\D|$)/.test(raw);
  }

  function hasRealActivationName(item) {
    if (!isObject(item)) return false;
    const name = clean(item.name || item.title || item.nombre || item.activationName || "");
    const location = clean(item.location || item.ubicacion || item.zone || item.zona || "");
    if (!name || /^(sin nombre|undefined|null|nan|n\/a|na|-)$/.test(name)) return false;
    if (BROAD_ZONES.has(name) && (!location || name === location || BROAD_ZONES.has(location))) return false;
    if (name === "activacion btl" || name === "activación btl") return false;
    return true;
  }

  function activationIsMissed(item) {
    if (!isObject(item)) return false;
    const status = clean(item.status || item.estado || item.result || item.validation || "");
    return /no se dio|cancel|rechaz|fall|missed/.test(status);
  }

  function activationIsGeneratedPlaceholder(item) {
    if (!isObject(item)) return false;
    if (activationIsJanuary(item)) return true;
    const name = clean(item.name || item.title || item.nombre || item.activationName || "");
    const location = clean(item.location || item.ubicacion || item.zone || item.zona || "");
    const type = clean(item.type || item.tipo || "");
    const status = clean(item.status || item.estado || "");
    return (!hasRealActivationName(item) && BROAD_ZONES.has(location) && (!type || type === "flyers") && (!status || /planific/.test(status)));
  }

  function normalizeActivation(item) {
    if (!isObject(item)) return null;
    if (!hasRealActivationName(item) || activationIsMissed(item) || activationIsJanuary(item) || activationIsGeneratedPlaceholder(item)) return null;
    const next = { ...item };
    const date = activationDate(next);
    const type = normalizeType(next.type || next.tipo);
    const status = normalizeStatus(next.status || next.estado);
    next.name = text(next.name || next.title || next.nombre || next.activationName).trim();
    if (!next.title) next.title = next.name;
    if (date) {
      next.date = date;
      next.fecha = date;
      next.calendarDate = date;
    }
    next.type = type;
    next.tipo = type;
    next.status = status;
    next.estado = status;
    return next;
  }

  function looksLikeActivationList(value) {
    if (!Array.isArray(value) || !value.length) return false;
    const sample = value.find(isObject);
    if (!sample) return false;
    const keys = Object.keys(sample).join(" ");
    return /activ|calendar|calendario|ubicacion|location|zona|zone|flyer|promot|fecha|date|status|estado/i.test(keys);
  }

  function sanitizeActivationList(value) {
    if (!Array.isArray(value)) return value;
    const seen = new Set();
    return value.map(normalizeActivation).filter(item => {
      if (!item) return false;
      const signature = [clean(item.name), clean(item.location || item.ubicacion || item.zone || item.zona), item.date || "", clean(item.type || item.tipo)].join("|");
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    });
  }

  function normalizeCollections(value, key = "") {
    if (RETIRED_KEY.test(text(key))) return undefined;
    if (Array.isArray(value)) {
      if (isActivationKey(key) || looksLikeActivationList(value)) return sanitizeActivationList(value);
      return value.map((item, index) => normalizeCollections(item, `${key}.${index}`)).filter(item => item !== undefined);
    }
    if (!isObject(value)) return value;
    const next = {};
    Object.entries(value).forEach(([childKey, childValue]) => {
      if (RETIRED_KEY.test(childKey)) return;
      const normalized = normalizeCollections(childValue, childKey);
      if (normalized !== undefined) next[childKey] = normalized;
    });
    return next;
  }

  function sanitizeStoredString(key, value) {
    if (typeof value !== "string") return value;
    if (RETIRED_KEY.test(text(key)) || RETIRED_TEXT.test(value)) return JSON.stringify([]);
    if (!DASHBOARD_HINT.test(text(key)) && !DASHBOARD_HINT.test(value)) return value;
    const parsed = parseRaw(value);
    if (parsed == null) return value;
    const normalized = normalizeCollections(parsed, key);
    const next = stringify(normalized);
    return next === undefined ? value : next;
  }

  const storageProto = (() => {
    try { return window.Storage && window.Storage.prototype; } catch (_error) { return null; }
  })();
  const rawGetItem = storageProto && storageProto.getItem;
  const rawSetItem = storageProto && storageProto.setItem;
  const rawRemoveItem = storageProto && storageProto.removeItem;

  function getStored(storage, key) {
    try { return rawGetItem ? rawGetItem.call(storage, key) : storage.getItem(key); } catch (_error) { return null; }
  }

  function setStored(storage, key, value) {
    try { return rawSetItem ? rawSetItem.call(storage, key, value) : storage.setItem(key, value); } catch (_error) { return undefined; }
  }

  function removeStored(storage, key) {
    try { return rawRemoveItem ? rawRemoveItem.call(storage, key) : storage.removeItem(key); } catch (_error) { return undefined; }
  }

  function sanitizeLocalStorage() {
    try {
      const storage = window.localStorage;
      if (!storage) return 0;
      let changed = 0;
      for (let index = storage.length - 1; index >= 0; index -= 1) {
        const key = storage.key(index);
        if (!key) continue;
        const value = getStored(storage, key);
        if (RETIRED_KEY.test(key) || RETIRED_TEXT.test(value || "")) {
          removeStored(storage, key);
          changed += 1;
          continue;
        }
        const next = sanitizeStoredString(key, value);
        if (next !== value) {
          setStored(storage, key, next);
          changed += 1;
        }
      }
      return changed;
    } catch (_error) {
      return 0;
    }
  }

  if (storageProto && rawGetItem && rawSetItem) {
    storageProto.getItem = function patchedGetItem(key) {
      const value = rawGetItem.call(this, key);
      return sanitizeStoredString(key, value);
    };
    storageProto.setItem = function patchedSetItem(key, value) {
      const next = sanitizeStoredString(key, text(value));
      return rawSetItem.call(this, key, next);
    };
  }

  const rawParse = JSON.parse;
  JSON.parse = function patchedParse(value, reviver) {
    const parsed = rawParse.call(JSON, value, reviver);
    if (typeof value === "string" && DASHBOARD_HINT.test(value)) return normalizeCollections(parsed);
    return parsed;
  };

  const rawFetch = window.fetch && window.fetch.bind(window);
  function stateEndpoint(input) {
    const url = typeof input === "string" ? input : input && input.url;
    return typeof url === "string" && /\/api\/state(?:\?|$)/.test(url);
  }

  if (rawFetch) {
    window.fetch = async function patchedFetch(input, init) {
      const response = await rawFetch(input, init);
      if (!stateEndpoint(input)) return response;
      try {
        const clone = response.clone();
        const payload = await clone.json();
        const normalized = normalizeCollections(payload);
        return new Response(JSON.stringify(normalized), {
          status: response.status,
          statusText: response.statusText,
          headers: { "content-type": "application/json; charset=utf-8" }
        });
      } catch (_error) {
        return response;
      }
    };
  }

  async function purgeRemoteActivationKeys() {
    if (!rawFetch || window.__yangoJanuaryRemotePurgeDone) return;
    window.__yangoJanuaryRemotePurgeDone = true;
    try {
      const response = await rawFetch(`/api/state?janPurge=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json();
      const rows = Array.isArray(payload?.items) ? payload.items : [];
      await Promise.all(rows.map(async row => {
        const key = row?.key || row?.id || row?.name;
        if (!key || RETIRED_KEY.test(key)) return;
        let value = row.value;
        if (typeof value === "string") value = parseRaw(value);
        if (!isActivationKey(key) && !looksLikeActivationList(value)) return;
        const cleaned = sanitizeActivationList(Array.isArray(value) ? value : []);
        if (stringify(cleaned) === stringify(value)) return;
        await rawFetch("/api/state", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ key, value: cleaned })
        });
      }));
    } catch (_error) {
      // La app debe seguir cargando aunque Railway esté lento.
    }
  }

  async function hydrateCollaboratorMirror() {
    if (!rawFetch || !isCollaboratorPanel() || window.__yangoMirrorHydratedV4) return;
    window.__yangoMirrorHydratedV4 = true;
    try {
      const response = await window.fetch(`/api/state?mirror=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json();
      const rows = Array.isArray(payload?.items) ? payload.items : [];
      let changed = 0;
      rows.forEach(row => {
        const key = row?.key || row?.id || row?.name;
        if (!key || RETIRED_KEY.test(key)) return;
        const value = normalizeCollections(row.value, key);
        const serialized = stringify(value);
        const current = getStored(window.localStorage, key);
        if (serialized && current !== serialized) {
          setStored(window.localStorage, key, serialized);
          changed += 1;
        }
      });
      if (changed && !sessionStorage.getItem("yangoMirrorReloadedV4")) {
        sessionStorage.setItem("yangoMirrorReloadedV4", "1");
        setTimeout(() => window.location.reload(), 250);
      }
    } catch (_error) {
      // noop
    }
  }

  function removeRetiredUi() {
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_ELEMENT);
    const remove = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const label = clean(node.textContent || node.getAttribute?.("aria-label") || "");
      if (/rifa samsung|samsung raffle/.test(label)) remove.push(node.closest?.("button,a,li,.nav-item,.sidebar-item,section,div") || node);
    }
    remove.forEach(node => { try { node.remove(); } catch (_error) {} });
  }

  function safeDateSortPatch() {
    const rawSort = Array.prototype.sort;
    Array.prototype.sort = function patchedSort(compareFn) {
      if (typeof compareFn !== "function") return rawSort.call(this, compareFn);
      return rawSort.call(this, (a, b) => {
        try { return compareFn(a, b); }
        catch (error) {
          if (/localeCompare|bg|undefined|null/i.test(text(error && error.message))) {
            const ad = text(a?.date || a?.fecha || a?.calendarDate || a?.activationDate || "0000-00-00");
            const bd = text(b?.date || b?.fecha || b?.calendarDate || b?.activationDate || "0000-00-00");
            return bd.localeCompare(ad);
          }
          throw error;
        }
      });
    };
  }

  function recoverFromErrorScreen() {
    const body = clean(document.body?.innerText || "");
    if (!/algo salio mal|algo salió mal/.test(body)) return;
    if (!/bg|localecompare|qr\.reduce|undefined|null/.test(body)) return;
    const tries = Number(sessionStorage.getItem("yangoRecoveryTriesV10") || 0);
    if (tries >= 3) return;
    sessionStorage.setItem("yangoRecoveryTriesV10", String(tries + 1));
    sanitizeLocalStorage();
    purgeRemoteActivationKeys().finally(() => setTimeout(() => window.location.reload(), 400));
  }

  safeDateSortPatch();
  sanitizeLocalStorage();
  purgeRemoteActivationKeys();
  hydrateCollaboratorMirror();

  document.addEventListener("DOMContentLoaded", () => {
    sanitizeLocalStorage();
    removeRetiredUi();
    recoverFromErrorScreen();
    setTimeout(removeRetiredUi, 800);
    setTimeout(recoverFromErrorScreen, 1200);
  });

  window.addEventListener("storage", event => {
    if (!event.key || RETIRED_KEY.test(event.key) || !DASHBOARD_HINT.test(event.key)) return;
    sanitizeLocalStorage();
  });

  window.addEventListener("error", event => {
    const message = text(event?.error?.message || event?.message || "");
    if (/bg|localeCompare|qr\.reduce|undefined|null/i.test(message)) setTimeout(recoverFromErrorScreen, 100);
  });
})();
