// server/routes/completion.js — Completion tracking routes
const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const { markComplete, unmarkComplete, getMyCompletions } = require('../../services/completionService');

const router = express.Router();

// GET /api/completion/mine
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const completions = await getMyCompletions(req.principal.user.studentId);
    res.json({ completions });
  } catch (err) { next(err); }
});

// PUT /api/homework/:homeworkId/completion — mark complete (own record only)
router.put('/:homeworkId/completion', requireAuth, async (req, res, next) => {
  try {
    const result = await markComplete(req.params.homeworkId, req.principal.user.studentId);
    res.json(result);
  } catch (err) { next(err); }
});

// DELETE /api/homework/:homeworkId/completion — unmark complete (own record only)
router.delete('/:homeworkId/completion', requireAuth, async (req, res, next) => {
  try {
    const result = await unmarkComplete(req.params.homeworkId, req.principal.user.studentId);
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
