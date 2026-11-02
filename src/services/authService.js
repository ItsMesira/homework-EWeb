// services/authService.js — Principal creation and role resolution
//
// A "principal" is the authenticated user in a web request context.
// Roles: 'student' | 'president' | 'teacher'
//
// Teacher status comes from Discord guild membership + ADMIN_ROLE_ID.
// President status comes from an active PresidentAppointments row.
// Student status is the default for active class members.

const crypto = require('crypto');
const { SHEETS, ADMIN_ROLE_ID, GUILD_ID, DEFAULT_CLASS_ID, BROWSER_SESSION_IDLE, BROWSER_SESSION_ABSOLUTE, SESSION_SECRET } = require('../config');
const { readSheet } = require('../utils/sheets');
const { hashPassword, verifyPassword, isDiscordAdmin } = require('../utils/auth');
const { nowISO } = require('../utils/dates');
const { generateId, PREFIXES } = require('../utils/ids');

// In-memory browser session store (acts as L1 cache for serverless & fast lookups)
// key: sessionToken → { studentId, discordId, role, classId, createdAt, lastAccess }
const browserSessions = new Map();

// Cleanup expired sessions every 15 minutes (unref so it does not prevent serverless shutdown)
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [token, sess] of browserSessions) {
    if (now - sess.lastAccess > BROWSER_SESSION_IDLE || now - sess.createdAt > BROWSER_SESSION_ABSOLUTE) {
      browserSessions.delete(token);
    }
  }
}, 15 * 60 * 1000);
if (cleanupInterval.unref) cleanupInterval.unref();

/**
 * Resolve a user's role from their studentId and Discord ID.
 * @param {string} studentId
 * @param {string} discordId
 * @param {object} guildMember — Discord guild member (for teacher check)
 * @returns {Promise<{ role: string, classId: string, user: object }>}
 */
async function resolvePrincipal(studentId, discordId, guildMember) {
  const users = await readSheet(SHEETS.USERS);
  const user  = users.find((u) =>
    (studentId && u.studentId === studentId) ||
    (discordId && u.discordId === discordId)
  );

  // Teacher: Discord admin role, administrator permission, or server owner
  let role = 'student';
  if (isDiscordAdmin(guildMember)) {
    role = 'teacher';
  }

  // President: active appointment
  if (role !== 'teacher' && user) {
    const appointments = await readSheet(SHEETS.PRESIDENT_APPOINTMENTS);
    const isActive = appointments.some(
      (a) => a.studentId === user.studentId && a.classId === DEFAULT_CLASS_ID && !a.revokedAt
    );
    if (isActive) role = 'president';
  }

  // Deactivated accounts cannot sign in, even via Discord OAuth
  if (user && user.isActive === 'false') {
    return null;
  }

  // If user not found but is a teacher, they can still access
  if (!user && role !== 'teacher') {
    return null;
  }

  return {
    role,
    classId: DEFAULT_CLASS_ID,
    user: user ? {
      discordId:   user.discordId,
      firstName:   user.firstName,
      lastName:    user.lastName,
      studentId:   user.studentId,
      isActive:    user.isActive !== 'false', // blank = active
    } : { discordId, firstName: 'Teacher', lastName: '', studentId: '', isActive: true },
  };
}

/**
 * Authenticate a student by student ID + password.
 * If discordClient is provided and user has a linked discordId, resolves teacher status.
 * @returns {Promise<{ principal: object } | null>}
 */
async function loginWithPassword(studentId, password, discordClient = null) {
  const users = await readSheet(SHEETS.USERS);
  const user  = users.find((u) => u.studentId === studentId);

  if (!user) return null;
  if (user.isActive === 'false') return null;
  if (!verifyPassword(password, user.passwordHash)) return null;

  let role = 'student';

  // Check if user is an admin / teacher in the Discord guild
  if (user.discordId) {
    try {
      let member = null;
      if (discordClient) {
        const guild = await discordClient.guilds.fetch(GUILD_ID);
        member = await guild.members.fetch(user.discordId);
      } else {
        const { fetchGuildMember } = require('../server/integrations/discordOAuth');
        member = await fetchGuildMember(user.discordId);
      }
      if (member && isDiscordAdmin(member)) {
        role = 'teacher';
      }
    } catch { /* guild or member fetch error */ }
  }

  // If not teacher, check if president
  if (role !== 'teacher') {
    const appointments = await readSheet(SHEETS.PRESIDENT_APPOINTMENTS);
    const isPresident = appointments.some(
      (a) => a.studentId === user.studentId && a.classId === DEFAULT_CLASS_ID && !a.revokedAt
    );
    if (isPresident) role = 'president';
  }

  return {
    role,
    classId: DEFAULT_CLASS_ID,
    user: {
      discordId: user.discordId,
      firstName: user.firstName,
      lastName:  user.lastName,
      studentId: user.studentId,
      isActive:  true,
    },
  };
}

// Encode session payload as base64url + HMAC-SHA256 signature using SESSION_SECRET
function signSessionPayload(data) {
  const payloadStr = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payloadStr).digest('base64url');
  return `${payloadStr}.${signature}`;
}

function verifySessionPayload(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadStr, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payloadStr).digest('base64url');
  if (signature.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) return null;

  try {
    const data = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    const now = Date.now();
    if (data.exp && now > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Create a browser session token (HMAC-signed for serverless resilience).
 * @returns {string} session token
 */
function createBrowserSession(principal) {
  const now = Date.now();
  const sessionData = {
    studentId:  principal.user.studentId,
    discordId:  principal.user.discordId,
    role:       principal.role,
    classId:    principal.classId,
    firstName:  principal.user.firstName,
    lastName:   principal.user.lastName,
    createdAt:  now,
    lastAccess: now,
    exp:        now + BROWSER_SESSION_ABSOLUTE,
  };
  const token = signSessionPayload(sessionData);
  browserSessions.set(token, sessionData);
  return token;
}

/**
 * Get a browser session, refreshing idle expiry.
 * Works seamlessly across Vercel serverless instances.
 * @returns {object | null}
 */
function getBrowserSession(token) {
  if (!token) return null;
  const now = Date.now();

  // 1. Check fast in-memory map
  const sess = browserSessions.get(token);
  if (sess) {
    if (now - sess.lastAccess > BROWSER_SESSION_IDLE || now - sess.createdAt > BROWSER_SESSION_ABSOLUTE) {
      browserSessions.delete(token);
      return null;
    }
    sess.lastAccess = now;
    return sess;
  }

  // 2. Stateless HMAC verification (for new Vercel serverless lambdas)
  const data = verifySessionPayload(token);
  if (!data) return null;
  if (data.lastAccess && (now - data.lastAccess > BROWSER_SESSION_IDLE)) {
    if (now - data.createdAt > BROWSER_SESSION_ABSOLUTE) return null;
  }
  data.lastAccess = now;
  browserSessions.set(token, data);
  return data;
}

/**
 * Destroy a browser session.
 */
function destroyBrowserSession(token) {
  browserSessions.delete(token);
}

/**
 * Check if a principal has at least one of the given roles.
 */
function hasRole(principal, ...roles) {
  if (!principal) return false;
  return roles.includes(principal.role);
}

/**
 * Check if a principal can manage class content (president or teacher).
 */
function canManageContent(principal) {
  return hasRole(principal, 'president', 'teacher');
}

/**
 * Check if a principal is a teacher.
 */
function isTeacher(principal) {
  return hasRole(principal, 'teacher');
}

module.exports = {
  resolvePrincipal,
  loginWithPassword,
  createBrowserSession,
  getBrowserSession,
  destroyBrowserSession,
  hasRole,
  canManageContent,
  isTeacher,
};
