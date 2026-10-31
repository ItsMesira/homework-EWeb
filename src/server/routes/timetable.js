// server/routes/timetable.js — Timetable routes + OCR import
const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/requireAuth');
const { requireRole } = require('../middleware/requireRole');
const { getTimetableGrid, upsertCell } = require('../../services/timetableService');
const { createImport, getImport, listImports, confirmImport, rejectImport } = require('../../services/timetableImportService');
const { DEFAULT_TERM, DEFAULT_SCHOOL_YEAR, VISION_ENABLED, MAX_UPLOAD_BYTES } = require('../../config');
const { log } = require('../middleware/logger');

const router = express.Router();

// Multer for OCR image upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are accepted for OCR'));
  },
});

// GET /api/timetable?term=&schoolYear=
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const term = parseInt(req.query.term || DEFAULT_TERM, 10);
    const schoolYear = parseInt(req.query.schoolYear || DEFAULT_SCHOOL_YEAR, 10);
    const grid = await getTimetableGrid(term, schoolYear);
    res.json({ grid, term, schoolYear });
  } catch (err) { next(err); }
});

// PUT /api/timetable/:term/:schoolYear/:day/:period — president/teacher only
router.put('/:term/:schoolYear/:day/:period', requireRole('president', 'teacher'), async (req, res, next) => {
  try {
    const term = parseInt(req.params.term, 10);
    const schoolYear = parseInt(req.params.schoolYear, 10);
    const day = parseInt(req.params.day, 10);
    const period = parseInt(req.params.period, 10);

    const updatedBy = `${req.principal.user.firstName} ${req.principal.user.lastName}`.trim() || req.principal.user.discordId;
    const cell = await upsertCell(day, period, { ...req.body, term, schoolYear }, updatedBy);
    res.json(cell);
  } catch (err) {
    err.statusCode = 400;
    next(err);
  }
});

// ─── OCR Import routes ──────────────────────────────────────────────────────

// POST /api/timetable/import — upload image for OCR (teacher only)
router.post('/import', requireRole('teacher'), upload.single('image'), async (req, res, next) => {
  if (!VISION_ENABLED) return res.status(503).json({ error: 'OCR import is not configured' });
  if (!req.file) return res.status(400).json({ error: 'No image file provided' });

  try {
    const term = parseInt(req.body.term || DEFAULT_TERM, 10);
    const schoolYear = parseInt(req.body.schoolYear || DEFAULT_SCHOOL_YEAR, 10);
    const createdBy = req.principal.user.studentId || req.principal.user.discordId;

    const result = await createImport(req.file.buffer, term, schoolYear, createdBy);
    log(`Timetable import created: ${result.importId}`);
    res.status(201).json(result);
  } catch (err) {
    err.statusCode = err.statusCode || 500;
    next(err);
  }
});

// GET /api/timetable/imports — list all imports (teacher only)
router.get('/imports', requireRole('teacher'), async (req, res, next) => {
  try {
    const imports = await listImports();
    res.json({ imports });
  } catch (err) { next(err); }
});

// GET /api/timetable/imports/:id — get a specific import draft (teacher only)
router.get('/imports/:id', requireRole('teacher'), async (req, res, next) => {
  try {
    const imp = await getImport(req.params.id);
    if (!imp) return res.status(404).json({ error: 'Import not found' });
    res.json(imp);
  } catch (err) { next(err); }
});

// POST /api/timetable/imports/:id/confirm — confirm draft (teacher only)
router.post('/imports/:id/confirm', requireRole('teacher'), async (req, res, next) => {
  try {
    const confirmedBy = req.principal.user.studentId || req.principal.user.discordId;
    const { grid, forceOverwrite } = req.body || {};
    const result = await confirmImport(req.params.id, grid, confirmedBy, !!forceOverwrite);
    log(`Timetable import confirmed: ${req.params.id}, ${result.upserted} cells`);
    res.json(result);
  } catch (err) {
    err.statusCode = err.message.includes('not found') ? 404 : err.message.includes('cannot') ? 400 : 500;
    next(err);
  }
});

// POST /api/timetable/imports/:id/reject — reject draft (teacher only)
router.post('/imports/:id/reject', requireRole('teacher'), async (req, res, next) => {
  try {
    const result = await rejectImport(req.params.id);
    log(`Timetable import rejected: ${req.params.id}`);
    res.json(result);
  } catch (err) {
    err.statusCode = err.message.includes('not found') ? 404 : err.message.includes('cannot') ? 400 : 500;
    next(err);
  }
});

module.exports = router;
