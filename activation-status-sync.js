(() => {
  if (typeof window === "undefined" || window.__yangoSharedStateSyncV12) return;
  window.__yangoSharedStateSyncV12 = true;

  const pending = new Map();
  const lastSeen = new Map();
  let timer = null;
  let hydrating = false;
  let flushing = false;

  const canonicalKeys = {
    agency: "yango_agency_submissions_h1",
    acts: "yango_activations_h1",
    qr: "yango_btl_results_h1",
    media: "yango_media_ooh_h1",
    pop: "yango_pop_inventory_h1",
    branding: "yango_branding_inventory_h1",
    influencers: "yango_influencers_h1",
    mystery: "yango_mystery_shopper_h1",
    budgets: "yango_budgets_h1",
    social: "yango_social_report_h1",
    users: "yango_users_h1"
  };

  const protectedTypes = new Set(["agency", "media", "pop", "branding", "influencers", "mystery", "budgets", "social", "users"]);
  const replaceTypes = new Set(["influencers", "acts", "branding", "pop", "media", "social", "users"]);

  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const compact = value => normalize(value).replace(/[^a-z0-9]+/g, "");
  const parseJson = value => { try { return JSON.parse(value); } catch (_error) { return null; } };
  const stringify = value => { try { return JSON.stringify(value); } catch (_error) { return String(value); } };
  const clone = value => parseJson(stringify(value));
  const isObject = value => value && typeof value === "object" && !Array.isArray(value);
  const blockedKey = key => /migration|backup|respaldo|token|password|pass|secret|hydrated|debug|devtools|theme|tooltip|toast|mapbox|leaflet/i.test(String(key || ""));
  const broadActivationZones = new Set(["petare", "centro", "este", "sureste", "universidades", "oeste", "sur", "norte", "satelites", "satélites", "sabana grande"]);

  const normalizeDate = value => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    let match = raw.match(/(20\d{2}|19\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (match) return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
    match = raw.match(/(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|19\d{2})/);
    if (match) return `${match[3]}-${String(match[2]).padStart(2, "0")}-${String(match[1]).padStart(2, "0")}`;
    return raw;
  };

  const hasMeaningfulData = value => {
    if (Array.isArray(value)) return value.length > 0;
    if (isObject(value)) return Object.values(value).some(hasMeaningfulData);
    return value !== undefined && value !== null && String(value).trim() !== "";
  };

  const activationHasRealName = item => {
    const name = normalize(item && (item.name || item.nombre || item.title || item.titulo));
    return !!name && name !== "sin nombre" && compact(name) !== "sinnombre" && !["undefined", "null", "nan"].includes(name);
  };
  const activationStatus = item => normalize(item && (item.status || item.estado || item.activationStatus || item.validacion || item.validation));
  const activationIsMissed = item => {
    const status = activationStatus(item);
    return status === "no se dio" || compact(status) === "nosedio" || ["missed", "cancelled", "canceled"].includes(status);
  };
  const activationIsGeneratedPlaceholder = item => {
    const date = normalizeDate(item && (item.date || item.fecha || item.calendarDate || item.activationDate || item.createdAt || item.updatedAt));
    const name = normalize(item && (item.name || item.nombre || item.title || item.titulo));
    const location = normalize(item && (item.location || item.ubicacion || item.zone || item.zona || item.area));
    const status = activationStatus(item);
    const planned = !status || ["planned", "planificada", "pending"].includes(status);
    return planned && (date === "2026-01-01" || /(^|\D)1\s*ene/.test(normalize(date))) && broadActivationZones.has(name) && (!location || location === name || broadActivationZones.has(location));
  };
  const sanitizeActivations = value => {
    if (!Array.isArray(value)) return value;
    const seen = new Set();
    return value.filter(item => isObject(item) && activationHasRealName(item) && !activationIsMissed(item) && !activationIsGeneratedPlaceholder(item)).filter(item => {
      const id = [
        normalizeDate(item.date || item.fecha || item.calendarDate || item.activationDate || item.createdAt || item.updatedAt),
        normalize(item.name || item.nombre || item.title || item.titulo),
        normalize(item.location || item.ubicacion || item.zone || item.zona || item.area),
        normalize(item.type || item.tipo || item.activationType || item.tipoActivacion)
      ].join("|");
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  };

  const sanitizeValue = (type, value) => type === "acts" ? sanitizeActivations(value) : value;

  const typeFromKey = key => {
    const k = String(key || "").toLowerCase();
    if (/agency|agencia|proof|photo|foto|evidencia|promotor/.test(k)) return "agency";
    if (/acts|activation|activacion|calendar|calendario/.test(k)) return "acts";
    if (/adjust|qr|result|resultado/.test(k)) return "qr";
    if (/influ/.test(k)) return "influencers";
    if (/branding/.test(k)) return "branding";
    if (/pop|material/.test(k)) return "pop";
    if (/media|ooh/.test(k)) return "media";
    if (/mystery|shopper/.test(k)) return "mystery";
    if (/budget|presupuesto/.test(k)) return "budgets";
    if (/social|instagram|tiktok/.test(k)) return "social";
    if (/user|usuario/.test(k)) return "users";
    return "unknown";
  };

  const typeFromValue = value => {
    const sample = stringify(value).slice(0, 18000).toLowerCase();
    if (/promotora|promotoras|evidencia|proof|flyers entreg|cantidad de flyers|agencia/.test(sample)) return "agency";
    if (/activaci|activation|calendario|calendar|sabana|petare|centro de caracas|altamira|chacaito|fecha calendario/.test(sample)) return "acts";
    if (/adjust|installs|clicks|registration|success_first_order|primer viaje|first order/.test(sample)) return "qr";
    if (/instagram|tiktok|influencer|microinfluencer|reach|followers|entregable/.test(sample)) return "influencers";
    if (/ooh|banderola|parada bus|valla|reach estimado/.test(sample)) return "media";
    if (/longsleeves|chalecos|cascos|stickers|bipbip|dragopro|motogo/.test(sample)) return "branding";
    if (/material pop|gorras|landyards|llaveros|tote/.test(sample)) return "pop";
    if (/mystery|shopper|visitada|operativa/.test(sample)) return "mystery";
    if (/followers|aorp|organic reach|facebook|instagram|tiktok/.test(sample)) return "social";
    if (/presupuesto|budget|mtd|actuals/.test(sample)) return "budgets";
    if (/usuario|user|luis|giselle|agency/.test(sample)) return "users";
    return "unknown";
  };

  const sharedKey = key => {
    const k = String(key || "");
    if (!k || blockedKey(k) || /samsung|raffle|rifa/i.test(k)) return false;
    return /^(yango_|mkt_|btl_)/i.test(k) || /agency|agencia|proof|photo|foto|evidencia|flyer|promotor|acts|activation|activacion|calendar|calendario|adjust|qr|result|resultado|budget|presupuesto|influ|branding|pop|material|media|ooh|mystery|shopper|social|tiktok|instagram|users|usuarios/i.test(k);
  };

  const typeOf = (key, value) => {
    const fromKey = typeFromKey(key);
    return fromKey !== "unknown" ? fromKey : typeFromValue(value);
  };

  const stableId = item => {
    if (!isObject(item)) return "";
    return String(
      item.id || item.activationId || item.actId || item.uuid || item.key || item.responseId ||
      item.name || item.nombre || item.username || item.handle || item.igUsername || item.instagram || item.tiktokUsername ||
      [item.title || item.titulo || "", item.date || item.fecha || item.calendarDate || "", item.location || item.ubicacion || item.zone || item.zona || "", item.type || item.tipo || ""].join("|")
    ).trim();
  };

  const mergeArrays = (remoteValue, localValue) => {
    const remote = Array.isArray(remoteValue) ? remoteValue : [];
    const local = Array.isArray(localValue) ? localValue : [];
    if (!remote.length) return local;
    if (!local.length) return remote;
    const merged = remote.slice();
    const indexById = new Map();
    merged.forEach((item, index) => {
      const id = stableId(item);
      if (id) indexById.set(id, index);
    });
    local.forEach(item => {
      const id = stableId(item);
      if (id && indexById.has(id)) {
        const index = indexById.get(id);
        merged[index] = isObject(merged[index]) && isObject(item) ? { ...merged[index], ...item } : item;
      } else {
        merged.push(item);
      }
    });
    return merged;
  };

  const mergeObjects = (remoteValue, localValue) => {
    if (Array.isArray(remoteValue) || Array.isArray(localValue)) return mergeArrays(remoteValue, localValue);
    if (!isObject(remoteValue)) return hasMeaningfulData(localValue) ? localValue : remoteValue;
    if (!isObject(localValue)) return remoteValue;
    const next = { ...remoteValue };
    Object.keys(localValue).forEach(key => {
      next[key] = mergeObjects(remoteValue[key], localValue[key]);
    });
    return next;
  };

  const fetchRemote = async () => {
    const response = await fetch(`/api/state?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`API ${response.status}`);
    const payload = await response.json();
    return payload.values || {};
  };

  const putRemote = async (key, value) => {
    const response = await fetch(`/api/state/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value })
    });
    if (!response.ok) throw new Error(`API ${response.status}`);
  };

  const originalSetItem = localStorage.setItem.bind(localStorage);
  const originalRemoveItem = localStorage.removeItem.bind(localStorage);

  const remember = (key, value) => {
    lastSeen.set(key, stringify(value));
  };

  const writeLocal = (key, value) => {
    const serialized = stringify(value);
    if (localStorage.getItem(key) !== serialized) originalSetItem(key, serialized);
    remember(key, value);
  };

  const readLocal = key => parseJson(localStorage.getItem(key));

  const localEntries = () => {
    const entries = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!sharedKey(key)) continue;
      const parsed = readLocal(key);
      if (parsed == null) continue;
      const type = typeOf(key, parsed);
      const target = canonicalKeys[type];
      if (!target) continue;
      const value = sanitizeValue(type, parsed);
      entries.push({ key, type, target, value });
    }
    return entries;
  };

  const bestLocalForType = type => {
    const target = canonicalKeys[type];
    const candidates = localEntries().filter(entry => entry.type === type || entry.target === target);
    const meaningful = candidates.filter(entry => hasMeaningfulData(entry.value));
    if (!meaningful.length) return null;
    meaningful.sort((a, b) => stringify(b.value).length - stringify(a.value).length);
    return meaningful[0];
  };

  const queueDirect = (key, target, type, value, reason) => {
    const cleanValue = sanitizeValue(type, value);
    if (protectedTypes.has(type) && !hasMeaningfulData(cleanValue)) return;
    const raw = stringify(cleanValue);
    if (lastSeen.get(key) === raw && lastSeen.get(target) === raw) return;
    pending.set(`${key}->${target}`, { key, target, type, value: cleanValue, reason });
    clearTimeout(timer);
    timer = setTimeout(flush, 550);
  };

  const hydrate = async () => {
    if (hydrating || !window.fetch || window.location.protocol === "file:") return;
    hydrating = true;
    try {
      const remote = await fetchRemote();
      const rescue = [];
      Object.entries(canonicalKeys).forEach(([type, target]) => {
        const remoteValue = sanitizeValue(type, remote[target]);
        const localBest = bestLocalForType(type);
        if (protectedTypes.has(type) && !hasMeaningfulData(remoteValue) && localBest && hasMeaningfulData(localBest.value)) {
          writeLocal(target, localBest.value);
          rescue.push({ key: localBest.key, target, type, value: localBest.value });
          return;
        }
        if (hasMeaningfulData(remoteValue)) {
          writeLocal(target, remoteValue);
          localEntries().filter(entry => entry.type === type && entry.key !== target).forEach(entry => writeLocal(entry.key, remoteValue));
        }
      });
      rescue.forEach(entry => queueDirect(entry.key, entry.target, entry.type, entry.value, "rescue-local-from-empty-remote"));
      window.dispatchEvent(new CustomEvent("yango:shared-state-hydrated", { detail: { protected: true } }));
    } catch (error) {
      console.warn("No pude hidratar datos compartidos:", error);
    } finally {
      hydrating = false;
    }
  };

  function queue(key, rawValue, reason) {
    if (hydrating || !sharedKey(key)) return;
    const parsed = typeof rawValue === "string" ? parseJson(rawValue) : rawValue;
    if (parsed == null) return;
    const type = typeOf(key, parsed);
    const target = canonicalKeys[type];
    if (!target) return;
    queueDirect(key, target, type, parsed, reason);
  }

  async function flush() {
    if (flushing || !pending.size || !window.fetch || window.location.protocol === "file:") return;
    flushing = true;
    try {
      const remote = await fetchRemote();
      const entries = Array.from(pending.values());
      pending.clear();
      for (const entry of entries) {
        const current = sanitizeValue(entry.type, remote[entry.target]);
        let next;
        if (replaceTypes.has(entry.type)) {
          next = sanitizeValue(entry.type, entry.value);
        } else {
          next = sanitizeValue(entry.type, mergeObjects(current, entry.value));
        }
        if (protectedTypes.has(entry.type) && !hasMeaningfulData(next)) continue;
        remote[entry.target] = next;
        await putRemote(entry.target, next);
        writeLocal(entry.target, next);
        writeLocal(entry.key, next);
      }
      window.dispatchEvent(new CustomEvent("yango:shared-state-synced", { detail: { protected: true } }));
    } catch (error) {
      console.warn("No pude sincronizar cambios del panel:", error);
    } finally {
      flushing = false;
    }
  }

  const scanSoon = reason => {
    setTimeout(() => localEntries().forEach(entry => queueDirect(entry.key, entry.target, entry.type, entry.value, reason)), 350);
  };

  localStorage.setItem = function patchedSetItem(key, value) {
    originalSetItem(key, value);
    queue(key, value, "localStorage.setItem");
  };
  localStorage.removeItem = function patchedRemoveItem(key) {
    const oldValue = readLocal(key);
    originalRemoveItem(key);
    const type = typeOf(key, oldValue);
    if (protectedTypes.has(type)) return;
    queue(key, "[]", "localStorage.removeItem");
  };

  document.addEventListener("click", () => scanSoon("click"), true);
  document.addEventListener("change", () => scanSoon("change"), true);
  document.addEventListener("input", () => scanSoon("input"), true);
  document.addEventListener("submit", () => scanSoon("submit"), true);
  window.addEventListener("focus", () => { hydrate(); scanSoon("focus"); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) hydrate(); });
  window.addEventListener("beforeunload", () => { scanSoon("beforeunload"); flush(); });

  setTimeout(hydrate, 150);
  setTimeout(() => { hydrate(); scanSoon("startup"); }, 1800);
  setInterval(hydrate, 30000);
})();

(() => {
  if (typeof window === "undefined" || window.__yangoBtlMapPolishLoaderInstalledV7) return;
  window.__yangoBtlMapPolishLoaderInstalledV7 = true;
  const load = () => {
    if (document.querySelector('script[src^="/btl-map-polish.js"]')) return;
    const script = document.createElement("script");
    script.src = `/btl-map-polish.js?v=20260813d-${Date.now()}`;
    script.defer = true;
    document.head.appendChild(script);
  };
  setTimeout(load, 200);
  setTimeout(load, 2200);
})();
