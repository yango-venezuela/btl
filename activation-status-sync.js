(() => {
  if (typeof window === "undefined") return;
  const SYNC_FLAG = "__yangoSafeSharedStateSyncInstalled";
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

  const isTeamOrAgencyKey = key => /^(yango_team_|yango_agency|yango_agencia)/i.test(String(key || ""))
    || /agency|agencia|proof|photo|foto|flyer|promotor/i.test(String(key || ""));

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

  const mergeTypes = new Set(["agency", "acts", "pop", "branding", "media", "mystery", "influencers", "raffle"]);
  const mergeSharedValue = (type, remoteValue, localValue) => mergeTypes.has(type) ? mergeObjectsDeep(remoteValue, localValue) : localValue;

  const fallbackKeyForType = type => ({
    agency: "yango_agency_submissions_h1",
    media: "yango_media_ooh_h1",
    pop: "yango_pop_inventory_h1",
    branding: "yango_branding_inventory_h1",
    influencers: "yango_influencers_h1",
    raffle: "yango_samsung_raffle_h1"
  })[type] || "";

  const canonicalRank = key => {
    const lower = String(key || "").toLowerCase();
    if (keyBlocked(lower)) return -100;
    if (/^yango_team_/.test(lower) || /^yango_agency_/.test(lower) || /^yango_agencia_/.test(lower)) return -50;
    if (/seed|sample|demo|template/.test(lower)) return -20;
    if (/^yango_/.test(lower)) return 20;
    return 0;
  };

  const fetchRemoteValues = async () => {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) throw new Error(`API ${response.status}`);
    const payload = await response.json();
    return payload.values || {};
  };

  const putState = async (key, value) => {
    const response = await fetch(`/api/state/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value })
    });
    if (!response.ok) throw new Error(`API ${response.status}`);
  };

  const findCanonicalKeys = (remoteValues, type) => Object.keys(remoteValues || {})
    .filter(key => canonicalRank(key) >= 0)
    .map(key => ({ key, type: typeFromKey(key), rank: canonicalRank(key) }))
    .filter(row => row.type === type)
    .sort((a, b) => b.rank - a.rank || a.key.localeCompare(b.key))
    .map(row => row.key);

  const pending = new Map();
  let timer = null;
  let running = false;

  const queueEntry = (key, value, reason) => {
    if (!key || keyBlocked(key) || !isTeamOrAgencyKey(key)) return;
    const parsed = parseJson(value);
    if (parsed == null) return;
    const type = typeFromKey(key);
    if (type === "unknown") return;
    pending.set(key, { key, value: parsed, type, reason });
    clearTimeout(timer);
    timer = setTimeout(flushPending, 900);
    setTimeout(flushPending, 2600);
  };

  const flushPending = async () => {
    if (running || !pending.size || !window.fetch || window.location.protocol === "file:") return;
    running = true;
    try {
      const remoteValues = await fetchRemoteValues();
      const entries = Array.from(pending.values());
      pending.clear();
      const synced = [];
      for (const entry of entries) {
        let targetKeys = findCanonicalKeys(remoteValues, entry.type);
        if (!targetKeys.length) {
          const fallback = fallbackKeyForType(entry.type);
          if (fallback) targetKeys = [fallback];
        }
        for (const key of targetKeys) {
          const merged = mergeSharedValue(entry.type, remoteValues[key], entry.value);
          remoteValues[key] = merged;
          await putState(key, merged);
          synced.push(`${entry.key}->${key}`);
        }
      }
      if (synced.length) {
        window.dispatchEvent(new CustomEvent("yango:shared-state-synced", { detail: { synced } }));
      }
    } catch (error) {
      console.warn("No pude sincronizar cambios del panel:", error);
    } finally {
      running = false;
    }
  };

  const originalSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function patchedSetItem(key, value) {
    originalSetItem(key, value);
    queueEntry(key, value, "localStorage.setItem");
  };

  const actionableButton = target => {
    const button = target && target.closest && target.closest("button");
    if (!button) return false;
    const text = normalize(button.textContent || "");
    return /se dio|no se dio|guardar|aprob|validar|pagado|grabo|grabó|publico|publicó|entregado|contactado|respondio|respondió|salida|enviar|actualizar|subir|agregar|editar|cargar|foto|fotos|flyer|promotora|media|ooh|ubicacion|ubicación/.test(text);
  };

  document.addEventListener("click", event => {
    if (!actionableButton(event.target)) return;
    setTimeout(() => {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key && isTeamOrAgencyKey(key)) queueEntry(key, localStorage.getItem(key), "button-scan");
      }
    }, 300);
  }, true);
})();
