const express = require("express");
const path = require("path");
const fs = require("fs");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3000;
const databaseUrl = process.env.DATABASE_URL;
const isRailwayPrivateDatabase = /railway\.internal/i.test(String(databaseUrl || ""));
const HELPER_VERSION = "20260810a";

const SUMMARY_SHEET_ID = "1HF0h65jgRPZiKYAro_bctnnSOaVARqd-KPjycfOUZDg";
const SUMMARY_GIDS = new Set(["306964116", "949067172"]);
const MYSTERY_SHOPPER_SHEET_ID = "12-AWRARvNJytUoGNWj0IGtSMaO1clqtqyzqT6jntwNY";
const MYSTERY_SHOPPER_SHEET_NAME = "Form Responses 1";

function shouldUseDatabaseSsl() {
  if (!databaseUrl || process.env.PGSSLMODE === "disable" || isRailwayPrivateDatabase) return false;
  if (process.env.PGSSLMODE === "require") return true;
  try {
    return new URL(databaseUrl).searchParams.get("sslmode") === "require";
  } catch (_error) {
    return false;
  }
}

const databaseSsl = shouldUseDatabaseSsl();
const pool = databaseUrl ? new Pool({
  connectionString: databaseUrl,
  ssl: databaseSsl ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 8000),
  idleTimeoutMillis: 30000
}) : null;

let readyPromise = null;

function describeError(error) {
  if (!error) return "Unknown error";
  if (error.message) return error.message;
  if (typeof error === "string") return error;
  try { return JSON.stringify(error); } catch (_error) { return String(error); }
}

function databaseDiagnostics() {
  if (!databaseUrl) return { configured: false };
  try {
    const url = new URL(databaseUrl);
    return {
      configured: true,
      host: url.hostname,
      port: url.port || "default",
      ssl: databaseSsl ? "enabled" : "disabled"
    };
  } catch (_error) {
    return { configured: true, host: "invalid-url", ssl: "unknown" };
  }
}

async function ensureDatabase() {
  if (!pool) return false;
  if (!readyPromise) {
    readyPromise = pool.query(`
      create table if not exists app_state (
        key text primary key,
        value jsonb not null,
        updated_at timestamptz not null default now()
      );
    `);
  }
  await readyPromise;
  return true;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < String(text || "").length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

function csvToObjects(text) {
  const rows = parseCsv(text).filter(row => row.some(cell => String(cell || "").trim() !== ""));
  if (!rows.length) return [];
  const headers = rows[0].map(header => String(header || "").trim());
  return rows.slice(1).map(row => headers.reduce((obj, header, index) => {
    obj[header || `Column ${index + 1}`] = row[index] || "";
    return obj;
  }, {}));
}

async function fetchCsvText(sheetId, params) {
  const query = new URLSearchParams(params);
  const urls = [
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?${query.toString()}`,
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&${query.toString()}`
  ];
  let lastError = null;
  for (const url of urls) {
    try {
      const response = await fetch(url, { headers: { "user-agent": "Yango-MKT-Dashboard" } });
      const text = await response.text();
      if (!response.ok || /^\s*</.test(text)) throw new Error(`Google Sheets returned ${response.status}`);
      return text;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("No pude leer Google Sheets.");
}

function normalizeStateText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeStateCompact(value) {
  return normalizeStateText(value).replace(/[^a-z0-9]+/g, "");
}

function normalizeDateForState(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 20000 && value < 80000) return new Date(Date.UTC(1899, 11, 30 + value)).toISOString().slice(0, 10);
    return "";
  }
  const raw = String(value || "").trim();
  if (!raw) return "";
  const iso = raw.match(/(20\d{2}|19\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`;
  const local = raw.match(/(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|19\d{2})/);
  if (local) return `${local[3]}-${String(local[2]).padStart(2, "0")}-${String(local[1]).padStart(2, "0")}`;
  const yearless = raw.match(/(?:^|[^\d])(\d{1,2})[-/.](\d{1,2})(?![-/.]\d)/);
  if (yearless) return `2026-${String(yearless[2]).padStart(2, "0")}-${String(yearless[1]).padStart(2, "0")}`;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return "";
}

function normalizeActivationType(type) {
  const text = normalizeStateText(type);
  const compact = normalizeStateCompact(type);
  const types = new Map([
    ["flyers", "Flyers"], ["flyer", "Flyers"],
    ["cafe", "Café"], ["café", "Café"],
    ["helados", "Helados"], ["helado", "Helados"],
    ["materialpop", "Material POP"], ["material pop", "Material POP"], ["pop", "Material POP"],
    ["universidad", "Universidad"], ["universidades", "Universidad"],
    ["evento", "Evento"], ["eventos", "Evento"]
  ]);
  return types.get(text) || types.get(compact) || "Flyers";
}

function normalizeActivationStatus(status) {
  const text = normalizeStateText(status);
  if (["planned", "done", "missed", "cancelled", "canceled", "pending", "completed", "active", "paused"].includes(text)) return text;
  if (/se dio|hecha|realizada|done|complete|completed|aprob|valid/.test(text)) return "done";
  if (/no se dio|cancel|missed|paus|pausa/.test(text)) return "missed";
  return "planned";
}

function sanitizeDeliverables(value) {
  const allowed = new Map(["Stories", "Reel", "Post", "TikTok", "Live"].map(item => [item.toLowerCase(), item]));
  const raw = Array.isArray(value) ? value : String(value || "").split("+");
  const output = [];
  raw.forEach(item => {
    const text = String(item || "").trim();
    if (!text) return;
    const canonical = allowed.get(text.toLowerCase()) || text;
    if (!output.some(existing => String(existing).toLowerCase() === String(canonical).toLowerCase())) output.push(canonical);
  });
  return output.length ? output : ["Stories"];
}

function stateRichnessScore(item) {
  if (!item || typeof item !== "object") return 0;
  return Object.values(item).reduce((score, value) => {
    if (Array.isArray(value)) return score + value.filter(Boolean).length;
    if (value && typeof value === "object") return score + Object.keys(value).length;
    return score + (value !== undefined && value !== null && String(value).trim() !== "" ? 1 : 0);
  }, 0);
}

function influencerStateKey(item) {
  const name = normalizeStateText(item && (item.name || item.nombre));
  const handle = normalizeStateText(item && (item.handle || item.igUsername || item.instagram || item.tiktokUsername));
  return name || handle ? `${name}|${handle}` : "";
}

function sanitizeInfluencerState(value) {
  if (!Array.isArray(value)) return value;
  const map = new Map();
  value.forEach(item => {
    const key = influencerStateKey(item);
    if (!key) return;
    const next = item && typeof item === "object" ? { ...item, deliverables: sanitizeDeliverables(item.deliverables || item.entregables) } : item;
    const current = map.get(key);
    if (!current || stateRichnessScore(next) >= stateRichnessScore(current)) map.set(key, next);
  });
  return Array.from(map.values());
}

function sanitizeSocialReportState(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.months)) return value;
  return { ...value, months: Array.from(new Set(value.months.filter(Boolean))) };
}

function stateObjectText(item) {
  if (!item || typeof item !== "object") return "";
  return [
    item.id, item.name, item.nombre, item.title, item.titulo, item.location, item.ubicacion,
    item.zone, item.zona, item.type, item.tipo, item.activationType, item.tipoActivacion,
    item.date, item.fecha, item.calendarDate, item.activationDate, item.createdAt,
    item.promoters, item.promotoras, item.photos, item.fotos, item.evidence, item.evidencia
  ].filter(Boolean).join(" ");
}

function looksLikeAgencyStateItem(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return false;
  return /promotora|promotoras|foto|fotos|photo|photos|evidencia|proof|flyers entreg|cantidad de flyers|agency|agencia/i.test(JSON.stringify(item).slice(0, 6000));
}

function looksLikeActivationStateItem(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return false;
  const sample = normalizeStateText(stateObjectText(item));
  return /activacion|activation|petare|sabana|centro|este|oeste|norte|sur|flyer|cafe|helado|universidad|evento|chacaito|altamira|hoyada|junquito|montalban|vega/.test(sample);
}

function sanitizeDatedStateItem(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return item;
  const isAgency = looksLikeAgencyStateItem(item);
  const isActivation = looksLikeActivationStateItem(item);
  if (!isAgency && !isActivation) return item;
  const date = normalizeDateForState(item.date || item.fecha || item.calendarDate || item.activationDate || item.createdAt || item.updatedAt) || "2026-01-01";
  const next = { ...item, date };
  next.fecha = String(next.fecha || date);
  next.name = String(next.name || next.nombre || next.title || next.titulo || next.location || next.ubicacion || "Sin nombre");
  next.nombre = String(next.nombre || next.name);
  next.title = String(next.title || next.titulo || next.name);
  next.titulo = String(next.titulo || next.title);
  next.location = String(next.location || next.ubicacion || next.zone || next.zona || "");
  next.ubicacion = String(next.ubicacion || next.location);
  next.zone = String(next.zone || next.zona || next.location);
  next.zona = String(next.zona || next.zone);
  if (isActivation) {
    next.type = normalizeActivationType(item.type || item.tipo || item.activationType || item.tipoActivacion);
    next.tipo = normalizeActivationType(item.tipo || item.type || item.activationType || item.tipoActivacion);
    next.status = normalizeActivationStatus(item.status || item.estado);
    next.estado = String(next.estado || next.status);
  }
  return next;
}

function sanitizeDatedState(value) {
  if (Array.isArray(value)) return value.map(item => sanitizeDatedState(sanitizeDatedStateItem(item))).filter(item => item != null);
  if (!value || typeof value !== "object") return value;
  const itemCleaned = sanitizeDatedStateItem(value);
  const next = { ...itemCleaned };
  Object.keys(next).forEach(key => {
    if (Array.isArray(next[key]) || (next[key] && typeof next[key] === "object")) next[key] = sanitizeDatedState(next[key]);
  });
  return next;
}

function shouldSanitizeDatedState(key, value) {
  if (/agency|agencia|proof|photo|foto|evidencia|promotor|flyer|activ|calendar|calendario|acts|btl|yango|mkt/i.test(String(key || ""))) return true;
  try {
    return /promotora|promotoras|foto|fotos|activacion|activation|calendario|calendar|petare|sabana|flyers entreg/i.test(JSON.stringify(value).slice(0, 8000));
  } catch (_error) {
    return false;
  }
}

function sanitizeStateValue(key, value) {
  if (/samsung|raffle|rifa/i.test(String(key || ""))) return [];
  let next = value;
  if (key === "yango_influencers_h1") next = sanitizeInfluencerState(next);
  if (key === "yango_social_report_h1") next = sanitizeSocialReportState(next);
  if (shouldSanitizeDatedState(key, next)) next = sanitizeDatedState(next);
  return next;
}

function sendDashboard(_req, res) {
  fs.readFile(path.join(__dirname, "index.html"), "utf8", (error, html) => {
    if (error) return res.status(500).send("No pude cargar el dashboard.");
    const helperNames = [
      "samsung-raffle-export",
      "preboot-state-guard",
      "influencer-payment-filter",
      "branding-inventory-cleanup",
      "activation-status-sync",
      "mystery-shopper-sheet-sync",
      "cloud-save-status",
      "yango-summary-dashboard",
      "yango-summary-standalone-fix"
    ];
    const helperPattern = new RegExp(`<script\\s+[^>]*src=["']\\/(?:${helperNames.join("|")})\\.js(?:\\?[^"']*)?["'][^>]*><\\/script>`, "gi");
    const withoutOldHelpers = html.replace(helperPattern, "");
    const prebootTag = `<script src="/preboot-state-guard.js?v=${HELPER_VERSION}"></script>`;
    const withPreboot = withoutOldHelpers.includes("</head>")
      ? withoutOldHelpers.replace("</head>", `${prebootTag}</head>`)
      : `${prebootTag}${withoutOldHelpers}`;
    const isTeamPanel = Boolean(_req.query && _req.query.panel);
    const helperTags = [
      `<script src="/influencer-payment-filter.js?v=${HELPER_VERSION}" defer></script>`,
      `<script src="/branding-inventory-cleanup.js?v=${HELPER_VERSION}" defer></script>`,
      `<script src="/activation-status-sync.js?v=${HELPER_VERSION}" defer></script>`,
      `<script src="/mystery-shopper-sheet-sync.js?v=${HELPER_VERSION}" defer></script>`,
      `<script src="/cloud-save-status.js?v=${HELPER_VERSION}" defer></script>`,
      ...(!isTeamPanel ? [
        `<script src="/yango-summary-dashboard.js?v=${HELPER_VERSION}" defer></script>`,
        `<script src="/yango-summary-standalone-fix.js?v=${HELPER_VERSION}" defer></script>`
      ] : [])
    ];
    const withHelpers = withPreboot.replace("</body>", `${helperTags.join("")}</body>`);
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.type("html").send(withHelpers);
  });
}

app.use(express.json({ limit: "50mb" }));

app.get("/api/health", async (_req, res) => {
  try {
    const hasDb = await ensureDatabase();
    res.json({ ok: true, database: hasDb ? "connected" : "not_configured", diagnostics: databaseDiagnostics() });
  } catch (error) {
    res.status(500).json({ ok: false, error: describeError(error), diagnostics: databaseDiagnostics() });
  }
});

app.get("/api/yango-summary-csv", async (req, res) => {
  try {
    const gid = String(req.query.gid || "");
    if (!SUMMARY_GIDS.has(gid)) return res.status(400).send("Invalid sheet gid");
    const text = await fetchCsvText(SUMMARY_SHEET_ID, { tqx: "out:csv", gid });
    res.set("Cache-Control", "no-store");
    res.type("text/csv").send(text);
  } catch (error) {
    res.status(502).send(error.message);
  }
});

app.get("/api/mystery-shopper-responses", async (_req, res) => {
  try {
    const text = await fetchCsvText(MYSTERY_SHOPPER_SHEET_ID, { tqx: "out:csv", sheet: MYSTERY_SHOPPER_SHEET_NAME });
    const rows = csvToObjects(text);
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, source: "google_sheets", sheetId: MYSTERY_SHOPPER_SHEET_ID, sheetName: MYSTERY_SHOPPER_SHEET_NAME, rows });
  } catch (error) {
    res.status(502).json({ ok: false, error: error.message });
  }
});

app.get("/api/state", async (req, res) => {
  try {
    if (!(await ensureDatabase())) return res.status(503).json({ ok: false, error: "DATABASE_URL is not configured" });
    const keys = String(req.query.keys || "").split(",").map(k => k.trim()).filter(Boolean);
    const result = keys.length
      ? await pool.query("select key, value, updated_at from app_state where key = any($1)", [keys])
      : await pool.query("select key, value, updated_at from app_state");
    const values = {};
    const updatedAt = {};
    result.rows.forEach(row => {
      values[row.key] = sanitizeStateValue(row.key, row.value);
      updatedAt[row.key] = row.updated_at;
    });
    res.json({ ok: true, values, updatedAt });
  } catch (error) {
    res.status(500).json({ ok: false, error: describeError(error) });
  }
});

async function saveStateValue(req, res) {
  try {
    if (!(await ensureDatabase())) return res.status(503).json({ ok: false, error: "DATABASE_URL is not configured" });
    const key = req.params.key;
    const incomingValue = req.body && Object.prototype.hasOwnProperty.call(req.body, "value") ? req.body.value : req.body;
    const value = sanitizeStateValue(key, incomingValue);
    const result = await pool.query(`
      insert into app_state (key, value, updated_at)
      values ($1, $2::jsonb, now())
      on conflict (key)
      do update set value = excluded.value, updated_at = now()
      returning key, updated_at
    `, [key, JSON.stringify(value)]);
    res.json({ ok: true, key: result.rows[0].key, updatedAt: result.rows[0].updated_at });
  } catch (error) {
    res.status(500).json({ ok: false, error: describeError(error) });
  }
}

app.put("/api/state/:key", saveStateValue);
app.post("/api/state/:key", saveStateValue);

app.get("/", sendDashboard);
app.use(express.static(__dirname, { index: false }));
app.get("*", sendDashboard);

app.listen(port, () => {
  console.log(`Yango MKT dashboard listening on ${port}`);
});
