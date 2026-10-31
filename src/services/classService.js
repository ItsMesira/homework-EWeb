// services/classService.js — Class info, members, and president appointments
const { SHEETS, DEFAULT_CLASS_ID } = require('../config');
const { readSheet, readSheetWithRows, appendRowRaw, updateRowRaw } = require('../utils/sheets');
const { nowISO } = require('../utils/dates');
const { generateId, PREFIXES } = require('../utils/ids');

/**
 * Get the default class info.
 */
async function getClass() {
  const classes = await readSheet(SHEETS.CLASSES);
  const cls = classes.find((c) => c.classId === DEFAULT_CLASS_ID);
  if (!cls) return null;
  return {
    classId:         cls.classId,
    className:       cls.className,
    room:            cls.room,
    defaultTerm:     parseInt(cls.defaultTerm, 10),
    defaultSchoolYear: parseInt(cls.defaultSchoolYear, 10),
    timeZone:        cls.timeZone,
    isActive:        cls.isActive === 'true',
  };
}

/**
 * List all class members.
 */
async function listMembers() {
  const members = await readSheet(SHEETS.CLASS_MEMBERS);
  return members.filter((m) => m.classId === DEFAULT_CLASS_ID && m.status === 'active');
}

/**
 * List active presidents.
 */
async function listPresidents() {
  const appointments = await readSheet(SHEETS.PRESIDENT_APPOINTMENTS);
  return appointments.filter((a) => a.classId === DEFAULT_CLASS_ID && !a.revokedAt);
}

/**
 * Check if a studentId is an active president.
 */
async function isActivePresident(studentId) {
  const presidents = await listPresidents();
  return presidents.some((p) => p.studentId === studentId);
}

/**
 * Appoint a president (teacher-only).
 */
async function appointPresident(studentId, appointedByDiscordId) {
  // Check if already an active president
  const existing = await listPresidents();
  if (existing.some((p) => p.studentId === studentId)) {
    throw new Error('This student is already an active president');
  }

  const appointmentId = generateId(PREFIXES.APPOINTMENT);
  await appendRowRaw(SHEETS.PRESIDENT_APPOINTMENTS, [
    appointmentId, DEFAULT_CLASS_ID, studentId, appointedByDiscordId, nowISO(), '', '',
  ]);

  return { appointmentId, studentId, appointedAt: nowISO() };
}

/**
 * Revoke a president (teacher-only).
 */
async function revokePresident(studentId, revokedByDiscordId) {
  const appointments = await readSheetWithRows(SHEETS.PRESIDENT_APPOINTMENTS);
  const apt = appointments.find(
    (a) => a.classId === DEFAULT_CLASS_ID && a.studentId === studentId && !a.revokedAt
  );
  if (!apt) throw new Error('No active president appointment found for this student');

  await updateRowRaw(SHEETS.PRESIDENT_APPOINTMENTS, apt._rowIndex, [
    apt.appointmentId, apt.classId, apt.studentId, apt.appointedByDiscordId, apt.appointedAt,
    revokedByDiscordId, nowISO(),
  ]);

  return { studentId, revokedAt: nowISO() };
}

module.exports = {
  getClass,
  listMembers,
  listPresidents,
  isActivePresident,
  appointPresident,
  revokePresident,
};
