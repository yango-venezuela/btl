(() => {
  if (typeof window === "undefined" || window.__yangoManualRescueBundleSyncV1) return;
  window.__yangoManualRescueBundleSyncV1 = true;

  const BUNDLE_KEY = "yango_manual_rescue_bundle_h1";
  const APPLIED_PREFIX = "yango_manual_rescue_bundle_applied_";
  const originalSetItem = localStorage.setItem.bind(localStorage);

  const parseJson = value => {
    try { return JSON.parse(value); } catch (_error) { return null; }
  };

  const stableStringify = value => {
    try { return JSON.stringify(value); } catch (_error) { return String(value); }
  };

  const blocked = key => /migration|backup|respaldo|auto_sync|token|password|pass|secret|hydrated|applied/i.test(String(key || ""));
  const noisy = key => /debug|devtools|chakra|theme|sidebar|tooltip|toast|mapbox|leaflet|loglevel|amplitude|analytics|sentry|intercom/i.test(String(key || ""));

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
      entries.push({ key, value, size });
    }
    return entries.sort((a, b) => b.size - a.size).slice(0, 80).map(({ key, value, size }) => ({ key, value, size }));
  };

  const applyBundle = bundle => {
    if (!bundle || !Array.isArray(bundle.entries)) return false;
    let changed = false;
    bundle.entries.forEach(entry => {
      if (!entry || !entry.key || blocked(entry.key) || noisy(entry.key)) return;
      const next = stableStringify(entry.value);
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
      const values = await fetchState([BUNDLE_KEY]);
      const bundle = values[BUNDLE_KEY];
      if (!bundle || !bundle.updatedAt) return;
      const marker = `${APPLIED_PREFIX}${bundle.updatedAt}`;
      if (sessionStorage.getItem(marker)) return;
      const changed = applyBundle(bundle);
      sessionStorage.setItem(marker, "1");
      if (changed) setTimeout(() => window.location.reload(), 450);
    } catch (error) {
      console.warn("No pude aplicar paquete de rescate:", error);
    }
  };

  const uploadBundle = async button => {
    if (!window.fetch || window.location.protocol === "file:") return;
    const oldText = button ? button.textContent : "";
    if (button) {
      button.disabled = true;
      button.textContent = "Subiendo paquete...";
    }
    try {
      const entries = collectBundleEntries();
      const bundle = {
        updatedAt: new Date().toISOString(),
        origin: window.location.href,
        entries
      };
      await putState(BUNDLE_KEY, bundle);
      if (button) button.textContent = `Paquete listo: ${entries.length}`;
      window.dispatchEvent(new CustomEvent("yango:manual-rescue-bundle-uploaded", { detail: { entries: entries.length } }));
      setTimeout(() => {
        if (!button) return;
        button.textContent = oldText || "Sincronizar datos";
        button.disabled = false;
      }, 4000);
    } catch (error) {
      console.warn("No pude subir paquete de rescate:", error);
      if (button) {
        button.textContent = "Error paquete";
        setTimeout(() => {
          button.textContent = oldText || "Sincronizar datos";
          button.disabled = false;
        }, 4000);
      }
    }
  };

  const ensureButton = () => {
    let button = document.getElementById("yango-manual-shared-sync");
    if (!button) {
      const style = document.createElement("style");
      style.textContent = `
        #yango-manual-shared-sync{position:fixed;right:18px;bottom:18px;z-index:99999;border:0;border-radius:999px;background:#111827;color:#fff;font:800 12px/1 system-ui,sans-serif;padding:12px 14px;box-shadow:0 12px 30px rgba(15,23,42,.22);cursor:pointer;}
        #yango-manual-shared-sync:hover{background:#ef1715;}
        #yango-manual-shared-sync:disabled{opacity:.7;cursor:wait;}
      `;
      document.head.appendChild(style);
      button = document.createElement("button");
      button.id = "yango-manual-shared-sync";
      button.type = "button";
      button.textContent = "Sincronizar datos";
      button.title = "Sube a Railway los datos guardados en esta computadora";
      document.body.appendChild(button);
    }
    if (!button.dataset.rescueBundleSync) {
      button.dataset.rescueBundleSync = "1";
      button.addEventListener("click", () => setTimeout(() => uploadBundle(button), 250), true);
    }
  };

  setTimeout(hydrateBundle, 100);
  setTimeout(hydrateBundle, 1600);
  setTimeout(ensureButton, 900);
  setInterval(hydrateBundle, 30000);
})();