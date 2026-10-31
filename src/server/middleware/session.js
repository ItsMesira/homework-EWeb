// server/middleware/session.js — Browser cookie session middleware
//
// Reads a signed session token from the __Host-emble-session cookie
// (or emble-session in dev) and attaches req.principal.

const cookieParser = require('cookie-parser');
const { WEB_ENABLED, SESSION_SECRET } = require('../../config');
const { getBrowserSession } = require('../../services/authService');

const COOKIE_NAME = 'emble-session';

function cookieSessionMiddleware(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) {
    req.principal = null;
    return next();
  }

  const session = getBrowserSession(token);
  if (!session) {
    res.clearCookie(COOKIE_NAME);
    req.principal = null;
    return next();
  }

  req.principal = {
    role: session.role,
    classId: session.classId,
    user: {
      discordId: session.discordId,
      firstName: session.firstName,
      lastName: session.lastName,
      studentId: session.studentId,
      isActive: true,
    },
  };
  next();
}

module.exports = { cookieParser, COOKIE_NAME, cookieSessionMiddleware };
