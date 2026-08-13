(() => {
  if (typeof window === "undefined" || window.__yangoBtlCanonicalMapV1) return;
  window.__yangoBtlCanonicalMapV1 = true;

  const CANONICAL_KEY = "yango_activations_h1";
  const BROAD_ZONES = new Set(["petare", "centro", "este", "sureste", "universidades", "oeste", "sur", "norte", "satelites", "satélites", "sabana grande"]);
  const LOCATION_COORDS = {
    petare:[10.4768,-66.8067], paloverde:[10.4805,-66.7938], ladolorita:[10.474,-66.785],
    centro:[10.5061,-66.9146], centrodecaracas:[10.5061,-66.9146], lahoyada:[10.5027,-66.9155], bellasartes:[10.4998,-66.9038], parquecentral:[10.4987,-66.9032], plazavenezuela:[10.4915,-66.889], lossimbolos:[10.4758,-66.8902], estacion5dejulio:[10.5008,-66.9189],
    este:[10.4944,-66.8464], altamira:[10.4956,-66.846], chacaito:[10.4915,-66.8742], elrecreo:[10.49,-66.871], losdoscaminos:[10.4935,-66.8338], loscortijos:[10.4855,-66.8292], losruices:[10.4849,-66.8195], lacalifornia:[10.4828,-66.8135], laurbina:[10.4857,-66.801], macaracuay:[10.462,-66.8089],
    sureste:[10.4759,-66.8587], lasmercedes:[10.4806,-66.861], bellomonte:[10.4824,-66.8717], elcafetal:[10.4631,-66.8319], caurimare:[10.4741,-66.8189], pradosdeleste:[10.4509,-66.845], plazabaruta:[10.4355,-66.8768], lasminas:[10.4195,-66.857],
    universidades:[10.4919,-66.8917], ucab:[10.464,-66.976], ciudaduniversitaria:[10.49,-66.891], monteavila:[10.499,-66.785],
    oeste:[10.492,-66.964], catia:[10.5236,-66.9508], plazasucre:[10.511,-66.949], propatria:[10.5068,-66.9687], antimano:[10.4715,-66.9802], layaguara:[10.481,-66.9478], lavega:[10.4644,-66.9434], montalban:[10.466,-66.9555], elparaiso:[10.4789,-66.9141], elpinar:[10.4648,-66.9187],
    sur:[10.435,-66.9315], caricuao:[10.4338,-66.9845], elvalle:[10.454,-66.9157], larinconada:[10.4304,-66.9386],
    norte:[10.5141,-66.9072], sanbernardino:[10.513,-66.9022], altaflorida:[10.5128,-66.884], lapastora:[10.5127,-66.9271],
    satelites:[10.402,-67.015], losteques:[10.3445,-67.0433], sanantoniodelosaltos:[10.3887,-66.9515], eljunquito:[10.47,-67.1],
    sabanagrande:[10.4933,-66.8764]
  };
  const TYPE_COLORS = { flyers:'#64748b', flyer:'#64748b', cafe:'#b45309', helados:'#0ea5e9', helado:'#0ea5e9', materialpop:'#ec4899', pop:'#ec4899', universidad:'#8b5cf6', universidades:'#8b5cf6', evento:'#d946ef', eventos:'#d946ef' };
  const BOUNDS = { north: 10.60, south: 10.34, west: -67.12, east: -66.69 };

  const cleanText = value => String(value == null ? "" : value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  const compact = value => cleanText(value).replace(/[^a-z0-9]+/g, "");
  const parse = value => { try { return JSON.parse(value); } catch (_error) { return null; } };
  const stringify = value => { try { return JSON.stringify(value); } catch (_error) { return String(value); } };
  const isObject = value => value && typeof value === "object" && !Array.isArray(value);
  const activationKey = key => /yango_activations|\bacts\b|activation|activacion|activaciones|calendar|calendario/i.test(String(key || ""));
  const hasRealName = item => {
    const name = cleanText(item && (item.name || item.nombre || item.title || item.titulo));
    return !!name && name !== "sin nombre" && compact(name) !== "sinnombre" && !["undefined", "null", "nan"].includes(name);
  };
  const statusText = item => cleanText(item && (item.status || item.estado || item.activationStatus || item.validacion || item.validation));
  const isMissed = item => {
    const status = statusText(item);
    return status === "no se dio" || compact(status) === "nosedio" || ["missed", "cancelled", "canceled"].includes(status);
  };
  const normalizeDate = value => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    let m = raw.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) return `${m[1]}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}`;
    m = raw.match(/(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})/);
    if (m) return `${m[3]}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;
    return raw;
  };
  const isGeneratedPlaceholder = item => {
    const date = normalizeDate(item.date || item.fecha || item.calendarDate || item.activationDate || item.createdAt);
    const name = cleanText(item.name || item.nombre || item.title || item.titulo);
    const loc = cleanText(item.location || item.ubicacion || item.zone || item.zona || item.area);
    const planned = !statusText(item) || ["planned", "planificada", "pending"].includes(statusText(item));
    return planned && (date === "2026-01-01" || /(^|\D)1\s*ene/.test(cleanText(date))) && BROAD_ZONES.has(name) && (!loc || name === loc || BROAD_ZONES.has(loc));
  };
  const shouldKeep = item => isObject(item) && hasRealName(item) && !isMissed(item) && !isGeneratedPlaceholder(item);
  const stableId = item => [normalizeDate(item.date || item.fecha || item.calendarDate || item.activationDate), cleanText(item.name || item.nombre || item.title || item.titulo), cleanText(item.location || item.ubicacion || item.zone || item.zona), cleanText(item.type || item.tipo || item.activationType || item.tipoActivacion)].join("|");
  const sanitizeList = value => {
    const raw = Array.isArray(value) ? value : [];
    const seen = new Set();
    return raw.filter(shouldKeep).filter(item => {
      const id = stableId(item);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  };

  const putState = async (key, value) => {
    try {
      const response = await fetch(`/api/state/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value })
      });
      return response.ok;
    } catch (_error) { return false; }
  };

  const purgeEverywhere = async () => {
    let canonical = [];
    let changed = false;
    try {
      const response = await fetch(`/api/state?t=${Date.now()}`, { cache: "no-store" });
      if (response.ok) {
        const payload = await response.json();
        const values = payload.values || {};
        canonical = sanitizeList(values[CANONICAL_KEY]);
        if (stringify(canonical) !== stringify(values[CANONICAL_KEY] || [])) changed = true;
        for (const [key, value] of Object.entries(values)) {
          if (!activationKey(key)) continue;
          const cleaned = key === CANONICAL_KEY ? canonical : sanitizeList(value);
          if (stringify(cleaned) !== stringify(value || [])) {
            await putState(key, cleaned);
            changed = true;
          }
        }
      }
    } catch (_error) {}
    try {
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const key = localStorage.key(i) || "";
        if (!activationKey(key)) continue;
        const value = parse(localStorage.getItem(key));
        const cleaned = key === CANONICAL_KEY ? canonical : sanitizeList(value);
        if (key !== CANONICAL_KEY && (!cleaned.length || stringify(cleaned) === stringify(canonical))) {
          localStorage.removeItem(key);
          changed = true;
        } else if (stringify(cleaned) !== stringify(value || [])) {
          localStorage.setItem(key, stringify(cleaned));
          changed = true;
        }
      }
      localStorage.setItem(CANONICAL_KEY, stringify(canonical));
    } catch (_error) {}
    if (changed) {
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new CustomEvent("yango:activations-cleaned", { detail: { total: canonical.length } }));
      if (!sessionStorage.getItem("yango_btl_purged_reloaded_v1")) {
        sessionStorage.setItem("yango_btl_purged_reloaded_v1", "1");
        setTimeout(() => location.reload(), 350);
      }
    }
    return canonical;
  };

  const coordsFor = item => {
    const lat = Number(item.lat ?? item.latitude ?? item.Latitude ?? item.latitud);
    const lng = Number(item.lng ?? item.lon ?? item.longitude ?? item.Longitude ?? item.longitud);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat > 9.7 && lat < 11.1 && lng > -67.6 && lng < -66.2) return [lat, lng];
    const text = compact([item.location,item.locationName,item.zone,item.zona,item.area,item.name,item.title,item.nombre,item.address,item.direccion,item.ubicacion].filter(Boolean).join(" "));
    const key = Object.keys(LOCATION_COORDS).sort((a,b)=>b.length-a.length).find(k => text.includes(k));
    return key ? LOCATION_COORDS[key] : null;
  };
  const project = ([lat, lng]) => {
    const x = ((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * 100;
    const y = ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * 100;
    return [Math.max(3, Math.min(97, x)), Math.max(4, Math.min(96, y))];
  };
  const itemType = item => String(item.type || item.tipo || item.activationType || item.tipoActivacion || "Flyers");
  const itemName = item => String(item.name || item.nombre || item.title || item.titulo || "Activación BTL").trim();
  const itemLocation = item => String(item.location || item.ubicacion || item.zone || item.zona || item.area || "").trim();
  const itemDate = item => String(item.date || item.fecha || item.calendarDate || item.activationDate || "").trim();

  const injectCss = () => {
    if (document.getElementById("yango-btl-canonical-map-css")) return;
    const style = document.createElement("style");
    style.id = "yango-btl-canonical-map-css";
    style.textContent = `
      .leaflet-container,.yango-btl-map-shell{min-height:520px!important;height:min(62vh,660px)!important;width:100%!important;border-radius:16px!important;background:#eef2f5!important;position:relative!important;overflow:hidden!important;}
      .yango-btl-map-shell{border:1px solid rgba(15,23,42,.08);box-shadow:inset 0 0 0 1px rgba(255,255,255,.7);}
      .yango-btl-lite-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(100,116,139,.14) 1px,transparent 1px),linear-gradient(90deg,rgba(100,116,139,.14) 1px,transparent 1px);background-size:72px 72px;opacity:.42;}
      .yango-btl-lite-label{position:absolute;color:rgba(71,85,105,.34);font:800 11px/1 system-ui,sans-serif;text-transform:uppercase;letter-spacing:.08em;}
      .yango-btl-pin{position:absolute;width:18px;height:18px;border:3px solid #fff;border-radius:999px;box-shadow:0 7px 18px rgba(15,23,42,.32);transform:translate(-50%,-50%);cursor:pointer;z-index:3;}
      .yango-btl-popup{position:absolute;z-index:4;min-width:190px;background:white;border:1px solid rgba(15,23,42,.12);border-radius:14px;padding:10px 12px;box-shadow:0 14px 36px rgba(15,23,42,.18);font:12px/1.35 system-ui,sans-serif;color:#0f172a;transform:translate(-50%, calc(-100% - 18px));pointer-events:none;}
      .yango-btl-map-counter,.yango-btl-map-reload{position:absolute;z-index:5;background:rgba(255,255,255,.96);border:1px solid rgba(15,23,42,.12);box-shadow:0 8px 24px rgba(15,23,42,.12);font:800 12px/1 system-ui,sans-serif;color:#0f172a;border-radius:999px;padding:10px 12px;}
      .yango-btl-map-counter{left:14px;bottom:14px}.yango-btl-map-reload{right:14px;top:14px;cursor:pointer}
    `;
    document.head.appendChild(style);
  };

  const findOrCreateMap = () => {
    const existing = Array.from(document.querySelectorAll('.leaflet-container,.yango-btl-map-shell')).sort((a,b)=>(b.clientWidth*b.clientHeight)-(a.clientWidth*a.clientHeight))[0];
    if (existing) return existing;
    const cards = Array.from(document.querySelectorAll('section,article,div')).filter(el => /Mapa de activaciones en Caracas/i.test(el.textContent || ""));
    const card = cards.sort((a,b)=>(a.textContent || "").length - (b.textContent || "").length)[0];
    if (!card) return null;
    const shell = document.createElement('div');
    shell.className = 'yango-btl-map-shell';
    card.appendChild(shell);
    return shell;
  };

  const render = async () => {
    injectCss();
    const container = findOrCreateMap();
    if (!container) return;
    container.classList.add('yango-btl-map-shell');
    container.innerHTML = '<div class="yango-btl-lite-grid"></div><span class="yango-btl-lite-label" style="left:18%;top:20%">Oeste</span><span class="yango-btl-lite-label" style="left:46%;top:24%">Caracas</span><span class="yango-btl-lite-label" style="left:70%;top:28%">Este</span><button class="yango-btl-map-reload" type="button">Actualizar mapa</button><div class="yango-btl-map-counter">Cargando...</div>';
    const list = await purgeEverywhere();
    const points = list.filter(coordsFor);
    points.forEach((item, index) => {
      const [lat, lng] = coordsFor(item);
      const [x,y] = project([lat + ((index % 5)-2)*0.001, lng + (((index+2)%5)-2)*0.001]);
      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'yango-btl-pin';
      pin.style.left = `${x}%`;
      pin.style.top = `${y}%`;
      pin.style.background = TYPE_COLORS[compact(itemType(item))] || '#ef4444';
      pin.title = `${itemName(item)}\n${itemLocation(item)} · ${itemType(item)} · ${itemDate(item) || 'Sin fecha'}`;
      pin.onmouseenter = () => {
        container.querySelector('.yango-btl-popup')?.remove();
        const popup = document.createElement('div');
        popup.className = 'yango-btl-popup';
        popup.style.left = `${x}%`;
        popup.style.top = `${y}%`;
        popup.innerHTML = `<strong>${itemName(item)}</strong><br>${itemLocation(item)} · ${itemType(item)}<br>${itemDate(item) || ''}`;
        container.appendChild(popup);
      };
      pin.onmouseleave = () => container.querySelector('.yango-btl-popup')?.remove();
      container.appendChild(pin);
    });
    const counter = container.querySelector('.yango-btl-map-counter');
    if (counter) counter.textContent = `${points.length} activaciones en mapa`;
    const reload = container.querySelector('.yango-btl-map-reload');
    if (reload) reload.onclick = event => { event.preventDefault(); render(); };
  };

  const schedule = () => setTimeout(render, 300);
  [250, 1200, 3000].forEach(t => setTimeout(render, t));
  window.addEventListener('focus', schedule);
  window.addEventListener('storage', schedule);
  window.addEventListener('yango:shared-state-hydrated', schedule);
  window.addEventListener('yango:activations-cleaned', schedule);
  document.addEventListener('click', event => {
    const text = String(event.target?.textContent || '').toLowerCase();
    if (/mapa|activaciones|calendario|actualizar/.test(text)) schedule();
  }, true);
})();

(() => {
  if (typeof window === "undefined" || window.__yangoManualRescueBundleLoaderV1) return;
  window.__yangoManualRescueBundleLoaderV1 = true;
  const load = () => {
    if (document.querySelector('script[src^="/manual-rescue-bundle-sync.js"]')) return;
    const script = document.createElement("script");
    script.src = `/manual-rescue-bundle-sync.js?v=20260804c-${Date.now()}`;
    script.defer = true;
    document.head.appendChild(script);
  };
  setTimeout(load, 150);
  setTimeout(load, 1800);
})();