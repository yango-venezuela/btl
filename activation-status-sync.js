(() => {
  if (typeof window === "undefined") return;
  const SYNC_FLAG = "__yangoSafeSharedStateSyncInstalledV4";
  if (window[SYNC_FLAG]) return;
  window[SYNC_FLAG] = true;

  const HYDRATE_VERSION = "20260810a";
  const HYDRATE_MARKER = `yango_shared_state_hydrated_${HYDRATE_VERSION}`;
  const pending = new Map();
  let timer = null;
  let running = false;
  let hydrating = false;

  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const stableStringify = value => { try { return JSON.stringify(value); } catch (_error) { return String(value); } };
  const parseJson = value => { try { return JSON.parse(value); } catch (_error) { return null; } };
  const isObject = value => value && typeof value === "object" && !Array.isArray(value);
  const keyBlocked = key => /migration|backup|respaldo|auto_sync|token|password|pass|secret|hydrated|manual_rescue_bundle|debug|devtools|chakra|theme|tooltip|toast|mapbox|leaflet/i.test(String(key || ""));
  const sharedKeyPattern = /^(yango_|mkt_|btl_)/i;
  const sharedKeywordPattern = /agency|agencia|proof|photo|foto|evidencia|flyer|promotor|acts|activation|activacion|calendar|calendario|adjust|qr|result|resultado|budget|presupuesto|influ|branding|pop|material|media|ooh|mystery|shopper|social|tiktok|instagram|users|usuarios/i;

  const fallbackKeyForType = type => ({
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
  })[type] || "";

  const typeFromKey = key => {
    const lower = String(key || "").toLowerCase();
    if (/agency|agencia|proof|photo|foto|evidencia|promotor|flyer/.test(lower)) return "agency";
    if (/acts|activation|activacion|calendar|calendario|btl(?!_budget)/.test(lower)) return "acts";
    if (/adjust|qr|result|resultado/.test(lower)) return "qr";
    if (/influ/.test(lower)) return "influencers";
    if (/branding/.test(lower)) return "branding";
    if (/pop|material/.test(lower)) return "pop";
    if (/media|ooh/.test(lower)) return "media";
    if (/mystery|shopper/.test(lower)) return "mystery";
    if (/budget|presupuesto/.test(lower)) return "budgets";
    if (/social|instagram|tiktok/.test(lower)) return "social";
    if (/user|usuario/.test(lower)) return "users";
    if (/samsung|raffle|rifa/.test(lower)) return "ignore";
    return "unknown";
  };

  const typeFromValue = value => {
    const sample = stableStringify(value).slice(0, 16000).toLowerCase();
    if (/promotora|promotoras|foto|fotos|photo|photos|evidencia|proof|flyers entreg|flyersentreg|cantidad de flyers|nombre de promotora|agency|agencia/.test(sample)) return "agency";
    if (/activaci|activation|calendario|calendar|sabana|petare|flyers|fecha calendario|centro de caracas|altamira|chacaito/.test(sample)) return "acts";
    if (/adjust|installs|clicks|registration|success_first_order|primer viaje|first order/.test(sample)) return "qr";
    if (/instagram|tiktok|influencer|microinfluencer|reach|followers|entregable/.test(sample)) return "influencers";
    if (/ooh|banderola|parada bus|valla|reach estimado|media/.test(sample)) return "media";
    if (/longsleeves|chalecos|cascos|stickers|bipbip|dragopro|motogo|branding/.test(sample)) return "branding";
    if (/material pop|gorras|landyards|llaveros|tote/.test(sample)) return "pop";
    if (/mystery|shopper|visitada|operativa/.test(sample)) return "mystery";
    if (/followers|aorp|organic reach|facebook|instagram|tiktok/.test(sample)) return "social";
    if (/presupuesto|budget|mtd|actuals/.test(sample)) return "budgets";
    if (/usuario|user|luis|giselle|agency/.test(sample)) return "users";
    return "unknown";
  };

  const isSharedDashboardKey = key => {
    const value = String(key || "");
    if (!value || keyBlocked(value)) return false;
    if (/samsung|raffle|rifa/i.test(value)) return false;
    return sharedKeyPattern.test(value) || sharedKeywordPattern.test(value);
  };

  const typeOfEntry = (key, value) => {
    const fromKey = typeFromKey(key);
    if (fromKey === "ignore") return "ignore";
    if (fromKey !== "unknown") return fromKey;
    return typeFromValue(value);
  };

  const stableId = item => {
    if (!isObject(item)) return "";
    const base = item.id || item.activationId || item.actId || item.uuid || item.key || item.responseId || item.phone || item.telefono || item.name || item.nombre || item.username || item.handle;
    if (base) return String(base).trim();
    return [item.title || item.titulo || "", item.date || item.fecha || item.calendarDate || "", item.location || item.ubicacion || item.zone || item.zona || "", item.type || item.tipo || ""].join("|").trim();
  };

  const score = value => {
    if (!isObject(value)) return value == null || value === "" ? 0 : 1;
    return Object.values(value).reduce((sum, item) => {
      if (Array.isArray(item)) return sum + item.filter(Boolean).length;
      if (isObject(item)) return sum + Object.keys(item).length;
      return sum + (item != null && String(item).trim() ? 1 : 0);
    }, 0);
  };

  const mergeArraysById = (remoteValue, localValue) => {
    const remote = Array.isArray(remoteValue) ? remoteValue : [];
    const local = Array.isArray(localValue) ? localValue : [];
    const merged = [...remote];
    const indexById = new Map();
    merged.forEach((item, index) => {
      const id = stableId(item);
      if (id) indexById.set(id, index);
    });
    local.forEach(item => {
      const id = stableId(item);
      if (id && indexById.has(id)) {
        const index = indexById.get(id);
        merged[index] = isObject(merged[index]) && isObject(item) ? { ...merged[index], ...item } : (score(item) >= score(merged[index]) ? item : merged[index]);
      } else {
        merged.push(item);
      }
    });
    return merged;
  };

  const mergeObjectsDeep = (remoteValue, localValue) => {
    if (Array.isArray(remoteValue) || Array.isArray(localValue)) return mergeArraysById(remoteValue, localValue);
    if (!isObject(remoteValue)) return localValue;
    if (!isObject(localValue)) return remoteValue;
    const next = { ...remoteValue };
    Object.keys(localValue).forEach(key => {
      if (Array.isArray(localValue[key]) || Array.isArray(remoteValue[key])) next[key] = mergeArraysById(remoteValue[key], localValue[key]);
      else if (isObject(localValue[key]) || isObject(remoteValue[key])) next[key] = mergeObjectsDeep(remoteValue[key], localValue[key]);
      else next[key] = localValue[key] !== undefined && localValue[key] !== null && localValue[key] !== "" ? localValue[key] : remoteValue[key];
    });
    return next;
  };

  const mergeTypes = new Set(["agency", "acts", "qr", "pop", "branding", "media", "mystery", "influencers", "budgets", "social", "users"]);
  const mergeSharedValue = (type, remoteValue, localValue) => mergeTypes.has(type) ? mergeObjectsDeep(remoteValue, localValue) : localValue;

  const canonicalRank = key => {
    const lower = String(key || "").toLowerCase();
    if (keyBlocked(lower) || /samsung|raffle|rifa/.test(lower)) return -100;
    if (/seed|sample|demo|template/.test(lower)) return -20;
    if (/^yango_/.test(lower)) return 40;
    if (/^mkt_|^btl_/.test(lower)) return 25;
    return 5;
  };

  const fetchRemoteValues = async () => {
    const response = await fetch("/api/state?t=" + Date.now(), { cache: "no-store" });
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

  const findCanonicalKeys = (remoteValues, type) => {
    const keys = Object.keys(remoteValues || {})
      .filter(key => canonicalRank(key) >= 0)
      .filter(key => typeOfEntry(key, remoteValues[key]) === type)
      .sort((a, b) => canonicalRank(b) - canonicalRank(a) || a.localeCompare(b));
    const fallback = fallbackKeyForType(type);
    if (fallback && !keys.includes(fallback)) keys.unshift(fallback);
    return [...new Set(keys)];
  };

  const originalSetItem = localStorage.setItem.bind(localStorage);

  const collectLocalEntries = () => {
    const entries = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!isSharedDashboardKey(key)) continue;
      const parsed = parseJson(localStorage.getItem(key));
      if (parsed == null) continue;
      const type = typeOfEntry(key, parsed);
      if (type === "unknown" || type === "ignore") continue;
      entries.push({ key, value: parsed, type, reason: "local-scan" });
    }
    return entries;
  };

  const mirrorTypeRemote = async (remoteValues, type) => {
    const fallback = fallbackKeyForType(type);
    if (!fallback) return;
    let value = remoteValues[fallback];
    let changed = false;
    Object.entries(remoteValues || {}).forEach(([key, entryValue]) => {
      if (key === fallback || keyBlocked(key)) return;
      if (typeOfEntry(key, entryValue) !== type) return;
      value = mergeSharedValue(type, value, entryValue);
      changed = true;
    });
    if (changed) {
      remoteValues[fallback] = value;
      await putState(fallback, value);
      originalSetItem(fallback, stableStringify(value));
    }
  };

  const mirrorAllCanonicalRemote = async remoteValues => {
    for (const type of mergeTypes) await mirrorTypeRemote(remoteValues, type);
  };

  const hydrateLocalFromRemote = async () => {
    if (hydrating || !window.fetch || window.location.protocol === "file:") return;
    hydrating = true;
    try {
      const remoteValues = await fetchRemoteValues();
      await mirrorAllCanonicalRemote(remoteValues);
      let changed = false;
      Object.entries(remoteValues).forEach(([key, value]) => {
        if (!isSharedDashboardKey(key) && !/^yango_rescue_/.test(key)) return;
        const type = typeOfEntry(key, value);
        if (type === "unknown" || type === "ignore") return;
        const currentValue = parseJson(localStorage.getItem(key));
        const mergedValue = currentValue == null ? value : mergeSharedValue(type, value, currentValue);
        const mergedText = stableStringify(mergedValue);
        if (localStorage.getItem(key) !== mergedText) {
          originalSetItem(key, mergedText);
          changed = true;
        }
      });
      window.dispatchEvent(new CustomEvent("yango:shared-state-hydrated", { detail: { keys: Object.keys(remoteValues).filter(isSharedDashboardKey) } }));
      if (changed && !sessionStorage.getItem(HYDRATE_MARKER)) {
        sessionStorage.setItem(HYDRATE_MARKER, "1");
        setTimeout(() => window.location.reload(), 300);
      }
    } catch (error) {
      console.warn("No pude hidratar datos compartidos:", error);
    } finally {
      hydrating = false;
    }
  };

  const queueEntry = (key, value, reason) => {
    if (!isSharedDashboardKey(key)) return;
    const parsed = typeof value === "string" ? parseJson(value) : value;
    if (parsed == null) return;
    const type = typeOfEntry(key, parsed);
    if (type === "unknown" || type === "ignore") return;
    pending.set(key, { key, value: parsed, type, reason });
    clearTimeout(timer);
    timer = setTimeout(flushPending, 700);
    setTimeout(flushPending, 2200);
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
        const targetKeys = findCanonicalKeys(remoteValues, entry.type);
        for (const key of targetKeys) {
          const merged = mergeSharedValue(entry.type, remoteValues[key], entry.value);
          remoteValues[key] = merged;
          await putState(key, merged);
          originalSetItem(key, stableStringify(merged));
          synced.push(`${entry.key}->${key}`);
        }
      }
      await mirrorAllCanonicalRemote(remoteValues);
      if (synced.length) window.dispatchEvent(new CustomEvent("yango:shared-state-synced", { detail: { synced } }));
    } catch (error) {
      console.warn("No pude sincronizar cambios del panel:", error);
    } finally {
      running = false;
    }
  };

  const scanLocalSoon = reason => setTimeout(() => {
    collectLocalEntries().forEach(entry => queueEntry(entry.key, stableStringify(entry.value), reason));
  }, 350);

  localStorage.setItem = function patchedSetItem(key, value) {
    originalSetItem(key, value);
    queueEntry(key, value, "localStorage.setItem");
  };

  const actionableTarget = target => {
    const element = target && target.closest && target.closest("button,input,select,textarea,label,[role='button']");
    if (!element) return false;
    const text = normalize(element.textContent || element.value || element.getAttribute("aria-label") || element.getAttribute("placeholder") || "");
    return /se dio|no se dio|guardar|aprob|validar|pagado|grabo|grabó|publico|publicó|entregado|contactado|respondio|respondió|salida|enviar|actualizar|subir|agregar|editar|cargar|importar|foto|fotos|flyer|promotora|media|ooh|ubicacion|ubicación|resultado|adjust|calendario|activacion|activación|influencer|branding|inventario|material|pop/.test(text);
  };

  document.addEventListener("click", event => { if (actionableTarget(event.target)) scanLocalSoon("click-scan"); }, true);
  document.addEventListener("change", () => scanLocalSoon("change-scan"), true);
  document.addEventListener("input", () => scanLocalSoon("input-scan"), true);
  document.addEventListener("submit", () => scanLocalSoon("submit-scan"), true);
  window.addEventListener("focus", () => { hydrateLocalFromRemote(); scanLocalSoon("focus-scan"); });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { hydrateLocalFromRemote(); scanLocalSoon("visibility-scan"); }
  });
  window.addEventListener("beforeunload", () => {
    collectLocalEntries().forEach(entry => queueEntry(entry.key, stableStringify(entry.value), "beforeunload"));
    flushPending();
  });

  setTimeout(hydrateLocalFromRemote, 100);
  setTimeout(() => { hydrateLocalFromRemote(); scanLocalSoon("startup-scan"); }, 1400);
  setTimeout(() => { hydrateLocalFromRemote(); scanLocalSoon("startup-rescan"); }, 4200);
  setInterval(() => { hydrateLocalFromRemote(); scanLocalSoon("interval-scan"); }, 12000);
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