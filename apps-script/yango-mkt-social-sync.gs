const SPREADSHEET_ID = '1C1cJ9z4lD6tIxwoS0Dk2d_UrjpK9XwRljZnUiQxWjt4';

const SHEETS = {
  users: 'SM_Users',
  influencers: 'SM_Influencers',
  socialReports: 'SM_Report',
  log: 'SM_ChangeLog',
};

const HEADERS = {
  [SHEETS.users]: ['id','name','email','role','password','active','created_at','updated_at','deleted_at'],
  [SHEETS.influencers]: ['id','name','type','platform','ig_username','tiktok_username','deliverables','ig_followers','tiktok_followers','publish_date','budget','paid','payment_date','recorded','published','promo_code','promo_redemptions','ig_reach','tiktok_reach','notes','created_at','updated_at','deleted_at'],
  [SHEETS.socialReports]: ['id','month','ig_followers','tiktok_followers','ig_reach','tiktok_reach','ig_clicks','tiktok_clicks','ig_installs','tiktok_installs','ig_orders','tiktok_orders','notes','created_at','updated_at','deleted_at'],
  [SHEETS.log]: ['at','actor','action','entity','entity_id','payload_json'],
};

const DEFAULT_USERS = [
  { id: 'admin', name: 'Isabella', email: 'admin@yango.local', role: 'admin', password: 'Yango2026!', active: true },
  { id: 'giselle', name: 'Giselle', email: 'giselle@yango.local', role: 'editor', password: 'Giselle2026!', active: true },
];

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'health';
  if (action === 'bootstrap') return json(loadBootstrap_());
  return json({ ok: true, configured: true, sheets: SHEETS });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = body.action;
    const payload = body.payload || {};
    const actor = body.actor || 'anonymous';

    ensureAll_();

    if (action === 'upsertInfluencer') return json(upsert_(SHEETS.influencers, payload, actor, action));
    if (action === 'deleteInfluencer') return json(softDelete_(SHEETS.influencers, payload.id, actor, action));

    if (action === 'upsertSocialReport') return json(upsert_(SHEETS.socialReports, payload, actor, action));
    if (action === 'deleteSocialReport') return json(softDelete_(SHEETS.socialReports, payload.id, actor, action));

    if (action === 'upsertUser') return json(upsert_(SHEETS.users, payload, actor, action));
    if (action === 'deleteUser') return json(softDelete_(SHEETS.users, payload.id, actor, action));

    if (action === 'bootstrap') return json(loadBootstrap_());

    return json({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return json({ ok: false, error: err.message || String(err) });
  } finally {
    lock.releaseLock();
  }
}

function loadBootstrap_() {
  ensureAll_();
  seedDefaultUsers_();
  return {
    ok: true,
    users: activeRows_(SHEETS.users),
    influencers: activeRows_(SHEETS.influencers),
    socialReports: activeRows_(SHEETS.socialReports),
    updated_at: new Date().toISOString(),
  };
}

function upsert_(sheetName, payload, actor, action) {
  if (!payload.id) payload.id = Utilities.getUuid();
  const sheet = ensureSheet_(sheetName);
  const headers = getHeaders_(sheet);
  const now = new Date().toISOString();
  payload.updated_at = payload.updated_at || now;
  payload.created_at = payload.created_at || now;
  payload.deleted_at = '';

  const idCol = headers.indexOf('id') + 1;
  const rowIndex = findRowById_(sheet, idCol, payload.id);
  const row = headers.map(h => valueForCell_(payload[h]));

  if (rowIndex) sheet.getRange(rowIndex, 1, 1, headers.length).setValues([row]);
  else sheet.appendRow(row);

  log_(actor, action, sheetName, payload.id, payload);
  return Object.assign({ ok: true }, loadBootstrap_());
}

function softDelete_(sheetName, id, actor, action) {
  if (!id) throw new Error('Missing id');
  const sheet = ensureSheet_(sheetName);
  const headers = getHeaders_(sheet);
  const idCol = headers.indexOf('id') + 1;
  const deletedCol = headers.indexOf('deleted_at') + 1;
  const updatedCol = headers.indexOf('updated_at') + 1;
  const rowIndex = findRowById_(sheet, idCol, id);
  if (rowIndex) {
    const now = new Date().toISOString();
    sheet.getRange(rowIndex, deletedCol).setValue(now);
    if (updatedCol) sheet.getRange(rowIndex, updatedCol).setValue(now);
  }
  log_(actor, action, sheetName, id, { id: id });
  return Object.assign({ ok: true }, loadBootstrap_());
}

function activeRows_(sheetName) {
  return readObjects_(sheetName).filter(row => !row.deleted_at && row.active !== false && row.active !== 'false');
}

function readObjects_(sheetName) {
  const sheet = ensureSheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter(row => row.some(cell => cell !== '')).map(row => {
    const obj = {};
    headers.forEach((header, i) => obj[header] = parseCell_(row[i]));
    return obj;
  });
}

function ensureAll_() {
  Object.keys(HEADERS).forEach(name => ensureSheet_(name));
}

function ensureSheet_(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  const expected = HEADERS[sheetName];
  if (!expected) return sheet;
  const current = sheet.getLastColumn() ? sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), expected.length)).getValues()[0].map(String) : [];
  const empty = sheet.getLastRow() === 0 || current.every(v => !v);
  if (empty) {
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
    sheet.setFrozenRows(1);
  } else {
    expected.forEach(header => {
      if (!current.includes(header)) {
        sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      }
    });
  }
  return sheet;
}

function seedDefaultUsers_() {
  const existing = readObjects_(SHEETS.users);
  if (existing.length) return;
  DEFAULT_USERS.forEach(user => upsert_(SHEETS.users, user, 'system', 'seedUser'));
}

function getHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
}

function findRowById_(sheet, idCol, id) {
  if (!idCol || sheet.getLastRow() < 2) return null;
  const ids = sheet.getRange(2, idCol, sheet.getLastRow() - 1, 1).getValues().flat();
  const index = ids.findIndex(value => String(value) === String(id));
  return index >= 0 ? index + 2 : null;
}

function valueForCell_(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function parseCell_(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return value;
}

function log_(actor, action, entity, entityId, payload) {
  const sheet = ensureSheet_(SHEETS.log);
  sheet.appendRow([new Date().toISOString(), actor || '', action || '', entity || '', entityId || '', JSON.stringify(payload || {})]);
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
