// services/analyticsService.js — Personal and class analytics
const { SHEETS, DEFAULT_CLASS_ID } = require('../config');
const { readSheet } = require('../utils/sheets');
const { parseBangkokDate } = require('../utils/dates');

/**
 * Get personal analytics for a student.
 */
async function getMyAnalytics(studentId) {
  const [homeworkList, completions, users] = await Promise.all([
    readSheet(SHEETS.HOMEWORK),
    readSheet(SHEETS.COMPLETION),
    readSheet(SHEETS.USERS),
  ]);

  const userRecord = users.find((u) => u.studentId === studentId);
  const now = Date.now();

  const classHw = homeworkList.filter((hw) => !hw.classId || hw.classId === DEFAULT_CLASS_ID);

  const pending = classHw.filter((hw) => {
    if (!hw.dueDate) return true;
    const d = parseBangkokDate(hw.dueDate);
    return d && d.getTime() >= now;
  });

  const myCompletions = completions.filter((c) => c.studentId === studentId);
  const doneCount = pending.filter((hw) =>
    myCompletions.some((c) => c.homeworkId === hw.homeworkId)
  ).length;
  const todoCount = pending.length - doneCount;
  const pct = pending.length > 0 ? Math.round((doneCount / pending.length) * 100) : 100;

  const upcoming = pending
    .filter((hw) => !myCompletions.some((c) => c.homeworkId === hw.homeworkId))
    .sort((a, b) => {
      const da = parseBangkokDate(a.dueDate);
      const db = parseBangkokDate(b.dueDate);
      return (da ? da.getTime() : Infinity) - (db ? db.getTime() : Infinity);
    })
    .slice(0, 5)
    .map((hw) => ({
      homeworkId: hw.homeworkId,
      title: hw.title,
      subjectCode: hw.subjectCode,
      dueDate: hw.dueDate,
    }));

  // Subject breakdown
  const subjectStats = {};
  for (const hw of classHw) {
    const code = hw.subjectCode || 'UNKNOWN';
    if (!subjectStats[code]) subjectStats[code] = { total: 0, completed: 0 };
    subjectStats[code].total++;
    if (myCompletions.some((c) => c.homeworkId === hw.homeworkId)) {
      subjectStats[code].completed++;
    }
  }

  return {
    user: userRecord ? {
      firstName: userRecord.firstName,
      lastName: userRecord.lastName,
      studentId,
    } : { firstName: '', lastName: '', studentId },
    pendingCount: pending.length,
    doneCount,
    todoCount,
    completionRate: pct,
    upcoming,
    subjectStats: Object.entries(subjectStats).map(([code, s]) => ({
      subjectCode: code,
      total: s.total,
      completed: s.completed,
      rate: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
    })),
  };
}

/**
 * Get class-wide analytics (president/teacher only).
 */
async function getClassAnalytics(filters = {}) {
  const [homeworkList, completions, users] = await Promise.all([
    readSheet(SHEETS.HOMEWORK),
    readSheet(SHEETS.COMPLETION),
    readSheet(SHEETS.USERS),
  ]);

  const classHw = homeworkList.filter((hw) => !hw.classId || hw.classId === DEFAULT_CLASS_ID);
  const classUsers = users.filter((u) => u.isActive !== 'false');
  const now = Date.now();

  // Per-homework completion stats
  const homeworkStats = classHw.map((hw) => {
    const done = completions.filter((c) => c.homeworkId === hw.homeworkId);
    const dueDate = parseBangkokDate(hw.dueDate);
    const isOverdue = dueDate && dueDate.getTime() < now;
    return {
      homeworkId: hw.homeworkId,
      title: hw.title,
      subjectCode: hw.subjectCode,
      dueDate: hw.dueDate,
      completedCount: done.length,
      totalCount: classUsers.length,
      isOverdue: !!isOverdue,
    };
  }).sort((a, b) => {
    const da = parseBangkokDate(a.dueDate);
    const db = parseBangkokDate(b.dueDate);
    return (da ? da.getTime() : Infinity) - (db ? db.getTime() : Infinity);
  });

  // Per-student completion stats
  const studentStats = classUsers.map((u) => {
    const myCompletions = completions.filter((c) => c.studentId === u.studentId);
    const pending = classHw.filter((hw) => {
      if (!hw.dueDate) return true;
      const d = parseBangkokDate(hw.dueDate);
      return d && d.getTime() >= now;
    });
    const doneCount = pending.filter((hw) =>
      myCompletions.some((c) => c.homeworkId === hw.homeworkId)
    ).length;
    return {
      studentId: u.studentId,
      name: `${u.firstName} ${u.lastName}`.trim(),
      completed: doneCount,
      pending: pending.length,
      rate: pending.length > 0 ? Math.round((doneCount / pending.length) * 100) : 100,
    };
  }).sort((a, b) => a.rate - b.rate);

  // Overall class stats
  const overdueCount = homeworkStats.filter((h) => h.isOverdue).length;
  const totalPending = classHw.filter((hw) => {
    if (!hw.dueDate) return true;
    const d = parseBangkokDate(hw.dueDate);
    return d && d.getTime() >= now;
  }).length;

  // Per-subject stats
  const subjectMap = {};
  for (const hw of classHw) {
    const code = hw.subjectCode || 'UNKNOWN';
    if (!subjectMap[code]) subjectMap[code] = { total: 0, completed: 0 };
    subjectMap[code].total++;
    subjectMap[code].completed += completions.filter((c) => c.homeworkId === hw.homeworkId).length;
  }

  return {
    totalHomework: classHw.length,
    totalPending,
    overdueCount,
    totalStudents: classUsers.length,
    homeworkStats,
    studentStats,
    subjectStats: Object.entries(subjectMap).map(([code, s]) => ({
      subjectCode: code,
      total: s.total,
      completed: s.completed,
    })),
  };
}

/**
 * Export homework data as CSV (president/teacher only).
 * Includes UTF-8 BOM and formula escaping.
 */
function exportHomeworkCSV(homeworkStats) {
  const BOM = '\uFEFF';
  const header = 'homeworkId,subjectCode,title,dueDate,completedCount,totalCount,isOverdue';
  const rows = homeworkStats.map((h) => {
    const escape = (val) => {
      let s = String(val || '');
      // Escape cells beginning with formula chars
      if (/^[=+\-@]/.test(s)) s = `'${s}`;
      // Escape quotes
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        s = `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    return [h.homeworkId, h.subjectCode, h.title, h.dueDate, h.completedCount, h.totalCount, h.isOverdue]
      .map(escape).join(',');
  });
  return BOM + header + '\n' + rows.join('\n');
}

/**
 * Export student completion data as CSV.
 */
function exportStudentsCSV(studentStats) {
  const BOM = '\uFEFF';
  const header = 'studentId,name,completed,pending,rate';
  const rows = studentStats.map((s) => {
    const escape = (val) => {
      let str = String(val || '');
      if (/^[=+\-@]/.test(str)) str = `'${str}`;
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        str = `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    return [s.studentId, s.name, s.completed, s.pending, s.rate + '%'].map(escape).join(',');
  });
  return BOM + header + '\n' + rows.join('\n');
}

module.exports = { getMyAnalytics, getClassAnalytics, exportHomeworkCSV, exportStudentsCSV };
