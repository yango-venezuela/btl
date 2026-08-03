(() => {
  if (typeof window === "undefined") return;
  const SYNC_FLAG = "__yangoActivationStatusSyncInstalled";
  if (window[SYNC_FLAG]) return;
  window[SYNC_FLAG] = true;

  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  const looksLikeActivation = item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const text = normalize([
      item.name,
      item.title,
      item.zone,
      item.location,
      item.locationName,
      item.address,
      item.type,
      item.activationType,
      item.status,
      item.validation,
      item.executionStatus
    ].filter(Boolean).join(" "));
    const hasActivationFields = Boolean(item.date || item.calendarDate || item.location || item.zone || item.type || item.activationType);
    const hasActivationText = /activacion|btl|flyer|centro|petare|sabana|altamira|chacao|chacaito|hoyada|vega|junquito|antonio|universidad|oeste|este|sur|norte/.test(text);
    return hasActivationFields && (hasActivationText || Boolean(item.id && (item.name || item.title)));
  };

  const looksLikeActivationArray = value => Array.isArray(value) && value.length > 0 && value.some(looksLikeActivation);

  const parseJson = value => {
    try { return JSON.parse(value); } catch (_error) { return null; }
  };

  const localActivationCandidates = () => {
    const candidates = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      const value = parseJson(localStorage.getItem(key));
      if (!looksLikeActivationArray(value)) continue;
      candidates.push({ key, value });
    }
    return candidates.sort((a, b) => {
      const aTeam = /^yango_team_.*_acts/.test(a.key) ? 0 : 1;
      const bTeam = /^yango_team_.*_acts/.test(b.key) ? 0 : 1;
      if (aTeam !== bTeam) return aTeam - bTeam;
      const aCanonical = /team|backup|migration/i.test(a.key) ? 1 : 0;
      const bCanonical = /team|backup|migration/i.test(b.key) ? 1 : 0;
      if (aCanonical !== bCanonical) return aCanonical - bCanonical;
      return (b.value.length || 0) - (a.value.length || 0);
    });
  };

  const remoteActivationKeys = values => Object.keys(values || {}).filter(key => {
    if (/migration|backup/i.test(key)) return false;
    return looksLikeActivationArray(values[key]);
  }).sort((a, b) => {
    const aCanonical = /^yango_team_/.test(a) ? 1 : 0;
    const bCanonical = /^yango_team_/.test(b) ? 1 : 0;
    if (aCanonical !== bCanonical) return aCanonical - bCanonical;
    return a.localeCompare(b);
  });

  const putState = async (key, value) => {
    const response = await fetch(`/api/state/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value })
    });
    if (!response.ok) throw new Error(`API ${response.status}`);
  };

  let pendingTimer = null;
  let running = false;
  const flushActivationStatus = async reason => {
    if (running) return;
    if (!window.fetch || window.location.protocol === "file:") return;
    const candidates = localActivationCandidates();
    if (!candidates.length) return;
    const local = candidates[0];
    running = true;
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) return;
      const remote = await response.json();
      const keys = remoteActivationKeys(remote.values || {});
      const targetKeys = keys.length ? keys : candidates.map(item => item.key).filter(key => !/^yango_team_/.test(key));
      const uniqueKeys = [...new Set(targetKeys.length ? targetKeys : [local.key])];
      await Promise.all(uniqueKeys.map(key => putState(key, local.value)));
      window.dispatchEvent(new CustomEvent("yango:activation-status-synced", { detail: { reason, keys: uniqueKeys } }));
    } catch (error) {
      console.warn("No pude forzar sync de activaciones:", error);
    } finally {
      running = false;
    }
  };

  const scheduleFlush = reason => {
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => flushActivationStatus(reason), 900);
    setTimeout(() => flushActivationStatus(`${reason}:late`), 2200);
  };

  const isStatusButton = target => {
    const button = target && target.closest && target.closest("button");
    if (!button) return false;
    const text = normalize(button.textContent || "");
    return text.includes("se dio") || text.includes("no se dio") || text.includes("validar") || text.includes("aprob");
  };

  document.addEventListener("click", event => {
    if (isStatusButton(event.target)) scheduleFlush("status-button");
  }, true);

  const originalSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function patchedSetItem(key, value) {
    originalSetItem(key, value);
    const parsed = parseJson(value);
    if (looksLikeActivationArray(parsed)) scheduleFlush(`localStorage:${key}`);
  };
})();
