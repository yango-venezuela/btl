(() => {
  if (typeof window === "undefined" || window.__yangoSamsungRaffleRemovedV1) return;
  window.__yangoSamsungRaffleRemovedV1 = true;

  const KEYS = ["yango_samsung_raffle_h1", "samsung_raffle", "rifa_samsung"];
  const TEXT_PATTERN = /rifa samsung|samsung|raffle/i;
  const KEY_PATTERN = /samsung|raffle|rifa/i;

  const clearLocalData = () => {
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) keys.push(localStorage.key(index));
    keys.filter(key => KEY_PATTERN.test(String(key || ""))).forEach(key => localStorage.removeItem(key));
  };

  const clearRemoteData = async () => {
    for (const key of KEYS) {
      try {
        await fetch(`/api/state/${encodeURIComponent(key)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: [] })
        });
      } catch (_error) {}
    }
  };

  const removeRaffleUi = () => {
    const candidates = [...document.querySelectorAll("button,a,[role='button'],li,nav div,aside div,section,main > div")];
    candidates.forEach(node => {
      const text = String(node.textContent || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      if (!TEXT_PATTERN.test(text)) return;
      if (node.matches && node.matches("section,main > div")) node.remove();
      else {
        const clickable = node.closest && node.closest("button,a,[role='button'],li");
        (clickable || node).remove();
      }
    });
  };

  const run = () => {
    clearLocalData();
    removeRaffleUi();
    clearRemoteData();
  };

  setTimeout(run, 50);
  setTimeout(run, 700);
  setTimeout(run, 2200);
  setInterval(removeRaffleUi, 5000);
})();
