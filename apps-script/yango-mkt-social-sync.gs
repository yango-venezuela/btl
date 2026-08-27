const SPREADSHEET_ID = '1C1cJ9z4lD6tIxwoS0Dk2d_UrjpK9XwRljZnUiQxWjt4';
const BUDGET_SOURCE_SPREADSHEET_ID = '10e4_nB5dSu91s0bi8VY958WRp-9Dulso-a0MrQ9NlbM';

const SHEETS = {
  users: 'SM_Users',
  influencers: 'SM_Influencers',
  socialReports: 'SM_Report',
  btlActivations: 'BTL_Calendar',
  btlResults: 'BTL_Results',
  agencyReports: 'BTL_Agency',
  btlBudgets: 'BTL_Budgets',
  oohItems: 'OOH_Inventory',
  driverComms: 'Driver_Comms',
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
  [SHEETS.driverComms]: ['id','date','title','category','channel','audience','status','text','image_url','notes','created_at','updated_at','deleted_at'],
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

    if (action === 'upsertDriverComm') return json(upsert_(SHEETS.driverComms, payload, actor, action));
    if (action === 'deleteDriverComm') return json(softDelete_(SHEETS.driverComms, payload.id, actor, action));

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
    driverComms: activeRows_(SHEETS.driverComms),
    budgetSource: loadBudgetSource_(),
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
  return { ok: true, entity: sheetName, id: payload.id, row: payload, updated_at: now };
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
  return { ok: true, entity: sheetName, id: id, deleted_at: new Date().toISOString() };
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

function loadBudgetSource_() {
  const cache = CacheService.getScriptCache();
  const key = 'budgetSourceV2';
  const cached = cache.get(key);
  if (cached) {
    try { return JSON.parse(cached); } catch (err) {}
  }
  const data = loadBudgetSourceFresh_();
  try { cache.put(key, JSON.stringify(data), 300); } catch (err) {}
  return data;
}

function loadBudgetSourceFresh_() {
  const out = {
    ok: true,
    source_url: 'https://docs.google.com/spreadsheets/d/' + BUDGET_SOURCE_SPREADSHEET_ID + '/edit',
    updated_at: new Date().toISOString(),
    model: [],
    expenses: [],
    expense_months: [],
    summary: [],
    periods: [],
  };
  try {
    const ss = SpreadsheetApp.openById(BUDGET_SOURCE_SPREADSHEET_ID);
    const summarySheet = ss.getSheetByName('Resumen_Actual');
    const modelSheet = ss.getSheetByName('Initial Model_Caracas');
    const expensesSheet = ss.getSheetByName('Expenses');
    if (summarySheet) out.summary = parseBudgetSummary_(summarySheet.getRange(1, 1, Math.min(summarySheet.getLastRow(), 80), Math.min(summarySheet.getLastColumn(), 30)).getDisplayValues());
    if (modelSheet) out.model = parseBudgetModel_(modelSheet.getRange(1, 1, Math.min(modelSheet.getLastRow(), 120), Math.min(modelSheet.getLastColumn(), 80)).getDisplayValues());
    if (expensesSheet) {
      const rows = Math.max(expensesSheet.getLastRow() - 1, 1);
      out.expenses = parseBudgetExpenses_(expensesSheet.getRange(2, 1, Math.min(rows, 1000), Math.min(expensesSheet.getLastColumn(), 18)).getDisplayValues());
      out.expense_months = aggregateBudgetExpenses_(out.expenses);
    }
    out.periods = uniqueBudgetPeriods_(out.summary, out.model, out.expenses);
  } catch (err) {
    out.ok = false;
    out.error = err.message || String(err);
  }
  return out;
}

function parseBudgetSummary_(values) {
  if (!values || !values.length) return [];
  const actualRow = values.findIndex(row => row.some(cell => String(cell).trim().toUpperCase() === 'ACTUAL'));
  const budgetRow = values.findIndex(row => row.some(cell => String(cell).trim().toUpperCase() === 'BUDGET'));
  const diffRow = values.findIndex(row => row.some(cell => String(cell).trim().toUpperCase().indexOf('DIF') === 0));
  if (actualRow < 0 && budgetRow < 0) return [];
  const labelRowIndex = Math.max(0, Math.min(actualRow < 0 ? 4 : actualRow, budgetRow < 0 ? 4 : budgetRow) - 1);
  const labels = values[labelRowIndex] || [];
  return labels.map(function(label, col) {
    const period = budgetPeriodKey_(label);
    if (!period) return null;
    return {
      period: period,
      label: budgetPeriodLabel_(period),
      actual: budgetAmount_(values[actualRow] && values[actualRow][col]),
      budget: budgetAmount_(values[budgetRow] && values[budgetRow][col]),
      diff: budgetAmount_(values[diffRow] && values[diffRow][col]),
    };
  }).filter(Boolean);
}

function parseBudgetModel_(values) {
  if (!values || values.length < 6) return [];
  let metricRow = values.findIndex(row => row.filter(cell => /^(BUDGET|ACTUAL|ESTIMATION)$/i.test(String(cell).trim())).length >= 3);
  if (metricRow < 0) metricRow = 3;
  const monthRow = metricRow + 1;
  const rows = [];
  const months = [];
  let currentPeriod = '';
  for (let col = 0; col < (values[monthRow] || []).length; col++) {
    const maybePeriod = budgetPeriodKey_(values[monthRow][col]);
    if (maybePeriod) currentPeriod = maybePeriod;
    months[col] = currentPeriod;
  }
  const startRow = monthRow + 1;
  for (let r = startRow; r < values.length; r++) {
    const category = firstText_(values[r].slice(0, 4));
    if (!category || /^total$/i.test(category) || /^caracas$/i.test(category)) continue;
    for (let c = 0; c < values[r].length; c++) {
      const metric = String(values[metricRow][c] || '').trim().toLowerCase();
      if (!/^(budget|actual|estimation)$/.test(metric)) continue;
      const period = months[c];
      if (!period) continue;
      const amount = budgetAmount_(values[r][c]);
      if (!amount) continue;
      let found = rows.find(item => item.period === period && item.category === category);
      if (!found) {
        found = { period: period, label: budgetPeriodLabel_(period), category: category, budget: 0, actual: 0, estimation: 0 };
        rows.push(found);
      }
      found[metric] = amount;
    }
  }
  return rows;
}

function parseBudgetExpenses_(values) {
  if (!values || values.length < 2) return [];
  const headers = values[0].map(function(x) { return String(x || '').trim(); });
  const idx = function(name) {
    const target = name.toLowerCase();
    return headers.findIndex(function(h) { return h.toLowerCase() === target; });
  };
  const paidBy = idx('Paid By:');
  const area = idx('Area');
  const project = idx('Project');
  const ticketDate = idx('Ticket Date');
  const approvedDate = idx('Ticket Approved');
  const initiativeDate = idx('Iniciative Date');
  const provider = idx('Provider');
  const description = idx('Description');
  const amount = idx('Amount');
  const status = idx('Status');
  const amountBs = idx('Monto en Bs');
  const rate = idx('Tasa');
  const proof = idx('Proof');
  const ticket = idx('Ticket');
  return values.slice(1).map(function(row, i) {
    const date = budgetDate_(row[initiativeDate]) || budgetDate_(row[approvedDate]) || budgetDate_(row[ticketDate]);
    const obj = {
      id: 'expense_' + (i + 1),
      paid_by: row[paidBy] || '',
      area: row[area] || '',
      project: row[project] || '',
      ticket_date: budgetDate_(row[ticketDate]),
      approved_date: budgetDate_(row[approvedDate]),
      initiative_date: budgetDate_(row[initiativeDate]),
      date: date,
      period: date ? date.slice(0, 7) : '',
      provider: row[provider] || '',
      description: row[description] || '',
      amount: budgetAmount_(row[amount]),
      status: row[status] || '',
      amount_bs: row[amountBs] || '',
      rate: row[rate] || '',
      proof: row[proof] || '',
      ticket: row[ticket] || '',
    };
    return obj;
  }).filter(function(x) {
    return x.amount || x.area || x.project || x.description || x.provider;
  }).sort(function(a, b) {
    return String(b.date || '').localeCompare(String(a.date || ''));
  }).slice(0, 350);
}

function aggregateBudgetExpenses_(expenses) {
  const map = {};
  expenses.forEach(function(x) {
    const period = x.period || '';
    if (!period) return;
    const key = [period, x.area || 'Sin área', x.project || 'Sin proyecto', x.status || 'Sin status'].join('||');
    if (!map[key]) map[key] = { period: period, area: x.area || 'Sin área', project: x.project || 'Sin proyecto', status: x.status || 'Sin status', amount: 0, count: 0 };
    map[key].amount += budgetAmount_(x.amount);
    map[key].count += 1;
  });
  return Object.keys(map).map(function(k) { return map[k]; });
}

function uniqueBudgetPeriods_(summary, model, expenses) {
  const seen = {};
  [summary || [], model || [], expenses || []].forEach(function(list) {
    list.forEach(function(item) {
      if (item.period) seen[item.period] = budgetPeriodLabel_(item.period);
    });
  });
  return Object.keys(seen).sort().reverse().map(function(period) {
    return { period: period, label: seen[period] };
  });
}

function firstText_(values) {
  for (let i = 0; i < values.length; i++) {
    const text = String(values[i] || '').trim();
    if (text) return text;
  }
  return '';
}

function budgetAmount_(value) {
  if (typeof value === 'number') return value;
  let s = String(value || '').trim();
  if (!s) return 0;
  const negative = /^\(.*\)$/.test(s) || /^-/.test(s);
  s = s.replace(/[^\d.,-]/g, '').replace(/^-/, '');
  if (!s) return 0;
  const comma = s.lastIndexOf(',');
  const dot = s.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) s = comma > dot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (comma >= 0) s = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? (negative ? -n : n) : 0;
}

function budgetPeriodKey_(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  let m = s.match(/^(\d{1,2})[./-](\d{4})$/);
  if (m) return m[2] + '-' + String(Number(m[1])).padStart(2, '0');
  m = s.match(/^(\d{4})[./-](\d{1,2})$/);
  if (m) return m[1] + '-' + String(Number(m[2])).padStart(2, '0');
  m = s.match(/^(ene|enero|feb|febrero|mar|marzo|abr|abril|may|mayo|jun|junio|jul|julio|ago|agosto|sep|sept|septiembre|oct|octubre|nov|noviembre|dic|diciembre)\s+(\d{4})$/i);
  if (m) return m[2] + '-' + String(monthNumber_(m[1])).padStart(2, '0');
  return '';
}

function budgetPeriodLabel_(period) {
  const parts = String(period || '').split('-');
  const names = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return parts.length === 2 ? (names[Number(parts[1]) - 1] || parts[1]) + ' ' + parts[0] : String(period || '');
}

function budgetDate_(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + String(Number(m[2])).padStart(2, '0') + '-' + String(Number(m[3])).padStart(2, '0');
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    const year = String(m[3]).length === 2 ? '20' + m[3] : m[3];
    return year + '-' + String(Number(m[2])).padStart(2, '0') + '-' + String(Number(m[1])).padStart(2, '0');
  }
  return '';
}

function monthNumber_(name) {
  const k = String(name || '').toLowerCase().slice(0, 3);
  return { ene:1, feb:2, mar:3, abr:4, may:5, jun:6, jul:7, ago:8, sep:9, oct:10, nov:11, dic:12 }[k] || 0;
}

function log_(actor, action, entity, entityId, payload) {
  const sheet = ensureSheet_(SHEETS.log);
  sheet.appendRow([new Date().toISOString(), actor || '', action || '', entity || '', entityId || '', JSON.stringify(payload || {})]);
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
