(() => {
  if (typeof window === "undefined" || window.__yangoAuthoritativeInfluencerSyncV1) return;
  window.__yangoAuthoritativeInfluencerSyncV1 = true;

  const KEY = "yango_influencers_h1";
  let hydrating = false;
  let pushing = false;
  let ready = false;
  let timer = null;
  let lastSynced = "";

  const parse = value => { try { return JSON.parse(value); } catch (_error) { return null; } };
  const stringify = value => { try { return JSON.stringify(value); } catch (_error) { return String(value); } };
  const cleanText = value => String(value == null ? "" : value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

  function sanitize(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Map();
    value.forEach(item => {
      if (!item || typeof item !== "object") return;
      const name = cleanText(item.name || item.nombre);
      const handle = cleanText(item.handle || item.igUsername || item.instagram || item.tiktokUsername);
      const key = `${name}|${handle}`;
      if (!name && !handle) return;
      if (name === "carlos rides") return;
      if (!seen.has(key)) seen.set(key, item);
      else seen.set(key, { ...seen.get(key), ...item });
    });
    return [...seen.values()];
  }

  function localValue() {
    return sanitize(parse(localStorage.getItem(KEY)));
  }

  function setLocal(value) {
    const next = stringify(sanitize(value));
    if (localStorage.getItem(KEY) !== next) localStorage.setItem(KEY, next);
    lastSynced = next;
  }

  async function hydrate() {
    if (!window.fetch || window.location.protocol === "file:" || hydrating || pushing) return;
    hydrating = true;
    try {
      const response = await fetch(`/api/state?keys=${encodeURIComponent(KEY)}&t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json();
      const remote = payload && payload.values ? payload.values[KEY] : undefined;
      if (Array.isArray(remote)) setLocal(remote);
      ready = true;
    } catch (_error) {
      ready = true;
    } finally {
      hydrating = false;
    }
  }

  async function pushNow(reason = "change") {
    if (!ready || hydrating || pushing || window.__yangoCollaboratorMirrorPending) return;
    const value = localValue();
    const raw = stringify(value);
    if (raw === lastSynced && reason !== "force") return;
    pushing = true;
    try {
      const response = await fetch(`/api/state/${encodeURIComponent(KEY)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value })
      });
      if (response.ok) {
        lastSynced = raw;
        window.dispatchEvent(new CustomEvent("yango:influencers-authoritative-synced", { detail: { count: value.length, reason } }));
      }
    } catch (_error) {
      // The normal sync will retry; this helper should never break the UI.
    } finally {
      pushing = false;
    }
  }

  function schedulePush(reason) {
    clearTimeout(timer);
    timer = setTimeout(() => pushNow(reason), 700);
    setTimeout(() => pushNow(reason), 2200);
  }

  const previousSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function setItemWithInfluencerAuthority(key, value) {
    previousSetItem(key, value);
    if (key === KEY) schedulePush("localStorage.setItem");
  };

  document.addEventListener("click", () => schedulePush("click"), true);
  document.addEventListener("change", () => schedulePush("change"), true);
  document.addEventListener("input", () => schedulePush("input"), true);
  window.addEventListener("focus", hydrate);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) hydrate(); });

  hydrate();
  setTimeout(hydrate, 1500);
  setInterval(hydrate, 15000);
})();
