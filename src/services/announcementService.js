// services/announcementService.js — Class announcements
const { SHEETS, DEFAULT_CLASS_ID } = require('../config');
const { readSheet, readSheetWithRows, appendRowRaw, updateRowRaw, deleteRow } = require('../utils/sheets');
const { nowISO } = require('../utils/dates');
const { generateId, PREFIXES } = require('../utils/ids');

/**
 * List announcements (pinned first, then newest).
 * Excludes soft-deleted.
 */
async function listAnnouncements() {
  const items = await readSheet(SHEETS.ANNOUNCEMENTS);
  return items
    .filter((a) => a.classId === DEFAULT_CLASS_ID && !a.deletedAt)
    .map((a) => ({
      announcementId: a.announcementId,
      title:          a.title,
      body:           a.body,
      priority:       a.priority || 'normal',
      isPinned:       a.isPinned === 'true',
      publishedAt:    a.publishedAt,
      expiresAt:      a.expiresAt,
      createdBy:      a.createdBy,
      createdAt:      a.createdAt,
      updatedAt:      a.updatedAt,
    }))
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
}

/**
 * Create an announcement (president/teacher only).
 */
async function createAnnouncement(data, principal) {
  const announcementId = generateId(PREFIXES.ANNOUNCEMENT);
  const now = nowISO();
  const createdBy = principal.user.discordId;

  const row = [
    announcementId, DEFAULT_CLASS_ID,
    data.title, data.body || '',
    data.priority || 'normal', data.isPinned ? 'true' : 'false',
    data.publishedAt || now, data.expiresAt || '',
    createdBy, now, now, '',
  ];
  await appendRowRaw(SHEETS.ANNOUNCEMENTS, row);

  return {
    announcementId,
    title: data.title,
    body: data.body || '',
    priority: data.priority || 'normal',
    isPinned: !!data.isPinned,
    publishedAt: data.publishedAt || now,
    expiresAt: data.expiresAt || '',
    createdBy,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update an announcement (president/teacher only).
 */
async function updateAnnouncement(announcementId, updates, principal) {
  const items = await readSheetWithRows(SHEETS.ANNOUNCEMENTS);
  const a = items.find(
    (a) => a.announcementId === announcementId && a.classId === DEFAULT_CLASS_ID && !a.deletedAt
  );
  if (!a) throw new Error('Announcement not found');

  const now = nowISO();
  await updateRowRaw(SHEETS.ANNOUNCEMENTS, a._rowIndex, [
    a.announcementId, DEFAULT_CLASS_ID,
    updates.title       ?? a.title,
    updates.body        ?? a.body,
    updates.priority    ?? a.priority,
    updates.isPinned !== undefined ? String(updates.isPinned) : a.isPinned,
    updates.publishedAt ?? a.publishedAt,
    updates.expiresAt   ?? a.expiresAt,
    a.createdBy, a.createdAt, now, '',
  ]);

  return {
    announcementId,
    title: updates.title ?? a.title,
    body: updates.body ?? a.body,
    priority: updates.priority ?? a.priority,
    isPinned: updates.isPinned !== undefined ? updates.isPinned : a.isPinned === 'true',
    publishedAt: updates.publishedAt ?? a.publishedAt,
    expiresAt: updates.expiresAt ?? a.expiresAt,
    createdBy: a.createdBy,
    createdAt: a.createdAt,
    updatedAt: now,
  };
}

/**
 * Delete an announcement (soft delete).
 */
async function deleteAnnouncement(announcementId) {
  const items = await readSheetWithRows(SHEETS.ANNOUNCEMENTS);
  const a = items.find(
    (a) => a.announcementId === announcementId && a.classId === DEFAULT_CLASS_ID && !a.deletedAt
  );
  if (!a) throw new Error('Announcement not found');

  const now = nowISO();
  await updateRowRaw(SHEETS.ANNOUNCEMENTS, a._rowIndex, [
    a.announcementId, DEFAULT_CLASS_ID, a.title, a.body, a.priority, a.isPinned,
    a.publishedAt, a.expiresAt, a.createdBy, a.createdAt, a.updatedAt, now,
  ]);
}

module.exports = { listAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement };
