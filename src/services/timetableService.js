// services/timetableService.js — Timetable grid management
const { SHEETS, DEFAULT_CLASS_ID, DEFAULT_TERM, DEFAULT_SCHOOL_YEAR } = require('../config');
const { readSheet, readSheetWithRows, appendRowRaw, updateRowRaw, deleteRow, batchAppend } = require('../utils/sheets');
const { nowISO } = require('../utils/dates');
const { generateId, PREFIXES } = require('../utils/ids');
const { normalizeSubjectCode } = require('./subjectService');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_MAP = { 1: 'จันทร์', 2: 'อังคาร', 3: 'พุธ', 4: 'พฤหัสบดี', 5: 'ศุกร์' };
const MAX_PERIOD = 9;

/**
 * Get the timetable for a term/year.
 * @param {number} term
 * @param {number} schoolYear
 * @returns {Promise<Array>} — flat array of { day, period, cellType, subjectCode, label, instructor }
 */
async function getTimetable(term = DEFAULT_TERM, schoolYear = DEFAULT_SCHOOL_YEAR) {
  const entries = await readSheet(SHEETS.TIMETABLE);
  return entries
    .filter((e) => e.classId === DEFAULT_CLASS_ID && parseInt(e.term) === term && parseInt(e.schoolYear) === schoolYear)
    .map((e) => ({
      timetableEntryId: e.timetableEntryId,
      day:      parseInt(e.day, 10),
      period:   parseInt(e.period, 10),
      cellType: e.cellType || 'subject',
      subjectCode: e.subjectCode || '',
      label:    e.label || '',
      instructor: e.instructor || '',
      updatedAt: e.updatedAt,
      updatedBy: e.updatedBy,
    }));
}

/**
 * Get the timetable as a 5×9 grid (day × period).
 */
async function getTimetableGrid(term, schoolYear) {
  const entries = await getTimetable(term, schoolYear);
  const grid = {};
  for (let day = 1; day <= 5; day++) {
    grid[day] = {};
    for (let period = 1; period <= MAX_PERIOD; period++) {
      const entry = entries.find((e) => e.day === day && e.period === period);
      grid[day][period] = entry || { cellType: 'free', label: '', subjectCode: '', instructor: '' };
    }
  }
  return grid;
}

/**
 * Upsert a single timetable cell (president/teacher only).
 */
async function upsertCell(day, period, data, updatedBy) {
  if (day < 1 || day > 5) throw new Error('Day must be 1-5 (Monday-Friday)');
  if (period < 1 || period > MAX_PERIOD) throw new Error('Period must be 1-9');

  const term = data.term || DEFAULT_TERM;
  const schoolYear = data.schoolYear || DEFAULT_SCHOOL_YEAR;

  const entries = await readSheetWithRows(SHEETS.TIMETABLE);
  const existing = entries.find(
    (e) => e.classId === DEFAULT_CLASS_ID &&
          parseInt(e.term) === term &&
          parseInt(e.schoolYear) === schoolYear &&
          parseInt(e.day) === day &&
          parseInt(e.period) === period
  );

  const cellType = data.cellType || 'subject';
  const subjectCode = cellType === 'subject' ? (data.subjectCode || '') : '';
  const label = cellType !== 'subject' ? (data.label || '') : '';
  const instructor = data.instructor || '';

  if (existing) {
    await updateRowRaw(SHEETS.TIMETABLE, existing._rowIndex, [
      existing.timetableEntryId, DEFAULT_CLASS_ID, term, schoolYear, day, period,
      cellType, subjectCode, label, instructor, nowISO(), updatedBy,
    ]);
  } else {
    const entryId = generateId(PREFIXES.TIMETABLE);
    await appendRowRaw(SHEETS.TIMETABLE, [
      entryId, DEFAULT_CLASS_ID, term, schoolYear, day, period,
      cellType, subjectCode, label, instructor, nowISO(), updatedBy,
    ]);
  }

  return { day, period, cellType, subjectCode, label, instructor, term, schoolYear };
}

/**
 * Batch upsert multiple cells (for timetable import confirmation and paste).
 */
async function batchUpsertCells(cells, updatedBy) {
  if (!cells || cells.length === 0) return [];

  const entries = await readSheetWithRows(SHEETS.TIMETABLE);
  const toAppend = [];
  const results = [];

  for (const cell of cells) {
    const day = parseInt(cell.day, 10);
    const period = parseInt(cell.period, 10);
    if (day < 1 || day > 5 || period < 1 || period > MAX_PERIOD) continue;

    const term = parseInt(cell.term || DEFAULT_TERM, 10);
    const schoolYear = parseInt(cell.schoolYear || DEFAULT_SCHOOL_YEAR, 10);
    const cellType = cell.cellType || 'subject';
    const subjectCode = cellType === 'subject' ? (cell.subjectCode || '') : '';
    const label = cellType !== 'subject' ? (cell.label || '') : '';
    const instructor = cell.instructor || '';

    const existing = entries.find(
      (e) => e.classId === DEFAULT_CLASS_ID &&
            parseInt(e.term) === term &&
            parseInt(e.schoolYear) === schoolYear &&
            parseInt(e.day) === day &&
            parseInt(e.period) === period
    );

    if (existing) {
      await updateRowRaw(SHEETS.TIMETABLE, existing._rowIndex, [
        existing.timetableEntryId, DEFAULT_CLASS_ID, term, schoolYear, day, period,
        cellType, subjectCode, label, instructor, nowISO(), updatedBy,
      ]);
    } else {
      const entryId = generateId(PREFIXES.TIMETABLE);
      toAppend.push([
        entryId, DEFAULT_CLASS_ID, term, schoolYear, day, period,
        cellType, subjectCode, label, instructor, nowISO(), updatedBy,
      ]);
    }

    results.push({ day, period, cellType, subjectCode, label, instructor, term, schoolYear });
  }

  if (toAppend.length > 0) {
    await batchAppend(SHEETS.TIMETABLE, toAppend);
  }

  return results;
}

/**
 * Create Subjects rows for every subject code that appears in the timetable
 * but is missing from the Subjects sheet.
 *
 * Timetable imports only write timetable cells; without this the codes exist
 * in the grid but homework can't reference them ("Subject not found").
 *
 * @param {number} term
 * @param {number} schoolYear
 * @returns {Promise<Array<{ subjectCode, subjectName, instructor }>>} created rows
 */
async function createMissingSubjects(term = DEFAULT_TERM, schoolYear = DEFAULT_SCHOOL_YEAR) {
  const [entries, subjects] = await Promise.all([
    getTimetable(term, schoolYear),
    readSheet(SHEETS.SUBJECTS),
  ]);

  const existing = new Set(
    subjects
      .filter((s) => !s.classId || s.classId === DEFAULT_CLASS_ID)
      .map((s) => normalizeSubjectCode(s.subjectCode))
      .filter(Boolean)
  );

  // Collect distinct codes, preferring the first cell that carries a label
  const missing = new Map();
  for (const entry of entries) {
    if (entry.cellType !== 'subject') continue;
    const code = normalizeSubjectCode(entry.subjectCode);
    if (!code || existing.has(code)) continue;

    const prev = missing.get(code);
    if (!prev) {
      missing.set(code, { subjectCode: code, subjectName: entry.label || '', instructor: entry.instructor || '' });
    } else {
      // Fill gaps from later cells (e.g. a code repeated with a name/teacher)
      if (!prev.subjectName && entry.label) prev.subjectName = entry.label;
      if (!prev.instructor && entry.instructor) prev.instructor = entry.instructor;
    }
  }

  if (missing.size === 0) return [];

  const created = [...missing.values()];
  // One API call for all new rows: [code, name, credits, instructor, classId, needsReview]
  await batchAppend(SHEETS.SUBJECTS, created.map((s) => [
    s.subjectCode,
    s.subjectName,
    '',
    s.instructor,
    DEFAULT_CLASS_ID,
    s.subjectName ? 'false' : 'true', // flag rows with no readable name for review
  ]));

  return created;
}

module.exports = {
  DAYS,
  DAY_MAP,
  MAX_PERIOD,
  getTimetable,
  getTimetableGrid,
  upsertCell,
  batchUpsertCells,
  createMissingSubjects,
};
