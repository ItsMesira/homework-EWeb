// services/completionService.js — Homework completion tracking
const { SHEETS } = require('../config');
const { readSheet, readSheetWithRows, appendRowRaw, deleteRow } = require('../utils/sheets');
const { nowISO } = require('../utils/dates');

/**
 * Mark a homework as complete for the authenticated student.
 * Enforces: one completion per homework/student.
 */
async function markComplete(homeworkId, studentId) {
  if (!studentId) throw new Error('Student ID required');

  // Check if already completed
  const completions = await readSheetWithRows(SHEETS.COMPLETION);
  const existing = completions.find(
    (c) => c.homeworkId === homeworkId && c.studentId === studentId
  );
  if (existing) return { homeworkId, studentId, completedAt: existing.completedAt };

  await appendRowRaw(SHEETS.COMPLETION, [homeworkId, studentId, nowISO()]);
  return { homeworkId, studentId, completedAt: nowISO() };
}

/**
 * Unmark a homework as complete (remove completion record).
 * Only operates on the authenticated student's record.
 */
async function unmarkComplete(homeworkId, studentId) {
  if (!studentId) throw new Error('Student ID required');

  const completions = await readSheetWithRows(SHEETS.COMPLETION);
  const existing = completions.find(
    (c) => c.homeworkId === homeworkId && c.studentId === studentId
  );
  if (!existing) return { homeworkId, studentId, completed: false };

  await deleteRow(SHEETS.COMPLETION, existing._rowIndex);
  return { homeworkId, studentId, completed: false };
}

/**
 * Get all completions for a student.
 */
async function getMyCompletions(studentId) {
  const completions = await readSheet(SHEETS.COMPLETION);
  return completions
    .filter((c) => c.studentId === studentId)
    .map((c) => ({ homeworkId: c.homeworkId, studentId: c.studentId, completedAt: c.completedAt }));
}

/**
 * Get completion count for a homework (for presidents/teachers).
 */
async function getCompletionCount(homeworkId) {
  const completions = await readSheet(SHEETS.COMPLETION);
  return completions.filter((c) => c.homeworkId === homeworkId).length;
}

module.exports = { markComplete, unmarkComplete, getMyCompletions, getCompletionCount };
