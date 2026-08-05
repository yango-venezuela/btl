(() => {
  if (typeof window === "undefined") return;
  const SYNC_FLAG = "__yangoSafeSharedStateSyncInstalledV2";
  if (window[SYNC_FLAG]) return;
  window[SYNC_FLAG] = true;

  const HYDRATE_VERSION = "20260804b";
  const HYDRATE_MARKER = `yango_shared_state_hydrated_${HYDRATE_VERSION}`;

  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  const parseJson = value => {
    try { return JSON.parse(value); } catch (_error) { return null; }
  };

  const stableStringify = value => {
    try { return JSON.stringify(value); } catch (_error) { return String(value); }
  };

  const isObject = value => value && typeof value === "object" && !Array.isArray(value);
  const keyBlocked = key => /migration|backup|respaldo|auto_sync|token|password|pass|secret|hydrated|manual_rescue_bundle|device_id/i.test(String(key || ""));

  const sharedKeyPattern = /^(yango_|mkt_|btl_)/i;
  const sharedKeywordPattern = /agency|agencia|proof|photo|foto|flyer|promotor|acts|activation|activacion|calendar|calendario|adjust|qr|result|resultado|budget|presupuesto|influ|branding|pop|material|media|ooh|mystery|shopper|samsung|raffle|rifa|social|tiktok|instagram|users|usuarios/i;

  const isSharedDashboardKey = key => {
    const value = String(key || "");
    if (!value || keyBlocked(value)) return false;
    return sharedKeyPattern.test(value) || sharedKeywordPattern.test(value);
  };

  const isRescueCandidateKey = key => {
    const value = String(key || "");
    if (!value || keyBlocked(value)) return false;
    if (/debug|devtools|chakra|theme|sidebar|tooltip|toast|mapbox|leaflet/i.test(value)) return false;
    return true;
  };

  const typeFromKey = key => {
    const lower = String(key || "").toLowerCase();
    if (/agency|agencia|proof|photo|foto|promotor|flyer/.test(lower)) return "agency";
    if (/acts|activation|activacion|calendar|calendario|btl(?!_budget)/.test(lower)) return "acts";
    if (/adjust|qr|result|resultado/.test(lower)) return "qr";
    if (/influ/.test(lower)) return "influencers";
    if (/branding/.test(lower)) return "branding";
    if (/pop|material/.test(lower)) return "pop";
    if (/media|ooh/.test(lower)) return "media";
    if (/mystery|shopper/.test(lower)) return "mystery";
    if (/budget|presupuesto/.test(lower)) return "budgets";
    if (/social|instagram|tiktok/.test(lower)) return "social";
    if (/samsung|raffle|rifa/.test(lower)) return "raffle";
    if (/user|usuario/.test(lower)) return "users";
    return "unknown";
  };

  const typeFromValue = value => {
    const sample = stableStringify(value).slice(0, 8000).toLowerCase();
    if (/activaci|activation|calendario|calendar|sabana|petare|flyers|fecha calendario/.test(sample)) return "acts";
    if (/adjust|installs|clicks|registration|success_first_order|primer/.test(sample)) return "qr";
    if (/promotora|promotoras|foto|fotos|flyers entreg/.test(sample)) return "agency";
    if (/instagram|tiktok|influencer|microinfluencer|reach/.test(sample)) return "influencers";
    if (/ooh|banderola|parada bus|valla|reach estimado/.test(sample)) return "media";
    if (/longsleeves|chalecos|cascos|stickers|bipbip|dragopro|motogo/.test(sample)) return "branding";
    if (/mystery|shopper|visitada|operativa/.test(sample)) return "mystery";
    if (/samsung|rifa|premio|contactado|respondio/.test(sample)) return "raffle";
    return "unknown";
  };

  const stableId = item => {
    if (!isObject(item)) return "";
    return String(item.id || item.activationId || item.actId || item.uuid || item.key || item.phone || item.telefono || item.name || item.nombre || [item.title || "", item.date || item.fecha || item.calendarDate || "", item.location || item.zone || item.zona || ""].join("|")).trim();
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

  const mergeTypes = new Set(["agency", "acts", "qr", "pop", "branding", "media", "mystery", "influencers", "raffle", "budgets", "social", "users"]);
  const mergeSharedValue = (type, remoteValue, localValue) => mergeTypes.has(type) ? mergeObjectsDeep(remoteValue, localValue) : localValue;

  const fallbackKeyForType = type => ({
    agency: "yango_agency_submissions_h1",
    acts: "yango_activations_h1",
    qr: "yango_btl_results_h1",
    media: "yango_media_ooh_h1",
    pop: "yango_pop_inventory_h1",
    branding: "yango_branding_inventory_h1",
    influencers: "yango_influencers_h1",
    mystery: "yango_mystery_shopper_h1",
    raffle: "yango_samsung_raffle_h1",
    budgets: "yango_budgets_h1",
    social: "yango_social_media_h1",
    users: "yango_users_h1"
  })[type] || "";

  const canonicalRank = key => {
    const lower = String(key || "").toLowerCase();
    if (keyBlocked(lower)) return -100;
    if (/^yango_team_/.test(lower) || /^yango_agency_/.test(lower) || /^yango_agencia_/.test(lower)) return -30;
    if (/seed|sample|demo|template/.test(lower)) return -20;
    if (/^yango_/.test(lower)) return 30;
    if (/^mkt_|^btl_/.test(lower)) return 20;
    return 5;
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

  const originalSetItem = localStorage.setItem.bind(localStorage);

  const collectLocalEntries = () => {
    const entries = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!isSharedDashboardKey(key)) continue;
      const parsed = parseJson(localStorage.getItem(key));
      if (parsed == null) continue;
      entries.push({ key, value: parsed, type: typeFromKey(key), reason: "local-scan" });
    }
    return entries.filter(entry => entry.type !== "unknown");
  };

  const collectRescueEntries = () => {
    const entries = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!isRescueCandidateKey(key)) continue;
      const raw = localStorage.getItem(key);
      const parsed = parseJson(raw);
      if (parsed == null) continue;
      if (!Array.isArray(parsed) && !isObject(parsed)) continue;
      const type = typeFromKey(key) !== "unknown" ? typeFromKey(key) : typeFromValue(parsed);
      entries.push({ key, value: parsed, type, size: String(raw || "").length });
    }
    return entries.sort((a, b) => b.size - a.size);
  };

  const hydrateLocalFromRemote = async () => {
    if (!window.fetch || window.location.protocol === "file:") return;
    try {
      const remoteValues = await fetchRemoteValues();
      let changed = false;
      Object.entries(remoteValues).forEach(([key, value]) => {
        if (!isSharedDashboardKey(key) && !/^yango_rescue_/.test(key)) return;
        const currentValue = parseJson(localStorage.getItem(key));
        const type = typeFromKey(key) !== "unknown" ? typeFromKey(key) : typeFromValue(value);
        const mergedValue = mergeSharedValue(type, value, currentValue);
        const mergedText = stableStringify(mergedValue);
        const currentText = localStorage.getItem(key);
        if (currentText !== mergedText) {
          originalSetItem(key, mergedText);
          changed = true;
        }
      });
      window.dispatchEvent(new CustomEvent("yango:shared-state-hydrated", { detail: { keys: Object.keys(remoteValues).filter(isSharedDashboardKey) } }));
      if (changed && !sessionStorage.getItem(HYDRATE_MARKER)) {
        sessionStorage.setItem(HYDRATE_MARKER, "1");
        setTimeout(() => window.location.reload(), 350);
      }
    } catch (error) {
      console.warn("No pude hidratar datos compartidos:", error);
    }
  };

  const pending = new Map();
  let timer = null;
  let running = false;

  const queueEntry = (key, value, reason) => {
    if (!isSharedDashboardKey(key)) return;
    const parsed = typeof value === "string" ? parseJson(value) : value;
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
        if (!targetKeys.includes(entry.key) && canonicalRank(entry.key) >= 20) targetKeys.unshift(entry.key);
        targetKeys = [...new Set(targetKeys)];
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

  const runManualRescueSync = async button => {
    if (!window.fetch || window.location.protocol === "file:") return;
    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = "Sincronizando...";
    try {
      const remoteValues = await fetchRemoteValues();
      const entries = collectRescueEntries();
      const synced = [];
      for (const entry of entries) {
        await putState(entry.key, entry.value);
        synced.push(entry.key);
        const target = entry.type !== "unknown" ? fallbackKeyForType(entry.type) : "";
        if (target) {
          const merged = mergeSharedValue(entry.type, remoteValues[target], entry.value);
          remoteValues[target] = merged;
          await putState(target, merged);
          synced.push(target);
        }
      }
      button.textContent = `Listo: ${new Set(synced).size} datos`;
      window.dispatchEvent(new CustomEvent("yango:manual-shared-sync", { detail: { synced } }));
      setTimeout(() => {
        button.textContent = oldText;
        button.disabled = false;
      }, 3500);
    } catch (error) {
      console.warn("No pude hacer sync manual:", error);
      button.textContent = "Error sync";
      setTimeout(() => {
        button.textContent = oldText;
        button.disabled = false;
      }, 3500);
    }
  };

  const installManualSyncButton = () => {
    if (document.getElementById("yango-manual-shared-sync")) return;
    const style = document.createElement("style");
    style.textContent = `
      #yango-manual-shared-sync{position:fixed;right:18px;bottom:18px;z-index:99999;border:0;border-radius:999px;background:#111827;color:#fff;font:800 12px/1 system-ui,sans-serif;padding:12px 14px;box-shadow:0 12px 30px rgba(15,23,42,.22);cursor:pointer;}
      #yango-manual-shared-sync:hover{background:#ef1715;}
      #yango-manual-shared-sync:disabled{opacity:.7;cursor:wait;}
    `;
    document.head.appendChild(style);
    const button = document.createElement("button");
    button.id = "yango-manual-shared-sync";
    button.type = "button";
    button.textContent = "Sincronizar datos";
    button.title = "Sube a Railway los datos guardados en esta computadora";
    button.addEventListener("click", () => runManualRescueSync(button));
    document.body.appendChild(button);
  };

  localStorage.setItem = function patchedSetItem(key, value) {
    originalSetItem(key, value);
    queueEntry(key, value, "localStorage.setItem");
  };

  const actionableButton = target => {
    const button = target && target.closest && target.closest("button");
    if (!button) return false;
    const text = normalize(button.textContent || "");
    return /se dio|no se dio|guardar|aprob|validar|pagado|grabo|grabó|publico|publicó|entregado|contactado|respondio|respondió|salida|enviar|actualizar|subir|agregar|editar|cargar|importar|foto|fotos|flyer|promotora|media|ooh|ubicacion|ubicación|resultado|adjust|calendario|activacion|activación/.test(text);
  };

  const scanLocalSoon = reason => setTimeout(() => {
    collectLocalEntries().forEach(entry => queueEntry(entry.key, stableStringify(entry.value), reason));
  }, 350);

  document.addEventListener("click", event => {
    if (!actionableButton(event.target)) return;
    scanLocalSoon("button-scan");
  }, true);

  window.addEventListener("beforeunload", () => {
    collectLocalEntries().forEach(entry => queueEntry(entry.key, stableStringify(entry.value), "beforeunload"));
    flushPending();
  });

  setTimeout(hydrateLocalFromRemote, 100);
  setTimeout(installManualSyncButton, 700);
  setTimeout(() => {
    hydrateLocalFromRemote();
    collectLocalEntries().forEach(entry => queueEntry(entry.key, stableStringify(entry.value), "startup-scan"));
  }, 1800);
  setInterval(() => {
    hydrateLocalFromRemote();
    collectLocalEntries().forEach(entry => queueEntry(entry.key, stableStringify(entry.value), "interval-scan"));
  }, 30000);
})();

(() => {
  if (typeof window === "undefined" || window.__yangoBtlMapPolishLoaderInstalledV2) return;
  window.__yangoBtlMapPolishLoaderInstalledV2 = true;
  const load = () => {
    const script = document.createElement("script");
    script.src = `/btl-map-polish.js?v=20260803h-${Date.now()}`;
    script.defer = true;
    document.head.appendChild(script);
  };
  setTimeout(load, 100);
  setTimeout(load, 1800);
})();