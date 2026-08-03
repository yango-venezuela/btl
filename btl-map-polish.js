(() => {
  if (typeof window === "undefined") return;
  const FLAG = "__yangoBtlMapFallbackPinsV2";
  if (window[FLAG]) return;
  window[FLAG] = true;

  const BOUNDS = { north: 10.595, south: 10.355, west: -67.115, east: -66.690 };
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

  const injectCss = () => {
    if (document.getElementById('yango-btl-map-fallback-css')) return;
    const style = document.createElement('style');
    style.id = 'yango-btl-map-fallback-css';
    style.textContent = `
      .leaflet-container{min-height:560px!important;height:min(70vh,720px)!important;width:100%!important;border-radius:16px!important;background:#eef2f5!important;position:relative!important;overflow:hidden!important;}
      .leaflet-tile-pane{filter:saturate(.78) contrast(.98) brightness(1.03)}
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

  const itemText = item => [item.location,item.locationName,item.zone,item.zona,item.area,item.activation,item.activacion,item.name,item.title,item.nombre,item.address,item.direccion,item.place,item.ubicacion].filter(Boolean).join(' ');
  const itemDate = item => String(item.date || item.fecha || item.calendarDate || item.activationDate || item.startDate || item.visitedDate || '');
  const itemType = item => String(item.type || item.tipo || item.activationType || item.tipoActivacion || item.mechanic || item.mechanics || 'Flyers');
  const itemLocation = item => String(item.location || item.locationName || item.zone || item.zona || item.area || item.activation || item.activacion || item.name || item.title || 'Activación BTL');

  const coordsFor = item => {
    const lat = Number(item.lat ?? item.latitude ?? item.Latitude ?? item.latitud);
    const lng = Number(item.lng ?? item.lon ?? item.longitude ?? item.Longitude ?? item.longitud);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat > 9.7 && lat < 11.1 && lng > -67.6 && lng < -66.2) return [lat,lng];
    const text = normalize(itemText(item));
    const key = Object.keys(LOCATION_COORDS).sort((a,b)=>b.length-a.length).find(k => text.includes(k));
    return key ? LOCATION_COORDS[key] : null;
  };

  const looksLikeActivation = item => {
    if (!isObject(item)) return false;
    const text = normalize(itemText(item));
    if (!coordsFor(item)) return false;
    if (/influencer|samsung|rifa|branding|stickers|cascos|chalecos|longsleeves|mediaooh/.test(text)) return false;
    return /activ|btl|flyer|cafe|helado|universidad|evento|sabana|petare|centro|altamira|chacaito|junquito|hoyada|montalban|vega|catia|teques|mercedes/.test(text);
  };

  const collect = (value, out=[]) => {
    if (Array.isArray(value)) value.forEach(v => looksLikeActivation(v) ? out.push(v) : collect(v,out));
    else if (isObject(value)) {
      if (looksLikeActivation(value)) out.push(value);
      Object.values(value).forEach(v => (Array.isArray(v)||isObject(v)) && collect(v,out));
    }
    return out;
  };

  const load = async () => {
    const response = await fetch('/api/state', { cache:'no-store' });
    if (!response.ok) return [];
    const payload = await response.json();
    const raw = [];
    Object.entries(payload.values || {}).forEach(([key,value]) => {
      if (/backup|migration|token|password|influencer|branding|samsung|raffle|rifa/i.test(key)) return;
      collect(value, raw);
    });
    const seen = new Set();
    return raw.filter(item => {
      const id = String(item.id || item.activationId || [itemDate(item), itemLocation(item), itemType(item)].join('|'));
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  };

  const project = ([lat,lng]) => {
    const x = ((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * 100;
    const y = ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * 100;
    return [Math.max(3, Math.min(97, x)), Math.max(4, Math.min(96, y))];
  };

  const findMapContainer = () => {
    const containers = Array.from(document.querySelectorAll('.leaflet-container'));
    return containers.sort((a,b)=>(b.clientWidth*b.clientHeight)-(a.clientWidth*a.clientHeight))[0] || null;
  };

  const render = async () => {
    injectCss();
    const container = findMapContainer();
    if (!container) return;
    container.style.position = 'relative';
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
      const label = `${nice(itemLocation(item))}\n${nice(itemType(item))} · ${itemDate(item) || 'Sin fecha'}`;
      pin.title = label;
      pin.addEventListener('mouseenter', () => {
        const old = layer.querySelector('.yango-btl-popup');
        if (old) old.remove();
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
      reload.onclick = event => { event.preventDefault(); render(); };
      container.appendChild(reload);
    }
  };

  const schedule = () => setTimeout(render, 350);
  [300, 1200, 2600, 5000].forEach(t => setTimeout(render, t));
  window.addEventListener('focus', schedule);
  window.addEventListener('resize', schedule);
  document.addEventListener('click', event => {
    const text = String(event.target?.textContent || '').toLowerCase();
    if (/mapa|activaciones|calendario|cargar|resultados/.test(text)) schedule();
  }, true);
  new MutationObserver(() => schedule()).observe(document.documentElement, { childList:true, subtree:true });
})();
