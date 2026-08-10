(() => {
  if (typeof window === "undefined" || window.__yangoSharedStateSyncV5) return;
  window.__yangoSharedStateSyncV5 = true;

  const pending = new Map();
  let timer = null;
  let flushing = false;
  let hydrating = false;

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

  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const parseJson = value => { try { return JSON.parse(value); } catch (_error) { return null; } };
  const stringify = value => { try { return JSON.stringify(value); } catch (_error) { return String(value); } };
  const isObject = value => value && typeof value === "object" && !Array.isArray(value);
  const blockedKey = key => /migration|backup|respaldo|token|password|pass|secret|hydrated|debug|devtools|theme|tooltip|toast|mapbox|leaflet/i.test(String(key || ""));

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
    if (!k || blockedKey(k)) return false;
    return /^(yango_|mkt_|btl_)/i.test(k) || /agency|agencia|proof|photo|foto|evidencia|flyer|promotor|acts|activation|activacion|calendar|calendario|adjust|qr|result|resultado|budget|presupuesto|influ|branding|pop|material|media|ooh|mystery|shopper|social|tiktok|instagram|users|usuarios/i.test(k);
  };

  const typeOf = (key, value) => {
    const fromKey = typeFromKey(key);
    return fromKey !== "unknown" ? fromKey : typeFromValue(value);
  };

  const stableId = item => {
    if (!isObject(item)) return "";
    return String(item.id || item.activationId || item.actId || item.uuid || item.key || item.responseId || item.name || item.nombre || item.username || item.handle || [item.title || item.titulo || "", item.date || item.fecha || item.calendarDate || "", item.location || item.ubicacion || item.zone || item.zona || "", item.type || item.tipo || ""].join("|")).trim();
  };

  const mergeArrays = (remoteValue, localValue) => {
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
        merged[index] = isObject(merged[index]) && isObject(item) ? { ...merged[index], ...item } : item;
      } else {
        merged.push(item);
      }
    });
    return merged;
  };

  const merge = (remoteValue, localValue) => {
    if (Array.isArray(remoteValue) || Array.isArray(localValue)) return mergeArrays(remoteValue, localValue);
    if (!isObject(remoteValue)) return localValue === undefined || localValue === null ? remoteValue : localValue;
    if (!isObject(localValue)) return remoteValue;
    const next = { ...remoteValue };
    Object.keys(localValue).forEach(key => {
      if (Array.isArray(remoteValue[key]) || Array.isArray(localValue[key])) next[key] = mergeArrays(remoteValue[key], localValue[key]);
      else if (isObject(remoteValue[key]) || isObject(localValue[key])) next[key] = merge(remoteValue[key], localValue[key]);
      else next[key] = localValue[key] !== undefined && localValue[key] !== null && localValue[key] !== "" ? localValue[key] : remoteValue[key];
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

  const collectLocal = () => {
    const entries = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!sharedKey(key)) continue;
      const value = parseJson(localStorage.getItem(key));
      if (value == null) continue;
      const type = typeOf(key, value);
      if (!canonicalKeys[type]) continue;
      entries.push({ key, type, value });
    }
    return entries;
  };

  const hydrate = async () => {
    if (hydrating || !window.fetch || window.location.protocol === "file:") return;
    hydrating = true;
    try {
      const remote = await fetchRemote();
      Object.entries(remote).forEach(([key, remoteValue]) => {
        if (!sharedKey(key)) return;
        const localValue = parseJson(localStorage.getItem(key));
        const merged = localValue == null ? remoteValue : merge(remoteValue, localValue);
        originalSetItem(key, stringify(merged));
      });
      window.dispatchEvent(new CustomEvent("yango:shared-state-hydrated", { detail: { keys: Object.keys(remote).filter(sharedKey) } }));
    } catch (error) {
      console.warn("No pude hidratar datos compartidos:", error);
    } finally {
      hydrating = false;
    }
  };

  const queue = (key, rawValue, reason) => {
    if (!sharedKey(key)) return;
    const value = typeof rawValue === "string" ? parseJson(rawValue) : rawValue;
    if (value == null) return;
    const type = typeOf(key, value);
    const target = canonicalKeys[type];
    if (!target) return;
    pending.set(`${key}->${target}`, { key, target, type, value, reason });
    clearTimeout(timer);
    timer = setTimeout(flush, 700);
    setTimeout(flush, 2200);
  };

  const flush = async () => {
    if (flushing || !pending.size || !window.fetch || window.location.protocol === "file:") return;
    flushing = true;
    try {
      const remote = await fetchRemote();
      const entries = Array.from(pending.values());
      pending.clear();
      const synced = [];
      for (const entry of entries) {
        const current = remote[entry.target];
        const merged = merge(current, entry.value);
        remote[entry.target] = merged;
        await putRemote(entry.target, merged);
        originalSetItem(entry.target, stringify(merged));
        synced.push(`${entry.key}->${entry.target}`);
      }
      if (synced.length) window.dispatchEvent(new CustomEvent("yango:shared-state-synced", { detail: { synced } }));
    } catch (error) {
      console.warn("No pude sincronizar cambios del panel:", error);
    } finally {
      flushing = false;
    }
  };

  const scanSoon = reason => setTimeout(() => collectLocal().forEach(entry => queue(entry.key, entry.value, reason)), 350);

  localStorage.setItem = function patchedSetItem(key, value) {
    originalSetItem(key, value);
    queue(key, value, "localStorage.setItem");
  };

  document.addEventListener("click", () => scanSoon("click"), true);
  document.addEventListener("change", () => scanSoon("change"), true);
  document.addEventListener("input", () => scanSoon("input"), true);
  document.addEventListener("submit", () => scanSoon("submit"), true);
  window.addEventListener("focus", () => { hydrate(); scanSoon("focus"); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { hydrate(); scanSoon("visible"); } });
  window.addEventListener("beforeunload", () => { scanSoon("beforeunload"); flush(); });

  setTimeout(hydrate, 150);
  setTimeout(() => { hydrate(); scanSoon("startup"); }, 1600);
  setTimeout(() => { hydrate(); scanSoon("startup-rescan"); }, 4500);
  setInterval(() => { hydrate(); scanSoon("interval"); }, 15000);
})();

(() => {
  if (typeof window === "undefined" || window.__yangoBtlMapPolishLoaderInstalledV3) return;
  window.__yangoBtlMapPolishLoaderInstalledV3 = true;
  const load = () => {
    const script = document.createElement("script");
    script.src = `/btl-map-polish.js?v=20260810a-${Date.now()}`;
    script.defer = true;
    document.head.appendChild(script);
  };
  setTimeout(load, 100);
  setTimeout(load, 1800);
})();