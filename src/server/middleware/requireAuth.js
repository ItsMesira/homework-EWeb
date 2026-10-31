// server/middleware/requireAuth.js — Require an authenticated session
const { cookieSessionMiddleware } = require('./session');

function requireAuth(req, res, next) {
  // Run session middleware first
  cookieSessionMiddleware(req, res, () => {
    if (!req.principal) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    next();
  });
}

module.exports = { requireAuth };
