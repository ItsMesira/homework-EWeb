// utils/auth.js — Password hashing and session management
//
// SECURITY IMPROVEMENTS over original:
//   • Passwords are hashed with PBKDF2 (100k iterations, SHA-256) + per-user salt
//     instead of bare unsalted SHA-256, so a leaked sheet can't be rainbow-tabled.
//   • Salt is stored alongside the hash as "salt:hash" in the passwordHash column
//     (the column name stays the same so no sheet migration is needed).
//   • Legacy plain-SHA-256 hashes (no colon) are detected and still verified so
//     existing users don't get locked out — they'll just be prompted to change their
//     password next time (or you can wipe and re-register).
//   • Sessions are cleaned up automatically every 15 minutes to prevent memory leaks
//     on long-running deployments.

const crypto = require('crypto');
const { SESSION_TIMEOUT, SHEETS, ADMIN_ROLE_ID, DEFAULT_CLASS_ID } = require('../config');
const { readSheet } = require('../utils/sheets');

// Discord Administrator permission bitflag (1n << 3n = 8n)
const DISCORD_ADMIN_FLAG = 8n;

// In-memory session store: { discordId -> { studentId, expiresAt } }
const sessions = new Map();

// ─── Hashing ──────────────────────────────────────────────────────────────────

/**
 * Hash a password using PBKDF2 with a fresh random salt.
 * Returns a string in the form "salt:hash" (both hex-encoded).
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 100_000, 32, 'sha256')
    .toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a stored hash.
 * Handles both the new "salt:hash" format AND the legacy bare SHA-256 format
 * so existing users aren't locked out after the upgrade.
 */
function verifyPassword(password, stored) {
  if (!password || !stored || typeof stored !== 'string') return false;
  if (stored.includes(':')) {
    // New format: PBKDF2
    const [salt, expectedHash] = stored.split(':');
    const actualHash = crypto
      .pbkdf2Sync(password, salt, 100_000, 32, 'sha256')
      .toString('hex');
    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(actualHash,    'hex'),
      Buffer.from(expectedHash,  'hex')
    );
  } else {
    // Legacy format: unsalted SHA-256 — still works, just weaker
    const legacyHash = crypto.createHash('sha256').update(password).digest('hex');
    return legacyHash === stored;
  }
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

function createSession(discordId, studentId) {
  sessions.set(discordId, {
    studentId,
    expiresAt: Date.now() + SESSION_TIMEOUT,
  });
}

/**
 * Get an active session, refreshing its expiry on access.
 * Returns null if no session exists or it has expired.
 */
function getSession(discordId) {
  const session = sessions.get(discordId);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(discordId);
    return null;
  }
  // Sliding expiry — reset timer on activity
  session.expiresAt = Date.now() + SESSION_TIMEOUT;
  return session;
}

function destroySession(discordId) {
  sessions.delete(discordId);
}

// ─── Session cleanup (prevents memory leak on long-running bots) ──────────────
// Runs every 15 minutes to evict expired sessions.
const sessionCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now > session.expiresAt) sessions.delete(id);
  }
}, 15 * 60 * 1000);
// Don't keep the process alive (matters for serverless + CLI scripts)
if (sessionCleanupInterval.unref) sessionCleanupInterval.unref();

// ─── Discord role resolution ──────────────────────────────────────────────────

/**
 * Check if a Discord guild member has administrator rights.
 * True if ADMIN_ROLE_ID matches user's Discord ID, user is server owner,
 * has Administrator permission, or has the ADMIN_ROLE_ID role.
 */
function isDiscordAdmin(member) {
  if (!member) return false;

  const memberId = member.id || member.user?.id;
  const adminId = ADMIN_ROLE_ID;

  // 1. Direct User ID match: in case the user configured ADMIN_ROLE_ID with their User ID
  if (adminId && memberId && memberId === adminId) {
    return true;
  }

  // 2. Server owner check
  if (member.guild && memberId && memberId === member.guild.ownerId) {
    return true;
  }

  // 3. Administrator permission check (handles Discord API bitfield or manager)
  if (member.permissions) {
    try {
      if (typeof member.permissions.has === 'function') {
        if (member.permissions.has(DISCORD_ADMIN_FLAG)) return true;
      } else {
        const permsBigInt = BigInt(member.permissions);
        if ((permsBigInt & DISCORD_ADMIN_FLAG) === DISCORD_ADMIN_FLAG) return true;
      }
    } catch { /* ignore bitfield parse error */ }
  }

  // 4. Role ID check (handles both GuildMemberRoleManager and raw string[] arrays)
  if (adminId && member.roles) {
    if (typeof member.roles.cache?.has === 'function') {
      if (member.roles.cache.has(adminId)) return true;
    }
    if (Array.isArray(member.roles)) {
      if (member.roles.includes(adminId)) return true;
    }
  }

  return false;
}

/**
 * Resolve a Discord interaction member's role for content management.
 * Uses the Discord session (for studentId) + guild member roles + PresidentAppointments.
 *
 * @param {object} session — from getSession(discordId)
 * @param {object} member — Discord GuildMember from interaction.member
 * @returns {Promise<'teacher' | 'president' | 'student' | null>}
 */
async function resolveDiscordRole(session, member) {
  if (!session) return null;

  // Teacher: check Discord admin role or permissions
  if (isDiscordAdmin(member)) {
    return 'teacher';
  }

  // President: check PresidentAppointments
  try {
    const appointments = await readSheet(SHEETS.PRESIDENT_APPOINTMENTS);
    const isActive = appointments.some(
      (a) => a.studentId === session.studentId && a.classId === DEFAULT_CLASS_ID && !a.revokedAt
    );
    if (isActive) return 'president';
  } catch { /* sheet might not exist yet */ }

  return 'student';
}

/**
 * Check if a Discord user can manage content (president or teacher).
 * Convenience wrapper around resolveDiscordRole.
 */
async function canManageContentDiscord(session, member) {
  const role = await resolveDiscordRole(session, member);
  return role === 'teacher' || role === 'president';
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  getSession,
  destroySession,
  isDiscordAdmin,
  resolveDiscordRole,
  canManageContentDiscord,
};
