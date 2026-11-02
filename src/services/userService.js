// services/userService.js — User CRUD and class membership
const { SHEETS, DEFAULT_CLASS_ID } = require('../config');
const { readSheet, readSheetWithRows, appendRowRaw, updateRowRaw, deleteRow } = require('../utils/sheets');
const { hashPassword } = require('../utils/auth');
const { nowISO } = require('../utils/dates');

/**
 * List all users (without password hashes).
 * Teacher-only.
 */
async function listUsers() {
  const users = await readSheet(SHEETS.USERS);
  return users.map((u) => ({
    discordId:  u.discordId,
    firstName:  u.firstName,
    lastName:   u.lastName,
    studentId:  u.studentId,
    isActive:   u.isActive !== 'false',
  }));
}

/**
 * Get a user by student ID (without password hash).
 */
async function getUserByStudentId(studentId) {
  const users = await readSheet(SHEETS.USERS);
  const u = users.find((u) => u.studentId === studentId);
  if (!u) return null;
  return {
    discordId: u.discordId,
    firstName: u.firstName,
    lastName:  u.lastName,
    studentId: u.studentId,
    isActive:  u.isActive !== 'false',
  };
}

/**
 * Provision a new student account (teacher-only).
 * @param {object} data — { firstName, lastName, studentId, password }
 */
async function provisionUser(data) {
  const users = await readSheet(SHEETS.USERS);
  if (users.find((u) => u.studentId === data.studentId)) {
    throw new Error('Student ID already exists');
  }

  const passwordHash = hashPassword(data.password);
  const row = [data.discordId || '', data.firstName, data.lastName, data.studentId, passwordHash, 'true'];
  await appendRowRaw(SHEETS.USERS, row);

  // Also add to ClassMembers
  await appendRowRaw(SHEETS.CLASS_MEMBERS, [DEFAULT_CLASS_ID, data.studentId, 'active', nowISO(), '']);

  return {
    discordId: data.discordId || '',
    firstName: data.firstName,
    lastName:  data.lastName,
    studentId: data.studentId,
    isActive:  true,
  };
}

/**
 * Update a user (teacher-only).
 * @param {string} studentId
 * @param {object} updates — { firstName, lastName, isActive, password }
 */
async function updateUser(studentId, updates) {
  const users = await readSheetWithRows(SHEETS.USERS);
  const idx = users.findIndex((u) => u.studentId === studentId);
  if (idx === -1) throw new Error('User not found');

  const u = users[idx];
  const firstName  = updates.firstName  ?? u.firstName;
  const lastName   = updates.lastName   ?? u.lastName;
  const isActive   = updates.isActive   ?? (u.isActive !== 'false' ? 'true' : 'false');
  const passwordHash = updates.password ? hashPassword(updates.password) : u.passwordHash;

  await updateRowRaw(SHEETS.USERS, u._rowIndex, [
    u.discordId, firstName, lastName, studentId, passwordHash, isActive,
  ]);

  return { discordId: u.discordId, firstName, lastName, studentId, isActive: isActive === 'true' };
}

/**
 * Deactivate a user (soft delete — teacher-only).
 * Prefers deactivation over deletion to preserve historical records.
 */
async function deactivateUser(studentId) {
  const users = await readSheetWithRows(SHEETS.USERS);
  const u = users.find((u) => u.studentId === studentId);
  if (!u) throw new Error('User not found');

  await updateRowRaw(SHEETS.USERS, u._rowIndex, [
    u.discordId, u.firstName, u.lastName, studentId, u.passwordHash, 'false',
  ]);

  return { studentId, isActive: false };
}

/**
 * Hard-delete a user (teacher-only, use with caution).
 */
async function deleteUser(studentId) {
  const users = await readSheetWithRows(SHEETS.USERS);
  const idx = users.findIndex((u) => u.studentId === studentId);
  if (idx === -1) throw new Error('User not found');
  await deleteRow(SHEETS.USERS, users[idx]._rowIndex);
}

/**
 * Link a Discord ID to an existing student account (self-service from the
 * account page). Refuses if that Discord ID already belongs to someone else,
 * so a link attempt can never silently sign the user into another account.
 */
async function linkDiscordAccount(studentId, discordId) {
  if (!studentId || !discordId) throw new Error('studentId and discordId are required');

  const users = await readSheetWithRows(SHEETS.USERS);
  const target = users.find((u) => u.studentId === studentId);
  if (!target) throw new Error('User not found');

  const conflict = users.find((u) => u.discordId === discordId && u.studentId !== studentId);
  if (conflict) {
    const err = new Error('This Discord account is already linked to another student');
    err.statusCode = 409;
    throw err;
  }

  await updateRowRaw(SHEETS.USERS, target._rowIndex, [
    discordId,
    target.firstName,
    target.lastName,
    target.studentId,
    target.passwordHash,
    target.isActive === 'false' ? 'false' : 'true',
  ]);

  return { studentId, discordId };
}

module.exports = { listUsers, getUserByStudentId, provisionUser, updateUser, deactivateUser, deleteUser, linkDiscordAccount };
