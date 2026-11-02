// server/routes/timetable.js — Timetable routes + OCR import
const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/requireAuth');
const { requireRole } = require('../middleware/requireRole');
const { getTimetableGrid, upsertCell, batchUpsertCells } = require('../../services/timetableService');
const { createImport, getImport, listImports, confirmImport, rejectImport } = require('../../services/timetableImportService');
const { DEFAULT_TERM, DEFAULT_SCHOOL_YEAR, VISION_ENABLED, GEMINI_API_KEY, OCR_ENABLED, MAX_UPLOAD_BYTES } = require('../../config');
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

// POST /api/timetable/batch — batch upsert timetable cells (president/teacher)
router.post('/batch', requireRole('president', 'teacher'), async (req, res, next) => {
  try {
    const { cells, term = DEFAULT_TERM, schoolYear = DEFAULT_SCHOOL_YEAR } = req.body;
    if (!Array.isArray(cells) || cells.length === 0) {
      return res.status(400).json({ error: 'No cells provided' });
    }
    const updatedBy = `${req.principal.user.firstName} ${req.principal.user.lastName}`.trim() || req.principal.user.discordId;
    const cellsWithMeta = cells.map((c) => ({
      ...c,
      term: parseInt(term, 10),
      schoolYear: parseInt(schoolYear, 10),
    }));
    const results = await batchUpsertCells(cellsWithMeta, updatedBy);
    log(`Timetable batch upserted: ${results.length} cells by ${updatedBy}`);
    res.json({ success: true, count: results.length, results });
  } catch (err) {
    next(err);
  }
});

// ─── OCR Import routes ──────────────────────────────────────────────────────

// POST /api/timetable/import — upload image for OCR (teacher or president)
router.post('/import', requireRole('teacher', 'president'), upload.single('image'), async (req, res, next) => {
  const geminiApiKey = req.headers['x-gemini-key'] || req.body?.geminiApiKey || GEMINI_API_KEY;
  if (!geminiApiKey && !VISION_ENABLED) {
    return res.status(400).json({
      error: 'No AI OCR provider configured. You can paste directly from Google Sheets / Excel for free, or provide a free Gemini API key from https://aistudio.google.com (no credit card required).'
    });
  }
  if (!req.file) return res.status(400).json({ error: 'No image file provided' });

  try {
    const term = parseInt(req.body.term || DEFAULT_TERM, 10);
    const schoolYear = parseInt(req.body.schoolYear || DEFAULT_SCHOOL_YEAR, 10);
    const createdBy = req.principal.user.studentId || req.principal.user.discordId;

    const result = await createImport(req.file.buffer, term, schoolYear, createdBy, geminiApiKey);
    log(`Timetable import created: ${result.importId}`);
    res.status(201).json(result);
  } catch (err) {
    err.statusCode = err.statusCode || 400;
    next(err);
  }
});

// GET /api/timetable/imports — list all imports (teacher/president)
router.get('/imports', requireRole('teacher', 'president'), async (req, res, next) => {
  try {
    const imports = await listImports();
    res.json({ imports });
  } catch (err) { next(err); }
});

// GET /api/timetable/imports/:id — get a specific import draft (teacher/president)
router.get('/imports/:id', requireRole('teacher', 'president'), async (req, res, next) => {
  try {
    const imp = await getImport(req.params.id);
    if (!imp) return res.status(404).json({ error: 'Import not found' });
    res.json(imp);
  } catch (err) { next(err); }
});

// POST /api/timetable/imports/:id/confirm — confirm draft (teacher/president)
router.post('/imports/:id/confirm', requireRole('teacher', 'president'), async (req, res, next) => {
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

// POST /api/timetable/imports/:id/reject — reject draft (teacher/president)
router.post('/imports/:id/reject', requireRole('teacher', 'president'), async (req, res, next) => {
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
