const express = require("express");
const path = require("path");
const fs = require("fs");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3000;
const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({
  connectionString: databaseUrl,
  ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false }
}) : null;

let readyPromise = null;
let brandingInventoryUpdatePromise = null;

const BRANDING_INVENTORY_UPDATE_ID = "branding_inventory_2026_07_21_v2";
const BRANDING_PARTNERS = ["BipBip", "DragoPro", "MotoGo"];
const BRANDING_STOCK_UPDATES = [
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

function patchBrandingInventoryArray(value) {
  const next = value.map(item => item && typeof item === "object" ? { ...item } : item);
  BRANDING_STOCK_UPDATES.forEach(update => upsertBrandingItem(next, update));
  return next;
}

function patchBrandingStateValue(value) {
  if (isBrandingInventoryArray(value)) {
    return { changed: true, value: patchBrandingInventoryArray(value) };
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { changed: false, value };
  }

  let changed = false;
  const next = { ...value };
  Object.keys(next).forEach(key => {
    if (isBrandingInventoryArray(next[key])) {
      next[key] = patchBrandingInventoryArray(next[key]);
      changed = true;
    }
  });

  return { changed, value: next };
}

async function applyBrandingInventoryUpdate() {
  if (!pool) return;
  if (!brandingInventoryUpdatePromise) {
    brandingInventoryUpdatePromise = (async () => {
      const migrationKey = `migration:${BRANDING_INVENTORY_UPDATE_ID}`;
      try {
        const existing = await pool.query("select value from app_state where key = $1", [migrationKey]);
        if (existing.rowCount) return;

        const result = await pool.query("select key, value from app_state");
        const updatedKeys = [];
        for (const row of result.rows) {
          if (String(row.key).startsWith("migration:")) continue;
          const patched = patchBrandingStateValue(row.value);
          if (!patched.changed) continue;

          await pool.query("update app_state set value = $2::jsonb, updated_at = now() where key = $1", [
            row.key,
            JSON.stringify(patched.value)
          ]);
          updatedKeys.push(row.key);
        }

        if (!updatedKeys.length) {
          console.log(`${BRANDING_INVENTORY_UPDATE_ID} skipped: branding inventory state was not found yet.`);
          return;
        }

        await pool.query(`
          insert into app_state (key, value, updated_at)
          values ($1, $2::jsonb, now())
          on conflict (key)
          do update set value = excluded.value, updated_at = now()
        `, [migrationKey, JSON.stringify({ appliedAt: new Date().toISOString(), stateKeys: updatedKeys })]);
        console.log(`Applied ${BRANDING_INVENTORY_UPDATE_ID} to ${updatedKeys.join(", ")}`);
      } catch (error) {
        console.warn(`Could not apply ${BRANDING_INVENTORY_UPDATE_ID}:`, error.message);
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

function sendDashboard(req, res) {
  fs.readFile(path.join(__dirname, "index.html"), "utf8", (error, html) => {
    if (error) return res.status(500).send("No pude cargar el dashboard.");
    const helperTags = [
      '<script src="/samsung-raffle-export.js" defer></script>',
      '<script src="/influencer-payment-filter.js" defer></script>'
    ];
    const tags = helperTags.filter(tag => !html.includes(tag)).join("");
    const withHelpers = tags ? html.replace("</body>", `${tags}</body>`) : html;
    res.type("html").send(withHelpers);
  });
}

app.use(express.json({ limit: "50mb" }));

app.get("/api/health", async (_req, res) => {
  try {
    const hasDb = await ensureDatabase();
    res.json({ ok: true, database: hasDb ? "connected" : "not_configured" });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
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
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.put("/api/state/:key", async (req, res) => {
  try {
    if (!(await ensureDatabase())) return res.status(503).json({ ok: false, error: "DATABASE_URL is not configured" });
    const key = req.params.key;
    const value = req.body && Object.prototype.hasOwnProperty.call(req.body, "value") ? req.body.value : req.body;
    const result = await pool.query(`
      insert into app_state (key, value, updated_at)
      values ($1, $2::jsonb, now())
      on conflict (key)
      do update set value = excluded.value, updated_at = now()
      returning key, updated_at
    `, [key, JSON.stringify(value)]);
    res.json({ ok: true, key: result.rows[0].key, updatedAt: result.rows[0].updated_at });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/", sendDashboard);
app.use(express.static(__dirname, { index: false }));
app.get("*", sendDashboard);

app.listen(port, () => {
  console.log(`Yango MKT dashboard listening on ${port}`);
});
