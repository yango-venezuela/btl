(() => {
  if (typeof window === "undefined" || window.__yangoActivationUnnamedCleanerV2) return;
  window.__yangoActivationUnnamedCleanerV2 = true;

  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const compact = value => normalize(value).replace(/[^a-z0-9]+/g, "");
  const parse = value => { try { return JSON.parse(value); } catch (_error) { return null; } };
  const stringify = value => { try { return JSON.stringify(value); } catch (_error) { return String(value); } };
  const isObject = value => value && typeof value === "object" && !Array.isArray(value);
  const activationKey = key => /yango_activations|\bacts\b|activation|activacion|activaciones|calendar|calendario/i.test(String(key || ""));
  const retiredKey = key => /samsung|raffle|rifa/i.test(String(key || ""));
  const looksActivation = (item, sourceKey = "") => {
    if (!isObject(item)) return false;
    const sample = normalize(`${sourceKey} ${item.name || ""} ${item.nombre || ""} ${item.title || ""} ${item.titulo || ""} ${item.location || ""} ${item.ubicacion || ""} ${item.zone || ""} ${item.zona || ""} ${item.type || ""} ${item.tipo || ""} ${item.calendarDate || ""} ${item.fecha || ""}`);
    if (/influencer|instagram|tiktok|branding|stickers|cascos|chalecos|longsleeves|media|ooh|mystery|shopper|agency|agencia/.test(sample)) return false;
    return /activ|calendar|calendario|flyer|cafe|helado|universidad|evento|petare|sabana|centro|este|oeste|norte|sur|satelite/.test(sample);
  };
  const badActivationName = item => {
    const name = normalize(item && (item.name || item.nombre || item.title || item.titulo));
    return !name || name === "sin nombre" || compact(name) === "sinnombre" || name === "undefined" || name === "null" || name === "nan";
  };
  const badActivationStatus = item => {
    const status = normalize(item && (item.status || item.estado || item.activationStatus || item.validacion || item.validation));
    return status === "no se dio" || compact(status) === "nosedio" || status === "missed" || status === "cancelled" || status === "canceled";
  };
  const shouldDropActivation = (item, sourceKey = "") => looksActivation(item, sourceKey) && (badActivationName(item) || badActivationStatus(item));
  const cleanValue = (value, sourceKey = "") => {
    if (Array.isArray(value)) {
      let changed = false;
      const next = [];
      value.forEach(item => {
        if (isObject(item) && shouldDropActivation(item, sourceKey)) {
          changed = true;
          return;
        }
        const cleaned = cleanValue(item, sourceKey);
        if (cleaned !== item) changed = true;
        if (cleaned != null) next.push(cleaned);
      });
      return changed ? next : value;
    }
    if (!isObject(value)) return value;
    if (shouldDropActivation(value, sourceKey)) return null;
    let changed = false;
    const next = { ...value };
    Object.keys(next).forEach(key => {
      const cleaned = cleanValue(next[key], `${sourceKey} ${key}`);
      if (cleaned !== next[key]) changed = true;
      if (cleaned == null) delete next[key];
      else next[key] = cleaned;
    });
    return changed ? next : value;
  };
  const saveRemote = async (key, value) => {
    try {
      const response = await fetch(`/api/state/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value })
      });
      return response.ok;
    } catch (_error) { return false; }
  };
  const cleanLocal = () => {
    let changed = false;
    try {
      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index) || "";
        if (retiredKey(key)) { localStorage.removeItem(key); changed = true; continue; }
        if (!activationKey(key)) continue;
        const value = parse(localStorage.getItem(key));
        if (value == null) continue;
        const cleaned = cleanValue(value, key);
        if (stringify(cleaned) !== stringify(value)) {
          localStorage.setItem(key, stringify(cleaned));
          changed = true;
        }
      }
    } catch (_error) {}
    return changed;
  };
  const cleanRemote = async () => {
    let changed = false;
    try {
      const response = await fetch(`/api/state?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return false;
      const payload = await response.json();
      const values = payload.values || {};
      for (const [key, value] of Object.entries(values)) {
        if (retiredKey(key) || !activationKey(key)) continue;
        const cleaned = cleanValue(value, key);
        if (stringify(cleaned) !== stringify(value)) {
          const ok = await saveRemote(key, cleaned);
          if (ok) {
            try { localStorage.setItem(key, stringify(cleaned)); } catch (_error) {}
            changed = true;
          }
        }
      }
    } catch (_error) {}
    return changed;
  };
  const hideVisibleGarbage = () => {
    try {
      document.querySelectorAll("body *").forEach(node => {
        if (node.children.length > 8) return;
        const text = normalize(node.textContent || "");
        const looksRow = /fecha calendario|planificada|flyers|activacion|\$\d/.test(text);
        if (looksRow && (text.includes("sin nombre") || text.includes("no se dio"))) node.style.display = "none";
      });
    } catch (_error) {}
  };
  const run = async () => {
    const localChanged = cleanLocal();
    const remoteChanged = await cleanRemote();
    hideVisibleGarbage();
    if (localChanged || remoteChanged) {
      window.dispatchEvent(new CustomEvent("yango:activations-cleaned"));
      window.dispatchEvent(new Event("storage"));
    }
  };
  [80, 900, 2500, 6000].forEach(delay => setTimeout(run, delay));
  window.addEventListener("focus", run);
  window.addEventListener("yango:shared-state-hydrated", run);
})();

(() => {
  if (typeof window === "undefined") return;
  const FLAG = "__yangoBtlMapFallbackPinsV5";
  if (window[FLAG]) return;
  window[FLAG] = true;

  const BOUNDS = { north: 10.595, south: 10.355, west: -67.115, east: -66.690 };
  const TILE_ZOOM = 12;
  const TILE_URLS = [
    "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
  ];
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

  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '').trim();
  const nice = value => String(value || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim();
  const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
  const parse = value => { try { return JSON.parse(value); } catch (_error) { return null; } };
  const badName = item => {
    const name = normalize(item && (item.name || item.nombre || item.title || item.titulo));
    return !name || name === 'sinnombre' || name === 'undefined' || name === 'null' || name === 'nan';
  };
  const badStatus = item => {
    const status = normalize(item && (item.status || item.estado || item.activationStatus || item.validacion || item.validation));
    return status === 'nosedio' || status === 'missed' || status === 'cancelled' || status === 'canceled';
  };

  const injectCss = () => {
    if (document.getElementById('yango-btl-map-fallback-css')) return;
    const style = document.createElement('style');
    style.id = 'yango-btl-map-fallback-css';
    style.textContent = `
      .leaflet-container{min-height:560px!important;height:min(70vh,720px)!important;width:100%!important;border-radius:16px!important;background:#eef2f5!important;position:relative!important;overflow:hidden!important;}
      .leaflet-tile-pane,.leaflet-tile-container,.leaflet-tile,.leaflet-layer{opacity:1!important;visibility:visible!important;filter:none!important;mix-blend-mode:normal!important;}
      .yango-btl-static-tiles{position:absolute;inset:0;z-index:2;pointer-events:none;background:#eef2f5;overflow:hidden;}
      .yango-btl-static-tiles img{position:absolute;display:block;max-width:none!important;opacity:1!important;visibility:visible!important;filter:saturate(.82) contrast(.98) brightness(1.04);}
      .yango-btl-pins-layer{position:absolute;inset:0;z-index:660;pointer-events:none;}
      .yango-btl-pin{position:absolute;width:20px;height:20px;border:3px solid #fff;border-radius:999px;box-shadow:0 8px 22px rgba(15,23,42,.36);transform:translate(-50%,-50%);pointer-events:auto;cursor:pointer;}
      .yango-btl-pin:hover{transform:translate(-50%,-50%) scale(1.18);z-index:3;}
      .yango-btl-popup{position:absolute;z-index:670;min-width:190px;max-width:260px;background:#fff;border:1px solid rgba(15,23,42,.14);border-radius:14px;padding:10px 12px;box-shadow:0 14px 36px rgba(15,23,42,.22);font:12px/1.35 system-ui,sans-serif;color:#0f172a;pointer-events:none;transform:translate(-50%, calc(-100% - 18px));}
      .yango-btl-map-counter,.yango-btl-map-reload{position:absolute;z-index:680;background:rgba(255,255,255,.95);border:1px solid rgba(15,23,42,.12);box-shadow:0 8px 24px rgba(15,23,42,.12);font:800 12px/1 system-ui,sans-serif;color:#0f172a;border-radius:999px;padding:10px 12px;}
      .yango-btl-map-counter{left:14px;bottom:14px;}
      .yango-btl-map-reload{right:14px;top:14px;cursor:pointer;}
    `;
    document.head.appendChild(style);
  };

  const itemText = item => [item.location,item.locationName,item.zone,item.zona,item.area,item.activation,item.activacion,item.name,item.title,item.nombre,item.address,item.direccion,item.place,item.ubicacion,item.realLocation,item.real_location,item.locationArea,item.sector,item.neighborhood,item.barrio].filter(Boolean).join(' ');
  const itemDate = item => String(item.date || item.fecha || item.calendarDate || item.activationDate || item.startDate || item.visitedDate || item.day || item.dia || '');
  const itemType = item => String(item.type || item.tipo || item.activationType || item.tipoActivacion || item.mechanic || item.mechanics || item.material || item.category || 'Flyers');
  const itemLocation = item => String(item.location || item.locationName || item.zone || item.zona || item.area || item.realLocation || item.activation || item.activacion || item.name || item.title || item.ubicacion || 'Activación BTL');

  const coordsFor = item => {
    const lat = Number(item.lat ?? item.latitude ?? item.Latitude ?? item.latitud);
    const lng = Number(item.lng ?? item.lon ?? item.longitude ?? item.Longitude ?? item.longitud);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat > 9.7 && lat < 11.1 && lng > -67.6 && lng < -66.2) return [lat,lng];
    const text = normalize(itemText(item));
    const key = Object.keys(LOCATION_COORDS).sort((a,b)=>b.length-a.length).find(k => text.includes(k));
    return key ? LOCATION_COORDS[key] : null;
  };

  const looksLikeActivation = (item, sourceKey = '') => {
    if (!isObject(item) || badName(item) || badStatus(item)) return false;
    const text = normalize(`${sourceKey} ${itemText(item)} ${itemType(item)} ${itemDate(item)}`);
    if (!coordsFor(item)) return false;
    if (/influencer|samsung|rifa|branding|stickers|cascos|chalecos|longsleeves|mediaooh/.test(text)) return false;
    return /activ|btl|calendar|calendario|flyer|cafe|helado|universidad|evento|sabana|petare|centro|altamira|chacaito|junquito|hoyada|montalban|vega|catia|teques|mercedes|july|julio|junio|2026/.test(text);
  };

  const collect = (value, out=[], sourceKey='') => {
    if (Array.isArray(value)) value.forEach(v => looksLikeActivation(v, sourceKey) ? out.push(v) : collect(v,out,sourceKey));
    else if (isObject(value)) {
      if (looksLikeActivation(value, sourceKey)) out.push(value);
      Object.entries(value).forEach(([k,v]) => (Array.isArray(v)||isObject(v)) && collect(v,out,`${sourceKey} ${k}`));
    }
    return out;
  };

  const collectFromLocalStorage = raw => {
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index) || '';
        if (/backup|migration|token|password|influencer|branding|samsung|raffle|rifa/i.test(key)) continue;
        const value = parse(localStorage.getItem(key));
        if (value) collect(value, raw, key);
      }
    } catch (_error) {}
  };

  const collectFromWindow = raw => {
    ['activations','filteredActivations','btlActivations','calendarActivations','activationData','calendarData','state','appState','dashboardState'].forEach(key => {
      try { if (window[key]) collect(window[key], raw, key); } catch (_error) {}
    });
  };

  const load = async () => {
    const raw = [];
    try {
      const response = await fetch('/api/state', { cache:'no-store' });
      if (response.ok) {
        const payload = await response.json();
        Object.entries(payload.values || {}).forEach(([key,value]) => {
          if (/backup|migration|token|password|influencer|branding|samsung|raffle|rifa/i.test(key)) return;
          collect(value, raw, key);
        });
      }
    } catch (_error) {}
    collectFromLocalStorage(raw);
    collectFromWindow(raw);
    const seen = new Set();
    return raw.filter(item => {
      const id = String(item.id || item.activationId || item.actId || [itemDate(item), itemLocation(item), itemType(item)].join('|'));
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  };

  const mercatorPoint = (lat, lng, zoom = TILE_ZOOM) => {
    const sin = Math.sin((lat * Math.PI) / 180);
    const scale = 256 * Math.pow(2, zoom);
    return {
      x: ((lng + 180) / 360) * scale,
      y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale
    };
  };
  const nw = () => mercatorPoint(BOUNDS.north, BOUNDS.west);
  const se = () => mercatorPoint(BOUNDS.south, BOUNDS.east);
  const project = ([lat,lng]) => {
    const a = nw();
    const b = se();
    const p = mercatorPoint(lat, lng);
    const x = ((p.x - a.x) / (b.x - a.x)) * 100;
    const y = ((p.y - a.y) / (b.y - a.y)) * 100;
    return [Math.max(2, Math.min(98, x)), Math.max(3, Math.min(97, y))];
  };

  const tileUrl = (z, x, y) => TILE_URLS[Math.abs(x + y) % TILE_URLS.length].replace('{z}', z).replace('{x}', x).replace('{y}', y);
  const renderStaticTiles = container => {
    let tiles = container.querySelector('.yango-btl-static-tiles');
    if (!tiles) {
      tiles = document.createElement('div');
      tiles.className = 'yango-btl-static-tiles';
      container.insertBefore(tiles, container.firstChild);
    }
    if (tiles.dataset.ready === '1') return;
    tiles.innerHTML = '';
    const a = nw();
    const b = se();
    const width = b.x - a.x;
    const height = b.y - a.y;
    const minX = Math.floor(a.x / 256) - 1;
    const maxX = Math.floor(b.x / 256) + 1;
    const minY = Math.floor(a.y / 256) - 1;
    const maxY = Math.floor(b.y / 256) + 1;
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        const img = document.createElement('img');
        img.alt = '';
        img.decoding = 'async';
        img.loading = 'eager';
        img.referrerPolicy = 'no-referrer';
        img.src = tileUrl(TILE_ZOOM, x, y);
        img.style.left = `${((x * 256 - a.x) / width) * 100}%`;
        img.style.top = `${((y * 256 - a.y) / height) * 100}%`;
        img.style.width = `${(256 / width) * 100}%`;
        img.style.height = `${(256 / height) * 100}%`;
        tiles.appendChild(img);
      }
    }
    tiles.dataset.ready = '1';
  };

  const findMapContainer = () => Array.from(document.querySelectorAll('.leaflet-container')).sort((a,b)=>(b.clientWidth*b.clientHeight)-(a.clientWidth*a.clientHeight))[0] || null;

  const render = async () => {
    injectCss();
    const container = findMapContainer();
    if (!container) return;
    container.style.position = 'relative';
    renderStaticTiles(container);
    let layer = container.querySelector('.yango-btl-pins-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'yango-btl-pins-layer';
      container.appendChild(layer);
    }
    layer.innerHTML = '';
    const activations = await load();
    activations.forEach((item, index) => {
      const coords = coordsFor(item);
      if (!coords) return;
      const [x,y] = project([coords[0] + ((index % 5)-2)*0.0012, coords[1] + (((index+2)%5)-2)*0.0012]);
      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'yango-btl-pin';
      pin.style.left = `${x}%`;
      pin.style.top = `${y}%`;
      pin.style.background = TYPE_COLORS[normalize(itemType(item))] || '#ef4444';
      pin.title = `${nice(itemLocation(item))}\n${nice(itemType(item))} · ${itemDate(item) || 'Sin fecha'}`;
      pin.addEventListener('mouseenter', () => {
        layer.querySelector('.yango-btl-popup')?.remove();
        const popup = document.createElement('div');
        popup.className = 'yango-btl-popup';
        popup.style.left = `${x}%`;
        popup.style.top = `${y}%`;
        popup.innerHTML = `<strong>${nice(itemLocation(item))}</strong><br>${nice(itemType(item))} · ${itemDate(item) || 'Sin fecha'}`;
        layer.appendChild(popup);
      });
      pin.addEventListener('mouseleave', () => layer.querySelector('.yango-btl-popup')?.remove());
      layer.appendChild(pin);
    });
    let counter = container.querySelector('.yango-btl-map-counter');
    if (!counter) {
      counter = document.createElement('div');
      counter.className = 'yango-btl-map-counter';
      container.appendChild(counter);
    }
    counter.textContent = `${activations.length} activaciones en mapa`;
    let reload = container.querySelector('.yango-btl-map-reload');
    if (!reload) {
      reload = document.createElement('button');
      reload.type = 'button';
      reload.className = 'yango-btl-map-reload';
      reload.textContent = 'Actualizar mapa';
      reload.onclick = event => { event.preventDefault(); const t = container.querySelector('.yango-btl-static-tiles'); if (t) t.dataset.ready = '0'; render(); };
      container.appendChild(reload);
    }
  };

  const schedule = () => setTimeout(render, 350);
  [300, 1200, 2600, 5000].forEach(t => setTimeout(render, t));
  window.addEventListener('focus', schedule);
  window.addEventListener('resize', schedule);
  window.addEventListener('storage', schedule);
  window.addEventListener('yango:activations-cleaned', schedule);
  document.addEventListener('click', event => {
    const text = String(event.target?.textContent || '').toLowerCase();
    if (/mapa|activaciones|calendario|cargar|resultados|actualizar/.test(text)) schedule();
  }, true);
  new MutationObserver(() => schedule()).observe(document.documentElement, { childList:true, subtree:true });
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