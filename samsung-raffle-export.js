(() => {
  if (typeof window === "undefined" || window.__yangoSamsungRaffleRemovedV2) return;
  window.__yangoSamsungRaffleRemovedV2 = true;
  window.__yangoRemoveSamsungRaffleV1 = true;

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

  const normalizedText = node => String(node && node.textContent || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  const removeRaffleUi = () => {
    [...document.querySelectorAll("button,a,[role='button'],li")].forEach(node => {
      const text = normalizedText(node);
      if (TEXT_PATTERN.test(text) && text.length < 80) node.remove();
    });

    [...document.querySelectorAll("h1,h2,h3")].forEach(title => {
      if (!TEXT_PATTERN.test(normalizedText(title))) return;
      let node = title;
      for (let depth = 0; depth < 4 && node && node.parentElement; depth += 1) {
        const text = normalizedText(node.parentElement);
        if (text.includes("top 40") || text.includes("telefono") || text.includes("premio") || text.includes("contactado")) {
          node.parentElement.remove();
          return;
        }
        node = node.parentElement;
      }
      title.remove();
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
