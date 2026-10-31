// server/routes/subjects.js — Subject CRUD routes
const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const { requireRole } = require('../middleware/requireRole');
const { listSubjects, getSubject, createSubject, updateSubject, deleteSubject } = require('../../services/subjectService');

const router = express.Router();

// GET /api/subjects
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const subjects = await listSubjects();
    res.json({ subjects });
  } catch (err) { next(err); }
});

// POST /api/subjects — president/teacher only
router.post('/', requireRole('president', 'teacher'), async (req, res, next) => {
  try {
    const { subjectCode, subjectName, credits, instructor } = req.body || {};
    if (!subjectCode) return res.status(400).json({ error: 'subjectCode is required' });
    const subject = await createSubject({ subjectCode, subjectName, credits, instructor }, req.principal);
    res.status(201).json(subject);
  } catch (err) {
    err.statusCode = err.message.includes('already exists') ? 409 : 400;
    next(err);
  }
});

// PATCH /api/subjects/:subjectCode — president/teacher only
router.patch('/:subjectCode', requireRole('president', 'teacher'), async (req, res, next) => {
  try {
    const subject = await updateSubject(req.params.subjectCode, req.body || {}, req.principal);
    res.json(subject);
  } catch (err) {
    err.statusCode = err.message.includes('not found') ? 404 : 400;
    next(err);
  }
});

// DELETE /api/subjects/:subjectCode — president/teacher only
router.delete('/:subjectCode', requireRole('president', 'teacher'), async (req, res, next) => {
  try {
    await deleteSubject(req.params.subjectCode);
    res.json({ ok: true });
  } catch (err) {
    err.statusCode = err.message.includes('not found') ? 404 : 400;
    next(err);
  }
});

module.exports = router;
