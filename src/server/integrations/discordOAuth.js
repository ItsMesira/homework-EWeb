// server/integrations/discordOAuth.js — Discord OAuth2 authorization-code flow
//
// Flow:
//   1. GET /api/auth/discord → redirect to Discord authorize URL with state cookie
//   2. Discord redirects back to /api/auth/discord/callback?code=...&state=...
//   3. Exchange code for user identity (identify scope)
//   4. Verify guild membership via the bot client
//   5. Resolve principal (teacher from ADMIN_ROLE_ID, president from appointment, student otherwise)

const crypto = require('crypto');
const { CLIENT_ID, GUILD_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI, OAUTH_ENABLED, TOKEN } = require('../../config');

const DISCORD_API_BASE = 'https://discord.com/api/v10';

// Short-lived state store: state → { createdAt, linkStudentId }
const states = new Map();

// Clean up expired states every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of states) {
    if (now - val.createdAt > 10 * 60 * 1000) states.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * Generate the Discord OAuth authorize URL and store a state token.
 * @param {string|null} linkStudentId — if provided, this OAuth is for linking an existing account
 * @returns {{ url: string, state: string } | null}
 */
function getAuthorizeUrl(linkStudentId = null) {
  if (!OAUTH_ENABLED) return null;

  const state = crypto.randomBytes(16).toString('hex');
  states.set(state, { createdAt: Date.now(), linkStudentId });

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
 * Consume a state token (single-use).
 * @returns {{ linkStudentId: string|null } | null}
 */
function consumeState(state) {
  const val = states.get(state);
  if (!val) return null;
  states.delete(state);
  if (Date.now() - val.createdAt > 10 * 60 * 1000) return null;
  return { linkStudentId: val.linkStudentId };
}

module.exports = { getAuthorizeUrl, exchangeCode, consumeState, fetchGuildMember, OAUTH_ENABLED };
