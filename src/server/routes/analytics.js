// server/routes/analytics.js — Analytics and CSV export routes
const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const { requireRole } = require('../middleware/requireRole');
const { getMyAnalytics, getClassAnalytics, exportHomeworkCSV, exportStudentsCSV } = require('../../services/analyticsService');

const router = express.Router();

// GET /api/analytics/me — personal analytics
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const analytics = await getMyAnalytics(req.principal.user.studentId);
    res.json(analytics);
  } catch (err) { next(err); }
});

// GET /api/analytics/class — class analytics (president/teacher only)
router.get('/class', requireRole('president', 'teacher'), async (req, res, next) => {
  try {
    const analytics = await getClassAnalytics(req.query);
    res.json(analytics);
  } catch (err) { next(err); }
});

// GET /api/analytics/export?type=homework|students — CSV export (president/teacher only)
router.get('/export', requireRole('president', 'teacher'), async (req, res, next) => {
  try {
    const type = req.query.type || 'homework';
    const analytics = await getClassAnalytics(req.query);

    let csv;
    let filename;
    if (type === 'students') {
      csv = exportStudentsCSV(analytics.studentStats);
      filename = 'students.csv';
    } else {
      csv = exportHomeworkCSV(analytics.homeworkStats);
      filename = 'homework.csv';
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) { next(err); }
});

module.exports = router;
