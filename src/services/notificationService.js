// services/notificationService.js — Discord DM + Web Push delivery tracking
//
// Uses persistent NotificationDeliveries rows for idempotency instead of
// the in-memory sentReminders Map (which is lost on restart).
// The in-memory Map in reminders.js is kept for backward compat with the
// existing Discord scheduler; this service adds persistent tracking.

const { SHEETS, DEFAULT_CLASS_ID } = require('../config');
const { readSheet, appendRowRaw } = require('../utils/sheets');
const { nowISO } = require('../utils/dates');

/**
 * Check if a delivery key was already recorded.
 */
async function wasDelivered(deliveryKey) {
  const deliveries = await readSheet(SHEETS.NOTIFICATION_DELIVERIES);
  return deliveries.some((d) => d.deliveryKey === deliveryKey && d.status === 'sent');
}

/**
 * Record a delivery.
 */
async function recordDelivery(deliveryKey, channel, recipientId, status = 'sent') {
  await appendRowRaw(SHEETS.NOTIFICATION_DELIVERIES, [
    deliveryKey, channel, recipientId, status, nowISO(), status === 'sent' ? nowISO() : '',
  ]);
}

/**
 * Record an audit event.
 */
async function audit(classId, actorId, action, entityType, entityId, metadata = {}) {
  const { generateId, PREFIXES } = require('../utils/ids');
  const eventId = generateId(PREFIXES.AUDIT);
  await appendRowRaw(SHEETS.AUDIT_LOG, [
    eventId, classId || DEFAULT_CLASS_ID, actorId, action, entityType, entityId,
    JSON.stringify(metadata), nowISO(),
  ]);
  return { eventId, action, entityType, entityId };
}

module.exports = { wasDelivered, recordDelivery, audit };
