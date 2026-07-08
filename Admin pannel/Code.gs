/**
 * Taiva Admin — Google Sheets Backup Proxy
 * Deploy as Web App → Execute as "Me" → Anyone
 * Saves data as structured columns in a Google Spreadsheet
 */
var SCRIPT_TOKEN = 'TaivaBackup@2026';
var SPREADSHEET_NAME = 'TaivaAdminBackup';
var DATA_KEYS = [
  'taiva_products','taiva_orders','taiva_settings',
  'taiva_drafts','taiva_abandoned','taiva_collections',
  'taiva_giftCards','taiva_purchaseOrders','taiva_transfers',
  'taiva_segments','taiva_users'
];

function doGet(e) { return respond(handleRequest(e)); }
function doPost(e) { return respond(handleRequest(e)); }

function handleRequest(e) {
  if (e.parameter && e.parameter.action === 'load') return handleLoad(e);
  if (e.parameter && e.parameter.action === 'save') return handleSave(e);
  if (e.parameter && e.parameter.action === 'saveAll') return handleSaveAll(e);
  return { success: false, error: 'Use ?action=load or ?action=save or ?action=saveAll' };
}

function respond(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// ── Spreadsheet helpers ──

function getOrCreateSpreadsheet() {
  var files = DriveApp.getFilesByName(SPREADSHEET_NAME);
  if (files.hasNext()) {
    var file = files.next();
    return SpreadsheetApp.openById(file.getId());
  }
  var ss = SpreadsheetApp.create(SPREADSHEET_NAME);
  return ss;
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (sheet) {
    sheet.clearContents();
    return sheet;
  }
  return ss.insertSheet(name);
}

// ── Data conversion helpers ──

function flattenValue(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return JSON.stringify(val);
  return val;
}

function writeSheetData(sheet, data) {
  if (!data) return 0;
  if (typeof data !== 'object') return 0;

  var items = Array.isArray(data) ? data : [data];
  if (items.length === 0) return 0;

  // Collect all unique headers, first item sets order
  var headers = Object.keys(items[0] || {});
  items.forEach(function(item) {
    if (item && typeof item === 'object') {
      Object.keys(item).forEach(function(k) {
        if (headers.indexOf(k) === -1) headers.push(k);
      });
    }
  });

  if (headers.length === 0) return 0;

  var rows = items.map(function(item) {
    return headers.map(function(h) {
      if (item && typeof item === 'object') {
        return flattenValue(item[h]);
      }
      return '';
    });
  });

  // Write header row
  var headerRow = sheet.getRange(1, 1, 1, headers.length);
  headerRow.setValues([headers]);
  headerRow.setFontWeight('bold');

  // Write data rows
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  return rows.length;
}

function readSheetData(sheet) {
  var range = sheet.getDataRange();
  var values = range.getValues();
  if (values.length < 2) return [];

  var headers = values[0];
  var rows = [];

  for (var i = 1; i < values.length; i++) {
    var row = {};
    var hasValue = false;
    for (var j = 0; j < headers.length; j++) {
      var val = values[i][j];
      if (typeof val === 'string' && (val[0] === '[' || val[0] === '{')) {
        try { val = JSON.parse(val); } catch(e) {}
      }
      if (val !== '' && val !== null && val !== undefined) hasValue = true;
      row[headers[j]] = val;
    }
    if (hasValue) rows.push(row);
  }

  return rows;
}

// ── Handlers ──

function handleSave(e) {
  if (!checkToken(e)) return { success: false, error: 'Invalid token' };
  var key = e.parameter.key;
  if (!key || DATA_KEYS.indexOf(key) === -1) return { success: false, error: 'Valid key required' };

  var raw = e.parameter.data || (e.postData ? e.postData.contents : null);
  if (!raw) return { success: false, error: 'No data' };
  var data;
  try { data = JSON.parse(raw); } catch(_) { return { success: false, error: 'Invalid JSON' }; }

  var ss = getOrCreateSpreadsheet();
  var sheet = getOrCreateSheet(ss, key);
  var count = writeSheetData(sheet, data);

  return { success: true, key: key, rows: count };
}

function handleSaveAll(e) {
  if (!checkToken(e)) return { success: false, error: 'Invalid token' };
  var raw = e.parameter.b64 ? Utilities.newBlob(Utilities.base64Decode(e.parameter.b64)).getDataAsString() : e.parameter.data;
  if (!raw) return { success: false, error: 'No data' };
  var all;
  try { all = JSON.parse(raw); } catch(_) { return { success: false, error: 'Invalid JSON' }; }
  if (!all || typeof all !== 'object') return { success: false, error: 'Invalid data format' };

  var ss = getOrCreateSpreadsheet();
  var count = 0;
  Object.keys(all).forEach(function(k) {
    if (DATA_KEYS.indexOf(k) >= 0 && all[k]) {
      var sheet = getOrCreateSheet(ss, k);
      writeSheetData(sheet, all[k]);
      count++;
    }
  });

  return { success: true, saved: count };
}

function handleLoad(e) {
  if (!checkToken(e)) return { success: false, error: 'Invalid token' };
  var key = e.parameter.key;
  var ss = getOrCreateSpreadsheet();

  if (key) {
    if (DATA_KEYS.indexOf(key) === -1) return { success: false, error: 'Unknown key' };
    var sheet = ss.getSheetByName(key);
    if (!sheet) {
      var empty = (key === 'taiva_settings') ? {} : [];
      return { success: true, key: key, data: empty };
    }
    var rows = readSheetData(sheet);
    if (key === 'taiva_settings') {
      return { success: true, key: key, data: rows[0] || {} };
    }
    return { success: true, key: key, data: rows };
  }

  // Load all keys
  var result = {};
  DATA_KEYS.forEach(function(k) {
    var s = ss.getSheetByName(k);
    if (s) {
      var r = readSheetData(s);
      result[k] = (k === 'taiva_settings') ? (r[0] || {}) : r;
    }
  });
  return { success: true, data: result };
}

function checkToken(e) {
  return e.parameter && e.parameter.token === SCRIPT_TOKEN;
}
