// services/pushService.js — Push subscription storage with AES-256-GCM encryption
//
// Push subscriptions contain sensitive keys (p256dh, auth) that must be
// encrypted at rest. We use AES-256-GCM with a key derived from SESSION_SECRET.

const crypto = require('crypto');
const { SHEETS, DEFAULT_CLASS_ID, SESSION_SECRET } = require('../config');
const { appendRow, readSheet, readSheetWithRows, updateRow, updateRowRaw } = require('../utils/sheets');
const { generateId, PREFIXES } = require('../utils/ids');
const { nowISO } = require('../utils/dates');

// Derive a 32-byte key from SESSION_SECRET using SHA-256
const ENCRYPTION_KEY = crypto.createHash('sha256').update(SESSION_SECRET).digest();

/**
 * Encrypt a push subscription JSON string.
 * Returns "iv:ciphertext:authTag" (all base64).
 */
function encryptSubscription(subscriptionObj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const plaintext = JSON.stringify(subscriptionObj);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${encrypted}:${authTag.toString('base64')}`;
}

/**
 * Decrypt an encrypted subscription string.
 * Returns the original subscription object.
 */
function decryptSubscription(encryptedStr) {
  const [ivB64, ciphertextB64, authTagB64] = encryptedStr.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertextB64, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

/**
 * Hash an endpoint URL for deduplication (SHA-256, hex).
 */
function hashEndpoint(endpoint) {
  return crypto.createHash('sha256').update(endpoint).digest('hex');
}

/**
 * Subscribe a user to push notifications.
 * @param {string} studentId
 * @param {object} subscription — { endpoint, keys: { p256dh, auth } }
 * @returns {Promise<{ subscriptionId: string }>}
 */
async function subscribe(studentId, subscription) {
  const endpointHash = hashEndpoint(subscription.endpoint);

  // Check if this endpoint is already subscribed (for any user)
  const existing = await readSheet(SHEETS.PUSH_SUBSCRIPTIONS);
  const dup = existing.find(
    (s) => s.endpointHash === endpointHash && !s.revokedAt
  );
  if (dup) {
    // Already subscribed — update the encrypted subscription in case keys changed
    const rows = await readSheetWithRows(SHEETS.PUSH_SUBSCRIPTIONS);
    const row = rows.find((r) => r.endpointHash === endpointHash && !r.revokedAt);
    if (row) {
      row.encryptedSubscription = encryptSubscription(subscription);
      await updateRowRaw(SHEETS.PUSH_SUBSCRIPTIONS, row._rowIndex, [
        row.subscriptionId,
        row.classId || DEFAULT_CLASS_ID,
        row.studentId,
        row.endpointHash,
        row.encryptedSubscription,
        row.createdAt,
        row.revokedAt || '',
      ]);
      return { subscriptionId: row.subscriptionId };
    }
  }

  const subscriptionId = generateId(PREFIXES.SUBSCRIPTION);
  await appendRow(SHEETS.PUSH_SUBSCRIPTIONS, [
    subscriptionId,
    DEFAULT_CLASS_ID,
    studentId,
    endpointHash,
    encryptSubscription(subscription),
    nowISO(),
    '', // revokedAt
  ]);

  return { subscriptionId };
}

/**
 * Unsubscribe (revoke) a subscription by endpoint hash.
 */
async function unsubscribe(studentId, endpoint) {
  const endpointHash = hashEndpoint(endpoint);
  const rows = await readSheetWithRows(SHEETS.PUSH_SUBSCRIPTIONS);
  const row = rows.find(
    (r) => r.endpointHash === endpointHash && r.studentId === studentId && !r.revokedAt
  );
  if (!row) return false;

  row.revokedAt = nowISO();
  await updateRowRaw(SHEETS.PUSH_SUBSCRIPTIONS, row._rowIndex, [
    row.subscriptionId,
    row.classId || DEFAULT_CLASS_ID,
    row.studentId,
    row.endpointHash,
    row.encryptedSubscription,
    row.createdAt,
    row.revokedAt,
  ]);
  return true;
}

/**
 * Get all active subscriptions for a user.
 * Returns decrypted subscription objects ready for web-push.
 */
async function getActiveSubscriptions(studentId) {
  const rows = await readSheet(SHEETS.PUSH_SUBSCRIPTIONS);
  const active = rows.filter(
    (r) => r.studentId === studentId && !r.revokedAt && r.encryptedSubscription
  );
  return active.map((r) => ({
    subscriptionId: r.subscriptionId,
    ...decryptSubscription(r.encryptedSubscription),
  }));
}

/**
 * Get all active subscriptions for a class (for broadcast notifications).
 */
async function getClassSubscriptions() {
  const rows = await readSheet(SHEETS.PUSH_SUBSCRIPTIONS);
  const active = rows.filter(
    (r) => r.classId === DEFAULT_CLASS_ID && !r.revokedAt && r.encryptedSubscription
  );
  return active.map((r) => ({
    subscriptionId: r.subscriptionId,
    studentId: r.studentId,
    ...decryptSubscription(r.encryptedSubscription),
  }));
}

module.exports = {
  subscribe,
  unsubscribe,
  getActiveSubscriptions,
  getClassSubscriptions,
};
