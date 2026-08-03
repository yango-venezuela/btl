(() => {
  if (typeof window === "undefined") return;
  const FLAG = "__yangoBtlMapPolishInstalled";
  if (window[FLAG]) return;
  window[FLAG] = true;

  const CARACAS_CENTER = [10.4907, -66.8759];
  const CARACAS_BOUNDS = [[10.355, -67.115], [10.595, -66.690]];
  const DEFAULT_ZOOM = 12;
  const MAX_AUTO_ZOOM = 15;
  const MIN_AUTO_ZOOM = 11;
  const TILE_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
  const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

  const maps = window.__yangoLeafletMaps = window.__yangoLeafletMaps || [];
  const styledTiles = new WeakSet();
  const polishedMaps = new WeakSet();

  const injectCss = () => {
    if (document.getElementById("yango-btl-map-polish-css")) return;
    const style = document.createElement("style");
    style.id = "yango-btl-map-polish-css";
    style.textContent = `
      .leaflet-container {
        min-height: 520px !important;
        height: min(68vh, 680px) !important;
        width: 100% !important;
        border-radius: 14px !important;
        background: #eef2f5 !important;
      }
      .yango-map-recenter-btn {
        position: absolute;
        z-index: 650;
        right: 14px;
        top: 14px;
        border: 1px solid rgba(15, 23, 42, .14);
        border-radius: 999px;
        background: rgba(255, 255, 255, .94);
        color: #0f172a;
        font: 700 12px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        padding: 9px 12px;
        box-shadow: 0 8px 24px rgba(15, 23, 42, .12);
        cursor: pointer;
        backdrop-filter: blur(8px);
      }
      .yango-map-recenter-btn:hover { transform: translateY(-1px); box-shadow: 0 10px 28px rgba(15, 23, 42, .16); }
      .leaflet-tile-pane { filter: saturate(.78) contrast(.98) brightness(1.03); }
    `;
    document.head.appendChild(style);
  };

  const patchLeafletFactory = () => {
    if (!window.L || !window.L.map || window.L.__yangoMapPatched) return;
    const originalMap = window.L.map;
    window.L.map = function patchedMap(...args) {
      const map = originalMap.apply(this, args);
      if (!maps.includes(map)) maps.push(map);
      setTimeout(() => polishMap(map), 80);
      setTimeout(() => polishMap(map), 700);
      setTimeout(() => polishMap(map), 1800);
      return map;
    };
    window.L.__yangoMapPatched = true;
  };

  const collectExistingMaps = () => {
    document.querySelectorAll(".leaflet-container").forEach(container => {
      const id = container && container._leaflet_id;
      if (!id || !window.L) return;
      for (const key of Object.keys(window)) {
        const value = window[key];
        if (value && value._container === container && value.invalidateSize && !maps.includes(value)) maps.push(value);
      }
    });
  };

  const addCleanTileLayer = map => {
    if (!window.L || !map || styledTiles.has(map)) return;
    try {
      const tileLayer = window.L.tileLayer(TILE_URL, {
        attribution: TILE_ATTRIBUTION,
        maxZoom: 20,
        subdomains: "abcd",
        detectRetina: true,
        crossOrigin: true
      });
      tileLayer.addTo(map);
      styledTiles.add(map);
    } catch (_error) {}
  };

  const markerLatLngs = map => {
    const points = [];
    try {
      map.eachLayer(layer => {
        if (layer && typeof layer.getLatLng === "function") {
          const point = layer.getLatLng();
          if (point && Number.isFinite(point.lat) && Number.isFinite(point.lng)) points.push(point);
        } else if (layer && typeof layer.getLatLngs === "function") {
          const flatten = value => Array.isArray(value) ? value.flat(Infinity) : [];
          flatten(layer.getLatLngs()).forEach(point => {
            if (point && Number.isFinite(point.lat) && Number.isFinite(point.lng)) points.push(point);
          });
        }
      });
    } catch (_error) {}
    return points.filter(point => point.lat > 9.7 && point.lat < 11.1 && point.lng > -67.6 && point.lng < -66.2);
  };

  const fitMap = map => {
    if (!map || !window.L) return;
    const points = markerLatLngs(map);
    try {
      if (points.length >= 2) {
        const bounds = window.L.latLngBounds(points);
        map.fitBounds(bounds.pad(0.24), { animate: false, maxZoom: MAX_AUTO_ZOOM });
        if (map.getZoom() < MIN_AUTO_ZOOM) map.setZoom(MIN_AUTO_ZOOM, { animate: false });
      } else if (points.length === 1) {
        map.setView(points[0], MAX_AUTO_ZOOM, { animate: false });
      } else {
        map.fitBounds(CARACAS_BOUNDS, { animate: false, maxZoom: DEFAULT_ZOOM });
        map.setView(CARACAS_CENTER, DEFAULT_ZOOM, { animate: false });
      }
    } catch (_error) {
      try { map.setView(CARACAS_CENTER, DEFAULT_ZOOM, { animate: false }); } catch (__error) {}
    }
  };

  const ensureRecenterButton = map => {
    const container = map && map.getContainer && map.getContainer();
    if (!container || container.querySelector(".yango-map-recenter-btn")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "yango-map-recenter-btn";
    button.textContent = "Recentrar Caracas";
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      polishMap(map, { forceFit: true });
    });
    container.style.position = container.style.position || "relative";
    container.appendChild(button);
  };

  const polishMap = (map, options = {}) => {
    if (!map || typeof map.invalidateSize !== "function") return;
    injectCss();
    addCleanTileLayer(map);
    ensureRecenterButton(map);
    try { map.invalidateSize(false); } catch (_error) {}
    if (!polishedMaps.has(map) || options.forceFit) {
      fitMap(map);
      polishedMaps.add(map);
    }
    setTimeout(() => { try { map.invalidateSize(false); } catch (_error) {} }, 250);
  };

  const polishAll = (forceFit = false) => {
    patchLeafletFactory();
    collectExistingMaps();
    maps.forEach(map => polishMap(map, { forceFit }));
  };

  injectCss();
  patchLeafletFactory();
  const observer = new MutationObserver(() => polishAll(false));
  observer.observe(document.documentElement, { childList: true, subtree: true });

  [100, 500, 1200, 2500].forEach(delay => setTimeout(() => polishAll(delay >= 1200), delay));
  window.addEventListener("resize", () => setTimeout(() => polishAll(false), 120));
  window.addEventListener("focus", () => setTimeout(() => polishAll(true), 250));
  document.addEventListener("click", event => {
    const text = String(event.target && event.target.textContent || "").toLowerCase();
    if (/mapa|activaciones|resultados/.test(text)) setTimeout(() => polishAll(true), 450);
  }, true);
})();
