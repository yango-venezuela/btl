(() => {
  let summarySelected = false;
  let previousHeader = null;

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function ensureStyle() {
    if (document.getElementById("yds-standalone-style")) return;
    const style = document.createElement("style");
    style.id = "yds-standalone-style";
    style.textContent = `
      #yds-nav-group{display:flex;flex-direction:column;gap:6px;margin:8px 0 12px;padding-bottom:10px;border-bottom:1px solid #f1f5f9;order:-20}
      #yds-nav-group-label{font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;padding:0 10px}
      #yds-nav-group #yds-nav-shortcut{margin:0!important;min-height:42px;box-sizing:border-box;overflow:hidden}
      #yds-nav-shortcut.yds-standalone-active{background:#0f172a!important;color:#fff!important}
      #yds-nav-shortcut.yds-compact{width:42px!important;height:42px!important;min-height:42px!important;padding:0!important;margin:0 auto!important;justify-content:center!important;border-radius:12px!important}
      #yds-nav-shortcut.yds-compact .yds-nav-label{display:none!important}
      #yds-nav-shortcut.yds-compact .yds-nav-icon{margin:0!important}
      #yds-nav-group:has(#yds-nav-shortcut.yds-compact){align-items:center;padding-bottom:8px}
      #yds-nav-group:has(#yds-nav-shortcut.yds-compact) #yds-nav-group-label{display:none}
      #yango-summary-dashboard.yds-standalone-off{display:none!important}
      .yds-hidden-by-summary{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function headerNodes() {
    const h1 = Array.from(document.querySelectorAll("h1")).find(node => clean(node.textContent));
    const header = h1 && h1.parentElement && h1.parentElement.parentElement;
    const sub = h1 && h1.parentElement && h1.parentElement.querySelector("p");
    return { h1, sub, header };
  }

  function contentContainer() {
    const { header } = headerNodes();
    return header && header.nextElementSibling;
  }

  function mount() {
    return document.getElementById("yango-summary-dashboard");
  }

  function placeNavGroup() {
    ensureStyle();
    const btn = document.getElementById("yds-nav-shortcut");
    if (!btn) return;

    let group = document.getElementById("yds-nav-group");
    const sidebar = btn.closest("aside") || btn.parentElement;
    if (!group) {
      group = document.createElement("div");
      group.id = "yds-nav-group";
      group.innerHTML = '<div id="yds-nav-group-label">General</div>';
    }

    if (!btn.querySelector(".yds-nav-icon")) {
      btn.innerHTML = '<span class="yds-nav-icon">▦</span><span class="yds-nav-label">Resumen Yango</span>';
    }

    if (sidebar && group.parentElement !== sidebar) {
      const first = sidebar.firstElementChild;
      sidebar.insertBefore(group, first && first.nextElementSibling ? first.nextElementSibling : sidebar.firstChild);
    }
    if (btn.parentElement !== group) group.appendChild(btn);

    const compact = btn.getBoundingClientRect().width < 92 || (sidebar && sidebar.getBoundingClientRect().width < 100);
    btn.classList.toggle("yds-compact", compact);
    btn.classList.toggle("yds-standalone-active", summarySelected);
  }

  function hideSummary() {
    const el = mount();
    const content = contentContainer();
    if (el) el.classList.add("yds-standalone-off");
    if (content) Array.from(content.children).forEach(child => child.classList.remove("yds-hidden-by-summary"));
    const { h1, sub } = headerNodes();
    if (h1 && clean(h1.textContent) === "Resumen Yango" && previousHeader) h1.textContent = previousHeader.title;
    if (sub && previousHeader && clean(sub.textContent).includes("Daily Tracker")) sub.textContent = previousHeader.sub;
    document.getElementById("yds-nav-shortcut")?.classList.remove("yds-standalone-active");
  }

  function showSummary() {
    summarySelected = true;
    const el = mount();
    const content = contentContainer();
    const { h1, sub } = headerNodes();
    if (h1 && clean(h1.textContent) !== "Resumen Yango") {
      previousHeader = { title: h1.textContent, sub: sub ? sub.textContent : "" };
    }
    if (el) el.classList.remove("yds-standalone-off");
    if (content && el) Array.from(content.children).forEach(child => child.classList.toggle("yds-hidden-by-summary", child !== el));
    if (h1) h1.textContent = "Resumen Yango";
    if (sub) sub.textContent = "Daily Tracker, budget MTD y comparación vs mes anterior.";
    document.getElementById("yds-nav-shortcut")?.classList.add("yds-standalone-active");
  }

  function bindClicks() {
    const btn = document.getElementById("yds-nav-shortcut");
    if (btn && btn.dataset.ydsStandaloneBound !== "true") {
      btn.dataset.ydsStandaloneBound = "true";
      btn.addEventListener("click", () => {
        summarySelected = true;
        setTimeout(showSummary, 30);
      });
    }
  }

  document.addEventListener("click", event => {
    const button = event.target.closest && event.target.closest("button");
    if (!button || button.id === "yds-nav-shortcut") return;
    const text = clean(button.textContent);
    const isPanelNav = ["Vista global", "Resultados", "Mapa", "Calendario", "Activaciones", "Admin agencia", "Material POP", "Mystery Shopper", "Inventario Branding", "Rifa Samsung", "Influencers", "Reporte Social Media", "Media", "Usuarios"].some(label => text.includes(label));
    if (isPanelNav) {
      summarySelected = false;
      setTimeout(hideSummary, 40);
    }
  }, true);

  function tick() {
    placeNavGroup();
    bindClicks();
    if (summarySelected) showSummary();
    else hideSummary();
  }

  window.addEventListener("resize", tick);
  window.addEventListener("load", tick);
  document.addEventListener("DOMContentLoaded", tick);
  setInterval(tick, 300);
})();
