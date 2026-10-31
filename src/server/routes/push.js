// server/routes/push.js — Web Push subscription routes
//
// GET    /api/push/vapid-public-key  — get VAPID public key
// POST   /api/push/subscribe         — subscribe to notifications
// DELETE /api/push/subscribe          — unsubscribe

const express = require('express');
const { PUSH_ENABLED } = require('../../config');
const { requireAuth } = require('../middleware/requireAuth');
const { subscribe, unsubscribe } = require('../../services/pushService');
const { getPublicKey } = require('../integrations/webPush');
const { log } = require('../middleware/logger');

const router = express.Router();

// ─── GET /api/push/vapid-public-key ─────────────────────────────────────────
router.get('/vapid-public-key', (req, res) => {
  if (!PUSH_ENABLED) return res.status(503).json({ error: 'Push notifications not configured' });
  const key = getPublicKey();
  if (!key) return res.status(503).json({ error: 'VAPID key not available' });
  res.json({ publicKey: key });
});

// All subsequent routes require auth
router.use(requireAuth);

// ─── POST /api/push/subscribe ───────────────────────────────────────────────
router.post('/subscribe', async (req, res, next) => {
  if (!PUSH_ENABLED) return res.status(503).json({ error: 'Push notifications not configured' });

  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    return res.status(400).json({ error: 'Invalid subscription object' });
  }

  try {
    const studentId = req.principal.user.studentId;
    if (!studentId) {
      return res.status(400).json({ error: 'Student ID required for push subscriptions' });
    }

    const result = await subscribe(studentId, { endpoint, keys });
    log(`Push subscribed: studentId=${studentId}, subId=${result.subscriptionId}`);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// ─── DELETE /api/push/subscribe ─────────────────────────────────────────────
router.delete('/subscribe', async (req, res, next) => {
  if (!PUSH_ENABLED) return res.status(503).json({ error: 'Push notifications not configured' });

  const { endpoint } = req.body || {};
  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint is required' });
  }

  try {
    const studentId = req.principal.user.studentId;
    const removed = await unsubscribe(studentId, endpoint);
    if (!removed) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    log(`Push unsubscribed: studentId=${studentId}`);
    res.json({ unsubscribed: true });
  } catch (err) { next(err); }
});

module.exports = router;
