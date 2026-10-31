// server/routes/homework.js — Homework CRUD routes
const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const { requireRole } = require('../middleware/requireRole');
const { listHomework, getHomework, createHomework, updateHomework, deleteHomework } = require('../../services/homeworkService');
const { sendNewHomeworkDM } = require('../../utils/reminders');
const { audit } = require('../../services/notificationService');

const router = express.Router();

// GET /api/homework — list with filters
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const filters = {
      from:        req.query.from,
      to:          req.query.to,
      subjectCode: req.query.subjectCode,
      status:      req.query.status,
      search:      req.query.search,
    };
    const items = await listHomework(filters, req.principal);
    res.json({ homework: items });
  } catch (err) { next(err); }
});

// GET /api/homework/:homeworkId
router.get('/:homeworkId', requireAuth, async (req, res, next) => {
  try {
    const hw = await getHomework(req.params.homeworkId, req.principal);
    if (!hw) return res.status(404).json({ error: 'Homework not found' });
    res.json(hw);
  } catch (err) { next(err); }
});

// POST /api/homework — president/teacher only
router.post('/', requireRole('president', 'teacher'), async (req, res, next) => {
  try {
    const { subjectCode, title, details, imageUrl, link, dueDate } = req.body || {};
    if (!subjectCode || !title || !dueDate) {
      return res.status(400).json({ error: 'subjectCode, title, and dueDate are required' });
    }
    const hw = await createHomework({ subjectCode, title, details, imageUrl, link, dueDate }, req.principal);

    // Fire Discord DM notification (fire-and-forget)
    const clientRef = req.app.get('discordClient');
    if (clientRef) {
      sendNewHomeworkDM(clientRef, hw).catch(() => {});
    }

    // Audit
    await audit(req.principal.classId, req.principal.user.discordId || req.principal.user.studentId, 'create_homework', 'homework', hw.homeworkId);

    res.status(201).json(hw);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/homework/:homeworkId — president/teacher only
router.patch('/:homeworkId', requireRole('president', 'teacher'), async (req, res, next) => {
  try {
    const updates = req.body || {};
    const hw = await updateHomework(req.params.homeworkId, updates, req.principal);
    res.json(hw);
  } catch (err) {
    err.statusCode = err.message.includes('not found') ? 404 : 400;
    next(err);
  }
});

// DELETE /api/homework/:homeworkId — president/teacher only
router.delete('/:homeworkId', requireRole('president', 'teacher'), async (req, res, next) => {
  try {
    await deleteHomework(req.params.homeworkId);
    await audit(req.principal.classId, req.principal.user.discordId || req.principal.user.studentId, 'delete_homework', 'homework', req.params.homeworkId);
    res.json({ ok: true });
  } catch (err) {
    err.statusCode = err.message.includes('not found') ? 404 : 400;
    next(err);
  }
});

module.exports = router;
