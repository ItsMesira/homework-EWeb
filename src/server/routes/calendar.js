// server/routes/calendar.js — Calendar routes
const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const { listHomework } = require('../../services/homeworkService');
const { listAnnouncements } = require('../../services/announcementService');
const { parseBangkokDate, formatBangkokDateOnly } = require('../../utils/dates');

const router = express.Router();

// GET /api/calendar?from=&to= — aggregated calendar events
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const from = req.query.from || '';
    const to   = req.query.to || '';

    const [homework, announcements] = await Promise.all([
      listHomework({ from, to, status: 'all' }, req.principal),
      listAnnouncements(),
    ]);

    // Build calendar events
    const events = [];

    for (const hw of homework) {
      const dueDate = parseBangkokDate(hw.dueDate);
      if (dueDate) {
        events.push({
          type: 'homework',
          id: hw.homeworkId,
          title: hw.title,
          subjectCode: hw.subjectCode,
          date: formatBangkokDateOnly(dueDate),
          datetime: hw.dueDate,
          isOverdue: hw.isOverdue,
          completed: hw.completed,
        });
      }
    }

    for (const ann of announcements) {
      if (ann.publishedAt) {
        const pubDate = new Date(ann.publishedAt);
        if (!isNaN(pubDate.getTime())) {
          events.push({
            type: 'announcement',
            id: ann.announcementId,
            title: ann.title,
            date: formatBangkokDateOnly(pubDate),
            isPinned: ann.isPinned,
            priority: ann.priority,
          });
        }
      }
    }

    // Sort by date
    events.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    res.json({ events });
  } catch (err) { next(err); }
});

module.exports = router;
