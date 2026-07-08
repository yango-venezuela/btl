const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3000;
const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({
  connectionString: databaseUrl,
  ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false }
}) : null;

let readyPromise = null;

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

app.use(express.static(__dirname));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.listen(port, () => {
  console.log(`Yango MKT dashboard listening on ${port}`);
});
