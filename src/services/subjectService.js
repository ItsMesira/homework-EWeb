// services/subjectService.js — Subject CRUD with normalization and deduplication
const { SHEETS, DEFAULT_CLASS_ID } = require('../config');
const { readSheet, readSheetWithRows, appendRowRaw, updateRowRaw, deleteRow } = require('../utils/sheets');
const { nowISO } = require('../utils/dates');

/**
 * Normalize a subject code:
 * - Unicode NFC normalization
 * - Remove zero-width/control chars and whitespace
 * - Uppercase Latin letters
 * - Canonicalize hyphens (various dash forms → ASCII hyphen)
 */
function normalizeSubjectCode(code) {
  if (!code) return '';
  return code
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF\u0000-\u001F\u007F\s]/g, '')
    .replace(/[\u2010-\u2015\u2212]/g, '-') // various dashes → ASCII hyphen
    .toUpperCase();
}

/**
 * List all subjects for the default class.
 */
async function listSubjects() {
  const subjects = await readSheet(SHEETS.SUBJECTS);
  return subjects
    .filter((s) => !s.classId || s.classId === DEFAULT_CLASS_ID)
    .map((s) => ({
      subjectCode:  s.subjectCode,
      subjectName:  s.subjectName,
      credits:      s.credits,
      instructor:   s.instructor,
      classId:      s.classId || DEFAULT_CLASS_ID,
      needsReview:  s.needsReview === 'true',
    }));
}

/**
 * Get a single subject by code (normalized match).
 */
async function getSubject(subjectCode) {
  const subjects = await listSubjects();
  const normalized = normalizeSubjectCode(subjectCode);
  return subjects.find((s) => normalizeSubjectCode(s.subjectCode) === normalized) || null;
}

/**
 * Create a new subject (president/teacher only).
 * Checks for duplicate normalized code within the class.
 */
async function createSubject(data, createdBy) {
  const subjectCode = normalizeSubjectCode(data.subjectCode);
  if (!subjectCode) throw new Error('Subject code is required');

  const subjects = await readSheet(SHEETS.SUBJECTS);
  const exists = subjects.some(
    (s) => (!s.classId || s.classId === DEFAULT_CLASS_ID) &&
           normalizeSubjectCode(s.subjectCode) === subjectCode
  );
  if (exists) throw new Error('Subject code already exists for this class');

  const row = [
    subjectCode,
    data.subjectName || '',
    String(data.credits || ''),
    data.instructor || '',
    DEFAULT_CLASS_ID,
    'false',
  ];
  await appendRowRaw(SHEETS.SUBJECTS, row);

  return {
    subjectCode,
    subjectName: data.subjectName || '',
    credits: data.credits || '',
    instructor: data.instructor || '',
    classId: DEFAULT_CLASS_ID,
    needsReview: false,
  };
}

/**
 * Update a subject (president/teacher only).
 */
async function updateSubject(subjectCode, updates, updatedBy) {
  const subjects = await readSheetWithRows(SHEETS.SUBJECTS);
  const normalized = normalizeSubjectCode(subjectCode);
  const idx = subjects.findIndex(
    (s) => (!s.classId || s.classId === DEFAULT_CLASS_ID) &&
           normalizeSubjectCode(s.subjectCode) === normalized
  );
  if (idx === -1) throw new Error('Subject not found');

  const s = subjects[idx];
  const code = s.subjectCode; // preserve original code
  await updateRowRaw(SHEETS.SUBJECTS, s._rowIndex, [
    code,
    updates.subjectName  ?? s.subjectName,
    String(updates.credits ?? s.credits),
    updates.instructor   ?? s.instructor,
    s.classId || DEFAULT_CLASS_ID,
    updates.needsReview !== undefined ? String(updates.needsReview) : s.needsReview,
  ]);

  return {
    subjectCode: code,
    subjectName: updates.subjectName  ?? s.subjectName,
    credits:     updates.credits      ?? s.credits,
    instructor:  updates.instructor   ?? s.instructor,
    classId:     s.classId || DEFAULT_CLASS_ID,
    needsReview: (updates.needsReview !== undefined ? updates.needsReview : s.needsReview === 'true'),
  };
}

/**
 * Delete a subject (president/teacher only).
 * Note: this may orphan Homework/Timetable references — prefer archiving.
 */
async function deleteSubject(subjectCode) {
  const subjects = await readSheetWithRows(SHEETS.SUBJECTS);
  const normalized = normalizeSubjectCode(subjectCode);
  const idx = subjects.findIndex(
    (s) => (!s.classId || s.classId === DEFAULT_CLASS_ID) &&
           normalizeSubjectCode(s.subjectCode) === normalized
  );
  if (idx === -1) throw new Error('Subject not found');
  await deleteRow(SHEETS.SUBJECTS, subjects[idx]._rowIndex);
}

module.exports = {
  normalizeSubjectCode,
  listSubjects,
  getSubject,
  createSubject,
  updateSubject,
  deleteSubject,
};
