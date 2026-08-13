(() => {
  if (typeof window === "undefined" || window.__yangoPrebootStateGuardV11) return;
  window.__yangoPrebootStateGuardV11 = true;

  const RETIRED_KEY = /samsung|raffle|rifa/i;
  const RETIRED_TEXT = /rifa samsung|samsung raffle|raffle samsung|\brifa\b|samsung/i;
  const PANEL_HINT = /(?:[?&](?:panel|usuario|user|role|rol)=|\/)(luis|giselle|gise|agency|agencia|panel|usuario|user|role|rol)(?:[/?&#]|$)/i;
  const STATE_ENDPOINT = /\/api\/state(?:\?|$|\/)/;

  // These datasets are user-entered operating data. They must never be replaced
  // by an empty or stale cloud response during app boot.
  const PROTECTED_STATE_DEFS = [
    { key: "yango_influencers_h1", hint: /influ/i },
    { key: "yango_social_report_h1", hint: /social|smm/i },
    { key: "yango_agency_submissions_h1", hint: /agency|agencia|submission|proof|evidencia|foto|photo/i },
    { key: "yango_media_ooh_h1", hint: /media|ooh|valla|parada|banderola/i },
    { key: "yango_pop_inventory_h1", hint: /pop|material/i },
    { key: "yango_branding_inventory_h1", hint: /branding|brand|casco|chaleco|chaqueta|longsleeve|sticker/i },
    { key: "yango_mystery_shopper_h1", hint: /mystery|shopper/i },
    { key: "yango_budgets_h1", hint: /budget|presupuesto/i },
    { key: "yango_users_h1", hint: /users|usuarios|access|acceso/i }
  ];

  const text = value => String(value == null ? "" : value);
  const safeStringify = value => {
    try { return JSON.stringify(value); } catch (_error) { return String(value); }
  };
  const parseRaw = value => {
    if (value == null) return null;
    if (typeof value !== "string") return value;
    try { return JSON.parse(value); } catch (_error) { return null; }
  };
  const isObject = value => value && typeof value === "object" && !Array.isArray(value);

  function meaningful(value) {
    if (value == null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (isObject(value)) return Object.values(value).some(meaningful);
    const raw = text(value).trim();
    return !!raw && !/^(undefined|null|nan)$/i.test(raw);
  }

  function storageKeys() {
    const keys = [];
    try {
      for (let index = 0; index < localStorage.length; index += 1) keys.push(localStorage.key(index));
    } catch (_error) {}
    return keys.filter(Boolean);
  }

  function protectedDefForKey(key) {
    const raw = text(key);
    return PROTECTED_STATE_DEFS.find(def => def.key === raw || def.hint.test(raw));
  }

  function readLocal(key) {
    try { return parseRaw(localStorage.getItem(key)); } catch (_error) { return null; }
  }

  function writeLocal(key, value) {
    if (!meaningful(value)) return;
    try { localStorage.setItem(key, safeStringify(value)); } catch (_error) {}
  }

  function bestLocalFor(def) {
    const direct = readLocal(def.key);
    if (meaningful(direct)) return direct;

    let best = null;
    let bestScore = -1;
    storageKeys().forEach(key => {
      if (!key || RETIRED_KEY.test(key)) return;
      if (/token|password|secret|credential|session/i.test(key)) return;
      if (!def.hint.test(key)) return;
      const value = readLocal(key);
      if (!meaningful(value)) return;
      const score = safeStringify(value).length;
      if (score > bestScore) {
        best = value;
        bestScore = score;
      }
    });
    return best;
  }

  function stateKeyFromUrl(url) {
    try {
      const parsed = new URL(text(url), window.location.origin);
      const match = parsed.pathname.match(/\/api\/state\/([^/?#]+)/);
      return match ? decodeURIComponent(match[1]) : "";
    } catch (_error) {
      const match = text(url).match(/\/api\/state\/([^/?#]+)/);
      return match ? decodeURIComponent(match[1]) : "";
    }
  }

  function queueCloudRepair(key, value, originalFetch) {
    if (!key || !meaningful(value) || !originalFetch) return;
    window.__yangoProtectedCloudRepair = window.__yangoProtectedCloudRepair || new Set();
    const marker = `${key}:${safeStringify(value).length}`;
    if (window.__yangoProtectedCloudRepair.has(marker)) return;
    window.__yangoProtectedCloudRepair.add(marker);
    setTimeout(() => {
      try {
        originalFetch(`/api/state/${encodeURIComponent(key)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value })
        }).catch(() => {});
      } catch (_error) {}
    }, 120);
  }

  function rescueProtectedPayload(payload, url, originalFetch) {
    if (!payload || typeof payload !== "object") return payload;

    if (payload.values && typeof payload.values === "object") {
      PROTECTED_STATE_DEFS.forEach(def => {
        const remoteValue = payload.values[def.key];
        if (meaningful(remoteValue)) return;
        const localValue = bestLocalFor(def);
        if (!meaningful(localValue)) return;
        payload.values[def.key] = localValue;
        writeLocal(def.key, localValue);
        queueCloudRepair(def.key, localValue, originalFetch);
      });
      Object.keys(payload.values).forEach(key => {
        if (RETIRED_KEY.test(key)) delete payload.values[key];
      });
    }

    if (Object.prototype.hasOwnProperty.call(payload, "value")) {
      const requestedKey = stateKeyFromUrl(url);
      const def = protectedDefForKey(requestedKey);
      if (def && !meaningful(payload.value)) {
        const localValue = bestLocalFor(def);
        if (meaningful(localValue)) {
          payload.value = localValue;
          writeLocal(def.key, localValue);
          queueCloudRepair(def.key, localValue, originalFetch);
        }
      }
    }

    return payload;
  }

  function seedProtectedCanonicals() {
    PROTECTED_STATE_DEFS.forEach(def => {
      const direct = readLocal(def.key);
      if (meaningful(direct)) return;
      const localValue = bestLocalFor(def);
      if (meaningful(localValue)) writeLocal(def.key, localValue);
    });
  }

  function hideRetiredUi() {
    try {
      const nodes = Array.from(document.querySelectorAll("button,a,[role='button'],li,nav div,aside div,section,h1,h2,h3,h4,span,p"));
      nodes.forEach(node => {
        const label = text(node.textContent).replace(/\s+/g, " ").trim();
        if (!label || !RETIRED_TEXT.test(label)) return;
        const target = node.closest("button,a,li,[role='button'],section") || node;
        target.style.setProperty("display", "none", "important");
        target.setAttribute("aria-hidden", "true");
      });
    } catch (_error) {}
  }

  function dispatchSharedEvents(keys, changed) {
    try { window.dispatchEvent(new CustomEvent("yango:shared-state-hydrated", { detail: { keys, mirror: true, changed } })); } catch (_error) {}
    try { window.dispatchEvent(new CustomEvent("yango:collaborator-mirror-hydrated", { detail: { keys, changed } })); } catch (_error) {}
    keys.forEach(key => {
      try { window.dispatchEvent(new StorageEvent("storage", { key, newValue: localStorage.getItem(key), storageArea: localStorage })); } catch (_error) {}
    });
  }

  async function hydrateCollaboratorMirror(originalFetch) {
    if (!PANEL_HINT.test(window.location.href || "") || !originalFetch || window.location.protocol === "file:") return;
    if (window.__yangoCollaboratorMirrorRunning) return;
    window.__yangoCollaboratorMirrorRunning = true;
    try {
      const response = await originalFetch(`/api/state?mirror=1&t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = rescueProtectedPayload(await response.json(), "/api/state?mirror=1", originalFetch);
      const values = payload && payload.values && typeof payload.values === "object" ? payload.values : {};
      const keys = Object.keys(values).filter(key => !RETIRED_KEY.test(key));
      let changed = false;
      keys.forEach(key => {
        const value = values[key];
        const next = safeStringify(value);
        if (localStorage.getItem(key) !== next) {
          localStorage.setItem(key, next);
          changed = true;
        }
      });
      dispatchSharedEvents(keys, changed);
    } catch (_error) {
      // The normal sync script retries after boot.
    } finally {
      window.__yangoCollaboratorMirrorRunning = false;
    }
  }

  try {
    const originalSetItem = Storage && Storage.prototype && Storage.prototype.setItem;
    const originalRemoveItem = Storage && Storage.prototype && Storage.prototype.removeItem;
    if (originalSetItem && !Storage.prototype.__yangoSafeSetItemV11) {
      Object.defineProperty(Storage.prototype, "__yangoSafeSetItemV11", { value: true, configurable: true });
      Storage.prototype.setItem = function safeSetItem(key, value) {
        if (RETIRED_KEY.test(text(key))) return originalSetItem.call(this, key, "[]");
        const def = protectedDefForKey(key);
        if (def) {
          const incoming = parseRaw(value);
          const existing = parseRaw(this.getItem(key));
          if (!meaningful(incoming) && meaningful(existing)) return;
        }
        return originalSetItem.call(this, key, value);
      };
    }
    if (originalRemoveItem && !Storage.prototype.__yangoSafeRemoveItemV11) {
      Object.defineProperty(Storage.prototype, "__yangoSafeRemoveItemV11", { value: true, configurable: true });
      Storage.prototype.removeItem = function safeRemoveItem(key) {
        const def = protectedDefForKey(key);
        if (def && meaningful(parseRaw(this.getItem(key)))) return;
        return originalRemoveItem.call(this, key);
      };
    }
  } catch (_error) {}

  try {
    const originalFetch = window.fetch && window.fetch.bind(window);
    if (originalFetch && !window.__yangoSafeFetchV11) {
      window.__yangoSafeFetchV11 = true;
      window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        try {
          const url = text(args[0] && args[0].url || args[0]);
          if (!STATE_ENDPOINT.test(url)) return response;
          const payload = rescueProtectedPayload(await response.clone().json(), url, originalFetch);
          const headers = new Headers(response.headers);
          headers.set("Content-Type", "application/json; charset=utf-8");
          return new Response(JSON.stringify(payload), { status: response.status, statusText: response.statusText, headers });
        } catch (_error) {
          return response;
        }
      };
      hydrateCollaboratorMirror(originalFetch);
    }
  } catch (_error) {}

  function recoverFromErrorScreen() {
    try {
      hideRetiredUi();
      const body = document.body && document.body.innerText ? document.body.innerText : "";
      if (!/Algo salió mal/i.test(body)) return;
      if (!/qr\.reduce|reading 'reduce'|reading 'bg'|\bbg\b|localeCompare|date|undefined|null/i.test(body)) return;
      const attempts = Number(sessionStorage.getItem("yango_preboot_recovery_attempts_v11") || "0");
      if (attempts >= 2) return;
      sessionStorage.setItem("yango_preboot_recovery_attempts_v11", String(attempts + 1));
      seedProtectedCanonicals();
      setTimeout(() => window.location.reload(), 350);
    } catch (_error) {}
  }

  seedProtectedCanonicals();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", recoverFromErrorScreen);
  else recoverFromErrorScreen();
  try { new MutationObserver(() => { hideRetiredUi(); }).observe(document.documentElement, { childList: true, subtree: true }); } catch (_error) {}
  setTimeout(hideRetiredUi, 300);
  setTimeout(hideRetiredUi, 1500);
})();
