// utils/dates.js — Asia/Bangkok-safe date parsing and formatting
//
// Existing homework dueDate values are timezone-less "YYYY-MM-DD HH:mm" strings.
// We treat them as Asia/Bangkok local time and never silently reinterpret them.

const TZ = 'Asia/Bangkok';

/**
 * Parse a "YYYY-MM-DD HH:mm" string as an Asia/Bangkok local time.
 * Returns a Date object (UTC-adjusted) or null if invalid.
 *
 * @param {string} str — e.g. "2025-12-31 23:59"
 * @returns {Date|null}
 */
function parseBangkokDate(str) {
  if (!str || typeof str !== 'string') return null;
  // Replace space with T for ISO-ish parsing, then treat as Bangkok time
  const normalized = str.includes('T') ? str : str.replace(' ', 'T');
  // Interpret as Bangkok time by appending +07:00 if no offset is present
  const withTZ = /[+-]\d{2}:?\d{2}$/.test(normalized) || normalized.endsWith('Z')
    ? normalized
    : normalized + '+07:00';
  const d = new Date(withTZ);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format a Date (or timestamp) as "YYYY-MM-DD HH:mm" in Asia/Bangkok.
 */
function formatBangkokDate(date) {
  const d = typeof date === 'number' ? new Date(date) : date;
  if (!d || isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d).replace(',', '');
}

/**
 * Format a Date as ISO date only "YYYY-MM-DD" in Asia/Bangkok.
 */
function formatBangkokDateOnly(date) {
  const d = typeof date === 'number' ? new Date(date) : date;
  if (!d || isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Get the current time as an ISO string.
 */
function nowISO() {
  return new Date().toISOString();
}

/**
 * Get the current Bangkok date+time as "YYYY-MM-DD HH:mm".
 */
function nowBangkok() {
  return formatBangkokDate(new Date());
}

/**
 * Get the day of week (1=Monday ... 5=Friday) for a date in Bangkok timezone.
 * Returns 0 for weekends.
 */
function getDayOfWeek(date) {
  const d = typeof date === 'number' ? new Date(date) : date;
  if (!d || isNaN(d.getTime())) return 0;
  const dow = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
  }).format(d);
  const map = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5 };
  return map[dow] || 0;
}

/**
 * Format a Buddhist (BE) year date for display in Thai.
 * Converts Gregorian year to BE (year + 543).
 */
function formatThaiDate(date) {
  const d = typeof date === 'number' ? new Date(date) : date;
  if (!d || isNaN(d.getTime())) return '';
  const gregorianYear = parseInt(new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric',
  }).format(d));
  const beYear = gregorianYear + 543;
  const rest = new Intl.DateTimeFormat('th-TH', {
    timeZone: TZ,
    month: 'long',
    day: 'numeric',
  }).format(d);
  return `${rest} ${beYear}`;
}

/**
 * Check if a date string is in the past (in Bangkok time).
 */
function isOverdue(dateStr) {
  const d = parseBangkokDate(dateStr);
  if (!d) return false;
  return d.getTime() < Date.now();
}

/**
 * Get a human-readable relative time in Thai.
 * e.g. "อีก 3 วัน", "เลยกำหนด 2 ชั่วโมง"
 */
function relativeTimeThai(dateStr) {
  const d = parseBangkokDate(dateStr);
  if (!d) return '';
  const diff = d.getTime() - Date.now();
  const absDiff = Math.abs(diff);
  const isPast = diff < 0;

  const dayMs  = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  const minMs  = 60 * 1000;

  if (absDiff >= dayMs) {
    const days = Math.floor(absDiff / dayMs);
    return isPast ? `เลยกำหนด ${days} วัน` : `อีก ${days} วัน`;
  }
  if (absDiff >= hourMs) {
    const hours = Math.floor(absDiff / hourMs);
    return isPast ? `เลยกำหนด ${hours} ชั่วโมง` : `อีก ${hours} ชั่วโมง`;
  }
  const mins = Math.floor(absDiff / minMs);
  return isPast ? `เลยกำหนด ${mins} นาที` : `อีก ${mins} นาที`;
}

module.exports = {
  TZ,
  parseBangkokDate,
  formatBangkokDate,
  formatBangkokDateOnly,
  nowISO,
  nowBangkok,
  getDayOfWeek,
  formatThaiDate,
  isOverdue,
  relativeTimeThai,
};
