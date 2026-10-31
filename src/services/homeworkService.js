// services/homeworkService.js — Homework CRUD with role enforcement
const { SHEETS, DEFAULT_CLASS_ID } = require('../config');
const { readSheet, readSheetWithRows, appendRowRaw, updateRowRaw, deleteRow } = require('../utils/sheets');
const { parseBangkokDate, formatBangkokDate, nowBangkok, nowISO } = require('../utils/dates');
const { generateId, PREFIXES } = require('../utils/ids');

/**
 * List homework with optional filters.
 * @param {object} filters — { from, to, subjectCode, status }
 *   status: 'pending' | 'overdue' | 'completed' | 'all'
 * @param {object} principal — for completion scoping
 */
async function listHomework(filters = {}, principal) {
  const [homeworkList, completions] = await Promise.all([
    readSheet(SHEETS.HOMEWORK),
    readSheet(SHEETS.COMPLETION),
  ]);

  // Filter by class
  let items = homeworkList.filter((hw) => !hw.classId || hw.classId === DEFAULT_CLASS_ID);

  // Apply date filters
  if (filters.from) {
    const fromDate = parseBangkokDate(filters.from);
    if (fromDate) items = items.filter((hw) => {
      const d = parseBangkokDate(hw.dueDate);
      return d && d >= fromDate;
    });
  }
  if (filters.to) {
    const toDate = parseBangkokDate(filters.to);
    if (toDate) items = items.filter((hw) => {
      const d = parseBangkokDate(hw.dueDate);
      return d && d <= toDate;
    });
  }

  // Apply subject filter
  if (filters.subjectCode) {
    items = items.filter((hw) => hw.subjectCode === filters.subjectCode);
  }

  // Apply search
  if (filters.search) {
    const q = filters.search.toLowerCase();
    items = items.filter((hw) =>
      (hw.title || '').toLowerCase().includes(q) ||
      (hw.details || '').toLowerCase().includes(q) ||
      (hw.subjectCode || '').toLowerCase().includes(q)
    );
  }

  // Enrich with completion status
  const now = Date.now();
  items = items.map((hw) => {
    const dueDate = parseBangkokDate(hw.dueDate);
    const isOverdue = dueDate && dueDate.getTime() < now;

    // Check completion for this student
    let completed = false;
    if (principal && principal.user.studentId) {
      completed = completions.some(
        (c) => c.homeworkId === hw.homeworkId && c.studentId === principal.user.studentId
      );
    }

    // Completion count (for presidents/teachers)
    const completedCount = completions.filter((c) => c.homeworkId === hw.homeworkId).length;

    return {
      homeworkId:   hw.homeworkId,
      subjectCode:  hw.subjectCode,
      title:        hw.title,
      details:      hw.details,
      imageUrl:     hw.imageUrl,
      link:         hw.link,
      dueDate:      hw.dueDate,
      assignDate:   hw.assignDate,
      addedBy:      hw.addedBy,
      classId:      hw.classId || DEFAULT_CLASS_ID,
      isOverdue:    !!isOverdue,
      completed,
      completedCount,
    };
  });

  // Apply status filter
  if (filters.status === 'pending') {
    items = items.filter((hw) => !hw.isOverdue);
  } else if (filters.status === 'overdue') {
    items = items.filter((hw) => hw.isOverdue);
  } else if (filters.status === 'completed') {
    items = items.filter((hw) => hw.completed);
  }

  // Sort by due date ascending
  items.sort((a, b) => {
    const da = parseBangkokDate(a.dueDate);
    const db = parseBangkokDate(b.dueDate);
    return (da ? da.getTime() : Infinity) - (db ? db.getTime() : Infinity);
  });

  return items;
}

/**
 * Get a single homework by ID.
 */
async function getHomework(homeworkId, principal) {
  const items = await listHomework({}, principal);
  return items.find((hw) => hw.homeworkId === homeworkId) || null;
}

/**
 * Create homework (president/teacher only).
 * @param {object} data — { subjectCode, title, details, imageUrl, link, dueDate }
 */
async function createHomework(data, principal) {
  // Validate subject exists
  const { getSubject } = require('./subjectService');
  const subject = await getSubject(data.subjectCode);
  if (!subject) throw new Error('Subject not found for this class');

  // Validate due date
  if (!data.dueDate) throw new Error('Due date is required');
  const dueDate = parseBangkokDate(data.dueDate);
  if (!dueDate) throw new Error('Invalid date format — use YYYY-MM-DD HH:MM');

  const homeworkId   = generateId(PREFIXES.HOMEWORK);
  const assignDate   = nowBangkok();
  const addedBy      = `${principal.user.firstName} ${principal.user.lastName}`.trim() || principal.user.discordId;

  const row = [
    homeworkId,
    data.subjectCode,
    data.title,
    data.details   || '',
    data.imageUrl  || '',
    data.link      || '',
    data.dueDate,
    assignDate,
    addedBy,
    DEFAULT_CLASS_ID,
  ];
  await appendRowRaw(SHEETS.HOMEWORK, row);

  // Return the created homework (without completions)
  return {
    homeworkId,
    subjectCode:  data.subjectCode,
    title:        data.title,
    details:      data.details || '',
    imageUrl:     data.imageUrl || '',
    link:         data.link || '',
    dueDate:      data.dueDate,
    assignDate,
    addedBy,
    classId:      DEFAULT_CLASS_ID,
    isOverdue:    false,
    completed:    false,
    completedCount: 0,
  };
}

/**
 * Update homework (president/teacher only).
 */
async function updateHomework(homeworkId, updates, principal) {
  const homeworkList = await readSheetWithRows(SHEETS.HOMEWORK);
  const hw = homeworkList.find(
    (h) => h.homeworkId === homeworkId && (!h.classId || h.classId === DEFAULT_CLASS_ID)
  );
  if (!hw) throw new Error('Homework not found');

  // Validate new subject if changing
  if (updates.subjectCode && updates.subjectCode !== hw.subjectCode) {
    const { getSubject } = require('./subjectService');
    const subject = await getSubject(updates.subjectCode);
    if (!subject) throw new Error('Subject not found for this class');
  }

  // Validate new due date if changing
  if (updates.dueDate) {
    const dueDate = parseBangkokDate(updates.dueDate);
    if (!dueDate) throw new Error('Invalid date format — use YYYY-MM-DD HH:MM');
  }

  await updateRowRaw(SHEETS.HOMEWORK, hw._rowIndex, [
    hw.homeworkId,
    updates.subjectCode ?? hw.subjectCode,
    updates.title       ?? hw.title,
    updates.details     ?? hw.details,
    updates.imageUrl    ?? hw.imageUrl,
    updates.link        ?? hw.link,
    updates.dueDate     ?? hw.dueDate,
    hw.assignDate,
    hw.addedBy,
    hw.classId || DEFAULT_CLASS_ID,
  ]);

  return getHomework(homeworkId, principal);
}

/**
 * Delete homework (president/teacher only).
 */
async function deleteHomework(homeworkId) {
  const homeworkList = await readSheetWithRows(SHEETS.HOMEWORK);
  const idx = homeworkList.findIndex(
    (h) => h.homeworkId === homeworkId && (!h.classId || h.classId === DEFAULT_CLASS_ID)
  );
  if (idx === -1) throw new Error('Homework not found');
  await deleteRow(SHEETS.HOMEWORK, homeworkList[idx]._rowIndex);
}

module.exports = { listHomework, getHomework, createHomework, updateHomework, deleteHomework };
