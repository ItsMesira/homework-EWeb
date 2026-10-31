// server/middleware/requireRole.js — Require specific roles
const { requireAuth } = require('./requireAuth');

/**
 * Middleware factory: require one or more roles.
 * Usage: router.post('/homework', requireRole('president', 'teacher'), handler)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (!roles.includes(req.principal.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      next();
    });
  };
}

module.exports = { requireRole };
