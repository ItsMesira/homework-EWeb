// server/routes/meta.js — Class metadata routes
const express = require('express');
const { getClass } = require('../../services/classService');
const { cookieSessionMiddleware } = require('../middleware/session');

const router = express.Router();

// GET /api/meta/class — public class info (no auth required)
router.get('/class', async (req, res, next) => {
  try {
    const cls = await getClass();
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    res.json(cls);
  } catch (err) { next(err); }
});

module.exports = router;
