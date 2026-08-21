const SPREADSHEET_ID = '1C1cJ9z4lD6tIxwoS0Dk2d_UrjpK9XwRljZnUiQxWjt4';

const SHEETS = {
  users: 'SM_Users',
  influencers: 'SM_Influencers',
  socialReports: 'SM_Report',
  btlActivations: 'BTL_Calendar',
  btlResults: 'BTL_Results',
  agencyReports: 'BTL_Agency',
  btlBudgets: 'BTL_Budgets',
  oohItems: 'OOH_Inventory',
  log: 'SM_ChangeLog',
};

const HEADERS = {
  [SHEETS.users]: ['id','name','email','role','password','active','created_at','updated_at','deleted_at'],
  [SHEETS.influencers]: ['id','name','type','platform','ig_username','tiktok_username','deliverables','ig_followers','tiktok_followers','publish_date','budget','paid','payment_date','recorded','published','link','tiktok_link','has_promo_code','promo_code','promo_redemptions','ig_reach','ig_likes','ig_comments','ig_shares','ig_saves','tiktok_reach','tiktok_likes','tiktok_comments','tiktok_shares','tiktok_saves','reach_total','engagement_total','engagement_rate','cost_per_engagement','cpm','cost_per_redemption','notes','created_at','updated_at','deleted_at'],
  [SHEETS.socialReports]: ['id','month','ig_followers','tiktok_followers','ig_reach','tiktok_reach','ig_clicks','tiktok_clicks','ig_installs','tiktok_installs','ig_orders','tiktok_orders','notes','created_at','updated_at','deleted_at'],
  [SHEETS.btlActivations]: ['id','name','date','bucket','real_location','type','address','status','promoters_planned','flyers_planned','budget','promo_code','qr_link','lat','lng','notes','created_at','updated_at','deleted_at'],
  [SHEETS.btlResults]: ['id','date','bucket','type','clicks','installs','registrations','first_orders','promo_redemptions','source','notes','created_at','updated_at','deleted_at'],
  [SHEETS.agencyReports]: ['id','activation_id','activation_name','date','real_location','type','status','promoters_count','promoters_names','flyers_delivered','photo_urls','notes','created_at','updated_at','deleted_at'],
  [SHEETS.btlBudgets]: ['id','period','label','amount','notes','created_at','updated_at','deleted_at'],
  [SHEETS.oohItems]: ['id','name','type','status','location','address','zone','lat','lng','vendor','format','start_date','end_date','monthly_cost','estimated_reach','photo_urls','notes','created_at','updated_at','deleted_at'],
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

    if (action === 'upsertBTLActivation') return json(upsert_(SHEETS.btlActivations, payload, actor, action));
    if (action === 'deleteBTLActivation') return json(softDelete_(SHEETS.btlActivations, payload.id, actor, action));

    if (action === 'upsertBTLResult') return json(upsert_(SHEETS.btlResults, payload, actor, action));
    if (action === 'deleteBTLResult') return json(softDelete_(SHEETS.btlResults, payload.id, actor, action));

    if (action === 'upsertBTLBudget') return json(upsert_(SHEETS.btlBudgets, payload, actor, action));
    if (action === 'deleteBTLBudget') return json(softDelete_(SHEETS.btlBudgets, payload.id, actor, action));

    if (action === 'upsertOOHItem') return json(upsert_(SHEETS.oohItems, payload, actor, action));
    if (action === 'deleteOOHItem') return json(softDelete_(SHEETS.oohItems, payload.id, actor, action));

    if (action === 'upsertAgencyReport') return json(saveAgencyReport_(payload, actor, action));
    if (action === 'deleteAgencyReport') return json(softDelete_(SHEETS.agencyReports, payload.id, actor, action));

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
    btlActivations: activeRows_(SHEETS.btlActivations),
    btlResults: activeRows_(SHEETS.btlResults),
    agencyReports: activeRows_(SHEETS.agencyReports),
    btlBudgets: activeRows_(SHEETS.btlBudgets),
    oohItems: activeRows_(SHEETS.oohItems),
    updated_at: new Date().toISOString(),
  };
}

function saveAgencyReport_(payload, actor, action) {
  const files = payload.photo_files || [];
  const existing = Array.isArray(payload.photo_urls) ? payload.photo_urls : String(payload.photo_urls || '').split(/\n|,/).map(function(x) { return x.trim(); }).filter(Boolean);
  const uploaded = files.map(function(file) {
    return uploadPhoto_(file, payload.activation_name || payload.activation_id || payload.id);
  }).filter(Boolean);
  payload.photo_urls = JSON.stringify(existing.concat(uploaded));
  delete payload.photo_files;
  return upsert_(SHEETS.agencyReports, payload, actor, action);
}

function uploadPhoto_(file, activationName) {
  if (!file || !file.data) return '';
  const folder = ensurePhotoFolder_();
  const safe = String(activationName || 'activacion').replace(/[^\w\-áéíóúÁÉÍÓÚñÑ ]+/g, '').slice(0, 80) || 'activacion';
  const name = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss') + '_' + safe + '_' + (file.name || 'foto.jpg');
  const blob = Utilities.newBlob(Utilities.base64Decode(file.data), file.type || 'image/jpeg', name);
  const created = folder.createFile(blob);
  created.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return created.getUrl();
}

function ensurePhotoFolder_() {
  const name = 'Yango MKT - Evidencias Agencia';
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
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
