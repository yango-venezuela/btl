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

  const fieldsText = item => normalize(Object.keys(item || {}).concat(Object.values(item || {}).filter(v => typeof v === "string" || typeof v === "number")).join(" "));

  const looksLikeActivation = item => {
    if (!isObject(item)) return false;
    const text = fieldsText(item);
    const hasFields = Boolean(item.date || item.calendarDate || item.location || item.zone || item.type || item.activationType || item.status || item.validation || item.executionStatus);
    const hasText = /activacion|btl|flyer|centro|petare|sabana|altamira|chacao|chacaito|hoyada|vega|junquito|antonio|universidad|oeste|este|sur|norte|se dio|no se dio|validar/.test(text);
    return hasFields && (hasText || Boolean(item.id && (item.name || item.title)));
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
    if (arraySome(value, looksLikeActivation)) return "acts";
    if (arraySome(value, looksLikeInfluencer)) return "influencers";
    if (arraySome(value, looksLikeBranding)) return "branding";
    if (arraySome(value, looksLikePop)) return "pop";
    if (arraySome(value, looksLikeMedia)) return "media";
    if (arraySome(value, looksLikeMystery)) return "mystery";

    const text = normalize(JSON.stringify(value || {}).slice(0, 12000));
    if (/clicks|installs|registration|registros|first order|primer viaje|promo code|canjes|qr/.test(text)) return "qr";
    if (/budget|presupuesto|planned|planificado|quarter|trimestre|month|mes/.test(text)) return "budgets";
    if (/instagram|tiktok|facebook|followers|reach|organic|orders|aov|gmv/.test(text)) return "social";
    if (/users|usuarios|access|permisos|luis|giselle|gise/.test(text) && isObject(value)) return "users";
    return "unknown";
  };

  const typeFromKey = key => {
    const lower = String(key || "").toLowerCase();
    if (/acts|activation|activacion/.test(lower)) return "acts";
    if (/influ/.test(lower)) return "influencers";
    if (/branding/.test(lower)) return "branding";
    if (/pop/.test(lower)) return "pop";
    if (/media|ooh/.test(lower)) return "media";
    if (/mystery|shopper/.test(lower)) return "mystery";
    if (/qr|result/.test(lower)) return "qr";
    if (/budget/.test(lower)) return "budgets";
    if (/social/.test(lower)) return "social";
    if (/user/.test(lower)) return "users";
    return "unknown";
  };

  const canonicalRank = key => {
    const lower = String(key || "").toLowerCase();
    if (keyBlocked(lower)) return -100;
    if (/^yango_team_/.test(lower)) return -50;
    if (/seed|sample|demo|template/.test(lower)) return -20;
    if (/^yango_/.test(lower)) return 20;
    return 0;
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

  const localTeamEntries = () => {
    const entries = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !/^yango_team_/i.test(key) || keyBlocked(key)) continue;
      const value = parseJson(localStorage.getItem(key));
      if (value == null) continue;
      const type = typeFromKey(key) !== "unknown" ? typeFromKey(key) : inferType(value);
      if (type === "unknown") continue;
      entries.push({ key, value, type });
    }
    return entries;
  };

  const saveEntryToSharedState = async (entry, remoteValues) => {
    const canonical = findCanonicalKeys(remoteValues, entry.type);
    if (!canonical.length) return [];
    await Promise.all(canonical.map(key => putState(key, entry.value)));
    return canonical;
  };

  let pendingTimer = null;
  let running = false;
  const flushTeamState = async reason => {
    if (running || !window.fetch || window.location.protocol === "file:") return;
    const entries = localTeamEntries();
    if (!entries.length) return;
    running = true;
    try {
      const remoteValues = await fetchRemoteValues();
      const synced = [];
      for (const entry of entries) {
        const keys = await saveEntryToSharedState(entry, remoteValues);
        keys.forEach(key => {
          remoteValues[key] = entry.value;
          synced.push(`${entry.key}->${key}`);
        });
      }
      if (synced.length) {
        window.dispatchEvent(new CustomEvent("yango:team-shared-state-synced", { detail: { reason, synced } }));
      }
    } catch (error) {
      console.warn("No pude forzar sync general del panel:", error);
    } finally {
      running = false;
    }
  };

  const scheduleFlush = reason => {
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => flushTeamState(reason), 700);
    setTimeout(() => flushTeamState(`${reason}:late`), 2200);
  };

  const actionableButton = target => {
    const button = target && target.closest && target.closest("button");
    if (!button) return false;
    const text = normalize(button.textContent || "");
    return /se dio|no se dio|guardar|aprob|validar|pagado|grabo|grabó|publico|publicó|entregado|contactado|respondio|respondió|salida|enviar|actualizar|subir|agregar|editar/.test(text);
  };

  document.addEventListener("click", event => {
    if (actionableButton(event.target)) scheduleFlush("button");
  }, true);
  document.addEventListener("change", () => scheduleFlush("change"), true);
  document.addEventListener("input", () => scheduleFlush("input"), true);

  const originalSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function patchedSetItem(key, value) {
    originalSetItem(key, value);
    if (/^yango_team_/i.test(String(key || ""))) scheduleFlush(`localStorage:${key}`);
  };

  setTimeout(() => flushTeamState("initial"), 2500);
})();
