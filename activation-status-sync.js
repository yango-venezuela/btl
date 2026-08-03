(() => {
  if (typeof window === "undefined") return;
  const SYNC_FLAG = "__yangoTeamSharedStateSyncInstalled";
  if (window[SYNC_FLAG]) return;
  window[SYNC_FLAG] = true;

  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  const parseJson = value => {
    try { return JSON.parse(value); } catch (_error) { return null; }
  };

  const isObject = value => value && typeof value === "object" && !Array.isArray(value);
  const keyBlocked = key => /migration|backup|auto_sync|token|password/i.test(String(key || ""));
  const MASTER_KEY_PATTERNS = [
    /yango_btl/i,
    /yango_qr/i,
    /yango_mystery/i,
    /yango_config/i,
    /yango_influ/i,
    /yango_social/i,
    /yango_btl_budget/i,
    /yango_pop/i,
    /yango_media_ooh/i,
    /yango_branding/i,
    /yango_users/i,
    /yango_agency/i,
    /yango_agencia/i,
    /yango_samsung/i,
    /yango_raffle/i
  ];
  const keyAllowed = key => {
    const text = String(key || "");
    return /^(yango_team_|yango_agency|yango_agencia)|agency|agencia|proof|photo|foto|flyer|promotor/i.test(text)
      || MASTER_KEY_PATTERNS.some(pattern => pattern.test(text));
  };

  const fieldsText = item => normalize(Object.keys(item || {}).concat(Object.values(item || {}).filter(v => typeof v === "string" || typeof v === "number")).join(" "));

  const looksLikeActivation = item => {
    if (!isObject(item)) return false;
    const text = fieldsText(item);
    const hasFields = Boolean(item.date || item.calendarDate || item.location || item.zone || item.type || item.activationType || item.status || item.validation || item.executionStatus);
    const hasText = /activacion|btl|flyer|centro|petare|sabana|altamira|chacao|chacaito|hoyada|vega|junquito|antonio|universidad|oeste|este|sur|norte|se dio|no se dio|validar/.test(text);
    return hasFields && (hasText || Boolean(item.id && (item.name || item.title)));
  };

  const looksLikeAgency = item => {
    if (!isObject(item)) return false;
    const text = fieldsText(item);
    return /agencia|agency|promotora|promotoras|flyers entregados|flyers|fotos|foto|photos|proof|prueba|evidencia|activacion|activation|entregado|asistencia/.test(text)
      && Boolean(item.id || item.activationId || item.actId || item.date || item.photos || item.fotos || item.flyers || item.flyersDelivered || item.promoters || item.promotoras || item.name || item.title);
  };

  const looksLikeInfluencer = item => {
    if (!isObject(item)) return false;
    const text = fieldsText(item);
    return /influencer|micro|instagram|tiktok|followers|reach|engagement|promo code|pagado|grabo|publico|reel|stories/.test(text)
      && Boolean(item.name || item.username || item.handle || item.ig || item.tiktok || item.followers || item.igFollowers || item.tiktokFollowers);
  };

  const looksLikeBranding = item => {
    if (!isObject(item)) return false;
    const text = fieldsText(item);
    return /stickers|cascos|longsleeves|chalecos|chaquetas|oficina|bipbip|dragopro|motogo|office stock|real stock|supplier/.test(text)
      && Boolean(item.product || item.variant || item.officeStock || item.partners || item.movements);
  };

  const looksLikePop = item => {
    if (!isObject(item)) return false;
    const text = fieldsText(item);
    return /material pop|gorras|landyards|lanyards|llaveros|tote|users general|drivers general|mundial|universidades|stock|salida/.test(text)
      && Boolean(item.name || item.item || item.product || item.category || item.stock || item.quantity);
  };

  const looksLikeMedia = item => {
    if (!isObject(item)) return false;
    const text = fieldsText(item);
    return /ooh|banderola|parada bus|valla|media|reach|lat|lng|direccion|ubicacion|activa|planificada|pausada/.test(text)
      && Boolean(item.type || item.status || item.location || item.address || item.lat || item.lng || item.reach);
  };

  const looksLikeMystery = item => {
    if (!isObject(item)) return false;
    const text = fieldsText(item);
    return /mystery|shopper|verificacion|verificado|evidencia|foto|auditoria/.test(text);
  };

  const arraySome = (value, fn) => Array.isArray(value) && value.some(fn);

  const inferType = value => {
    if (arraySome(value, looksLikeAgency)) return "agency";
    if (arraySome(value, looksLikeActivation)) return "acts";
    if (arraySome(value, looksLikeInfluencer)) return "influencers";
    if (arraySome(value, looksLikeBranding)) return "branding";
    if (arraySome(value, looksLikePop)) return "pop";
    if (arraySome(value, looksLikeMedia)) return "media";
    if (arraySome(value, looksLikeMystery)) return "mystery";

    const text = normalize(JSON.stringify(value || {}).slice(0, 20000));
    if (/agencia|agency|promotoras|promoters|flyers entregados|photos|fotos|proof|evidencia/.test(text)) return "agency";
    if (/clicks|installs|registration|registros|first order|primer viaje|promo code|canjes|qr/.test(text)) return "qr";
    if (/budget|presupuesto|planned|planificado|quarter|trimestre|month|mes/.test(text)) return "budgets";
    if (/instagram|tiktok|facebook|followers|reach|organic|orders|aov|gmv/.test(text)) return "social";
    if (/phone|telefono|premio|samsung|rifa|contactado|direccion|entregado/.test(text)) return "raffle";
    if (/users|usuarios|access|permisos|luis|giselle|gise/.test(text) && isObject(value)) return "users";
    return "unknown";
  };

  const typeFromKey = key => {
    const lower = String(key || "").toLowerCase();
    if (/agency|agencia|proof|photo|foto|promotor|flyer/.test(lower)) return "agency";
    if (/acts|activation|activacion|btl(?!_budget)/.test(lower)) return "acts";
    if (/influ/.test(lower)) return "influencers";
    if (/branding/.test(lower)) return "branding";
    if (/pop/.test(lower)) return "pop";
    if (/media|ooh/.test(lower)) return "media";
    if (/mystery|shopper/.test(lower)) return "mystery";
    if (/qr|result/.test(lower)) return "qr";
    if (/budget/.test(lower)) return "budgets";
    if (/social/.test(lower)) return "social";
    if (/samsung|raffle|rifa/.test(lower)) return "raffle";
    if (/user/.test(lower)) return "users";
    return "unknown";
  };

  const canonicalRank = key => {
    const lower = String(key || "").toLowerCase();
    if (keyBlocked(lower)) return -100;
    if (/^yango_team_/.test(lower) || /^yango_agency_/.test(lower) || /^yango_agencia_/.test(lower)) return -50;
    if (/seed|sample|demo|template/.test(lower)) return -20;
    if (/^yango_/.test(lower)) return 20;
    return 0;
  };

  const stableId = item => {
    if (!isObject(item)) return "";
    return String(item.id || item.activationId || item.actId || item.uuid || item.key || [item.name || item.title || "", item.date || item.calendarDate || "", item.location || item.zone || ""].join("|")).trim();
  };

  const mergeArraysById = (remoteValue, localValue) => {
    if (!Array.isArray(remoteValue) || !Array.isArray(localValue)) return localValue;
    const merged = [...remoteValue];
    const indexById = new Map();
    merged.forEach((item, index) => {
      const id = stableId(item);
      if (id) indexById.set(id, index);
    });
    localValue.forEach(item => {
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

  const mergeObjectsDeep = (remoteValue, localValue) => {
    if (Array.isArray(remoteValue) || Array.isArray(localValue)) return mergeArraysById(remoteValue, localValue);
    if (!isObject(remoteValue) || !isObject(localValue)) return localValue;
    const next = { ...remoteValue };
    Object.keys(localValue).forEach(key => {
      if (Array.isArray(localValue[key])) next[key] = mergeArraysById(remoteValue[key], localValue[key]);
      else if (isObject(localValue[key])) next[key] = mergeObjectsDeep(remoteValue[key], localValue[key]);
      else next[key] = localValue[key];
    });
    return next;
  };

  const mergeSharedValue = (type, remoteValue, localValue) => {
    if (["agency", "acts", "pop", "branding", "media", "mystery", "influencers", "raffle"].includes(type)) {
      return mergeObjectsDeep(remoteValue, localValue);
    }
    return localValue;
  };

  const putState = async (key, value) => {
    const response = await fetch(`/api/state/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value })
    });
    if (!response.ok) throw new Error(`API ${response.status}`);
  };

  const fetchRemoteValues = async () => {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) throw new Error(`API ${response.status}`);
    const payload = await response.json();
    return payload.values || {};
  };

  const findCanonicalKeys = (remoteValues, type) => Object.keys(remoteValues || {})
    .filter(key => canonicalRank(key) >= 0)
    .map(key => ({ key, value: remoteValues[key], type: typeFromKey(key), inferred: inferType(remoteValues[key]), rank: canonicalRank(key) }))
    .filter(row => row.type === type || row.inferred === type)
    .sort((a, b) => b.rank - a.rank || a.key.localeCompare(b.key))
    .map(row => row.key);

  const localEntries = () => {
    const entries = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !keyAllowed(key) || keyBlocked(key)) continue;
      const value = parseJson(localStorage.getItem(key));
      if (value == null) continue;
      const type = typeFromKey(key) !== "unknown" ? typeFromKey(key) : inferType(value);
      if (type === "unknown") continue;
      entries.push({ key, value, type, rank: canonicalRank(key) });
    }
    return entries.sort((a, b) => b.rank - a.rank || a.key.localeCompare(b.key));
  };

  const saveEntryToSharedState = async (entry, remoteValues) => {
    let canonical = findCanonicalKeys(remoteValues, entry.type);
    if (!canonical.length && entry.type === "agency") canonical = ["yango_agency_submissions_h1"];
    if (!canonical.length && entry.type === "media") canonical = ["yango_media_ooh_h1"];
    if (!canonical.length && entry.type === "pop") canonical = ["yango_pop_inventory_h1"];
    if (!canonical.length && entry.type === "branding") canonical = ["yango_branding_inventory_h1"];
    if (!canonical.length && entry.type === "influencers") canonical = ["yango_influencers_h1"];
    if (!canonical.length && entry.type === "raffle") canonical = ["yango_samsung_raffle_h1"];
    if (!canonical.length) return [];
    await Promise.all(canonical.map(key => {
      const mergedValue = mergeSharedValue(entry.type, remoteValues[key], entry.value);
      remoteValues[key] = mergedValue;
      return putState(key, mergedValue);
    }));
    return canonical;
  };

  let pendingTimer = null;
  let running = false;
  const flushSharedState = async reason => {
    if (running || !window.fetch || window.location.protocol === "file:") return;
    const entries = localEntries();
    if (!entries.length) return;
    running = true;
    try {
      const remoteValues = await fetchRemoteValues();
      const synced = [];
      for (const entry of entries) {
        const keys = await saveEntryToSharedState(entry, remoteValues);
        keys.forEach(key => synced.push(`${entry.key}->${key}`));
      }
      if (synced.length) {
        window.dispatchEvent(new CustomEvent("yango:shared-state-synced", { detail: { reason, synced } }));
      }
    } catch (error) {
      console.warn("No pude forzar sync general del panel:", error);
    } finally {
      running = false;
    }
  };

  const scheduleFlush = reason => {
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => flushSharedState(reason), 700);
    setTimeout(() => flushSharedState(`${reason}:late`), 2200);
    setTimeout(() => flushSharedState(`${reason}:final`), 5200);
  };

  const actionableButton = target => {
    const button = target && target.closest && target.closest("button");
    if (!button) return false;
    const text = normalize(button.textContent || "");
    return /se dio|no se dio|guardar|aprob|validar|pagado|grabo|grabó|publico|publicó|entregado|contactado|respondio|respondió|salida|enviar|actualizar|subir|agregar|editar|cargar|foto|fotos|flyer|promotora|media|ooh|ubicacion|ubicación/.test(text);
  };

  document.addEventListener("click", event => {
    if (actionableButton(event.target)) scheduleFlush("button");
  }, true);
  document.addEventListener("change", () => scheduleFlush("change"), true);
  document.addEventListener("input", () => scheduleFlush("input"), true);

  const originalSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function patchedSetItem(key, value) {
    originalSetItem(key, value);
    if (keyAllowed(key)) scheduleFlush(`localStorage:${key}`);
  };

  setTimeout(() => flushSharedState("initial"), 2500);
  setInterval(() => flushSharedState("interval"), 30000);
})();
