// server/integrations/webPush.js — Web Push (VAPID) helper
//
// Uses the web-push library with VAPID keys from env.
// When PUSH_ENABLED is false, all operations return gracefully.

const webpush = require('web-push');
const {
  PUSH_ENABLED,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  PUSH_SUBJECT,
} = require('../../config');

let configured = false;

function configure() {
  if (!PUSH_ENABLED || configured) return;
  webpush.setVapidDetails(
    PUSH_SUBJECT || 'mailto:noreply@emble.local',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  configured = true;
}

/**
 * Get the public VAPID key for the client.
 */
function getPublicKey() {
  if (!PUSH_ENABLED) return null;
  return VAPID_PUBLIC_KEY;
}

/**
 * Send a push notification to a subscription.
 * @param {object} subscription — { endpoint, keys: { p256dh, auth } }
 * @param {object|string} payload — notification body
 * @returns {Promise<void>}
 */
async function sendNotification(subscription, payload) {
  if (!PUSH_ENABLED) return;
  configure();
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  await webpush.sendNotification(subscription, body);
}

module.exports = {
  isConfigured: PUSH_ENABLED,
  getPublicKey,
  sendNotification,
};
