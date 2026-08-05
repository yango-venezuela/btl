const express = require("express");
const path = require("path");
const fs = require("fs");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3000;
const databaseUrl = process.env.DATABASE_URL;
const isRailwayPrivateDatabase = /railway\.internal/i.test(String(databaseUrl || ""));
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

const SUMMARY_SHEET_ID = "1HF0h65jgRPZiKYAro_bctnnSOaVARqd-KPjycfOUZDg";
const SUMMARY_GIDS = new Set(["306964116", "949067172"]);
const MYSTERY_SHOPPER_SHEET_ID = "12-AWRARvNJytUoGNWj0IGtSMaO1clqtqyzqT6jntwNY";
const MYSTERY_SHOPPER_SHEET_NAME = "Form Responses 1";
const HELPER_VERSION = "20260804f";

let readyPromise = null;
let brandingInventoryUpdatePromise = null;

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

const BRANDING_PARTNERS = ["BipBip", "DragoPro", "MotoGo"];
const BRANDING_INVENTORY_UPDATES = [
  {
    id: "branding_inventory_2026_07_21_v2",
    items: [
      { product: "Longsleeves", variant: "S", officeStock: 3, supplierPending: 0, partners: { BipBip: 0, DragoPro: 25, MotoGo: 12 } },
      { product: "Longsleeves", variant: "M", officeStock: 2, supplierPending: 1, partners: { BipBip: 0, DragoPro: 66, MotoGo: 21 } },
      { product: "Longsleeves", variant: "L", officeStock: 0, supplierPending: 0, partners: { BipBip: 0, DragoPro: 99, MotoGo: 33 } },
      { product: "Longsleeves", variant: "XL", officeStock: 0, supplierPending: 0, partners: { BipBip: 0, DragoPro: 35, MotoGo: 5 } },
      { product: "Chalecos", variant: "S", officeStock: 0, supplierPending: 20, partners: { BipBip: 0, DragoPro: 10, MotoGo: 0 } },
      { product: "Chalecos", variant: "M", officeStock: 172, supplierPending: 18, partners: { BipBip: 0, DragoPro: 70, MotoGo: 0 } },
      { product: "Chalecos", variant: "L", officeStock: 0, supplierPending: 140, partners: { BipBip: 0, DragoPro: 40, MotoGo: 0 } },
      { product: "Chalecos", variant: "XL", officeStock: 0, supplierPending: 20, partners: { BipBip: 0, DragoPro: 10, MotoGo: 0 } },
      { product: "Cascos", variant: "S", officeStock: 153, supplierPending: 0, unitCost: 18, partners: { BipBip: 0, DragoPro: 0, MotoGo: 0 } },
      { product: "Cascos", variant: "M", officeStock: 450, supplierPending: 0, unitCost: 18, partners: { BipBip: 0, DragoPro: 0, MotoGo: 0 } },
      { product: "Cascos", variant: "L", officeStock: 450, supplierPending: 0, unitCost: 18, partners: { BipBip: 0, DragoPro: 0, MotoGo: 0 } },
      { product: "Cascos", variant: "XL", officeStock: 153, supplierPending: 0, unitCost: 18, partners: { BipBip: 0, DragoPro: 0, MotoGo: 0 } }
    ]
  },
  {
    id: "branding_stickers_2026_07_21_v1",
    items: [
      { product: "Stickers", variant: "Pequeñas Rojas", officeStock: 4100, supplierPending: 0, unitCost: 0.25, partners: { BipBip: 0, DragoPro: 0, MotoGo: 0 } },
      { product: "Stickers", variant: "Grandes Rojas", officeStock: 4000, supplierPending: 0, unitCost: 0.25, partners: { BipBip: 0, DragoPro: 0, MotoGo: 0 } },
      { product: "Stickers", variant: "Medianas Rojas", officeStock: 1200, supplierPending: 0, unitCost: 0.25, partners: { BipBip: 0, DragoPro: 0, MotoGo: 0 } },
      { product: "Stickers", variant: "Transfer Blancas", officeStock: 400, supplierPending: 0, unitCost: 0.25, partners: { BipBip: 0, DragoPro: 0, MotoGo: 0 } }
    ]
  },
  {
    id: "branding_cascos_bipbip_transfer_2026_07_21_v1",
    mode: "transfer",
    items: [
      { product: "Cascos", variant: "S", boxes: 3, quantity: 27, from: "Oficina", to: "BipBip" },
      { product: "Cascos", variant: "M", boxes: 7, quantity: 63, from: "Oficina", to: "BipBip" },
      { product: "Cascos", variant: "L", boxes: 8, quantity: 72, from: "Oficina", to: "BipBip" },
      { product: "Cascos", variant: "XL", boxes: 4, quantity: 36, from: "Oficina", to: "BipBip" }
    ]
  }
];

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/talla/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function isBrandingInventoryArray(value) {
  if (!Array.isArray(value)) return false;
  return value.some(item => {
    if (!item || typeof item !== "object") return false;
    const product = normalizeText(item.product);
    return Boolean(product) && ["stickers", "cascos", "longsleeves", "chalecos", "chaquetas"].includes(product);
  });
}

function makeBrandingId(product, variant) {
  return `branding-${normalizeText(product)}-${normalizeText(variant)}`;
}

function withSupplierNote(notes, pending) {
  const base = String(notes || "").replace(/\s*Proveedor pendiente:\s*\d+\.?\s*/gi, "").trim();
  if (!Number(pending)) return base;
  return [base, `Proveedor pendiente: ${pending}`].filter(Boolean).join(" · ");
}

function buildPartners(currentPartners, targetPartners) {
  return BRANDING_PARTNERS.reduce((next, partner) => {
    const current = currentPartners && currentPartners[partner] && typeof currentPartners[partner] === "object"
      ? currentPartners[partner]
      : {};
    const amount = Number(targetPartners && Object.prototype.hasOwnProperty.call(targetPartners, partner) ? targetPartners[partner] : 0) || 0;
    next[partner] = {
      ...current,
      stock: amount,
      realStock: amount
    };
    return next;
  }, {});
}

function upsertBrandingItem(items, update) {
  const productKey = normalizeText(update.product);
  const variantKey = normalizeText(update.variant);
  const index = items.findIndex(item => normalizeText(item && item.product) === productKey && normalizeText(item && item.variant) === variantKey);
  const current = index >= 0 ? items[index] : {};
  const nextItem = {
    ...current,
    id: current.id || makeBrandingId(update.product, update.variant),
    product: update.product,
    variant: update.variant,
    officeStock: Number(update.officeStock) || 0,
    supplierPending: Number(update.supplierPending) || 0,
    unitCost: current.unitCost ?? update.unitCost ?? 0,
    notes: withSupplierNote(current.notes, update.supplierPending),
    partners: buildPartners(current.partners, update.partners),
    movements: Array.isArray(current.movements) ? current.movements : []
  };

  if (index >= 0) {
    items[index] = nextItem;
  } else {
    items.push(nextItem);
  }
}

function transferBrandingItem(items, transfer, migrationId) {
  const productKey = normalizeText(transfer.product);
  const variantKey = normalizeText(transfer.variant);
  const index = items.findIndex(item => normalizeText(item && item.product) === productKey && normalizeText(item && item.variant) === variantKey);
  const current = index >= 0 ? items[index] : {
    id: makeBrandingId(transfer.product, transfer.variant),
    product: transfer.product,
    variant: transfer.variant,
    officeStock: 0,
    partners: {},
    movements: []
  };
  const quantity = Number(transfer.quantity) || 0;
  const toPartner = transfer.to || "BipBip";
  const currentPartners = current.partners && typeof current.partners === "object" ? current.partners : {};
  const currentToPartner = currentPartners[toPartner] && typeof currentPartners[toPartner] === "object" ? currentPartners[toPartner] : {};
  const nextPartners = { ...currentPartners };
  nextPartners[toPartner] = {
    ...currentToPartner,
    stock: (Number(currentToPartner.stock) || 0) + quantity,
    realStock: (Number(currentToPartner.realStock) || 0) + quantity
  };

  const movement = {
    id: `${migrationId}-${normalizeText(transfer.product)}-${normalizeText(transfer.variant)}`,
    date: "2026-07-21",
    type: "transfer",
    from: transfer.from || "Oficina",
    to: toPartner,
    quantity,
    notes: `${transfer.boxes || ""} cajas x 9 cascos`.trim()
  };
  const movements = Array.isArray(current.movements) ? current.movements.filter(item => item && item.id !== movement.id) : [];

  const nextItem = {
    ...current,
    product: transfer.product,
    variant: transfer.variant,
    officeStock: Math.max(0, (Number(current.officeStock) || 0) - quantity),
    partners: nextPartners,
    movements: [...movements, movement]
  };

  if (index >= 0) {
    items[index] = nextItem;
  } else {
    items.push(nextItem);
  }
}

function patchBrandingInventoryArray(value, migration) {
  const next = value.map(item => item && typeof item === "object" ? { ...item } : item);
  if (migration.mode === "transfer") {
    migration.items.forEach(update => transferBrandingItem(next, update, migration.id));
  } else {
    migration.items.forEach(update => upsertBrandingItem(next, update));
  }
  return next;
}

function patchBrandingStateValue(value, migration) {
  if (isBrandingInventoryArray(value)) {
    return { changed: true, value: patchBrandingInventoryArray(value, migration) };
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { changed: false, value };
  }

  let changed = false;
  const next = { ...value };
  Object.keys(next).forEach(key => {
    if (isBrandingInventoryArray(next[key])) {
      next[key] = patchBrandingInventoryArray(next[key], migration);
      changed = true;
    }
  });

  return { changed, value: next };
}

async function applyOneBrandingInventoryUpdate(migration) {
  const migrationKey = `migration:${migration.id}`;
  const existing = await pool.query("select value from app_state where key = $1", [migrationKey]);
  if (existing.rowCount) return;

  const result = await pool.query("select key, value from app_state");
  const updatedKeys = [];
  for (const row of result.rows) {
    if (String(row.key).startsWith("migration:")) continue;
    const patched = patchBrandingStateValue(row.value, migration);
    if (!patched.changed) continue;

    await pool.query("update app_state set value = $2::jsonb, updated_at = now() where key = $1", [
      row.key,
      JSON.stringify(patched.value)
    ]);
    updatedKeys.push(row.key);
  }

  if (!updatedKeys.length) {
    console.log(`${migration.id} skipped: branding inventory state was not found yet.`);
    return;
  }

  await pool.query(`
    insert into app_state (key, value, updated_at)
    values ($1, $2::jsonb, now())
    on conflict (key)
    do update set value = excluded.value, updated_at = now()
  `, [migrationKey, JSON.stringify({ appliedAt: new Date().toISOString(), stateKeys: updatedKeys })]);
  console.log(`Applied ${migration.id} to ${updatedKeys.join(", ")}`);
}

async function applyBrandingInventoryUpdate() {
  if (!pool) return;
  if (!brandingInventoryUpdatePromise) {
    brandingInventoryUpdatePromise = (async () => {
      try {
        for (const migration of BRANDING_INVENTORY_UPDATES) {
          await applyOneBrandingInventoryUpdate(migration);
        }
      } catch (error) {
        console.warn("Could not apply branding inventory updates:", error.message);
      }
    })();
  }
  await brandingInventoryUpdatePromise;
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
  await applyBrandingInventoryUpdate();
  return true;
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

async function fetchSummaryCsvText(gid) {
  return fetchCsvText(SUMMARY_SHEET_ID, { tqx: "out:csv", gid });
}

async function fetchMysteryShopperCsvText() {
  return fetchCsvText(MYSTERY_SHOPPER_SHEET_ID, { tqx: "out:csv", sheet: MYSTERY_SHOPPER_SHEET_NAME });
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
    } else if (char === ',') {
      row.push(value);
      value = "";
    } else if (char === '\n') {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== '\r') {
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

function sendDashboard(req, res) {
  fs.readFile(path.join(__dirname, "index.html"), "utf8", (error, html) => {
    if (error) return res.status(500).send("No pude cargar el dashboard.");
    const helperNames = [
      "samsung-raffle-export",
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
    const isTeamPanel = Boolean(req.query && req.query.panel);
    const helperTags = [
      `<script src="/samsung-raffle-export.js?v=${HELPER_VERSION}" defer></script>`,
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
    const withHelpers = withoutOldHelpers.replace("</body>", `${helperTags.join("")}</body>`);
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
    const text = await fetchSummaryCsvText(gid);
    res.set("Cache-Control", "no-store");
    res.type("text/csv").send(text);
  } catch (error) {
    res.status(502).send(error.message);
  }
});

app.get("/api/mystery-shopper-responses", async (_req, res) => {
  try {
    const text = await fetchMysteryShopperCsvText();
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
      values[row.key] = row.value;
      updatedAt[row.key] = row.updated_at;
    });
    res.json({ ok: true, values, updatedAt });
  } catch (error) {
    res.status(500).json({ ok: false, error: describeError(error) });
  }
});


function normalizeStateText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function influencerStateKey(item) {
  const name = normalizeStateText(item && item.name);
  const handle = normalizeStateText(item && item.handle);
  return name || handle ? `${name}|${handle}` : "";
}

function stateRichnessScore(item) {
  if (!item || typeof item !== "object") return 0;
  return Object.values(item).reduce((score, value) => {
    if (Array.isArray(value)) return score + value.filter(Boolean).length;
    if (value && typeof value === "object") return score + Object.keys(value).length;
    return score + (value !== undefined && value !== null && String(value).trim() !== "" ? 1 : 0);
  }, 0);
}

function sanitizeInfluencerState(value) {
  if (!Array.isArray(value)) return value;
  const map = new Map();
  value.forEach(item => {
    const key = influencerStateKey(item);
    if (!key) return;
    const current = map.get(key);
    if (!current || stateRichnessScore(item) >= stateRichnessScore(current)) map.set(key, item);
  });
  return Array.from(map.values());
}

function sanitizeSocialReportState(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.months)) return value;
  return {
    ...value,
    months: Array.from(new Set(value.months.filter(Boolean)))
  };
}

function sanitizeStateValue(key, value) {
  if (key === "yango_influencers_h1") return sanitizeInfluencerState(value);
  if (key === "yango_social_report_h1") return sanitizeSocialReportState(value);
  return value;
}

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