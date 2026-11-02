// services/attachmentService.js — Homework attachment CRUD
//
// Stores attachment metadata in the HomeworkAttachments sheet tab.
// Files are uploaded to Cloudinary; the cloudinaryPublicId is stored here.

const { SHEETS, DEFAULT_CLASS_ID, MAX_ATTACHMENTS_PER_HW } = require('../config');
const { appendRowRaw, readSheet } = require('../utils/sheets');
const { generateId, PREFIXES } = require('../utils/ids');
const { nowISO } = require('../utils/dates');

/**
 * List attachments for a homework item (excluding soft-deleted).
 */
async function listAttachments(homeworkId) {
  const rows = await readSheet(SHEETS.HOMEWORK_ATTACHMENTS);
  return rows.filter((r) => r.homeworkId === homeworkId && !r.deletedAt);
}

/**
 * Record a new attachment in the sheet after upload.
 */
async function createAttachment(homeworkId, uploadResult, originalFilename, uploadedBy) {
  const attachmentId = generateId(PREFIXES.ATTACHMENT || 'att');
  // RAW input: originalFilename is user-supplied and must never be evaluated
  // as a spreadsheet formula.
  await appendRowRaw(SHEETS.HOMEWORK_ATTACHMENTS, [
    attachmentId,
    homeworkId,
    DEFAULT_CLASS_ID,
    uploadResult.publicId,
    uploadResult.resourceType,
    uploadResult.format,
    String(uploadResult.bytes),
    originalFilename,
    uploadedBy,
    nowISO(),
    '', // deletedAt
  ]);

  return {
    attachmentId,
    homeworkId,
    cloudinaryPublicId: uploadResult.publicId,
    secureUrl: uploadResult.secureUrl,
    resourceType: uploadResult.resourceType,
    format: uploadResult.format,
    bytes: uploadResult.bytes,
    originalFilename,
    uploadedBy,
    createdAt: nowISO(),
  };
}

/**
 * Soft-delete an attachment (sets deletedAt). Does NOT delete from Cloudinary
 * immediately — that can be done via a cleanup job.
 */
async function deleteAttachment(attachmentId) {
  const { readSheetWithRows, updateRowRaw } = require('../utils/sheets');
  const rows = await readSheetWithRows(SHEETS.HOMEWORK_ATTACHMENTS);
  const row = rows.find((r) => r.attachmentId === attachmentId && !r.deletedAt);
  if (!row) return null;

  await updateRowRaw(SHEETS.HOMEWORK_ATTACHMENTS, row._rowIndex, [
    row.attachmentId,
    row.homeworkId,
    row.classId || DEFAULT_CLASS_ID,
    row.cloudinaryPublicId,
    row.resourceType,
    row.format,
    row.bytes,
    row.originalFilename,
    row.uploadedBy,
    row.createdAt,
    nowISO(),
  ]);
  return { attachmentId, deleted: true };
}

/**
 * Check if a homework item has room for more attachments.
 */
async function canAddAttachment(homeworkId) {
  const current = await listAttachments(homeworkId);
  return current.length < MAX_ATTACHMENTS_PER_HW;
}

module.exports = {
  listAttachments,
  createAttachment,
  deleteAttachment,
  canAddAttachment,
};
