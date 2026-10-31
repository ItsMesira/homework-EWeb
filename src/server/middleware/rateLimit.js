// server/middleware/rateLimit.js — Rate limiting configurations
//
// Uses express-rate-limit to create two limiters:
// 1. authLimiter   — strict, for login/OAuth endpoints (prevents brute force)
// 2. apiLimiter    — moderate, for general authenticated API calls
// 3. uploadLimiter — permissive, for file upload endpoints

const rateLimit = require('express-rate-limit');
const { log } = require('./logger');

// Auth rate limiter: 10 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' },
  handler: (req, res) => {
    log('[RateLimit] Auth throttled:', req.ip);
    res.status(429).json({ error: 'Too many authentication attempts. Please try again later.' });
  },
  // Skip successful requests — only count failures
  skipSuccessfulRequests: true,
});

// General API rate limiter: 200 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
  handler: (req, res) => {
    log('[RateLimit] API throttled:', req.ip, req.path);
    res.status(429).json({ error: 'Too many requests. Please slow down.' });
  },
});

// Upload rate limiter: 20 uploads per 15 minutes per IP
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many upload attempts. Please try again later.' },
});

module.exports = { authLimiter, apiLimiter, uploadLimiter };
