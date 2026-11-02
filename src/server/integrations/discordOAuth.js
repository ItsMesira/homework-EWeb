// server/integrations/discordOAuth.js — Discord OAuth2 authorization-code flow
//
// Flow:
//   1. GET /api/auth/discord → redirect to Discord authorize URL with state cookie
//   2. Discord redirects back to /api/auth/discord/callback?code=...&state=...
//   3. Exchange code for user identity (identify scope)
//   4. Verify guild membership via the bot client
//   5. Resolve principal (teacher from ADMIN_ROLE_ID, president from appointment, student otherwise)

const crypto = require('crypto');
const { CLIENT_ID, GUILD_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI, OAUTH_ENABLED, TOKEN, SESSION_SECRET } = require('../../config');

const DISCORD_API_BASE = 'https://discord.com/api/v10';

const STATE_TTL_MS = 10 * 60 * 1000;

// OAuth state is HMAC-signed rather than stored in memory: on serverless
// (Vercel) the callback can land on a different instance than the one that
// issued the state, which would otherwise fail with oauth_invalid_state.

function signState(data) {
  const body = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifyState(state) {
  if (!state || typeof state !== 'string') return null;
  const parts = state.split('.');
  if (parts.length !== 2) return null;

  const [body, signature] = parts;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!data.exp || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Generate the Discord OAuth authorize URL and sign a state token.
 * @param {string|null} linkStudentId — if provided, this OAuth is for linking an existing account
 * @returns {{ url: string, state: string } | null}
 */
function getAuthorizeUrl(linkStudentId = null) {
  if (!OAUTH_ENABLED) return null;

  const state = signState({
    linkStudentId: linkStudentId || null,
    exp: Date.now() + STATE_TTL_MS,
    nonce: crypto.randomBytes(8).toString('hex'),
  });

  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope:         'identify',
    state,
  });

  return {
    url:   `${DISCORD_API_BASE}/oauth2/authorize?${params.toString()}`,
    state,
  };
}

/**
 * Exchange the OAuth code for a Discord user identity.
 * Uses the token endpoint to get an access_token, then fetches /users/@me.
 * @param {string} code
 * @returns {Promise<{ id: string, username: string } | null>}
 */
async function exchangeCode(code) {
  const body = new URLSearchParams({
    client_id:     CLIENT_ID,
    client_secret: DISCORD_CLIENT_SECRET,
    grant_type:    'authorization_code',
    code,
    redirect_uri:  DISCORD_REDIRECT_URI,
  });

  const tokenRes = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!tokenRes.ok) return null;
  const tokenData = await tokenRes.json();

  const userRes = await fetch(`${DISCORD_API_BASE}/users/@me`, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userRes.ok) return null;
  const user = await userRes.json();

  return {
    id:       user.id,
    username: user.username,
  };
}

/**
 * Fetch a guild member using the Discord REST API and Bot Token.
 * Useful in serverless environments (e.g. Vercel) where the WebSocket bot client is not running.
 * @param {string} discordId
 * @returns {Promise<object | null>}
 */
async function fetchGuildMember(discordId) {
  if (!TOKEN || !GUILD_ID || !discordId) return null;
  try {
    const res = await fetch(`${DISCORD_API_BASE}/guilds/${GUILD_ID}/members/${discordId}`, {
      headers: { Authorization: `Bot ${TOKEN}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Verify and consume a state token.
 * @returns {{ linkStudentId: string|null } | null}
 */
function consumeState(state) {
  const data = verifyState(state);
  if (!data) return null;
  return { linkStudentId: data.linkStudentId || null };
}

module.exports = { getAuthorizeUrl, exchangeCode, consumeState, fetchGuildMember, OAUTH_ENABLED };
