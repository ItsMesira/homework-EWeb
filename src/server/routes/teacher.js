// server/routes/teacher.js — Teacher-only administration routes
const express = require('express');
const { requireRole } = require('../middleware/requireRole');
const { listUsers, provisionUser, updateUser, deactivateUser, deleteUser } = require('../../services/userService');
const { listPresidents, appointPresident, revokePresident, getClass } = require('../../services/classService');
const { readSheet, readSheetWithRows, appendRowRaw, updateRowRaw } = require('../../utils/sheets');
const { SHEETS } = require('../../config');
const { audit } = require('../../services/notificationService');

const router = express.Router();

// All routes require teacher role
router.use(requireRole('teacher'));

// ─── Users ────────────────────────────────────────────────────────────────────

// GET /api/teacher/users
router.get('/users', async (req, res, next) => {
  try {
    const users = await listUsers();
    res.json({ users });
  } catch (err) { next(err); }
});

// POST /api/teacher/users
router.post('/users', async (req, res, next) => {
  try {
    const { firstName, lastName, studentId, password, discordId } = req.body || {};
    if (!firstName || !lastName || !studentId || !password) {
      return res.status(400).json({ error: 'firstName, lastName, studentId, and password are required' });
    }
    const user = await provisionUser({ firstName, lastName, studentId, password, discordId });
    await audit(req.principal.classId, req.principal.user.discordId, 'provision_user', 'user', studentId);
    res.status(201).json(user);
  } catch (err) {
    err.statusCode = err.message.includes('already exists') ? 409 : 400;
    next(err);
  }
});

// PATCH /api/teacher/users/:studentId
router.patch('/users/:studentId', async (req, res, next) => {
  try {
    const user = await updateUser(req.params.studentId, req.body || {}, req.principal);
    res.json(user);
  } catch (err) {
    err.statusCode = err.message.includes('not found') ? 404 : 400;
    next(err);
  }
});

// DELETE /api/teacher/users/:studentId — soft delete (deactivate)
router.delete('/users/:studentId', async (req, res, next) => {
  try {
    const hard = req.query.hard === '1';
    if (hard) {
      await deleteUser(req.params.studentId);
    } else {
      await deactivateUser(req.params.studentId);
    }
    await audit(req.principal.classId, req.principal.user.discordId, hard ? 'delete_user' : 'deactivate_user', 'user', req.params.studentId);
    res.json({ ok: true });
  } catch (err) {
    err.statusCode = err.message.includes('not found') ? 404 : 400;
    next(err);
  }
});

// ─── Presidents ───────────────────────────────────────────────────────────────

// GET /api/teacher/presidents
router.get('/presidents', async (req, res, next) => {
  try {
    const presidents = await listPresidents();
    res.json({ presidents });
  } catch (err) { next(err); }
});

// POST /api/teacher/presidents
router.post('/presidents', async (req, res, next) => {
  try {
    const { studentId } = req.body || {};
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });
    const appointment = await appointPresident(studentId, req.principal.user.discordId);
    await audit(req.principal.classId, req.principal.user.discordId, 'appoint_president', 'president', studentId);
    res.status(201).json(appointment);
  } catch (err) {
    err.statusCode = err.message.includes('already') ? 409 : 400;
    next(err);
  }
});

// DELETE /api/teacher/presidents/:studentId
router.delete('/presidents/:studentId', async (req, res, next) => {
  try {
    const result = await revokePresident(req.params.studentId, req.principal.user.discordId);
    await audit(req.principal.classId, req.principal.user.discordId, 'revoke_president', 'president', req.params.studentId);
    res.json(result);
  } catch (err) {
    err.statusCode = err.message.includes('not found') ? 404 : 400;
    next(err);
  }
});

// ─── Settings ─────────────────────────────────────────────────────────────────

// GET /api/teacher/settings
router.get('/settings', async (req, res, next) => {
  try {
    const settings = await readSheet(SHEETS.SETTINGS);
    const cls = await getClass();
    const classSettings = settings.filter((s) => s.classId === (cls?.classId || 'MEP4-744'));
    const result = {};
    for (const s of classSettings) {
      try { result[s.key] = JSON.parse(s.valueJson); }
      catch { result[s.key] = s.valueJson; }
    }
    res.json({ settings: result });
  } catch (err) { next(err); }
});

// PATCH /api/teacher/settings
router.patch('/settings', async (req, res, next) => {
  try {
    const cls = await getClass();
    const classId = cls?.classId || 'MEP4-744';
    const existing = await readSheetWithRows(SHEETS.SETTINGS);
    const updatedBy = req.principal.user.discordId;
    const { nowISO } = require('../../utils/dates');

    for (const [key, value] of Object.entries(req.body || {})) {
      const valueJson = JSON.stringify(value);
      const existingRow = existing.find((s) => s.classId === classId && s.key === key);
      if (existingRow && existingRow._rowIndex) {
        await updateRowRaw(SHEETS.SETTINGS, existingRow._rowIndex, [classId, key, valueJson, updatedBy, nowISO()]);
      } else {
        await appendRowRaw(SHEETS.SETTINGS, [classId, key, valueJson, updatedBy, nowISO()]);
      }
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
