// server/middleware/csrf.js — CSRF protection (double-submit cookie pattern)
//
// On any safe method (GET/HEAD/OPTIONS), a cookie containing a random CSRF
// token is set if one is not already present. On unsafe methods (POST/PUT/
// PATCH/DELETE), the middleware compares the X-CSRF-Token header against the
// cookie value — they must match.
//
// The cookie is NOT HttpOnly so the browser SPA can read it via
// document.cookie and send it back in the header.

const crypto = require('crypto');
const { COOKIE_NAME } = require('./session');

const CSRF_COOKIE = 'emble-csrf';
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Sets a CSRF cookie on the response if one is not already present on the
 * request. Called for every request so the SPA always has a valid token.
 */
function ensureCsrfCookie(req, res, next) {
  if (!req.cookies[CSRF_COOKIE]) {
    const token = generateToken();
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false, // SPA must read it
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours, matches session
    });
    // Also set on req so subsequent middleware in the same cycle can see it
    req.cookies[CSRF_COOKIE] = token;
  }
  next();
}

/**
 * Validates the double-submit token for unsafe HTTP methods.
 * Must run AFTER cookie-parser and ensureCsrfCookie.
 */
function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // If the user is not authenticated (e.g., login endpoint), skip CSRF —
  // the session cookie itself is the anti-CSRF mechanism for those routes.
  // The auth routes will be mounted before this middleware or exempted.
  const cookieToken = req.cookies[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER] || (req.body && req.body._csrf);

  if (!cookieToken || !headerToken) {
    return res.status(403).json({ error: 'CSRF token missing' });
  }

  if (cookieToken.length !== headerToken.length) {
    return res.status(403).json({ error: 'CSRF token invalid' });
  }

  // Constant-time comparison
  if (!crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
    return res.status(403).json({ error: 'CSRF token mismatch' });
  }

  next();
}

module.exports = {
  CSRF_COOKIE,
  CSRF_HEADER,
  generateToken,
  ensureCsrfCookie,
  csrfProtection,
};
