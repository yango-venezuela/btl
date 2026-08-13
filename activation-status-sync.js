(() => {
  if (typeof window === "undefined" || window.__yangoSharedStateSyncV16) return;
  window.__yangoSharedStateSyncV16 = true;

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
  const replaceTypes = new Set(["influencers", "acts", "branding", "pop", "media", "social", "users", "budgets", "mystery"]);
  const pending = new Map();
  const lastSeen = new Map();
  let hydrating = false;
  let flushing = false;
  let flushTimer = null;

  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const compact = value => normalize(value).replace(/[^a-z0-9]+/g, "");
  const parseJson = value => { try { return JSON.parse(value); } catch (_error) { return null; } };
  const stringify = value => { try { return JSON.stringify(value); } catch (_error) { return String(value); } };
  const isObject = value => value && typeof value === "object" && !Array.isArray(value);
  const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
  const blockedKey = key => /migration|backup|respaldo|token|password|pass|secret|hydrated|debug|devtools|theme|tooltip|toast|mapbox|leaflet|samsung|raffle|rifa/i.test(String(key || ""));
  const staleCopyKey = key => /backup|respaldo|snapshot|migration|seed|rescue|old|tmp|debug|copy|bak/i.test(String(key || ""));

  function showStatus(ok, message) {
    try {
      window.dispatchEvent(new CustomEvent("yango:cloud-save-status", { detail: { ok, message } }));
      const badge = document.getElementById("yango-cloud-save-status");
      if (badge) {
        badge.className = ok ? "ok" : "bad";
        badge.innerHTML = `<span class="dot"></span><span>${String(message || "")}</span>`;
      }
      document.body && document.body.classList.toggle("yango-cloud-save-offline", !ok);
    } catch (_error) {}
  }

  function normalizeDate(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    let match = raw.match(/(20\d{2}|19\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (match) return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
    match = raw.match(/(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|19\d{2})/);
    if (match) return `${match[3]}-${String(match[2]).padStart(2, "0")}-${String(match[1]).padStart(2, "0")}`;
    return raw;
  }

  function hasData(value) {
    if (Array.isArray(value)) return value.length > 0;
    if (isObject(value)) return Object.values(value).some(hasData);
    return value !== undefined && value !== null && String(value).trim() !== "";
  }

  function isUnnamedActivation(item) {
    if (!isObject(item)) return false;
    const name = normalize(item.name || item.nombre || item.title || item.titulo);
    return !name || name === "sin nombre" || compact(name) === "sinnombre" || ["undefined", "null", "nan", "-"].includes(name);
  }

  function activationStableId(item) {
    if (!isObject(item)) return "";
    const explicit = item.id || item.activationId || item.actId || item.uuid || item.key;
    if (explicit) return String(explicit);
    return [
      normalizeDate(item.date || item.fecha || item.calendarDate || item.activationDate || item.createdAt || item.updatedAt),
      normalize(item.name || item.nombre || item.title || item.titulo),
      normalize(item.location || item.ubicacion || item.zone || item.zona || item.area),
      normalize(item.type || item.tipo || item.activationType || item.tipoActivacion),
      normalize(item.status || item.estado || item.activationStatus || "")
    ].join("|");
  }

  function sanitizeActivations(value) {
    const list = Array.isArray(value) ? value : [];
    const seen = new Set();
    return list.filter(item => {
      if (isObject(item) && isUnnamedActivation(item)) return false;
      const id = activationStableId(item);
      if (!id || !id.replace(/\|/g, "")) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function sanitizeDeliverables(value) {
    const raw = Array.isArray(value) ? value : String(value || "").split("+");
    const allowed = new Map(["Stories", "Reel", "Post", "TikTok", "Live"].map(item => [item.toLowerCase(), item]));
    const out = [];
    raw.forEach(item => {
      const cleaned = String(item || "").trim();
      if (!cleaned) return;
      const canonical = allowed.get(cleaned.toLowerCase()) || cleaned;
      if (!out.some(existing => existing.toLowerCase() === canonical.toLowerCase())) out.push(canonical);
    });
    return out;
  }

  function influencerKey(item) {
    if (!isObject(item)) return "";
    const name = normalize(item.name || item.nombre);
    const handle = normalize(item.handle || item.igUsername || item.instagram || item.tiktokUsername || item.tiktok);
    return name || handle ? `${name}|${handle}` : "";
  }

  function sanitizeInfluencers(value) {
    const list = Array.isArray(value) ? value : [];
    const map = new Map();
    list.forEach(item => {
      const key = influencerKey(item);
      if (!key || /^carlos rides\|/.test(key) || key === "carlos rides|") return;
      const next = isObject(item) ? { ...item, deliverables: sanitizeDeliverables(item.deliverables || item.entregables) } : item;
      map.set(key, next);
    });
    return [...map.values()];
  }

  function sanitizeValue(type, value) {
    if (type === "acts") return sanitizeActivations(value);
    if (type === "influencers") return sanitizeInfluencers(value);
    if (["agency", "media", "mystery", "users", "qr"].includes(type) && !Array.isArray(value) && value && typeof value === "object") {
      const likely = value.items || value.rows || value.data || value.values || value.records || value.list || value.entries;
      if (Array.isArray(likely)) return likely;
    }
    return value;
  }

  function typeFromKey(key) {
    const k = String(key || "").toLowerCase();
    if (/agency|agencia|proof|photo|foto|evidencia|promotor/.test(k)) return "agency";
    if (/acts|activation|activacion|activaciones|calendar|calendario/.test(k)) return "acts";
    if (/adjust|qr|result|resultado/.test(k)) return "qr";
    if (/influ/.test(k)) return "influencers";
    if (/branding/.test(k)) return "branding";
    if (/pop|material/.test(k)) return "pop";
    if (/media|ooh|valla|banderola|parada/.test(k)) return "media";
    if (/mystery|shopper/.test(k)) return "mystery";
    if (/budget|presupuesto/.test(k)) return "budgets";
    if (/social|instagram|tiktok/.test(k)) return "social";
    if (/user|usuario/.test(k)) return "users";
    return "unknown";
  }

  function typeFromValue(value) {
    const sample = stringify(value).slice(0, 20000).toLowerCase();
    if (/promotora|promotoras|evidencia|proof|flyers entreg|cantidad de flyers|agencia/.test(sample)) return "agency";
    if (/activaci|activation|calendario|calendar|sabana|petare|centro de caracas|altamira|chacaito|fecha calendario|sin nombre/.test(sample)) return "acts";
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
  }

  function sharedKey(key) {
    const k = String(key || "");
    if (!k || blockedKey(k)) return false;
    return /^(yango_|mkt_|btl_)/i.test(k) || /agency|agencia|proof|photo|foto|evidencia|flyer|promotor|acts|activation|activacion|calendar|calendario|adjust|qr|result|resultado|budget|presupuesto|influ|branding|pop|material|media|ooh|mystery|shopper|social|tiktok|instagram|users|usuarios/i.test(k);
  }

  function typeOf(key, value) {
    const byKey = typeFromKey(key);
    return byKey !== "unknown" ? byKey : typeFromValue(value);
  }

  function stableId(item) {
    if (!isObject(item)) return "";
    return String(
      item.id || item.activationId || item.actId || item.uuid || item.key || item.responseId ||
      item.name || item.nombre || item.username || item.handle || item.igUsername || item.instagram || item.tiktokUsername ||
      [item.title || item.titulo || "", item.date || item.fecha || item.calendarDate || "", item.location || item.ubicacion || item.zone || item.zona || "", item.type || item.tipo || ""].join("|")
    ).trim();
  }

  function mergeArrays(remoteValue, localValue) {
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
  }

  function mergeObjects(remoteValue, localValue) {
    if (Array.isArray(remoteValue) || Array.isArray(localValue)) return mergeArrays(remoteValue, localValue);
    if (!isObject(remoteValue)) return hasData(localValue) ? localValue : remoteValue;
    if (!isObject(localValue)) return remoteValue;
    const next = { ...remoteValue };
    Object.keys(localValue).forEach(key => { next[key] = mergeObjects(remoteValue[key], localValue[key]); });
    return next;
  }

  async function fetchRemote() {
    const response = await fetch(`/api/state?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`API ${response.status}`);
    const payload = await response.json();
    return payload && payload.values && typeof payload.values === "object" ? payload.values : {};
  }

  async function putRemote(key, value) {
    const response = await fetch(`/api/state/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value })
    });
    if (!response.ok) throw new Error(`API ${response.status}`);
  }

  const proto = window.Storage && window.Storage.prototype;
  const nativeSetItem = proto && proto.setItem ? proto.setItem : localStorage.setItem;
  const nativeRemoveItem = proto && proto.removeItem ? proto.removeItem : localStorage.removeItem;

  function remember(key, value) {
    lastSeen.set(String(key), stringify(value));
  }

  function writeLocal(key, value) {
    const serialized = stringify(value);
    if (localStorage.getItem(key) !== serialized) nativeSetItem.call(localStorage, key, serialized);
    remember(key, value);
  }

  function readLocal(key) {
    return parseJson(localStorage.getItem(key));
  }

  function localEntries() {
    const entries = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!sharedKey(key)) continue;
      const parsed = readLocal(key);
      if (parsed == null) continue;
      const type = typeOf(key, parsed);
      const target = canonicalKeys[type];
      if (!target) continue;
      entries.push({ key, type, target, value: sanitizeValue(type, parsed) });
    }
    return entries;
  }

  function copyTypeLocally(type, value) {
    const target = canonicalKeys[type];
    if (!target) return;
    writeLocal(target, value);
    localEntries()
      .filter(entry => entry.type === type && entry.key !== target && !staleCopyKey(entry.key))
      .forEach(entry => writeLocal(entry.key, value));
  }

  function queueDirect(key, target, type, value, reason) {
    if (!target || hydrating) return;
    const clean = sanitizeValue(type, value);
    if (protectedTypes.has(type) && !replaceTypes.has(type) && !hasData(clean)) return;
    const raw = stringify(clean);
    if (lastSeen.get(String(key)) === raw && lastSeen.get(String(target)) === raw) return;
    pending.set(`${target}`, { key: target, target, type, value: clean, reason });
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 700);
    showStatus(true, "Guardando cambios en la nube...");
  }

  function queue(key, rawValue, reason, oldRawValue) {
    if (hydrating || !sharedKey(key)) return;
    const parsed = typeof rawValue === "string" ? parseJson(rawValue) : rawValue;
    if (parsed == null) return;
    const type = typeOf(key, parsed);
    const target = canonicalKeys[type];
    if (!target) return;

    const clean = sanitizeValue(type, parsed);
    if (replaceTypes.has(type)) {
      if (key !== target) {
        if (staleCopyKey(key)) return;
        const oldValue = sanitizeValue(type, typeof oldRawValue === "string" ? parseJson(oldRawValue) : oldRawValue);
        const changed = stringify(oldValue) !== stringify(clean);
        const userWrite = /Storage\.prototype\.setItem|click|change|input|submit|beforeunload/i.test(reason || "");
        if (!changed || !userWrite) return;
      }
      copyTypeLocally(type, clean);
      queueDirect(target, target, type, clean, reason);
      return;
    }

    queueDirect(key, target, type, clean, reason);
  }

  async function hydrate() {
    if (hydrating || !window.fetch || window.location.protocol === "file:") return;
    hydrating = true;
    try {
      const remote = await fetchRemote();
      Object.entries(canonicalKeys).forEach(([type, target]) => {
        const remoteHasTarget = hasOwn(remote, target);
        const remoteValue = sanitizeValue(type, remote[target]);
        if (remoteHasTarget && (hasData(remoteValue) || type === "acts" || replaceTypes.has(type))) {
          writeLocal(target, remoteValue || []);
          localEntries()
            .filter(entry => entry.type === type && entry.key !== target && !staleCopyKey(entry.key))
            .forEach(entry => writeLocal(entry.key, remoteValue || []));
        } else if (!remoteHasTarget) {
          const localValue = sanitizeValue(type, readLocal(target));
          if (hasData(localValue)) queueDirect(target, target, type, localValue, "seed-remote");
        }
      });
      window.dispatchEvent(new CustomEvent("yango:shared-state-hydrated", { detail: { source: "universal-sync-v16" } }));
      showStatus(true, "Guardado en la nube OK");
    } catch (error) {
      console.warn("No pude hidratar datos compartidos:", error);
      showStatus(false, `No se pudo leer la nube: ${String(error.message || error).slice(0, 80)}`);
    } finally {
      hydrating = false;
      localEntries().forEach(entry => remember(entry.key, entry.value));
    }
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
        const incoming = sanitizeValue(entry.type, entry.value);
        let next = replaceTypes.has(entry.type) ? incoming : mergeObjects(current, incoming);
        next = sanitizeValue(entry.type, next);
        if (protectedTypes.has(entry.type) && !replaceTypes.has(entry.type) && !hasData(next)) continue;
        remote[entry.target] = next;
        await putRemote(entry.target, next);
        copyTypeLocally(entry.type, next);
      }
      window.dispatchEvent(new CustomEvent("yango:shared-state-synced", { detail: { source: "universal-sync-v16" } }));
      showStatus(true, "Guardado en la nube OK");
    } catch (error) {
      console.warn("No pude sincronizar cambios del panel:", error);
      showStatus(false, `No se guardó en la nube: ${String(error.message || error).slice(0, 80)}`);
      clearTimeout(flushTimer);
      flushTimer = setTimeout(flush, 2500);
    } finally {
      flushing = false;
    }
  }

  function scan(reason) {
    if (hydrating) return;
    localEntries().forEach(entry => {
      if (replaceTypes.has(entry.type) && entry.key !== entry.target) return;
      const raw = stringify(entry.value);
      if (lastSeen.get(String(entry.key)) !== raw) queueDirect(entry.key, entry.target, entry.type, entry.value, reason);
    });
  }

  if (proto && !proto.__yangoSharedStateStoragePatchV16) {
    Object.defineProperty(proto, "__yangoSharedStateStoragePatchV16", { value: true, configurable: true });
    proto.setItem = function yangoSharedSetItem(key, value) {
      const oldValue = this === localStorage ? localStorage.getItem(key) : null;
      const result = nativeSetItem.call(this, key, value);
      if (this === localStorage) queue(key, value, "Storage.prototype.setItem", oldValue);
      return result;
    };
    proto.removeItem = function yangoSharedRemoveItem(key) {
      const oldValue = this === localStorage ? readLocal(key) : null;
      const result = nativeRemoveItem.call(this, key);
      if (this === localStorage) {
        const type = typeOf(key, oldValue);
        const target = canonicalKeys[type];
        if (replaceTypes.has(type) && key === target) {
          queueDirect(target, target, type, [], "Storage.prototype.removeItem");
        } else if (!protectedTypes.has(type)) {
          queue(key, "[]", "Storage.prototype.removeItem", oldValue);
        }
      }
      return result;
    };
  }

  document.addEventListener("click", () => setTimeout(() => scan("click"), 450), true);
  document.addEventListener("change", () => setTimeout(() => scan("change"), 450), true);
  document.addEventListener("input", () => setTimeout(() => scan("input"), 650), true);
  document.addEventListener("submit", () => setTimeout(() => scan("submit"), 450), true);
  window.addEventListener("focus", () => { hydrate(); setTimeout(() => scan("focus"), 900); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { hydrate(); setTimeout(() => scan("visible"), 900); } });
  window.addEventListener("beforeunload", () => { scan("beforeunload"); flush(); });

  setTimeout(hydrate, 120);
  setTimeout(() => scan("startup"), 2200);
  setInterval(() => scan("interval"), 5000);
  setInterval(hydrate, 30000);
})();

(() => {
  if (typeof window === "undefined" || window.__yangoBtlMapPolishLoaderInstalledV11) return;
  window.__yangoBtlMapPolishLoaderInstalledV11 = true;
  const load = () => {
    if (document.querySelector('script[src^="/btl-map-polish.js"]')) return;
    const script = document.createElement("script");
    script.src = `/btl-map-polish.js?v=20260813h-${Date.now()}`;
    script.defer = true;
    document.head.appendChild(script);
  };
  setTimeout(load, 200);
  setTimeout(load, 2200);
})();
