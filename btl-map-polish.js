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

  const LOCATION_COORDS = {
    petare: [10.4768, -66.8067], paloverde: [10.4805, -66.7938], ladolorita: [10.4740, -66.7850],
    centro: [10.5061, -66.9146], centrodecaracas: [10.5061, -66.9146], lahoyada: [10.5027, -66.9155], bellasartes: [10.4998, -66.9038], parquecentral: [10.4987, -66.9032], plazavenezuela: [10.4915, -66.8890], lossimbolos: [10.4758, -66.8902], estacion5dejulio: [10.5008, -66.9189],
    este: [10.4944, -66.8464], altamira: [10.4956, -66.8460], chacaito: [10.4915, -66.8742], elrecreo: [10.4900, -66.8710], losdoscaminos: [10.4935, -66.8338], loscortijos: [10.4855, -66.8292], losruices: [10.4849, -66.8195], lacalifornia: [10.4828, -66.8135], laurbina: [10.4857, -66.8010], macaracuay: [10.4620, -66.8089],
    sureste: [10.4759, -66.8587], lasmercedes: [10.4806, -66.8610], bellomonte: [10.4824, -66.8717], elcafetal: [10.4631, -66.8319], caurimare: [10.4741, -66.8189], pradosdeleste: [10.4509, -66.8450], plazabaruta: [10.4355, -66.8768], lasminas: [10.4195, -66.8570],
    universidades: [10.4919, -66.8917], ucab: [10.4640, -66.9760], ciudaduniversitaria: [10.4900, -66.8910], monteavila: [10.4990, -66.7850],
    oeste: [10.4920, -66.9640], catia: [10.5236, -66.9508], plazasucre: [10.5110, -66.9490], propatria: [10.5068, -66.9687], antimano: [10.4715, -66.9802], layaguara: [10.4810, -66.9478], lavega: [10.4644, -66.9434], montalban: [10.4660, -66.9555], elparaiso: [10.4789, -66.9141], elpinar: [10.4648, -66.9187],
    sur: [10.4350, -66.9315], caricuao: [10.4338, -66.9845], elvalle: [10.4540, -66.9157], larinconada: [10.4304, -66.9386],
    norte: [10.5141, -66.9072], sanbernardino: [10.5130, -66.9022], altaflorida: [10.5128, -66.8840], lapastora: [10.5127, -66.9271],
    satelites: [10.4020, -67.0150], losteques: [10.3445, -67.0433], sanantoniodelosaltos: [10.3887, -66.9515], eljunquito: [10.4700, -67.1000],
    sabanagrande: [10.4933, -66.8764]
  };

  const TYPE_COLORS = {
    flyers: "#64748b", flyer: "#64748b",
    cafe: "#b45309", café: "#b45309",
    helados: "#0ea5e9", helado: "#0ea5e9",
    materialpop: "#ec4899", pop: "#ec4899",
    universidad: "#8b5cf6", universidades: "#8b5cf6",
    evento: "#d946ef", eventos: "#d946ef"
  };

  const maps = window.__yangoLeafletMaps = window.__yangoLeafletMaps || [];
  const styledTiles = new WeakSet();
  const polishedMaps = new WeakSet();
  const activationLayerByMap = new WeakMap();
  let cachedActivations = [];
  let lastStateLoad = 0;

  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();

  const titleCase = value => String(value || "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim();
  const isObject = value => value && typeof value === "object" && !Array.isArray(value);

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
        position: absolute; z-index: 650; right: 14px; top: 14px;
        border: 1px solid rgba(15, 23, 42, .14); border-radius: 999px;
        background: rgba(255, 255, 255, .94); color: #0f172a;
        font: 700 12px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        padding: 9px 12px; box-shadow: 0 8px 24px rgba(15, 23, 42, .12);
        cursor: pointer; backdrop-filter: blur(8px);
      }
      .yango-map-recenter-btn:hover { transform: translateY(-1px); box-shadow: 0 10px 28px rgba(15, 23, 42, .16); }
      .leaflet-tile-pane { filter: saturate(.78) contrast(.98) brightness(1.03); }
      .yango-btl-map-note {
        position: absolute; left: 14px; bottom: 14px; z-index: 650;
        background: rgba(255,255,255,.94); border: 1px solid rgba(15,23,42,.12);
        border-radius: 12px; padding: 8px 10px; font: 700 11px/1.25 system-ui, sans-serif;
        color: #334155; box-shadow: 0 8px 24px rgba(15,23,42,.10);
      }
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
      window.L.tileLayer(TILE_URL, {
        attribution: TILE_ATTRIBUTION,
        maxZoom: 20,
        subdomains: "abcd",
        detectRetina: true,
        crossOrigin: true
      }).addTo(map);
      styledTiles.add(map);
    } catch (_error) {}
  };

  const candidateText = item => [
    item.location, item.locationName, item.zone, item.zona, item.area, item.activation, item.activacion,
    item.name, item.title, item.nombre, item.address, item.direccion, item.place, item.ubicacion
  ].filter(Boolean).join(" ");

  const activationDate = item => String(item.date || item.fecha || item.calendarDate || item.activationDate || item.startDate || item.visitedDate || "");
  const activationType = item => String(item.type || item.tipo || item.activationType || item.tipoActivacion || item.mechanic || item.mechanics || "Flyers");
  const activationLocation = item => String(item.location || item.locationName || item.zone || item.zona || item.area || item.activation || item.activacion || item.name || item.title || "");

  const parseLatLng = item => {
    const lat = Number(item.lat ?? item.latitude ?? item.Latitude ?? item.latitud);
    const lng = Number(item.lng ?? item.lon ?? item.longitude ?? item.Longitude ?? item.longitud);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat > 9.7 && lat < 11.1 && lng > -67.6 && lng < -66.2) return [lat, lng];
    const key = normalize(candidateText(item));
    const match = Object.keys(LOCATION_COORDS).find(locationKey => key.includes(locationKey));
    if (match) return LOCATION_COORDS[match];
    return null;
  };

  const stableId = item => String(item.id || item.activationId || item.actId || [activationDate(item), activationLocation(item), activationType(item)].join("|")).trim();

  const looksLikeActivation = item => {
    if (!isObject(item)) return false;
    const text = normalize(candidateText(item));
    const hasLocation = Boolean(parseLatLng(item));
    const hasActivationWords = /activ|btl|flyer|cafe|helado|universidad|evento|sabana|petare|centro|altamira|chacaito|junquito|hoyada|montalban|vega/.test(text);
    const notWrongModule = !/influencer|samsung|rifa|branding|stickers|cascos|chalecos|longsleeves/.test(text);
    return hasLocation && hasActivationWords && notWrongModule;
  };

  const collectActivationsFromValue = (value, out = []) => {
    if (Array.isArray(value)) {
      value.forEach(item => {
        if (looksLikeActivation(item)) out.push(item);
        else if (isObject(item) || Array.isArray(item)) collectActivationsFromValue(item, out);
      });
    } else if (isObject(value)) {
      if (looksLikeActivation(value)) out.push(value);
      Object.values(value).forEach(child => {
        if (isObject(child) || Array.isArray(child)) collectActivationsFromValue(child, out);
      });
    }
    return out;
  };

  const loadActivations = async () => {
    if (!window.fetch || Date.now() - lastStateLoad < 8000) return cachedActivations;
    lastStateLoad = Date.now();
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) return cachedActivations;
      const payload = await response.json();
      const values = payload.values || {};
      const raw = [];
      Object.entries(values).forEach(([key, value]) => {
        if (/backup|migration|token|password|influencer|branding|samsung|raffle|rifa/i.test(key)) return;
        collectActivationsFromValue(value, raw);
      });
      const unique = [];
      const seen = new Set();
      raw.forEach(item => {
        const coords = parseLatLng(item);
        if (!coords) return;
        const id = stableId(item);
        if (seen.has(id)) return;
        seen.add(id);
        unique.push({ ...item, __coords: coords });
      });
      cachedActivations = unique;
      return cachedActivations;
    } catch (_error) {
      return cachedActivations;
    }
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

  const colorForType = type => TYPE_COLORS[normalize(type)] || "#ef4444";

  const renderActivationPins = async map => {
    if (!window.L || !map) return;
    const activations = await loadActivations();
    if (!activations.length) return;
    let layer = activationLayerByMap.get(map);
    if (layer) {
      try { layer.clearLayers(); } catch (_error) {}
    } else {
      layer = window.L.layerGroup().addTo(map);
      activationLayerByMap.set(map, layer);
    }
    activations.forEach((item, index) => {
      const coords = item.__coords || parseLatLng(item);
      if (!coords) return;
      const type = activationType(item);
      const color = colorForType(type);
      const jitter = ((index % 7) - 3) * 0.00045;
      const marker = window.L.circleMarker([coords[0] + jitter, coords[1] - jitter], {
        radius: 8,
        color: "#ffffff",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.92
      });
      const location = titleCase(activationLocation(item)) || "Activación BTL";
      const date = activationDate(item) || "Sin fecha";
      marker.bindPopup(`<strong>${location}</strong><br>${titleCase(type)} · ${date}`);
      marker.addTo(layer);
    });
    const container = map.getContainer && map.getContainer();
    if (container) {
      let note = container.querySelector(".yango-btl-map-note");
      if (!note) {
        note = document.createElement("div");
        note.className = "yango-btl-map-note";
        container.appendChild(note);
      }
      note.textContent = `${activations.length} activaciones en mapa`;
    }
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
      cachedActivations = [];
      lastStateLoad = 0;
      polishMap(map, { forceFit: true });
    });
    container.style.position = container.style.position || "relative";
    container.appendChild(button);
  };

  const polishMap = async (map, options = {}) => {
    if (!map || typeof map.invalidateSize !== "function") return;
    injectCss();
    addCleanTileLayer(map);
    ensureRecenterButton(map);
    try { map.invalidateSize(false); } catch (_error) {}
    await renderActivationPins(map);
    if (!polishedMaps.has(map) || options.forceFit) {
      fitMap(map);
      polishedMaps.add(map);
    }
    setTimeout(() => { try { map.invalidateSize(false); fitMap(map); } catch (_error) {} }, 250);
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

  [100, 500, 1200, 2500, 4500].forEach(delay => setTimeout(() => polishAll(delay >= 1200), delay));
  window.addEventListener("resize", () => setTimeout(() => polishAll(false), 120));
  window.addEventListener("focus", () => setTimeout(() => { lastStateLoad = 0; polishAll(true); }, 250));
  document.addEventListener("click", event => {
    const text = String(event.target && event.target.textContent || "").toLowerCase();
    if (/mapa|activaciones|resultados|cargar|calendario/.test(text)) setTimeout(() => { lastStateLoad = 0; polishAll(true); }, 450);
  }, true);
})();
