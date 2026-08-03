(() => {
  if (typeof window === "undefined") return;
  const FLAG = "__yangoMysteryShopperSheetSyncInstalled";
  if (window[FLAG]) return;
  window[FLAG] = true;

  const SHEET_SOURCE = "google_form_mystery_shopper";
  const FALLBACK_KEY = "yango_mystery_shopper_h1";

  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  const cleanHeader = value => normalize(value).replace(/[^a-z0-9]+/g, "");
  const isObject = value => value && typeof value === "object" && !Array.isArray(value);

  const parseJson = value => {
    try { return JSON.parse(value); } catch (_error) { return null; }
  };

  const readField = (row, aliases) => {
    const keys = Object.keys(row || {});
    for (const alias of aliases) {
      const wanted = cleanHeader(alias);
      const key = keys.find(item => cleanHeader(item) === wanted || cleanHeader(item).includes(wanted) || wanted.includes(cleanHeader(item)));
      if (key && row[key] != null && String(row[key]).trim() !== "") return row[key];
    }
    return "";
  };

  const toIsoDate = value => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    const match = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (match) {
      const day = match[1].padStart(2, "0");
      const month = match[2].padStart(2, "0");
      const year = match[3].length === 2 ? `20${match[3]}` : match[3];
      return `${year}-${month}-${day}`;
    }
    return raw;
  };

  const numberValue = value => {
    const n = Number(String(value || "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const stableId = item => {
    if (!isObject(item)) return "";
    return String(item.id || item.responseId || [item.source, item.timestamp, item.date, item.location, item.type, item.shopperName].filter(Boolean).join("|")).trim();
  };

  const mergeArrays = (remoteValue, imported) => {
    const base = Array.isArray(remoteValue) ? remoteValue : [];
    const next = [...base];
    const indexById = new Map();
    next.forEach((item, index) => {
      const id = stableId(item);
      if (id) indexById.set(id, index);
    });
    imported.forEach(item => {
      const id = stableId(item);
      if (id && indexById.has(id)) {
        next[indexById.get(id)] = { ...next[indexById.get(id)], ...item };
      } else {
        next.push(item);
      }
    });
    return next;
  };

  const patchMysteryValue = (current, imported) => {
    if (Array.isArray(current)) return mergeArrays(current, imported);
    if (isObject(current)) {
      const next = { ...current };
      const candidateKeys = ["responses", "formResponses", "items", "records", "mysteryResponses", "mysteryShoppers"];
      let patchedAny = false;
      candidateKeys.forEach(key => {
        if (Array.isArray(next[key])) {
          next[key] = mergeArrays(next[key], imported);
          patchedAny = true;
        }
      });
      if (!patchedAny) next.responses = mergeArrays([], imported);
      next.lastGoogleFormSyncAt = new Date().toISOString();
      next.googleFormSource = SHEET_SOURCE;
      return next;
    }
    return imported;
  };

  const rowToRecord = row => {
    const timestamp = readField(row, ["Timestamp", "Marca temporal"]);
    const location = readField(row, ["Activación Visitada", "Activacion Visitada", "Ubicación", "Ubicacion"]);
    const date = toIsoDate(readField(row, ["Fecha Visitada"]));
    const time = readField(row, ["Hora Visitada"]);
    const shopperName = readField(row, ["Nombre y Apellido del mystery shopper", "Mystery shopper"]);
    const type = readField(row, ["Tipo de Activacion", "Tipo de Activación"]);
    const operative = readField(row, ["¿La activación estaba operativa?", "La activación estaba operativa"]);
    const promotersPresent = readField(row, ["¿Estaban presentes todas las promotoras?", "Estaban presentes todas las promotoras"]);
    const uniform = readField(row, ["¿Las promotoras tenían uniforme correcto?", "uniforme correcto"]);
    const photo = readField(row, ["Foto general de la activación", "Foto general"]);

    const ratings = {
      activeApproach: numberValue(readField(row, ["¿Las promotoras abordaban activamente a las personas?", "abordaban activamente"])),
      friendly: numberValue(readField(row, ["¿Las promotoras fueron amables y profesionales?", "amables y profesionales"])),
      appDownload: numberValue(readField(row, ["¿Invitaban activamente a descargar la app?", "descargar la app"])),
      benefits: numberValue(readField(row, ["¿Explicaban correctamente los beneficios de Yango?", "beneficios de Yango"])),
      questions: numberValue(readField(row, ["¿Respondían correctamente las preguntas?", "respondían correctamente"])),
      visibility: numberValue(readField(row, ["¿Qué tan visible era la activación desde lejos?", "visible era la activación"])),
      general: numberValue(readField(row, ["Calificación general de la activación", "Calificacion general"] ))
    };

    const id = [SHEET_SOURCE, timestamp, date, time, location, type, shopperName].map(normalize).filter(Boolean).join("--");
    return {
      id: id || `${SHEET_SOURCE}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      responseId: id,
      source: SHEET_SOURCE,
      importedFromGoogleForm: true,
      timestamp,
      location,
      activation: location,
      date,
      visitedDate: date,
      time,
      visitedTime: time,
      shopperName,
      type,
      activationType: type,
      operative,
      isOperative: /^si|sí$/i.test(String(operative || "")),
      promotersPresent,
      uniform,
      ratings,
      traffic: readField(row, ["Flujo de personas observado"]),
      audienceProfile: readField(row, ["Perfil predominante del público", "Perfil predominante"]),
      competition: readField(row, ["¿Había presencia de competencia?", "presencia de competencia"]),
      questionsHeard: readField(row, ["Preguntas más frecuentes escuchadas"]),
      generalRating: ratings.general,
      investAgain: readField(row, ["¿Volverías a invertir en esta ubicación?", "Volverías a invertir"]),
      comments: readField(row, ["Comentarios adicionales"]),
      photo,
      photoUrl: photo,
      verified: true,
      status: /^si|sí$/i.test(String(operative || "")) ? "Verificada" : "Observación",
      syncedAt: new Date().toISOString()
    };
  };

  const fetchState = async () => {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) return {};
    const payload = await response.json();
    return payload.values || {};
  };

  const putState = async (key, value) => {
    const response = await fetch(`/api/state/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value })
    });
    if (!response.ok) throw new Error(`API ${response.status}`);
  };

  const mysteryKeysFromState = values => Object.keys(values || {})
    .filter(key => /mystery|shopper/i.test(key) && !/backup|migration|token|password/i.test(key));

  const mysteryKeysFromStorage = () => {
    const keys = [];
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (/mystery|shopper/i.test(key || "") && !/backup|migration|token|password/i.test(key || "")) keys.push(key);
      }
    } catch (_error) {}
    return keys;
  };

  const syncMysteryResponses = async () => {
    if (!window.fetch || window.location.protocol === "file:") return;
    try {
      const response = await fetch("/api/mystery-shopper-responses", { cache: "no-store" });
      if (!response.ok) throw new Error(`Mystery API ${response.status}`);
      const payload = await response.json();
      const imported = Array.isArray(payload.rows) ? payload.rows.map(rowToRecord).filter(item => item.location || item.date || item.shopperName) : [];
      if (!imported.length) return;

      const remoteValues = await fetchState();
      const targetKeys = Array.from(new Set([...mysteryKeysFromState(remoteValues), ...mysteryKeysFromStorage(), FALLBACK_KEY]));
      for (const key of targetKeys) {
        const current = Object.prototype.hasOwnProperty.call(remoteValues, key) ? remoteValues[key] : parseJson(localStorage.getItem(key));
        const patched = patchMysteryValue(current, imported);
        await putState(key, patched);
        try { localStorage.setItem(key, JSON.stringify(patched)); } catch (_error) {}
      }
      window.dispatchEvent(new CustomEvent("yango:mystery-shopper-sheet-synced", { detail: { count: imported.length, keys: targetKeys } }));
    } catch (error) {
      console.warn("No pude sincronizar Mystery Shopper desde Google Sheets:", error);
    }
  };

  setTimeout(syncMysteryResponses, 1800);
  window.addEventListener("focus", () => setTimeout(syncMysteryResponses, 500));
  window.yangoSyncMysteryShopperSheet = syncMysteryResponses;
})();
