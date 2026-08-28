/**
 * Yango MKT — Budget Bridge
 *
 * Pega este archivo en Apps Script usando tu cuenta corporativa de Yango.
 * El script copia semanalmente las 3 pestañas necesarias del archivo corporativo
 * hacia un Google Sheet espejo en tu cuenta personal.
 *
 * PASOS:
 * 1) Crea un Google Sheet vacío en tu Gmail personal.
 * 2) Compártelo como EDITOR con tu correo corporativo de Yango.
 * 3) Cambia DEST_SPREADSHEET_ID por el ID de ese archivo personal.
 * 4) En Apps Script, corre syncBudgetTabs() una vez y acepta permisos.
 * 5) Corre installWeeklyTrigger() una vez para dejarlo automático.
 */

const SOURCE_SPREADSHEET_ID = '10e4_nB5dSu91s0bi8VY958WRp-9Dulso-a0MrQ9NlbM';

// IMPORTANTE: cambia esto por el ID del Google Sheet nuevo en tu Gmail personal.
const DEST_SPREADSHEET_ID = 'PEGA_AQUI_EL_ID_DEL_SHEET_PERSONAL';

const BUDGET_TABS_TO_SYNC = [
  {
    sourceName: 'Resumen Actual',
    fallbackNames: ['Resumen actual', 'resumen actual', 'Resumen_Actual'],
    destName: 'Budget - Resumen Actual',
  },
  {
    sourceName: 'Inicio del Modelo de Caracas',
    fallbackNames: [
      'Inicio del modelo de Caracas',
      'Inicio del Mudo del Caracas',
      'Inicio del Modelo Caracas',
      'Initial Model Caracas',
      'Initial Model_Caracas',
      'Modelo Caracas',
    ],
    destName: 'Budget - Modelo Caracas',
  },
  {
    sourceName: 'Expenses',
    fallbackNames: ['expenses', 'Expense', 'Gastos'],
    destName: 'Budget - Expenses',
  },
];

const SYNC_LOG_SHEET_NAME = 'Budget - Sync Log';

function syncBudgetTabs() {
  const startedAt = new Date();
  const source = SpreadsheetApp.openById(SOURCE_SPREADSHEET_ID);
  const dest = SpreadsheetApp.openById(DEST_SPREADSHEET_ID);
  const results = [];

  BUDGET_TABS_TO_SYNC.forEach((tabConfig) => {
    const sourceSheet = findSheet_(source, tabConfig.sourceName, tabConfig.fallbackNames);
    if (!sourceSheet) {
      results.push({
        tab: tabConfig.destName,
        status: 'ERROR',
        rows: 0,
        cols: 0,
        message: `No encontré la pestaña origen: ${tabConfig.sourceName}`,
      });
      return;
    }

    const destSheet = getOrCreateSheet_(dest, tabConfig.destName);
    const range = sourceSheet.getDataRange();
    const rows = range.getNumRows();
    const cols = range.getNumColumns();

    destSheet.clear({ contentsOnly: false });

    if (rows > 0 && cols > 0) {
      const destRange = destSheet.getRange(1, 1, rows, cols);

      // Display values preserva cómo se ve en el archivo: $, %, puntos/comas, etc.
      destRange.setValues(range.getDisplayValues());
      destRange.setBackgrounds(range.getBackgrounds());
      destRange.setFontColors(range.getFontColors());
      destRange.setFontWeights(range.getFontWeights());
      destRange.setFontStyles(range.getFontStyles());
      destRange.setHorizontalAlignments(range.getHorizontalAlignments());
      destRange.setVerticalAlignments(range.getVerticalAlignments());
      destRange.setWrapStrategies(range.getWrapStrategies());

      copyDimensions_(sourceSheet, destSheet, rows, cols);
      destSheet.setFrozenRows(sourceSheet.getFrozenRows());
      destSheet.setFrozenColumns(sourceSheet.getFrozenColumns());
    }

    results.push({
      tab: tabConfig.destName,
      status: 'OK',
      rows,
      cols,
      message: `Copiado desde "${sourceSheet.getName()}"`,
    });
  });

  writeSyncLog_(dest, startedAt, results);
  return {
    ok: results.every((item) => item.status === 'OK'),
    synced_at: new Date().toISOString(),
    results,
  };
}

function installWeeklyTrigger() {
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === 'syncBudgetTabs') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('syncBudgetTabs')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(7)
    .create();

  return 'Listo: se va a sincronizar todos los lunes a las 7:00 AM.';
}

function syncNowForButton() {
  return syncBudgetTabs();
}

function doGet() {
  const result = syncBudgetTabs();
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function findSheet_(spreadsheet, preferredName, fallbackNames) {
  const wanted = [preferredName].concat(fallbackNames || []);
  const sheets = spreadsheet.getSheets();
  const normalizedMap = {};

  sheets.forEach((sheet) => {
    normalizedMap[normalizeName_(sheet.getName())] = sheet;
  });

  for (const name of wanted) {
    const found = normalizedMap[normalizeName_(name)];
    if (found) return found;
  }

  return null;
}

function normalizeName_(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getOrCreateSheet_(spreadsheet, name) {
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function copyDimensions_(sourceSheet, destSheet, rows, cols) {
  for (let col = 1; col <= cols; col += 1) {
    try {
      destSheet.setColumnWidth(col, sourceSheet.getColumnWidth(col));
    } catch (err) {
      // Si Google limita alguna columna, seguimos con las demás.
    }
  }

  for (let row = 1; row <= rows; row += 1) {
    try {
      destSheet.setRowHeight(row, sourceSheet.getRowHeight(row));
    } catch (err) {
      // Si Google limita alguna fila, seguimos con las demás.
    }
  }
}

function writeSyncLog_(spreadsheet, startedAt, results) {
  const sheet = getOrCreateSheet_(spreadsheet, SYNC_LOG_SHEET_NAME);
  sheet.clear();

  const rows = [
    ['synced_at', 'source_file_id', 'destination_file_id', 'tab', 'status', 'rows', 'columns', 'message'],
  ];

  results.forEach((item) => {
    rows.push([
      startedAt,
      SOURCE_SPREADSHEET_ID,
      DEST_SPREADSHEET_ID,
      item.tab,
      item.status,
      item.rows,
      item.cols,
      item.message,
    ]);
  });

  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, rows[0].length);
}
