(() => {
  if (typeof window === "undefined" || window.__yangoAutoRescueBundleSyncV2) return;
  window.__yangoAutoRescueBundleSyncV2 = true;

  const BUNDLE_PREFIX = "yango_manual_rescue_bundle_";
  const LEGACY_BUNDLE_KEY = "yango_manual_rescue_bundle_h1";
  const DEVICE_KEY = "yango_device_id_h1";
  const APPLIED_PREFIX = "yango_manual_rescue_bundle_applied_";
  const originalSetItem = localStorage.setItem.bind(localStorage);
  let uploadTimer = null;
  let uploading = false;
  let lastSignature = "";

  const parseJson = value => {
    try { return JSON.parse(value); } catch (_error) { return null; }
  };

  const stableStringify = value => {
    try { return JSON.stringify(value); } catch (_error) { return String(value); }
  };

  const blocked = key => /migration|backup|respaldo|auto_sync|token|password|pass|secret|hydrated|applied|manual_rescue_bundle|device_id/i.test(String(key || ""));
  const noisy = key => /debug|devtools|chakra|theme|sidebar|tooltip|toast|mapbox|leaflet|loglevel|amplitude|analytics|sentry|intercom/i.test(String(key || ""));
  const relevant = key => /yango|mkt|btl|agency|agencia|activ|calendar|calendario|adjust|result|resultado|influ|branding|pop|material|media|ooh|mystery|shopper|samsung|rifa|raffle|social|instagram|tiktok|user|usuario|budget|presupuesto/i.test(String(key || ""));

  const fetchState = async keys => {
    const url = keys && keys.length ? `/api/state?keys=${encodeURIComponent(keys.join(","))}` : "/api/state";
    const response = await fetch(url, { cache: "no-store" });
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

  const getDeviceId = () => {
    try {
      let id = localStorage.getItem(DEVICE_KEY);
      if (!id) {
        id = `device_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
        originalSetItem(DEVICE_KEY, id);
      }
      return id;
    } catch (_error) {
      return `device_${Math.random().toString(36).slice(2, 10)}`;
    }
  };

  const ownBundleKey = () => `${BUNDLE_PREFIX}${getDeviceId()}`;

  const removeManualButton = () => {
    document.getElementById("yango-manual-shared-sync")?.remove();
  };

  const collectBundleEntries = () => {
    const entries = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || blocked(key) || noisy(key)) continue;
      const raw = localStorage.getItem(key);
      const value = parseJson(raw);
      if (value == null) continue;
      if (typeof value !== "object") continue;
      const size = String(raw || "").length;
      if (size > 4_000_000) continue;
      const sample = String(raw || "").slice(0, 2500);
      if (!relevant(key) && !/activaci|calendar|calendario|petare|sabana|centro|flyer|promotora|influencer|ooh|branding|cascos|rifa|samsung/i.test(sample)) continue;
      entries.push({ key, value, size });
    }
    return entries.sort((a, b) => b.size - a.size).slice(0, 100).map(({ key, value, size }) => ({ key, value, size }));
  };

  const bundleSignature = entries => entries.map(entry => `${entry.key}:${entry.size}`).join("|");

  const valueId = value => {
    if (!value || typeof value !== "object") return "";
    return String(value.id || value.key || value.uuid || value.name || value.nombre || value.title || value.titulo || value.phone || value.telefono || value.date || value.fecha || "");
  };

  const mergeArrays = (current, incoming) => {
    const byId = new Map();
    const output = [];
    const add = item => {
      const id = valueId(item);
      if (!id) { output.push(item); return; }
      if (!byId.has(id)) { byId.set(id, output.length); output.push(item); return; }
      const index = byId.get(id);
      output[index] = safeMergeValue(output[index], item);
    };
    current.forEach(add);
    incoming.forEach(add);
    return output;
  };

  function safeMergeValue(current, incoming) {
    if (current == null) return incoming;
    if (incoming == null) return current;
    if (Array.isArray(current) && Array.isArray(incoming)) return mergeArrays(current, incoming);
    if (current && incoming && typeof current === "object" && typeof incoming === "object" && !Array.isArray(current) && !Array.isArray(incoming)) {
      const next = { ...current };
      Object.keys(incoming).forEach(key => { next[key] = safeMergeValue(current[key], incoming[key]); });
      return next;
    }
    return incoming;
  }

  const mergeEntries = (baseEntries, incomingEntries) => {
    const byKey = new Map();
    const add = entry => {
      if (!entry || !entry.key || blocked(entry.key) || noisy(entry.key)) return;
      const current = byKey.get(entry.key);
      const value = current ? safeMergeValue(current.value, entry.value) : entry.value;
      byKey.set(entry.key, { key: entry.key, value, size: String(stableStringify(value)).length });
    };
    (baseEntries || []).forEach(add);
    (incomingEntries || []).forEach(add);
    return Array.from(byKey.values()).sort((a, b) => b.size - a.size).slice(0, 150);
  };

  const applyBundle = bundle => {
    if (!bundle || !Array.isArray(bundle.entries)) return false;
    let changed = false;
    bundle.entries.forEach(entry => {
      if (!entry || !entry.key || blocked(entry.key) || noisy(entry.key)) return;
      const currentValue = parseJson(localStorage.getItem(entry.key));
      const merged = safeMergeValue(currentValue, entry.value);
      const next = stableStringify(merged);
      if (localStorage.getItem(entry.key) !== next) {
        originalSetItem(entry.key, next);
        changed = true;
      }
    });
    return changed;
  };

  const hydrateBundle = async () => {
    if (!window.fetch || window.location.protocol === "file:") return;
    try {
      const values = await fetchState();
      const bundles = Object.entries(values)
        .filter(([key, value]) => (key === LEGACY_BUNDLE_KEY || String(key).startsWith(BUNDLE_PREFIX)) && value && Array.isArray(value.entries))
        .map(([key, value]) => ({ key, ...value }))
        .sort((a, b) => String(a.updatedAt || "").localeCompare(String(b.updatedAt || "")));
      if (!bundles.length) return;
      const marker = `${APPLIED_PREFIX}${bundles.map(bundle => `${bundle.key}:${bundle.updatedAt || ""}`).join("|")}`;
      if (sessionStorage.getItem(marker)) return;
      const changed = bundles.some(bundle => applyBundle(bundle));
      sessionStorage.setItem(marker, "1");
      if (changed) setTimeout(() => window.location.reload(), 450);
    } catch (error) {
      console.warn("No pude aplicar paquete automático:", error);
    }
  };

  const uploadBundle = async reason => {
    if (!window.fetch || window.location.protocol === "file:" || uploading) return;
    uploading = true;
    try {
      const entries = collectBundleEntries();
      const signature = bundleSignature(entries);
      if (!entries.length || signature === lastSignature) return;
      lastSignature = signature;
      const key = ownBundleKey();
      const existingValues = await fetchState([key]).catch(() => ({}));
      const existingBundle = existingValues[key];
      const mergedEntries = mergeEntries(existingBundle && existingBundle.entries, entries);
      const bundle = {
        updatedAt: new Date().toISOString(),
        origin: window.location.href,
        reason,
        deviceId: getDeviceId(),
        entries: mergedEntries
      };
      await putState(key, bundle);
      window.dispatchEvent(new CustomEvent("yango:auto-rescue-bundle-uploaded", { detail: { entries: mergedEntries.length, reason } }));
    } catch (error) {
      console.warn("No pude subir paquete automático:", error);
    } finally {
      uploading = false;
    }
  };

  const scheduleUpload = reason => {
    clearTimeout(uploadTimer);
    uploadTimer = setTimeout(() => uploadBundle(reason), 1200);
  };

  localStorage.setItem = function yangoAutoBundleSetItem(key, value) {
    originalSetItem(key, value);
    if (!blocked(key) && !noisy(key)) scheduleUpload(`localStorage:${key}`);
  };

  document.addEventListener("click", event => {
    const button = event.target && event.target.closest && event.target.closest("button");
    if (!button) return;
    const text = String(button.textContent || "").toLowerCase();
    if (/guardar|cargar|subir|importar|agregar|editar|actualizar|se dio|no se dio|aprobar|validar|foto|fotos|resultado|calendario|activaci|influencer|ooh|branding|material|rifa/.test(text)) {
      scheduleUpload("button-action");
    }
  }, true);

  window.addEventListener("beforeunload", () => {
    const entries = collectBundleEntries();
    const signature = bundleSignature(entries);
    if (!entries.length || signature === lastSignature) return;
    const payload = JSON.stringify({ value: { updatedAt: new Date().toISOString(), origin: window.location.href, reason: "beforeunload", deviceId: getDeviceId(), entries } });
    try {
      navigator.sendBeacon(`/api/state/${encodeURIComponent(ownBundleKey())}`, new Blob([payload], { type: "application/json" }));
    } catch (_error) {}
  });

  setTimeout(removeManualButton, 200);
  setTimeout(removeManualButton, 1000);
  setInterval(removeManualButton, 2500);
  setTimeout(hydrateBundle, 100);
  setTimeout(hydrateBundle, 1600);
  setTimeout(() => uploadBundle("startup"), 2500);
  setInterval(hydrateBundle, 30000);
  setInterval(() => uploadBundle("interval"), 45000);
})();