// server/routes/attachments.js — Homework attachment routes
//
// POST   /api/homework/:homeworkId/attachments  — upload (multipart)
// GET    /api/homework/:homeworkId/attachments  — list
// DELETE /api/homework/:homeworkId/attachments/:attachmentId — soft-delete

const express = require('express');
const multer = require('multer');
const { CLOUDINARY_ENABLED, MAX_UPLOAD_BYTES } = require('../../config');
const { requireAuth } = require('../middleware/requireAuth');
const { requireRole } = require('../middleware/requireRole');
const { canManageContent } = require('../../services/authService');
const { listAttachments, createAttachment, deleteAttachment, canAddAttachment } = require('../../services/attachmentService');
const { uploadBuffer, deleteAsset } = require('../integrations/cloudinary');
const { log } = require('../middleware/logger');

const router = express.Router();

// Multer: in-memory storage, 10MB limit, images + PDFs only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (req, file, cb) => {
    const allowed = /^image\/(jpeg|png|gif|webp)$|^application\/pdf$/;
    if (allowed.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only images (JPEG, PNG, GIF, WebP) and PDF files are allowed'));
  },
});

// All attachment routes require auth
router.use(requireAuth);

// ─── GET /api/homework/:homeworkId/attachments ──────────────────────────────
router.get('/:homeworkId/attachments', async (req, res, next) => {
  try {
    const attachments = await listAttachments(req.params.homeworkId);
    res.json({ attachments });
  } catch (err) { next(err); }
});

// ─── POST /api/homework/:homeworkId/attachments ─────────────────────────────
// Only presidents and teachers can upload
router.post('/:homeworkId/attachments', async (req, res, next) => {
  // Check permission first — multer runs after this
  if (!canManageContent(req.principal)) {
    return res.status(403).json({ error: 'Only presidents and teachers can upload attachments' });
  }
  if (!CLOUDINARY_ENABLED) {
    return res.status(503).json({ error: 'File uploads are not configured' });
  }

  // Run multer manually to handle the file
  upload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    try {
      const { homeworkId } = req.params;

      // Check attachment count limit
      const canAdd = await canAddAttachment(homeworkId);
      if (!canAdd) {
        return res.status(400).json({ error: 'Maximum attachments reached for this homework' });
      }

      const uploadedBy = `${req.principal.user.firstName} ${req.principal.user.lastName}`.trim() ||
        req.principal.user.studentId;

      const result = await uploadBuffer(req.file.buffer, {
        folder: `emble/homework/${homeworkId}`,
        resourceType: req.file.mimetype.startsWith('image/') ? 'image' : 'raw',
      });

      const attachment = await createAttachment(
        homeworkId,
        result,
        req.file.originalname,
        uploadedBy
      );

      log(`Attachment uploaded: ${attachment.attachmentId} for ${homeworkId}`);
      res.status(201).json({ attachment });
    } catch (err) {
      next(err);
    }
  });
});

// ─── DELETE /api/homework/:homeworkId/attachments/:attachmentId ──────────────
router.delete('/:homeworkId/attachments/:attachmentId', async (req, res, next) => {
  try {
    if (!canManageContent(req.principal)) {
      return res.status(403).json({ error: 'Only presidents and teachers can delete attachments' });
    }

    const { attachmentId } = req.params;
    const result = await deleteAttachment(attachmentId);
    if (!result) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Best-effort Cloudinary cleanup (don't block on it)
    if (CLOUDINARY_ENABLED) {
      deleteAsset(result.cloudinaryPublicId).catch(() => {});
    }

    log(`Attachment deleted: ${attachmentId}`);
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

module.exports = router;
