(() => {
  if (typeof window === "undefined" || window.__yangoCloudSaveStatusV6) return;
  window.__yangoCloudSaveStatusV6 = true;

  const STATUS_ID = "yango-cloud-save-status";
  const STYLE_ID = "yango-cloud-save-status-style";
  const HEALTH_URL = "/api/health";
  let lastOk = false;

  const escapeHtml = value => String(value || "").replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char] || char));
  const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  const compact = value => normalize(value).replace(/[^a-z0-9]+/g, "");
  const parseJson = value => { try { return JSON.parse(value); } catch (_error) { return null; } };
  const stringify = value => { try { return JSON.stringify(value); } catch (_error) { return String(value); } };
  const isObject = value => value && typeof value === "object" && !Array.isArray(value);
  const isActivationKey = key => /yango_activations|\bacts\b|activation|activacion|activaciones|calendar|calendario/i.test(String(key || ""));
  const looksLikeActivationArray = value => Array.isArray(value) && /activaci|activation|calendario|calendar|fecha calendario|sabana|petare|altamira|chacaito|flyers|helados|cafe|café|material pop/i.test(stringify(value).slice(0, 12000));
  const isUnnamedActivation = item => {
    if (!isObject(item)) return false;
    const name = normalize(item.name || item.nombre || item.title || item.titulo);
    return !name || name === "sin nombre" || compact(name) === "sinnombre" || ["undefined", "null", "nan", "-"].includes(name);
  };
  const sanitizeActivationCollection = value => Array.isArray(value) ? value.filter(item => !isUnnamedActivation(item)) : value;

  const ensureStyle = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${STATUS_ID}{position:fixed;left:18px;bottom:18px;z-index:2147483647;display:flex;align-items:center;gap:8px;max-width:min(460px,calc(100vw - 36px));border-radius:999px;padding:11px 14px;font:800 12px/1.2 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;box-shadow:0 18px 40px rgba(15,23,42,.22);border:1px solid rgba(255,255,255,.72);backdrop-filter:blur(12px);}
      #${STATUS_ID}.ok{background:#ecfdf3;color:#067647;border-color:#abefc6;}
      #${STATUS_ID}.bad{background:#fff1f3;color:#b42318;border-color:#fecdd3;}
      #${STATUS_ID}.checking{background:#f8fafc;color:#475467;border-color:#e4e7ec;}
      #${STATUS_ID} .dot{width:9px;height:9px;border-radius:999px;display:inline-block;background:currentColor;box-shadow:0 0 0 4px rgba(180,35,24,.14);}
      body.yango-cloud-save-offline::before{content:"NO SE ESTA GUARDANDO EN LA NUBE";position:fixed;top:0;left:0;right:0;z-index:2147483646;background:#b42318;color:#fff;text-align:center;font:900 12px/1 system-ui,sans-serif;letter-spacing:.08em;padding:8px 12px;}
      body.yango-cloud-save-offline{padding-top:28px;}
    `;
    document.head.appendChild(style);
  };

  const ensureBadge = () => {
    ensureStyle();
    let badge = document.getElementById(STATUS_ID);
    if (!badge) {
      badge = document.createElement("div");
      badge.id = STATUS_ID;
      badge.className = "checking";
      badge.innerHTML = "<span class=\"dot\"></span><span>Verificando guardado en la nube...</span>";
      document.body.appendChild(badge);
    }
    return badge;
  };

  const setStatus = (ok, message) => {
    lastOk = Boolean(ok);
    const badge = ensureBadge();
    badge.className = ok ? "ok" : "bad";
    badge.innerHTML = `<span class="dot"></span><span>${escapeHtml(message)}</span>`;
    document.body.classList.toggle("yango-cloud-save-offline", !ok);
    window.dispatchEvent(new CustomEvent("yango:cloud-save-status", { detail: { ok, message } }));
  };

  const putState = async (key, value) => {
    const response = await fetch(`/api/state/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value })
    });
    if (!response.ok) throw new Error(`API ${response.status}`);
  };

  const purgeUnnamedActivations = async source => {
    if (window.__yangoPurgeUnnamedActivationsRunning) return;
    window.__yangoPurgeUnnamedActivationsRunning = true;
    const changedKeys = [];
    try {
      const localKeys = [];
      for (let i = 0; i < localStorage.length; i += 1) localKeys.push(localStorage.key(i));
      localKeys.filter(Boolean).forEach(key => {
        if (!isActivationKey(key)) return;
        const value = parseJson(localStorage.getItem(key));
        if (!looksLikeActivationArray(value)) return;
        const clean = sanitizeActivationCollection(value);
        if (stringify(clean) !== stringify(value)) {
          localStorage.setItem(key, stringify(clean));
          changedKeys.push(key);
        }
      });

      const res = await fetch(`/api/state?t=${Date.now()}&purgeUnnamed=1`, { cache: "no-store" });
      const payload = await res.json().catch(() => ({}));
      const values = payload && payload.values && typeof payload.values === "object" ? payload.values : {};
      const remoteChanged = [];
      Object.keys(values).forEach(key => {
        const value = values[key];
        if (!isActivationKey(key) && !looksLikeActivationArray(value)) return;
        if (!looksLikeActivationArray(value)) return;
        const clean = sanitizeActivationCollection(value);
        if (stringify(clean) !== stringify(value)) remoteChanged.push({ key, value: clean });
      });
      for (const item of remoteChanged) {
        await putState(item.key, item.value);
        localStorage.setItem(item.key, stringify(item.value));
        changedKeys.push(item.key);
      }

      if (changedKeys.length) {
        window.dispatchEvent(new CustomEvent("yango:shared-state-hydrated", { detail: { purgeUnnamedActivations: true, keys: changedKeys, source } }));
        window.dispatchEvent(new CustomEvent("yango:shared-state-synced", { detail: { purgeUnnamedActivations: true, keys: changedKeys, source } }));
        setStatus(true, `Guardado en la nube OK · ${changedKeys.length} limpiezas`);
        if (!sessionStorage.getItem("yango_purged_unnamed_activations_reloaded_v1")) {
          sessionStorage.setItem("yango_purged_unnamed_activations_reloaded_v1", "1");
          setTimeout(() => window.location.reload(), 700);
        }
      }
    } catch (error) {
      console.warn("No pude limpiar activaciones sin nombre:", error);
    } finally {
      window.__yangoPurgeUnnamedActivationsRunning = false;
    }
  };

  const check = async () => {
    try {
      const res = await fetch(`${HEALTH_URL}?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data && data.ok && data.database === "connected") {
        setStatus(true, "Guardado en la nube OK");
        purgeUnnamedActivations("health-check");
      } else setStatus(false, "No se esta guardando en la nube" + (data && data.error ? `: ${String(data.error).slice(0, 80)}` : ""));
    } catch (error) {
      setStatus(false, "No se esta guardando en la nube: " + String(error && error.message || error).slice(0, 80));
    }
  };

  const originalFetch = window.fetch ? window.fetch.bind(window) : null;
  if (originalFetch && !window.__yangoCloudSaveFetchMonitorV6) {
    window.__yangoCloudSaveFetchMonitorV6 = true;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      try {
        const url = String(args[0] && args[0].url || args[0] || "");
        const method = String(args[1] && args[1].method || "GET").toUpperCase();
        if (/\/api\/state\//.test(url) && ["PUT", "POST", "PATCH"].includes(method)) {
          if (!response.ok) setStatus(false, `No se guardo en la nube (API ${response.status})`);
          else if (!lastOk) setTimeout(check, 300);
        }
      } catch (_error) {}
      return response;
    };
  }

  setTimeout(check, 600);
  setTimeout(check, 3500);
  setTimeout(() => purgeUnnamedActivations("startup"), 5200);
  setInterval(check, 30000);
})();