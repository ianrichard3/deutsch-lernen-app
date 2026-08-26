/**
 * Deutsch – ABMC de frases
 * Backend de Apps Script. La app funciona como web app y también como diálogo
 * modal sobre el Sheet.
 *
 * Hoja "Frases":
 * A: ID | B: Frase (DE) | C: Traducción | D: Notas | E: Estado | F: Etiquetas
 * G: Creado | H: Actualizado
 *
 * Hoja "Historial": ID | Resultado | Estudiado
 *
 * Regla de rendimiento: toda operación cuesta UNA lectura y UNA escritura.
 * El formato de la hoja se aplica sólo en setupSheet(), nunca al leer o guardar.
 */

const SHEET_NAME = 'Frases';
const SPREADSHEET_ID = '16iaAw1OpXNF2x2MHjEFVOLzGezdvI73XFDiqE56oQFU';
const HISTORY_SHEET_NAME = 'Historial';
const HISTORY_HEADERS = ['ID', 'Resultado', 'Estudiado'];
const HISTORY_COL = { ID: 1, RESULT: 2, REVIEWED_AT: 3 };
const HISTORY_WIDTH = HISTORY_HEADERS.length;
const HISTORY_LIMIT = 20;

const HEADERS = [
  'ID', 'Frase (DE)', 'Traducción', 'Notas', 'Estado', 'Etiquetas', 'Creado', 'Actualizado'
];

const COL = { ID: 1, DE: 2, ES: 3, NOTES: 4, STATUS: 5, TAGS: 6, CREATED: 7, UPDATED: 8 };
const WIDTH = HEADERS.length;

const STATUSES = ['Nueva', 'En práctica', 'Dominada'];
const DEFAULT_STATUS = 'Nueva';

const STATUS_COLOR = {
  'Nueva': '#eef2f6',
  'En práctica': '#fdf0dd',
  'Dominada': '#e2f2f0'
};

const ID_PREFIX = 'F';
const ID_PAD = 4;
const MIGRATE_RECORDED_TO = 'En práctica';

const GEMINI_MODEL = 'gemini-3.5-flash-lite';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const TRANSLATION_INSTRUCTION = 'Traducí del español al alemán estándar natural para estudiar. Devolvé únicamente la traducción alemana, sin comillas, explicaciones ni alternativas. Usá registro informal con "du" cuando el texto no indique contexto.';
const SPANISH_TRANSLATION_INSTRUCTION = 'Traducí del alemán al español natural para estudiar. Devolvé únicamente la traducción española, sin comillas, explicaciones ni alternativas.';
const ETYMOLOGY_INSTRUCTION = [
  'Eres un analista lingüístico de precisión.',
  'Cada vez que te envíe una palabra o frase corta en cualquier idioma (especialmente alemán), analízala utilizando exactamente la estructura siguiente.',
  'Sé conciso, directo y fácil de leer de un vistazo.',
  'Omite introducciones, despedidas y relleno conversacional.',
  '',
  'Estructura:',
  '',
  '[Palabra/Frase]',
  '1. Desglose etimológico',
  'Presenta (no en tabla) un análisis desglosado de la palabra en sus componentes exactos (prefijos, raíces, sufijos, elementos de enlace).',
  'Datos: Componente | Tipo | Significado literal / Función',
  '',
  '2. Traducción literal y real',
  'Traducción literal: La traducción exacta palabra por palabra según sus componentes.',
  'Significado real: La traducción idiomática y precisa en contexto.'
].join('\n');

/* ------------------------------------------------------------------ */
/* Menú y diálogo                                                      */
/* ------------------------------------------------------------------ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Deutsch')
    .addItem('Abrir frases', 'showApp')
    .addSeparator()
    .addItem('Preparar hoja', 'setupSheet')
    .addItem('Migrar desde "Grabado"', 'migrateSheet')
    .addToUi();
}

function showApp() {
  const html = HtmlService.createHtmlOutputFromFile('App')
    .setWidth(1000)
    .setHeight(640);
  SpreadsheetApp.getUi().showModalDialog(html, 'Frases en alemán');
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('App')
    .setTitle('Frases en alemán')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .addMetaTag('mobile-web-app-capable', 'yes')
    .addMetaTag('apple-mobile-web-app-capable', 'yes');
}

/* ------------------------------------------------------------------ */
/* Hoja: lectura barata, formato aparte                                */
/* ------------------------------------------------------------------ */

/** Ruta caliente: devuelve la hoja sin tocar formato. */
function getSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  return sheet || buildSheet_(ss.insertSheet(SHEET_NAME));
}

function getHistorySheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const existing = ss.getSheetByName(HISTORY_SHEET_NAME);
  if (existing) return existing;

  const sheet = ss.insertSheet(HISTORY_SHEET_NAME);
  sheet.getRange(1, 1, 1, HISTORY_WIDTH)
    .setValues([HISTORY_HEADERS])
    .setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.getRange(2, HISTORY_COL.REVIEWED_AT, sheet.getMaxRows() - 1, 1)
    .setNumberFormat('yyyy-mm-dd hh:mm');
  return sheet;
}

/** Ruta fría: encabezados, anchos, validación y colores. Sólo desde el menú. */
function setupSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  buildSheet_(ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME));
  ss.toast('Hoja "' + SHEET_NAME + '" lista.', 'Deutsch', 5);
}

function buildSheet_(sheet) {
  sheet.getRange(1, 1, 1, WIDTH)
    .setValues([HEADERS])
    .setFontWeight('bold')
    .setBackground('#16202b')
    .setFontColor('#ffffff')
    .setVerticalAlignment('middle');

  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 32);

  [80, 300, 300, 220, 110, 180, 140, 140].forEach(function (width, i) {
    sheet.setColumnWidth(i + 1, width);
  });

  const body = sheet.getMaxRows() - 1;
  if (body > 0) {
    // La validación cubre toda la columna, así las altas nuevas no
    // necesitan formato fila por fila.
    sheet.getRange(2, COL.STATUS, body, 1).setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(STATUSES, true)
        .setAllowInvalid(false)
        .setHelpText('Estados válidos: ' + STATUSES.join(', ') + '.')
        .build()
    );

    sheet.getRange(2, COL.CREATED, body, 2).setNumberFormat('yyyy-mm-dd hh:mm');
    sheet.getRange(2, COL.DE, body, 3).setWrap(true).setVerticalAlignment('top');

    applyStatusColors_(sheet, body);
  }

  return sheet;
}

function applyStatusColors_(sheet, body) {
  const target = sheet.getRange(2, COL.STATUS, body, 1);
  const targetA1 = target.getA1Notation();

  const kept = sheet.getConditionalFormatRules().filter(function (rule) {
    return !rule.getRanges().some(function (range) {
      return range.getA1Notation() === targetA1;
    });
  });

  const mine = STATUSES.map(function (status) {
    return SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(status)
      .setBackground(STATUS_COLOR[status])
      .setRanges([target])
      .build();
  });

  sheet.setConditionalFormatRules(kept.concat(mine));
}

/* ------------------------------------------------------------------ */
/* Tabla en memoria: una sola lectura por operación                    */
/* ------------------------------------------------------------------ */

function readTable_(sheet) {
  const lastRow = sheet.getLastRow();
  const values = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, WIDTH).getValues()
    : [];
  return { sheet: sheet, values: values, lastRow: lastRow };
}

/** Índice de fila (1-based en la hoja) para un ID, o -1. */
function rowOf_(table, id) {
  const target = normalize_(id).toUpperCase();
  if (!target) return -1;

  for (let i = 0; i < table.values.length; i++) {
    if (normalize_(table.values[i][COL.ID - 1]).toUpperCase() === target) return i + 2;
  }
  return -1;
}

function lastIdNumber_(table) {
  const props = PropertiesService.getDocumentProperties();
  let last = Number(props.getProperty('LAST_ID') || 0);
  if (!isFinite(last) || last < 0) last = 0;

  table.values.forEach(function (row) {
    const match = /^F(\d+)$/i.exec(normalize_(row[COL.ID - 1]));
    if (match) last = Math.max(last, Number(match[1]));
  });

  return last;
}

function formatId_(number) {
  return ID_PREFIX + String(number).padStart(ID_PAD, '0');
}

/** Siguiente ID a partir de los valores ya leídos: cero llamadas extra. */
function nextId_(table) {
  const next = lastIdNumber_(table) + 1;
  PropertiesService.getDocumentProperties().setProperty('LAST_ID', String(next));
  return formatId_(next);
}

function duplicateOf_(table, de, ignoreId) {
  const key = normalizeKey_(de);
  const ignore = normalize_(ignoreId).toUpperCase();

  for (let i = 0; i < table.values.length; i++) {
    const row = table.values[i];
    const rowId = normalize_(row[COL.ID - 1]);
    if (ignore && rowId.toUpperCase() === ignore) continue;
    if (normalizeKey_(row[COL.DE - 1]) === key) return rowId;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

function normalize_(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeKey_(value) {
  return normalize_(value).toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?¡¿"'`´]/g, '');
}

function cleanStatus_(value) {
  const candidate = normalize_(value).toLowerCase();
  for (let i = 0; i < STATUSES.length; i++) {
    if (STATUSES[i].toLowerCase() === candidate) return STATUSES[i];
  }
  return DEFAULT_STATUS;
}

function cleanTags_(value) {
  const raw = Array.isArray(value)
    ? value
    : String(value == null ? '' : value).split(',');

  const seen = {};
  const out = [];

  raw.forEach(function (item) {
    const tag = normalize_(item).replace(/\s+/g, ' ');
    if (!tag) return;
    const key = tag.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    out.push(tag);
  });

  return out;
}

function rowToObject_(row) {
  return {
    id: normalize_(row[COL.ID - 1]),
    de: normalize_(row[COL.DE - 1]),
    es: normalize_(row[COL.ES - 1]),
    notes: normalize_(row[COL.NOTES - 1]),
    status: cleanStatus_(row[COL.STATUS - 1]),
    tags: cleanTags_(row[COL.TAGS - 1]),
    created: toIso_(row[COL.CREATED - 1]),
    updated: toIso_(row[COL.UPDATED - 1])
  };
}

function toIso_(value) {
  return value instanceof Date ? value.toISOString() : '';
}

function timeOf_(value) {
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return isFinite(time) ? time : 0;
}

function withLock_(callback) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* IA                                                                  */
/* ------------------------------------------------------------------ */

function extractGeminiText_(data) {
  const steps = data && data.steps;
  if (!Array.isArray(steps)) return '';

  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    if (!step || step.type !== 'model_output' || !Array.isArray(step.content)) continue;
    const text = step.content.map(function (part) {
      return part && part.type === 'text' ? part.text : '';
    }).join('');
    if (normalize_(text)) return normalize_(text);
  }
  return '';
}

function geminiText_(instruction, input) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Falta configurar GEMINI_API_KEY en las propiedades del script.');

  const response = UrlFetchApp.fetch(GEMINI_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': apiKey },
    payload: JSON.stringify({
      model: GEMINI_MODEL,
      system_instruction: instruction,
      input: input,
      store: false,
      generation_config: { temperature: 0.2 }
    }),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('Gemini no pudo responder. Intentá de nuevo.');

  let data;
  try {
    data = JSON.parse(response.getContentText());
  } catch (err) {
    throw new Error('Gemini devolvió una respuesta inválida.');
  }

  const text = extractGeminiText_(data);
  if (!text) throw new Error('Gemini no devolvió texto. Intentá de nuevo.');
  return text;
}

function suggestGermanTranslation(text) {
  const spanish = normalize_(text);
  if (!spanish) throw new Error('Escribí la frase en español antes de traducir.');
  return geminiText_(TRANSLATION_INSTRUCTION, 'Texto en español:\n' + spanish);
}

function suggestSpanishTranslation(text) {
  const german = normalize_(text);
  if (!german) throw new Error('Escribí la frase en alemán antes de traducir.');
  return geminiText_(SPANISH_TRANSLATION_INSTRUCTION, 'Texto en alemán:\n' + german);
}

function analyzeEtymology(text) {
  const phrase = normalize_(text);
  if (!phrase) throw new Error('Escribí la palabra o frase en alemán antes de analizarla.');
  return geminiText_(ETYMOLOGY_INSTRUCTION, 'Palabra o frase a analizar:\n' + phrase);
}

/* ------------------------------------------------------------------ */
/* Historial de estudio                                                */
/* ------------------------------------------------------------------ */

function historyEntries_(sheet) {
  const lastRow = sheet.getLastRow();
  const values = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, HISTORY_WIDTH).getValues()
    : [];
  const byId = {};

  values.forEach(function (row) {
    const id = normalize_(row[HISTORY_COL.ID - 1]);
    if (!id) return;

    const entry = {
      id: id,
      correct: normalize_(row[HISTORY_COL.RESULT - 1]) === 'bien',
      reviewedAt: row[HISTORY_COL.REVIEWED_AT - 1]
    };
    const key = id.toUpperCase();
    if (!byId[key] || timeOf_(entry.reviewedAt) >= timeOf_(byId[key].reviewedAt)) {
      byId[key] = entry;
    }
  });

  return Object.keys(byId).map(function (key) { return byId[key]; })
    .sort(function (a, b) { return timeOf_(b.reviewedAt) - timeOf_(a.reviewedAt); })
    .slice(0, HISTORY_LIMIT);
}

function historyWindow_(entries, latest) {
  const seen = {};
  const out = [];

  [latest].concat(entries).forEach(function (entry) {
    if (!entry) return;
    const key = normalize_(entry.id).toUpperCase();
    if (!key || seen[key]) return;
    seen[key] = true;
    out.push(entry);
  });

  return out.slice(0, HISTORY_LIMIT);
}

function writeHistory_(sheet, entries) {
  const count = Math.max(sheet.getLastRow() - 1, entries.length);
  if (!count) return;

  const rows = entries.map(function (entry) {
    return [entry.id, entry.correct ? 'bien' : 'mal', entry.reviewedAt];
  });
  while (rows.length < count) rows.push(['', '', '']);
  sheet.getRange(2, 1, count, HISTORY_WIDTH).setValues(rows);
}

function historyToObject_(entry) {
  return {
    id: entry.id,
    correct: entry.correct,
    reviewedAt: toIso_(entry.reviewedAt)
  };
}

/* ------------------------------------------------------------------ */
/* Consulta                                                            */
/* ------------------------------------------------------------------ */

/** Única llamada de arranque: frases e historial de estudio. */
function listPhrases() {
  const table = readTable_(getSheet_());
  const items = [];

  table.values.forEach(function (row) {
    const item = rowToObject_(row);
    if (item.id || item.de) items.push(item);
  });

  items.sort(function (a, b) { return b.id.localeCompare(a.id); });

  return {
    items: items,
    history: historyEntries_(getHistorySheet_()).map(historyToObject_)
  };
}

/* ------------------------------------------------------------------ */
/* Alta                                                                */
/* ------------------------------------------------------------------ */

function createPhrase(payload) {
  const de = normalize_(payload && payload.de);
  if (!de) throw new Error('La frase en alemán no puede quedar vacía.');

  return withLock_(function () {
    const sheet = getSheet_();
    const table = readTable_(sheet);

    const duplicate = duplicateOf_(table, de, null);
    if (duplicate) throw new Error('Esa frase ya está cargada como ' + duplicate + '.');

    const now = new Date();
    const id = nextId_(table);
    const row = [
      id,
      de,
      normalize_(payload.es),
      normalize_(payload.notes),
      cleanStatus_(payload.status),
      cleanTags_(payload.tags).join(', '),
      now,
      now
    ];

    sheet.getRange(table.lastRow + 1 || 2, 1, 1, WIDTH).setValues([row]);

    return rowToObject_(row);
  });
}

function recordStudy(id, correct) {
  const phraseId = normalize_(id);
  if (!phraseId) throw new Error('Falta el ID de la frase.');
  if (typeof correct !== 'boolean') throw new Error('El resultado debe ser bien o mal.');

  return withLock_(function () {
    const phrases = readTable_(getSheet_());
    if (rowOf_(phrases, phraseId) === -1) {
      throw new Error('No existe la frase ' + phraseId + '.');
    }

    const historySheet = getHistorySheet_();
    const history = historyWindow_(historyEntries_(historySheet), {
      id: phraseId,
      correct: correct,
      reviewedAt: new Date()
    });
    writeHistory_(historySheet, history);
    return { history: history.map(historyToObject_) };
  });
}

function importDelimiter_(value) {
  if (value === ',' || value === '\t') return value;
  throw new Error('Elegí coma o tab como separador.');
}

function parseImport_(text, delimiter) {
  const source = String(text == null ? '' : text);
  if (!source.trim()) throw new Error('Pegá el CSV o TSV antes de continuar.');
  return Utilities.parseCsv(source, importDelimiter_(delimiter));
}

function columnCount_(rows) {
  return rows.reduce(function (count, row) {
    return Math.max(count, row.length);
  }, 0);
}

function previewImport(text, delimiter) {
  const rows = parseImport_(text, delimiter);
  return {
    columnCount: columnCount_(rows),
    rows: rows.slice(0, 5)
  };
}

function importPhrases(payload) {
  const rows = parseImport_(payload && payload.text, payload && payload.delimiter);
  const deColumn = Number(payload && payload.deColumn);
  const esColumn = Number(payload && payload.esColumn);
  const columnCount = columnCount_(rows);
  const firstRow = payload && payload.hasHeader ? 1 : 0;

  if (!isFinite(deColumn) || !isFinite(esColumn) || deColumn < 0 || esColumn < 0 ||
      deColumn >= columnCount || esColumn >= columnCount || deColumn === esColumn) {
    throw new Error('Elegí columnas distintas para alemán y español.');
  }

  return withLock_(function () {
    const sheet = getSheet_();
    const table = readTable_(sheet);
    const known = {};
    let lastId = lastIdNumber_(table);
    let empty = 0;
    let duplicate = 0;
    const now = new Date();
    const additions = [];

    table.values.forEach(function (row) {
      const key = normalizeKey_(row[COL.DE - 1]);
      if (key) known[key] = true;
    });

    rows.slice(firstRow).forEach(function (source) {
      const de = normalize_(source[deColumn]);
      if (!de) {
        empty++;
        return;
      }

      const key = normalizeKey_(de);
      if (known[key]) {
        duplicate++;
        return;
      }

      known[key] = true;
      lastId++;
      additions.push([
        formatId_(lastId), de, normalize_(source[esColumn]), '', DEFAULT_STATUS, '', now, now
      ]);
    });

    if (additions.length) {
      sheet.getRange(table.lastRow + 1, 1, additions.length, WIDTH).setValues(additions);
      PropertiesService.getDocumentProperties().setProperty('LAST_ID', String(lastId));
    }

    return { imported: additions.length, empty: empty, duplicate: duplicate };
  });
}

/* ------------------------------------------------------------------ */
/* Modificación                                                        */
/* ------------------------------------------------------------------ */

function updatePhrase(payload) {
  const id = normalize_(payload && payload.id);
  const de = normalize_(payload && payload.de);

  if (!id) throw new Error('Falta el ID de la frase.');
  if (!de) throw new Error('La frase en alemán no puede quedar vacía.');

  return withLock_(function () {
    const sheet = getSheet_();
    const table = readTable_(sheet);

    const rowIndex = rowOf_(table, id);
    if (rowIndex === -1) throw new Error('No existe la frase ' + id + '.');

    const duplicate = duplicateOf_(table, de, id);
    if (duplicate) throw new Error('Esa frase ya está cargada como ' + duplicate + '.');

    const current = table.values[rowIndex - 2];
    const row = [
      id,
      de,
      normalize_(payload.es),
      normalize_(payload.notes),
      current[COL.STATUS - 1],
      cleanTags_(payload.tags).join(', '),
      current[COL.CREATED - 1] || new Date(),
      new Date()
    ];

    sheet.getRange(rowIndex, 1, 1, WIDTH).setValues([row]);

    return rowToObject_(row);
  });
}

/** Cambia sólo el estado. Una lectura, una escritura de dos celdas. */
function setStatus(id, status) {
  return withLock_(function () {
    const sheet = getSheet_();
    const table = readTable_(sheet);

    const rowIndex = rowOf_(table, id);
    if (rowIndex === -1) throw new Error('No existe la frase ' + id + '.');

    const row = table.values[rowIndex - 2];
    row[COL.STATUS - 1] = cleanStatus_(status);
    row[COL.UPDATED - 1] = new Date();

    sheet.getRange(rowIndex, 1, 1, WIDTH).setValues([row]);

    return rowToObject_(row);
  });
}

/** Renombra una etiqueta en todas las frases: una lectura, una escritura. */
function renameTag(from, to) {
  const oldKey = normalize_(from).toLowerCase();
  if (!oldKey) throw new Error('Falta la etiqueta a renombrar.');
  const next = cleanTags_(to)[0] || '';

  return withLock_(function () {
    const sheet = getSheet_();
    const table = readTable_(sheet);
    if (!table.values.length) return { changed: 0 };

    let changed = 0;

    const column = table.values.map(function (row) {
      const tags = cleanTags_(row[COL.TAGS - 1]);
      const hit = tags.some(function (tag) { return tag.toLowerCase() === oldKey; });
      if (!hit) return [row[COL.TAGS - 1]];

      changed++;
      const replaced = tags.map(function (tag) {
        return tag.toLowerCase() === oldKey ? next : tag;
      });
      return [cleanTags_(replaced).join(', ')];
    });

    if (changed) {
      sheet.getRange(2, COL.TAGS, column.length, 1).setValues(column);
    }
    return { changed: changed };
  });
}

/* ------------------------------------------------------------------ */
/* Baja                                                                */
/* ------------------------------------------------------------------ */

function deletePhrase(id) {
  return withLock_(function () {
    const sheet = getSheet_();
    const table = readTable_(sheet);

    const rowIndex = rowOf_(table, id);
    if (rowIndex === -1) throw new Error('No existe la frase ' + id + '.');

    const historySheet = getHistorySheet_();
    const history = historyEntries_(historySheet);
    const kept = history.filter(function (entry) {
      return entry.id.toUpperCase() !== normalize_(id).toUpperCase();
    });
    if (kept.length !== history.length) writeHistory_(historySheet, kept);

    sheet.deleteRow(rowIndex);
    return { id: normalize_(id), history: kept.map(historyToObject_) };
  });
}

/* ------------------------------------------------------------------ */
/* Ediciones hechas directamente en la grilla                          */
/* ------------------------------------------------------------------ */

/**
 * Normaliza en bloque: lee el rango editado completo y lo devuelve de una,
 * así pegar cincuenta filas cuesta lo mismo que editar una celda.
 */
function onEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_NAME) return;

  const first = Math.max(e.range.getRow(), 2);
  const last = e.range.getRow() + e.range.getNumRows() - 1;
  if (last < 2) return;

  const count = last - first + 1;
  const range = sheet.getRange(first, 1, count, WIDTH);
  const values = range.getValues();

  // Máximo de ID existente, leído una sola vez.
  const props = PropertiesService.getDocumentProperties();
  let counter = Number(props.getProperty('LAST_ID') || 0);
  if (!isFinite(counter) || counter < 0) counter = 0;

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, COL.ID, lastRow - 1, 1).getValues().forEach(function (row) {
      const match = /^F(\d+)$/i.exec(normalize_(row[0]));
      if (match) counter = Math.max(counter, Number(match[1]));
    });
  }

  const now = new Date();
  let touched = false;

  values.forEach(function (row) {
    if (!normalize_(row[COL.DE - 1])) return;

    if (!normalize_(row[COL.ID - 1])) {
      counter++;
      row[COL.ID - 1] = ID_PREFIX + String(counter).padStart(ID_PAD, '0');
      row[COL.CREATED - 1] = now;
    }

    if (!normalize_(row[COL.STATUS - 1])) row[COL.STATUS - 1] = DEFAULT_STATUS;

    row[COL.TAGS - 1] = cleanTags_(row[COL.TAGS - 1]).join(', ');
    row[COL.UPDATED - 1] = now;
    touched = true;
  });

  if (!touched) return;

  props.setProperty('LAST_ID', String(counter));
  range.setValues(values);
}
