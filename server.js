const express = require("express");
const path = require("path");
const fs = require("fs");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3000;
const databaseUrl = process.env.DATABASE_URL;
const HELPER_VERSION = process.env.RAILWAY_GIT_COMMIT_SHA || "20260814b";
const APPS_SCRIPT_WEBHOOK_URL = String(process.env.APPS_SCRIPT_WEBHOOK_URL || "").trim();
const APPS_SCRIPT_SYNC_SECRET = String(process.env.APPS_SCRIPT_SYNC_SECRET || "").trim();
const APPS_SCRIPT_TIMEOUT_MS = Number(process.env.APPS_SCRIPT_TIMEOUT_MS || 8000);
const APPS_SCRIPT_AUTO_BACKFILL = process.env.APPS_SCRIPT_AUTO_BACKFILL !== "false";
let appsScriptStartupBackfillDone = false;

const SUMMARY_SHEET_ID = "1HF0h65jgRPZiKYAro_bctnnSOaVARqd-KPjycfOUZDg";
const SUMMARY_GIDS = new Set(["306964116", "949067172"]);
const MYSTERY_SHOPPER_SHEET_ID = "12-AWRARvNJytUoGNWj0IGtSMaO1clqtqyzqT6jntwNY";
const MYSTERY_SHOPPER_SHEET_NAME = "Form Responses 1";

function useSsl(url) {
  if (!url || /railway\.internal/i.test(String(url)) || process.env.PGSSLMODE === "disable") return false;
  if (process.env.PGSSLMODE === "require") return true;
  try { return new URL(url).searchParams.get("sslmode") === "require"; } catch (_e) { return false; }
}

const databaseSsl = useSsl(databaseUrl);
const pool = databaseUrl ? new Pool({
  connectionString: databaseUrl,
  ssl: databaseSsl ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 8000),
  idleTimeoutMillis: 30000
}) : null;
let readyPromise = null;

function describeError(error) {
  return error && error.message ? error.message : String(error || "Unknown error");
}

function diagnostics() {
  if (!databaseUrl) return { configured: false };
  try {
    const url = new URL(databaseUrl);
    return { configured: true, host: url.hostname, port: url.port || "default", ssl: databaseSsl ? "enabled" : "disabled" };
  } catch (_e) {
    return { configured: true, host: "invalid-url", ssl: "unknown" };
  }
}

async function ensureDatabase() {
  if (!pool) return false;
  if (!readyPromise) {
    readyPromise = pool.query(`create table if not exists app_state (key text primary key, value jsonb not null, updated_at timestamptz not null default now())`);
  }
  await readyPromise;
  return true;
}

function parseCsv(text) {
  const rows = [];
  let row = [], value = "", quoted = false;
  for (let i = 0; i < String(text || "").length; i += 1) {
    const c = text[i], n = text[i + 1];
    if (quoted) {
      if (c === '"' && n === '"') { value += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else value += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(value); value = ""; }
    else if (c === "\n") { row.push(value); rows.push(row); row = []; value = ""; }
    else if (c !== "\r") value += c;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}

function csvToObjects(text) {
  const rows = parseCsv(text).filter(row => row.some(cell => String(cell || "").trim()));
  if (!rows.length) return [];
  const headers = rows[0].map(h => String(h || "").trim());
  return rows.slice(1).map(row => headers.reduce((obj, h, i) => ({ ...obj, [h || `Column ${i + 1}`]: row[i] || "" }), {}));
}

async function fetchCsvText(sheetId, params) {
  const q = new URLSearchParams(params);
  const urls = [`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?${q}`, `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&${q}`];
  let lastError;
  for (const url of urls) {
    try {
      const response = await fetch(url, { headers: { "user-agent": "Yango-MKT-Dashboard" } });
      const text = await response.text();
      if (!response.ok || /^\s*</.test(text)) throw new Error(`Google Sheets returned ${response.status}`);
      return text;
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error("No pude leer Google Sheets.");
}

const cleanText = value => String(value == null ? "" : value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const compact = value => cleanText(value).replace(/[^a-z0-9]+/g, "");
const safeStringify = value => { try { return JSON.stringify(value); } catch (_e) { return String(value); } };

function normalizeDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && Number.isFinite(value)) return value > 20000 && value < 80000 ? new Date(Date.UTC(1899, 11, 30 + value)).toISOString().slice(0, 10) : "";
  const raw = String(value || "").trim();
  if (!raw) return "";
  let m = raw.match(/(20\d{2}|19\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  m = raw.match(/(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|19\d{2})/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  m = raw.match(/(?:^|[^\d])(\d{1,2})[-/.](\d{1,2})(?![-/.]\d)/);
  if (m) return `2026-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

const typeMap = new Map([
  ["flyers", "Flyers"], ["flyer", "Flyers"], ["cafe", "Café"], ["café", "Café"], ["helados", "Helados"], ["helado", "Helados"],
  ["materialpop", "Material POP"], ["material pop", "Material POP"], ["pop", "Material POP"], ["universidad", "Universidad"], ["universidades", "Universidad"], ["evento", "Evento"], ["eventos", "Evento"]
]);
function normalizeType(value) { return typeMap.get(cleanText(value)) || typeMap.get(compact(value)) || "Flyers"; }
function normalizeStatus(value) {
  const t = cleanText(value);
  if (/no se dio|no realizada|cancel|missed|paus|pausa/.test(t)) return "missed";
  if (["planned", "done", "missed", "cancelled", "canceled", "pending", "completed", "active", "paused"].includes(t)) return t;
  if (/se dio|hecha|realizada|done|complete|completed|aprob|valid/.test(t)) return "done";
  return "planned";
}

function looksLikeDashboardState(key, value) {
  if (/agency|agencia|proof|photo|foto|evidencia|promotor|flyer|activ|calendar|calendario|acts|btl|yango|mkt/i.test(String(key || ""))) return true;
  return /promotora|promotoras|foto|fotos|activacion|activation|calendario|calendar|petare|sabana|flyers entreg|agencia|agency/i.test(safeStringify(value).slice(0, 9000));
}

function sanitizeDated(value, force = false) {
  if (Array.isArray(value)) return value.map(item => sanitizeDated(item, force)).filter(item => item != null);
  if (!value || typeof value !== "object") return value;
  const sample = safeStringify(value).slice(0, 6000);
  const relevant = force || /promotora|promotoras|foto|fotos|photo|photos|activacion|activation|calendario|calendar|petare|sabana|centro|chacaito|altamira|hoyada|junquito|montalban|vega|flyer|agencia|agency/i.test(sample);
  const next = { ...value };
  Object.keys(next).forEach(key => {
    if (next[key] && typeof next[key] === "object") next[key] = sanitizeDated(next[key], relevant || /items|rows|data|activ|calendar|agencia|agency|reports|proofs/i.test(key));
  });
  if (!relevant) return next;
  const date = normalizeDate(next.date || next.fecha || next.calendarDate || next.activationDate || next.createdAt || next.updatedAt);
  if (date) {
    next.date = String(next.date || date);
    next.fecha = String(next.fecha || date);
    next.calendarDate = String(next.calendarDate || date);
    next.activationDate = String(next.activationDate || date);
    next.createdAt = String(next.createdAt || date);
    next.updatedAt = String(next.updatedAt || date);
  }
  const name = String(next.name || next.nombre || next.title || next.titulo || "").trim();
  if (name) {
    next.name = String(next.name || name);
    next.nombre = String(next.nombre || next.name);
    next.title = String(next.title || next.titulo || next.name);
    next.titulo = String(next.titulo || next.title);
  }
  const location = String(next.location || next.ubicacion || next.zone || next.zona || "").trim();
  if (location) {
    next.location = String(next.location || location);
    next.ubicacion = String(next.ubicacion || next.location);
    next.zone = String(next.zone || next.zona || next.location);
    next.zona = String(next.zona || next.zone);
  }
  if (next.type || next.tipo || next.activationType || next.tipoActivacion) {
    next.type = normalizeType(next.type || next.tipo || next.activationType || next.tipoActivacion);
    next.tipo = normalizeType(next.tipo || next.type || next.activationType || next.tipoActivacion);
  }
  if (next.status || next.estado) {
    next.status = normalizeStatus(next.status || next.estado);
    next.estado = String(next.estado || next.status);
  }
  return next;
}

function activationStateKey(key) {
  return /yango_activations|\bacts\b|activation|activacion|activaciones|calendar|calendario/i.test(String(key || ""));
}
function arrayStateKey(key) {
  return /yango_influencers_h1|yango_agency_submissions_h1|yango_media_ooh_h1|yango_mystery_shopper_h1|yango_users_h1|yango_btl_activations_h1|yango_btl_calendar_h1|yango_btl_results_h1/i.test(String(key || "")) || activationStateKey(key);
}
function normalizeArrayState(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const likelyKeys = ["items", "rows", "data", "values", "activations", "activationes", "calendar", "calendario", "reports", "submissions", "records", "list", "entries"];
  for (const key of likelyKeys) {
    if (Array.isArray(value[key])) return value[key];
  }
  const vals = Object.values(value);
  if (vals.length && vals.every(item => item && typeof item === "object" && !Array.isArray(item))) return vals;
  return [];
}
function activationIsUnnamed(item) {
  const name = cleanText(item && (item.name || item.nombre || item.title || item.titulo));
  return !name || name === "sin nombre" || compact(name) === "sinnombre" || ["undefined", "null", "nan", "-"].includes(name);
}

function activationStableKey(item) {
  if (!item || typeof item !== "object") return "";
  const name = cleanText(item.name || item.nombre || item.title || item.titulo);
  const location = cleanText(item.location || item.ubicacion || item.zone || item.zona);
  const type = cleanText(item.type || item.tipo || item.activationType || item.tipoActivacion);
  const status = cleanText(item.status || item.estado || item.activationStatus || "");
  const date = normalizeDate(item.date || item.fecha || item.calendarDate || item.activationDate || item.createdAt || item.updatedAt);
  return [date, location || name, type, name, status].filter(Boolean).join("|");
}

function sanitizeActivations(value) {
  const list = normalizeArrayState(value);
  const map = new Map();
  list.forEach(rawItem => {
    if (!rawItem || typeof rawItem !== "object") return;
    if (activationIsUnnamed(rawItem)) return;
    const item = sanitizeDated(rawItem, true);
    if (activationIsUnnamed(item)) return;
    const key = activationStableKey(item) || safeStringify(item);
    if (!map.has(key)) map.set(key, item);
    else map.set(key, { ...map.get(key), ...item });
  });
  return [...map.values()].sort((a, b) => String(a.date || a.fecha || "").localeCompare(String(b.date || b.fecha || "")) || String(a.name || a.nombre || "").localeCompare(String(b.name || b.nombre || "")));
}

function sanitizeDeliverables(value) {
  const allowed = new Map(["Stories", "Reel", "Post", "TikTok", "Live"].map(x => [x.toLowerCase(), x]));
  const raw = Array.isArray(value) ? value : String(value || "").split("+");
  const out = [];
  raw.forEach(item => {
    const t = String(item || "").trim();
    if (!t) return;
    const canonical = allowed.get(t.toLowerCase()) || t;
    if (!out.some(x => String(x).toLowerCase() === String(canonical).toLowerCase())) out.push(canonical);
  });
  return out.length ? out : ["Stories"];
}

function richness(item) {
  if (!item || typeof item !== "object") return 0;
  return Object.values(item).reduce((score, value) => score + (Array.isArray(value) ? value.filter(Boolean).length : value && typeof value === "object" ? Object.keys(value).length : value != null && String(value).trim() ? 1 : 0), 0);
}
function influencerKey(item) {
  const name = cleanText(item && (item.name || item.nombre));
  const handle = cleanText(item && (item.handle || item.igUsername || item.instagram || item.tiktokUsername));
  return name || handle ? `${name}|${handle}` : "";
}
function sanitizeInfluencers(value) {
  const list = normalizeArrayState(value);
  const map = new Map();
  list.forEach(item => {
    const key = influencerKey(item);
    if (!key || /^carlos rides\|/.test(key) || key === "carlos rides|") return;
    const next = item && typeof item === "object" ? { ...item, deliverables: sanitizeDeliverables(item.deliverables || item.entregables) } : item;
    if (!map.has(key) || richness(next) >= richness(map.get(key))) map.set(key, next);
  });
  return [...map.values()];
}

function sanitizeStateValue(key, value) {
  if (/samsung|raffle|rifa/i.test(String(key || ""))) return [];
  if (activationStateKey(key)) return sanitizeActivations(value);
  if (key === "yango_influencers_h1") return sanitizeInfluencers(value);
  if (arrayStateKey(key)) return normalizeArrayState(value);
  if (key === "yango_social_report_h1" && value && typeof value === "object" && Array.isArray(value.months)) return { ...value, months: [...new Set(value.months.filter(Boolean))] };
  return looksLikeDashboardState(key, value) ? sanitizeDated(value, true) : value;
}

function sameStateValue(a, b) {
  return safeStringify(a) === safeStringify(b);
}

function appsScriptCount(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return value == null || value === "" ? 0 : 1;
}

async function mirrorToAppsScript(key, value, metadata = {}) {
  if (!APPS_SCRIPT_WEBHOOK_URL) return { skipped: true, reason: "APPS_SCRIPT_WEBHOOK_URL not configured" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), APPS_SCRIPT_TIMEOUT_MS);
  try {
    const response = await fetch(APPS_SCRIPT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        secret: APPS_SCRIPT_SYNC_SECRET,
        source: "railway",
        key,
        value,
        count: appsScriptCount(value),
        updatedAt: new Date().toISOString(),
        ...metadata
      })
    });
    const text = await response.text().catch(() => "");
    if (!response.ok) throw new Error(`Apps Script returned ${response.status}: ${text.slice(0, 300)}`);
    return { ok: true, status: response.status };
  } catch (error) {
    console.warn("Apps Script mirror failed:", key, describeError(error));
    return { ok: false, error: describeError(error) };
  } finally {
    clearTimeout(timer);
  }
}

function fireAndForgetAppsScriptMirror(key, value, metadata = {}) {
  mirrorToAppsScript(key, value, metadata).catch(error => console.warn("Apps Script mirror crashed:", key, describeError(error)));
}

async function backfillAppsScriptState(trigger = "backfill") {
  if (!APPS_SCRIPT_WEBHOOK_URL) return { ok: false, error: "APPS_SCRIPT_WEBHOOK_URL is not configured" };
  if (!(await ensureDatabase())) return { ok: false, error: "DATABASE_URL is not configured" };
  const result = await pool.query("select key, value, updated_at from app_state order by key");
  const mirrored = [];
  for (const row of result.rows) {
    if (/samsung|raffle|rifa/i.test(row.key)) continue;
    const value = sanitizeStateValue(row.key, row.value);
    const mirror = await mirrorToAppsScript(row.key, value, { trigger, dbUpdatedAt: row.updated_at });
    mirrored.push({ key: row.key, count: appsScriptCount(value), ok: Boolean(mirror.ok), skipped: Boolean(mirror.skipped), error: mirror.error || "" });
  }
  return { ok: true, count: mirrored.length, mirrored };
}

function persistCleanState(key, value) {
  if (!pool) return;
  if (/samsung|raffle|rifa/i.test(String(key || ""))) {
    pool.query("delete from app_state where key = $1", [key]).catch(error => console.warn("No pude retirar estado viejo:", key, error.message));
    return;
  }
  pool.query("insert into app_state (key, value, updated_at) values ($1, $2::jsonb, now()) on conflict (key) do update set value = excluded.value, updated_at = now()", [key, JSON.stringify(value)]).then(() => {
    fireAndForgetAppsScriptMirror(key, value, { trigger: "cleanup" });
  }).catch(error => console.warn("No pude persistir limpieza:", key, error.message));
}

function requestToken(req) {
  const query = req.query || {};
  return [
    req.path || "",
    req.originalUrl || "",
    ...Object.keys(query),
    ...Object.values(query).map(value => Array.isArray(value) ? value.join(" ") : String(value || ""))
  ].join(" ").toLowerCase();
}

function isLuisPanel(req) {
  return /(^|[^a-z])luis([^a-z]|$)/.test(requestToken(req));
}

function isCollaboratorPanel(req) {
  const token = requestToken(req);
  return /(^|[^a-z])(giselle|gise|agency|agencia)([^a-z]|$)/.test(token) || /(^|[^a-z])(panel|usuario|user|role|rol)([^a-z]|$)/.test(token);
}

function sendDisabledUser(res) {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.type("html").send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Usuario desactivado</title><style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f7f9fc;color:#101828;display:grid;min-height:100vh;place-items:center}.card{max-width:520px;background:white;border:1px solid #dde6f2;border-radius:24px;padding:32px;box-shadow:0 20px 60px rgba(16,24,40,.08)}.mark{font-size:44px;color:#e60012;font-weight:900}h1{margin:8px 0 10px;font-size:28px}p{color:#667085;line-height:1.5}.btn{display:inline-block;margin-top:12px;background:#e60012;color:#fff;text-decoration:none;border-radius:14px;padding:12px 18px;font-weight:800}</style></head><body><main class="card"><div class="mark">Y</div><h1>Usuario desactivado</h1><p>El acceso de Luis fue retirado. Usa el Admin principal o el usuario de Giselle para seguir trabajando con la data central.</p><a class="btn" href="/">Ir al Admin</a></main></body></html>`);
}

function sendDashboard(req, res) {
  if (isLuisPanel(req)) return sendDisabledUser(res);
  fs.readFile(path.join(__dirname, "index.html"), "utf8", (error, html) => {
    if (error) return res.status(500).send("No pude cargar el dashboard.");
    const helperNames = ["preboot-state-guard", "summary-loop-guard", "influencer-payment-filter", "branding-inventory-cleanup", "activation-status-sync", "authoritative-influencer-sync", "mystery-shopper-sheet-sync", "cloud-save-status", "yango-summary-dashboard", "yango-summary-standalone-fix", "btl-map-polish"];
    const helperPattern = new RegExp(`<script\\s+[^>]*src=["']\\/(?:${helperNames.join("|")})\\.js(?:\\?[^"']*)?["'][^>]*><\\/script>`, "gi");
    const base = html.replace(helperPattern, "");
    const preboot = `<script src="/preboot-state-guard.js?v=${HELPER_VERSION}"></script>`;
    const withPreboot = base.includes("</head>") ? base.replace("</head>", `${preboot}</head>`) : `${preboot}${base}`;
    const isTeamPanel = isCollaboratorPanel(req);
    const adminHelpers = ["summary-loop-guard", "influencer-payment-filter", "branding-inventory-cleanup", "activation-status-sync", "authoritative-influencer-sync", "mystery-shopper-sheet-sync", "cloud-save-status", "yango-summary-dashboard", "yango-summary-standalone-fix", "btl-map-polish"];
    const collaboratorHelpers = ["activation-status-sync", "authoritative-influencer-sync", "cloud-save-status", "btl-map-polish"];
    const helpers = (isTeamPanel ? collaboratorHelpers : adminHelpers).map(name => `<script src="/${name}.js?v=${HELPER_VERSION}" defer></script>`).join("");
    const output = withPreboot.replace("</body>", `${helpers}</body>`);
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.type("html").send(output);
  });
}

app.use(express.json({ limit: "50mb" }));

app.get("/api/health", async (_req, res) => {
  try {
    const hasDb = await ensureDatabase();
    res.json({ ok: true, database: hasDb ? "connected" : "not_configured", diagnostics: diagnostics(), helperVersion: HELPER_VERSION, appsScriptMirror: { configured: Boolean(APPS_SCRIPT_WEBHOOK_URL), autoBackfill: APPS_SCRIPT_AUTO_BACKFILL } });
  } catch (error) {
    res.status(500).json({ ok: false, error: describeError(error), diagnostics: diagnostics(), helperVersion: HELPER_VERSION, appsScriptMirror: { configured: Boolean(APPS_SCRIPT_WEBHOOK_URL), autoBackfill: APPS_SCRIPT_AUTO_BACKFILL } });
  }
});

app.get("/api/apps-script-sync/status", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ ok: true, configured: Boolean(APPS_SCRIPT_WEBHOOK_URL), hasSecret: Boolean(APPS_SCRIPT_SYNC_SECRET), autoBackfill: APPS_SCRIPT_AUTO_BACKFILL });
});

async function handleAppsScriptBackfill(_req, res) {
  try {
    const result = await backfillAppsScriptState("manual-backfill");
    if (!result.ok) return res.status(503).json(result);
    res.json(result);
  } catch (error) { res.status(500).json({ ok: false, error: describeError(error) }); }
}

app.get("/api/apps-script-sync/backfill", handleAppsScriptBackfill);
app.post("/api/apps-script-sync/backfill", handleAppsScriptBackfill);

app.get("/api/yango-summary-csv", async (req, res) => {
  try {
    const gid = String(req.query.gid || "");
    if (!SUMMARY_GIDS.has(gid)) return res.status(400).send("Invalid sheet gid");
    const text = await fetchCsvText(SUMMARY_SHEET_ID, { tqx: "out:csv", gid });
    res.set("Cache-Control", "no-store");
    res.type("text/csv").send(text);
  } catch (error) { res.status(502).send(error.message); }
});

app.get("/api/mystery-shopper-responses", async (_req, res) => {
  try {
    const text = await fetchCsvText(MYSTERY_SHOPPER_SHEET_ID, { tqx: "out:csv", sheet: MYSTERY_SHOPPER_SHEET_NAME });
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, source: "google_sheets", sheetId: MYSTERY_SHOPPER_SHEET_ID, sheetName: MYSTERY_SHOPPER_SHEET_NAME, rows: csvToObjects(text) });
  } catch (error) { res.status(502).json({ ok: false, error: error.message }); }
});

app.get("/api/state", async (req, res) => {
  try {
    if (!(await ensureDatabase())) return res.status(503).json({ ok: false, error: "DATABASE_URL is not configured" });
    const keys = String(req.query.keys || "").split(",").map(k => k.trim()).filter(Boolean);
    const result = keys.length ? await pool.query("select key, value, updated_at from app_state where key = any($1)", [keys]) : await pool.query("select key, value, updated_at from app_state");
    const values = {}, updatedAt = {}, cleanup = [];
    result.rows.forEach(row => {
      const clean = sanitizeStateValue(row.key, row.value);
      values[row.key] = clean;
      updatedAt[row.key] = row.updated_at;
      if (/samsung|raffle|rifa/i.test(row.key) || !sameStateValue(clean, row.value)) cleanup.push({ key: row.key, value: clean });
    });
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, values, updatedAt, helperVersion: HELPER_VERSION });
    cleanup.forEach(item => persistCleanState(item.key, item.value));
  } catch (error) { res.status(500).json({ ok: false, error: describeError(error) }); }
});

async function saveStateValue(req, res) {
  try {
    if (!(await ensureDatabase())) return res.status(503).json({ ok: false, error: "DATABASE_URL is not configured" });
    const key = req.params.key;
    if (/samsung|raffle|rifa/i.test(String(key || ""))) {
      persistCleanState(key, []);
      return res.json({ ok: true, key, retired: true });
    }
    const incoming = req.body && Object.prototype.hasOwnProperty.call(req.body, "value") ? req.body.value : req.body;
    const value = sanitizeStateValue(key, incoming);
    const result = await pool.query("insert into app_state (key, value, updated_at) values ($1, $2::jsonb, now()) on conflict (key) do update set value = excluded.value, updated_at = now() returning key, updated_at", [key, JSON.stringify(value)]);
    const updatedAt = result.rows[0].updated_at;
    res.json({ ok: true, key: result.rows[0].key, updatedAt, appsScriptMirror: { configured: Boolean(APPS_SCRIPT_WEBHOOK_URL) } });
    fireAndForgetAppsScriptMirror(key, value, { trigger: "save", path: req.path, panel: isCollaboratorPanel(req) ? "collaborator" : "admin", dbUpdatedAt: updatedAt });
  } catch (error) { res.status(500).json({ ok: false, error: describeError(error) }); }
}

app.put("/api/state/:key", saveStateValue);
app.post("/api/state/:key", saveStateValue);
app.get("/", sendDashboard);
app.use(express.static(__dirname, { index: false }));
app.get("*", sendDashboard);
app.listen(port, () => {
  console.log(`Yango MKT dashboard listening on ${port}`);
  if (APPS_SCRIPT_AUTO_BACKFILL && APPS_SCRIPT_WEBHOOK_URL && !appsScriptStartupBackfillDone) {
    appsScriptStartupBackfillDone = true;
    setTimeout(() => {
      backfillAppsScriptState("startup-backfill")
        .then(result => console.log("Apps Script startup backfill:", result.ok ? `${result.count} keys mirrored` : result.error))
        .catch(error => console.warn("Apps Script startup backfill failed:", describeError(error)));
    }, 6000);
  }
});
