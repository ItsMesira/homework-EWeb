// utils/sheets.js — Google Sheets API helper
//
// Extended for the web dashboard:
//   • sheetsClient is re-created after 50 minutes (under Google's 60-min token lifetime)
//   • deleteRow validates rowIndex > 1 to protect the header
//   • initSheets is idempotent and adds missing headers to nonempty tabs
//   • New tabs for Classes, ClassMembers, PresidentAppointments, Timetable, etc.
//   • batchAppend for multi-row writes (timetable confirmation)
//   • updateCellRange for targeted cell updates
//   • RAW value input option for user-controlled values (prevents formula execution)
//   • readSheetWithRows returns both objects and their 1-based row indices

const { google } = require('googleapis');
const { SHEET_ID, SHEETS, GOOGLE_CREDENTIALS } = require('../config');

let sheetsClient    = null;
let clientCreatedAt = 0;
const CLIENT_TTL    = 50 * 60 * 1000; // 50 minutes — under Google's 60-min token lifetime

async function getClient() {
  const now = Date.now();
  if (sheetsClient && now - clientCreatedAt < CLIENT_TTL) return sheetsClient;

  const creds = JSON.parse(GOOGLE_CREDENTIALS);
  const auth  = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  sheetsClient    = google.sheets({ version: 'v4', auth });
  clientCreatedAt = now;
  return sheetsClient;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/** Read all rows from a sheet tab; returns array of objects keyed by first-row headers. */
async function readSheet(tabName) {
  const client = await getClient();
  const res    = await client.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range:         `${tabName}!A1:Z`,
  });
  const rows = res.data.values || [];
  if (rows.length < 1) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => (obj[h] = row[i] ?? ''));
    return obj;
  });
}

/**
 * Read all rows and include the 1-based sheet row index (header = row 1, first data row = 2).
 * Useful for updateRow/deleteRow operations.
 */
async function readSheetWithRows(tabName) {
  const client = await getClient();
  const res    = await client.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range:         `${tabName}!A1:Z`,
  });
  const rows = res.data.values || [];
  if (rows.length < 1) return [];
  const headers = rows[0];
  return rows.slice(1).map((row, i) => {
    const obj = {};
    headers.forEach((h, j) => (obj[h] = row[j] ?? ''));
    obj._rowIndex = i + 2; // +1 for header row, +1 for 0→1 conversion
    return obj;
  });
}

// ─── Write ────────────────────────────────────────────────────────────────────

/** Append a single row to a sheet tab. Uses USER_ENTERED for backward compatibility. */
async function appendRow(tabName, values) {
  const client = await getClient();
  await client.spreadsheets.values.append({
    spreadsheetId:    SHEET_ID,
    range:            `${tabName}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody:      { values: [values] },
  });
}

/** Append a single row with RAW input (prevents spreadsheet formula execution). */
async function appendRowRaw(tabName, values) {
  const client = await getClient();
  await client.spreadsheets.values.append({
    spreadsheetId:    SHEET_ID,
    range:            `${tabName}!A1`,
    valueInputOption: 'RAW',
    requestBody:      { values: [values] },
  });
}

/** Append multiple rows in one API call (batch). Uses RAW input. */
async function batchAppend(tabName, rows) {
  if (!rows || rows.length === 0) return;
  const client = await getClient();
  await client.spreadsheets.values.append({
    spreadsheetId:    SHEET_ID,
    range:            `${tabName}!A1`,
    valueInputOption: 'RAW',
    requestBody:      { values: rows },
  });
}

/** Update a specific row by 1-based row index. Uses USER_ENTERED for backward compat. */
async function updateRow(tabName, rowIndex, values) {
  if (rowIndex < 2) throw new Error('rowIndex must be >= 2 to protect the header row');
  const client = await getClient();
  await client.spreadsheets.values.update({
    spreadsheetId:    SHEET_ID,
    range:            `${tabName}!A${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody:      { values: [values] },
  });
}

/** Update a specific row with RAW input. */
async function updateRowRaw(tabName, rowIndex, values) {
  if (rowIndex < 2) throw new Error('rowIndex must be >= 2 to protect the header row');
  const client = await getClient();
  await client.spreadsheets.values.update({
    spreadsheetId:    SHEET_ID,
    range:            `${tabName}!A${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody:      { values: [values] },
  });
}

/** Delete a row by 1-based row index. rowIndex 1 is the header — never delete it. */
async function deleteRow(tabName, rowIndex) {
  if (rowIndex < 2) throw new Error('rowIndex must be >= 2 to protect the header row');
  const client = await getClient();
  const meta   = await client.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const sheet  = meta.data.sheets.find((s) => s.properties.title === tabName);
  if (!sheet) throw new Error(`Sheet tab "${tabName}" not found`);
  const sheetId = sheet.properties.sheetId;

  await client.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension:  'ROWS',
            startIndex: rowIndex - 1, // 0-based inclusive
            endIndex:   rowIndex,     // 0-based exclusive
          },
        },
      }],
    },
  });
}

// ─── Tab headers (existing + new) ─────────────────────────────────────────────

const TAB_HEADERS = {
  // Existing tabs — column positions preserved, new columns appended
  [SHEETS.USERS]:      ['discordId', 'firstName', 'lastName', 'studentId', 'passwordHash', 'isActive'],
  [SHEETS.SUBJECTS]:   ['subjectCode', 'subjectName', 'credits', 'instructor', 'classId', 'needsReview'],
  [SHEETS.HOMEWORK]:   ['homeworkId', 'subjectCode', 'title', 'details', 'imageUrl', 'link', 'dueDate', 'assignDate', 'addedBy', 'classId'],
  [SHEETS.COMPLETION]: ['homeworkId', 'studentId', 'completedAt'],
  // New tabs
  [SHEETS.CLASSES]:               ['classId', 'className', 'room', 'defaultTerm', 'defaultSchoolYear', 'timeZone', 'isActive', 'createdAt'],
  [SHEETS.CLASS_MEMBERS]:         ['classId', 'studentId', 'status', 'joinedAt', 'leftAt'],
  [SHEETS.PRESIDENT_APPOINTMENTS]: ['appointmentId', 'classId', 'studentId', 'appointedByDiscordId', 'appointedAt', 'revokedByDiscordId', 'revokedAt'],
  [SHEETS.TIMETABLE]:             ['timetableEntryId', 'classId', 'term', 'schoolYear', 'day', 'period', 'cellType', 'subjectCode', 'label', 'instructor', 'updatedAt', 'updatedBy'],
  [SHEETS.TIMETABLE_IMPORTS]:     ['importId', 'classId', 'term', 'schoolYear', 'cloudinaryPublicId', 'status', 'draftJson', 'revision', 'createdBy', 'createdAt', 'updatedAt', 'confirmedAt'],
  [SHEETS.HOMEWORK_ATTACHMENTS]:  ['attachmentId', 'homeworkId', 'classId', 'cloudinaryPublicId', 'resourceType', 'format', 'bytes', 'originalFilename', 'uploadedBy', 'createdAt', 'deletedAt'],
  [SHEETS.ANNOUNCEMENTS]:         ['announcementId', 'classId', 'title', 'body', 'priority', 'isPinned', 'publishedAt', 'expiresAt', 'createdBy', 'createdAt', 'updatedAt', 'deletedAt'],
  [SHEETS.SETTINGS]:              ['classId', 'key', 'valueJson', 'updatedBy', 'updatedAt'],
  [SHEETS.PUSH_SUBSCRIPTIONS]:    ['subscriptionId', 'classId', 'studentId', 'endpointHash', 'encryptedSubscription', 'createdAt', 'revokedAt'],
  [SHEETS.NOTIFICATION_DELIVERIES]: ['deliveryKey', 'channel', 'recipientId', 'status', 'createdAt', 'sentAt'],
  [SHEETS.AUDIT_LOG]:             ['eventId', 'classId', 'actorId', 'action', 'entityType', 'entityId', 'metadataJson', 'createdAt'],
};

// ─── Migration: extend existing tabs with new columns ─────────────────────────

// Maps tab → old headers → new headers (columns to append)
const COLUMN_EXTENSIONS = {
  [SHEETS.USERS]:    { old: ['discordId', 'firstName', 'lastName', 'studentId', 'passwordHash'], new: ['isActive'] },
  [SHEETS.SUBJECTS]: { old: ['subjectCode', 'subjectName', 'credits', 'instructor'], new: ['classId', 'needsReview'] },
  [SHEETS.HOMEWORK]: { old: ['homeworkId', 'subjectCode', 'title', 'details', 'imageUrl', 'link', 'dueDate', 'assignDate', 'addedBy'], new: ['classId'] },
};

/**
 * Ensure all required sheet tabs and header rows exist.
 * For existing tabs with data, append any missing columns to the header row.
 * Safe to call on every startup — it is idempotent.
 */
async function initSheets() {
  const client       = await getClient();
  const meta         = await client.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const existingTabs = meta.data.sheets.map((s) => s.properties.title);

  // Create missing tabs in a single batch request
  const addRequests = Object.values(SHEETS)
    .filter((tab) => !existingTabs.includes(tab))
    .map((tab) => ({ addSheet: { properties: { title: tab } } }));

  if (addRequests.length > 0) {
    await client.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody:   { requests: addRequests },
    });
  }

  // For each tab, ensure the header row has all required columns
  for (const [tab, headers] of Object.entries(TAB_HEADERS)) {
    const raw = await client.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range:         `${tab}!A1:Z1`,
    });

    const currentHeaders = (raw.data.values && raw.data.values[0]) || [];

    if (currentHeaders.length === 0) {
      // Empty tab — write the full header row
      await client.spreadsheets.values.update({
        spreadsheetId:    SHEET_ID,
        range:            `${tab}!A1`,
        valueInputOption: 'RAW',
        requestBody:      { values: [headers] },
      });
    } else {
      // Tab has data — check for missing columns and append them
      const missingCols = headers.filter((h) => !currentHeaders.includes(h));
      if (missingCols.length > 0) {
        const startCol = currentHeaders.length; // 0-based column index to start writing
        const range = `${tab}!${colLetter(startCol)}1:${colLetter(startCol + missingCols.length - 1)}1`;
        await client.spreadsheets.values.update({
          spreadsheetId:    SHEET_ID,
          range:            range,
          valueInputOption: 'RAW',
          requestBody:      { values: [missingCols] },
        });
      }
    }
  }

  // Seed default class if Classes tab is empty
  await seedDefaultClass(client);
}

/** Convert a 0-based column index to a spreadsheet column letter (0 → A, 25 → Z, 26 → AA). */
function colLetter(index) {
  let result = '';
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

/** Seed the default MEP4-744 class row if the Classes tab has no data. */
async function seedDefaultClass(client) {
  const { DEFAULT_CLASS_ID, DEFAULT_CLASS_NAME, DEFAULT_ROOM, DEFAULT_TERM, DEFAULT_SCHOOL_YEAR, DEFAULT_TIMEZONE } = require('../config');
  const raw = await client.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range:         `${SHEETS.CLASSES}!A2:H2`,
  });
  if (!raw.data.values || raw.data.values.length === 0) {
    await client.spreadsheets.values.append({
      spreadsheetId:    SHEET_ID,
      range:            `${SHEETS.CLASSES}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[DEFAULT_CLASS_ID, DEFAULT_CLASS_NAME, DEFAULT_ROOM, DEFAULT_TERM, DEFAULT_SCHOOL_YEAR, DEFAULT_TIMEZONE, 'true', new Date().toISOString()]],
      },
    });
  }
}

module.exports = {
  readSheet,
  readSheetWithRows,
  appendRow,
  appendRowRaw,
  batchAppend,
  updateRow,
  updateRowRaw,
  deleteRow,
  initSheets,
  TAB_HEADERS,
};
