/**
 * Yango MKT Venezuela - Apps Script mirror
 *
 * Cómo usar:
 * 1) Crea un Google Sheet vacío para backup/auditoría.
 * 2) Extensions > Apps Script, pega este archivo completo.
 * 3) En Project Settings > Script properties agrega, opcional:
 *    - MKT_SPREADSHEET_ID: ID del Google Sheet. Si el script está ligado al Sheet, puedes omitirlo.
 *    - MKT_SYNC_SECRET: clave opcional, debe coincidir con APPS_SCRIPT_SYNC_SECRET en Railway.
 * 4) Ejecuta setup() una vez.
 * 5) Deploy > New deployment > Web app:
 *    - Execute as: Me
 *    - Who has access: Anyone with the link (o tu dominio, si aplica)
 * 6) Copia el Web app URL y ponlo en Railway como APPS_SCRIPT_WEBHOOK_URL.
 */

const STATE_TAB_MAP = {
  yango_influencers_h1: 'Influencers',
  yango_activations_h1: 'Activaciones',
  yango_btl_calendar_h1: 'Activaciones',
  yango_btl_activations_h1: 'Activaciones',
  yango_btl_results_h1: 'BTL Results',
  yango_agency_submissions_h1: 'Agency Reports',
  yango_media_ooh_h1: 'Media OOH',
  yango_pop_inventory_h1: 'Material POP',
  yango_branding_inventory_h1: 'Branding Inventory',
  yango_mystery_shopper_h1: 'Mystery Shopper',
  yango_budgets_h1: 'Budgets',
  yango_social_report_h1: 'Social Report',
  yango_users_h1: 'Users'
};

function doGet() {
  return json_({ ok: true, app: 'Yango MKT Apps Script mirror', time: new Date().toISOString() });
}

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    verifySecret_(payload.secret || '');

    const ss = getSpreadsheet_();
    setupSheets_(ss);
    appendRawEvent_(ss, payload);

    const key = String(payload.key || '').trim();
    const value = payload.value;
    const tabName = STATE_TAB_MAP[key] || safeSheetName_(key || 'Unknown State');
    writeStateSheet_(ss, tabName, value, payload);

    return json_({ ok: true, key, tab: tabName, receivedAt: new Date().toISOString() });
  } catch (error) {
    return json_({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

function setup() {
  const ss = getSpreadsheet_();
  setupSheets_(ss);
  return 'OK - Yango MKT tabs created';
}

function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const id = String(props.getProperty('MKT_SPREADSHEET_ID') || '').trim();
  if (id) return SpreadsheetApp.openById(id);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('No active spreadsheet. Set MKT_SPREADSHEET_ID in Script properties.');
  return active;
}

function parsePayload_(e) {
  const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
  try { return JSON.parse(raw); }
  catch (_error) { throw new Error('Invalid JSON payload'); }
}

function verifySecret_(incoming) {
  const expected = String(PropertiesService.getScriptProperties().getProperty('MKT_SYNC_SECRET') || '').trim();
  if (!expected) return;
  if (String(incoming || '') !== expected) throw new Error('Invalid sync secret');
}

function setupSheets_(ss) {
  ensureSheet_(ss, 'Raw Events', ['received_at', 'source', 'key', 'trigger', 'count', 'updated_at', 'payload_json']);
  Object.keys(STATE_TAB_MAP).forEach(key => ensureSheet_(ss, STATE_TAB_MAP[key], ['synced_at', 'source_key']));
}

function appendRawEvent_(ss, payload) {
  const sheet = ensureSheet_(ss, 'Raw Events', ['received_at', 'source', 'key', 'trigger', 'count', 'updated_at', 'payload_json']);
  const value = payload.value;
  const count = Array.isArray(value) ? value.length : value && typeof value === 'object' ? Object.keys(value).length : value == null ? 0 : 1;
  sheet.appendRow([
    new Date(),
    payload.source || 'railway',
    payload.key || '',
    payload.trigger || '',
    count,
    payload.updatedAt || '',
    truncate_(JSON.stringify(payload), 45000)
  ]);
}

function writeStateSheet_(ss, tabName, value, payload) {
  const sheet = ensureSheet_(ss, tabName, ['synced_at', 'source_key']);
  const rows = normalizeRows_(value);
  const headers = buildHeaders_(rows);
  const finalHeaders = ['synced_at', 'source_key'].concat(headers);

  sheet.clearContents();
  sheet.getRange(1, 1, 1, finalHeaders.length).setValues([finalHeaders]);
  styleHeader_(sheet, finalHeaders.length);

  if (!rows.length) {
    sheet.getRange(2, 1, 1, 3).setValues([[new Date(), payload.key || '', 'Sin registros']]);
    return;
  }

  const output = rows.map(row => [new Date(), payload.key || ''].concat(headers.map(header => formatValue_(row[header]))));
  sheet.getRange(2, 1, output.length, finalHeaders.length).setValues(output);
  sheet.autoResizeColumns(1, Math.min(finalHeaders.length, 20));
  sheet.setFrozenRows(1);
}

function normalizeRows_(value) {
  if (Array.isArray(value)) return value.map(flattenRow_);
  if (value && typeof value === 'object') {
    const candidates = ['items', 'rows', 'data', 'values', 'activations', 'calendar', 'reports', 'submissions', 'records', 'list', 'entries'];
    for (const key of candidates) {
      if (Array.isArray(value[key])) return value[key].map(flattenRow_);
    }
    return [flattenRow_(value)];
  }
  if (value == null || value === '') return [];
  return [{ value: value }];
}

function flattenRow_(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return { value: row };
  const out = {};
  Object.keys(row).forEach(key => flattenInto_(out, key, row[key]));
  return out;
}

function flattenInto_(out, key, value) {
  if (value == null || value === '') {
    out[key] = '';
    return;
  }
  if (Array.isArray(value)) {
    out[key] = value.map(item => item && typeof item === 'object' ? JSON.stringify(item) : item).join(' | ');
    return;
  }
  if (typeof value === 'object') {
    Object.keys(value).forEach(childKey => flattenInto_(out, `${key}.${childKey}`, value[childKey]));
    return;
  }
  out[key] = value;
}

function buildHeaders_(rows) {
  const seen = {};
  rows.forEach(row => Object.keys(row || {}).forEach(key => { seen[key] = true; }));
  return Object.keys(seen).sort((a, b) => priority_(a) - priority_(b) || a.localeCompare(b));
}

function priority_(key) {
  const k = String(key).toLowerCase();
  const order = ['date', 'fecha', 'name', 'nombre', 'title', 'titulo', 'location', 'ubicacion', 'zone', 'zona', 'type', 'tipo', 'status', 'estado'];
  const idx = order.indexOf(k);
  return idx >= 0 ? idx : 100;
}

function ensureSheet_(ss, name, headers) {
  const safeName = safeSheetName_(name);
  let sheet = ss.getSheetByName(safeName);
  if (!sheet) sheet = ss.insertSheet(safeName);
  if (headers && headers.length && sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    styleHeader_(sheet, headers.length);
  }
  return sheet;
}

function styleHeader_(sheet, width) {
  sheet.getRange(1, 1, 1, width)
    .setFontWeight('bold')
    .setBackground('#111827')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);
}

function safeSheetName_(name) {
  return String(name || 'Sheet').replace(/[\\/\?\*\[\]:]/g, ' ').trim().slice(0, 95) || 'Sheet';
}

function formatValue_(value) {
  if (value == null) return '';
  if (value instanceof Date) return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function truncate_(text, max) {
  text = String(text || '');
  return text.length > max ? text.slice(0, max - 20) + '... [truncated]' : text;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
