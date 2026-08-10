(() => {
  if (typeof window === "undefined" || window.__yangoSummaryLoopGuardV1) return;
  window.__yangoSummaryLoopGuardV1 = true;

  const text = value => String(value || "").replace(/\s+/g, " ").trim();
  const retired = value => /rifa samsung|samsung raffle|raffle samsung|samsung|rifa/i.test(text(value));

  try {
    const originalSetInterval = window.setInterval && window.setInterval.bind(window);
    if (originalSetInterval && !window.__yangoOriginalSetInterval) {
      window.__yangoOriginalSetInterval = originalSetInterval;
      window.setInterval = function guardedSetInterval(callback, delay, ...args) {
        const source = String(callback || "");
        if (Number(delay) === 1500 && /activateSummary|yango-summary-dashboard|yds-nav-shortcut|syncNavCompact/.test(source)) {
          return originalSetInterval(() => {
            try {
              const hasShortcut = Boolean(document.getElementById("yds-nav-shortcut"));
              const hasMount = Boolean(document.getElementById("yango-summary-dashboard"));
              if (!hasShortcut || !hasMount) callback(...args);
            } catch (_error) {}
          }, 10000);
        }
        return originalSetInterval(callback, delay, ...args);
      };
    }
  } catch (_error) {}

  function cleanStorage() {
    try {
      const keys = [];
      for (let index = 0; index < localStorage.length; index += 1) keys.push(localStorage.key(index));
      keys.filter(key => /samsung|raffle|rifa/i.test(String(key || ""))).forEach(key => localStorage.removeItem(key));
    } catch (_error) {}
  }

  function hideRetiredUi() {
    try {
      cleanStorage();
      Array.from(document.querySelectorAll("button,a,[role='button']")).forEach(node => {
        if (!retired(node.textContent)) return;
        node.setAttribute("aria-hidden", "true");
        node.style.setProperty("display", "none", "important");
      });
      Array.from(document.querySelectorAll("div,span,p,h2,h3,h4")).forEach(node => {
        if (text(node.textContent).toLowerCase() !== "rifa") return;
        const parent = node.parentElement;
        const siblings = parent ? Array.from(parent.children) : [];
        const nearbyHasRetired = siblings.some(child => retired(child.textContent));
        if (nearbyHasRetired || siblings.length <= 2) {
          node.setAttribute("aria-hidden", "true");
          node.style.setProperty("display", "none", "important");
        }
      });
    } catch (_error) {}
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; hideRetiredUi(); }, 120);
  }

  cleanStorage();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hideRetiredUi);
  else hideRetiredUi();
  window.addEventListener("load", hideRetiredUi);
  try { new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true }); } catch (_error) {}
  setTimeout(hideRetiredUi, 600);
  setTimeout(hideRetiredUi, 2200);
})();