(() => {
  const duplicatedLabels = new Set(["Resumen general", "Oficina", "BipBip", "DragoPro", "MotoGo"]);

  function hasBrandingHeroContext(element) {
    let node = element.parentElement;
    while (node && node !== document.body) {
      const text = (node.textContent || "").replace(/\s+/g, " ").trim();
      const rect = node.getBoundingClientRect();
      if (text.includes("Branding · Inventario") && rect.width > 500 && rect.height <= 160) {
        return true;
      }
      node = node.parentElement;
    }
    return false;
  }

  function hideDuplicatedBrandingHeroLabel() {
    const pageText = document.body ? document.body.innerText || "" : "";
    if (!pageText.includes("BRANDING · INVENTARIO") && !pageText.includes("Branding · Inventario")) return;

    document.querySelectorAll("body *").forEach(element => {
      if (element.dataset.brandingHeroLabelCleaned === "true") return;
      const text = (element.textContent || "").replace(/\s+/g, " ").trim();
      if (!duplicatedLabels.has(text)) return;

      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      if (rect.left < window.innerWidth * 0.55) return;
      if (!hasBrandingHeroContext(element)) return;

      element.dataset.brandingHeroLabelCleaned = "true";
      element.style.display = "none";
    });
  }

  window.addEventListener("load", hideDuplicatedBrandingHeroLabel);
  document.addEventListener("DOMContentLoaded", hideDuplicatedBrandingHeroLabel);
  setInterval(hideDuplicatedBrandingHeroLabel, 600);

  const observer = new MutationObserver(hideDuplicatedBrandingHeroLabel);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();
