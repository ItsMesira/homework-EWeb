// server/routes/announcements.js — Announcement routes
const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const { requireRole } = require('../middleware/requireRole');
const { listAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement } = require('../../services/announcementService');

const router = express.Router();

// GET /api/announcements
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const items = await listAnnouncements();
    res.json({ announcements: items });
  } catch (err) { next(err); }
});

// POST /api/announcements — president/teacher only
router.post('/', requireRole('president', 'teacher'), async (req, res, next) => {
  try {
    const { title, body, priority, isPinned, publishedAt, expiresAt } = req.body || {};
    if (!title) return res.status(400).json({ error: 'title is required' });
    const announcement = await createAnnouncement({ title, body, priority, isPinned, publishedAt, expiresAt }, req.principal);
    res.status(201).json(announcement);
  } catch (err) { next(err); }
});

// PATCH /api/announcements/:announcementId — president/teacher only
router.patch('/:announcementId', requireRole('president', 'teacher'), async (req, res, next) => {
  try {
    const announcement = await updateAnnouncement(req.params.announcementId, req.body || {}, req.principal);
    res.json(announcement);
  } catch (err) {
    err.statusCode = err.message.includes('not found') ? 404 : 400;
    next(err);
  }
});

// DELETE /api/announcements/:announcementId — president/teacher only
router.delete('/:announcementId', requireRole('president', 'teacher'), async (req, res, next) => {
  try {
    await deleteAnnouncement(req.params.announcementId);
    res.json({ ok: true });
  } catch (err) {
    err.statusCode = err.message.includes('not found') ? 404 : 400;
    next(err);
  }
});

module.exports = router;
