// utils/ids.js — Shared ID generation
//
// Uses crypto.randomUUID (Node 18+) combined with a prefix for human-readable IDs.

const crypto = require('crypto');

/**
 * Generate a prefixed ID: PREFIX-timestamp-random
 * e.g. "HW-1735900000000-a1b2"
 */
function generateId(prefix) {
  const random = crypto.randomBytes(4).toString('hex');
  return `${prefix}-${Date.now()}-${random}`;
}

/**
 * Generate a short random ID (8 chars hex).
 */
function shortId() {
  return crypto.randomBytes(4).toString('hex');
}

/**
 * Generate a UUID v4 string.
 */
function uuid() {
  return crypto.randomUUID();
}

// Common prefixes
const PREFIXES = {
  HOMEWORK:    'HW',
  SUBJECT:     'SUB',
  COMPLETION:  'CMP',
  ANNOUNCEMENT: 'ANN',
  TIMETABLE:   'TT',
  IMPORT:      'IMP',
  APPOINTMENT: 'APR',
  ATTACHMENT:  'ATT',
  AUDIT:       'AUD',
  SUBSCRIPTION: 'PSH',
  DELIVERY:    'DLV',
};

module.exports = { generateId, shortId, uuid, PREFIXES };
