// services/timetableService.js — Timetable grid management
const { SHEETS, DEFAULT_CLASS_ID, DEFAULT_TERM, DEFAULT_SCHOOL_YEAR } = require('../config');
const { readSheet, readSheetWithRows, appendRowRaw, updateRowRaw, deleteRow, batchAppend } = require('../utils/sheets');
const { nowISO } = require('../utils/dates');
const { generateId, PREFIXES } = require('../utils/ids');

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

module.exports = {
  DAYS,
  DAY_MAP,
  MAX_PERIOD,
  getTimetable,
  getTimetableGrid,
  upsertCell,
  batchUpsertCells,
};
