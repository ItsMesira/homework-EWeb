// server/routes/auth.js — Authentication routes
const express = require('express');
const { CLIENT_ID, GUILD_ID, ADMIN_ROLE_ID, WEB_ENABLED, OAUTH_ENABLED } = require('../../config');
const { loginWithPassword, createBrowserSession, destroyBrowserSession, resolvePrincipal } = require('../../services/authService');
const { linkDiscordAccount } = require('../../services/userService');
const { getAuthorizeUrl, exchangeCode, consumeState, fetchGuildMember } = require('../integrations/discordOAuth');
const { COOKIE_NAME, cookieSessionMiddleware } = require('../middleware/session');
const { CSRF_COOKIE } = require('../middleware/csrf');
const { log } = require('../middleware/logger');
const { authLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// Cookie options
function cookieOpts() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure:   isProd,
    sameSite: 'lax',
    path:     '/',
    maxAge:   8 * 60 * 60 * 1000, // 8 hours
  };
}

// ─── POST /api/auth/login — Student ID + password login ────────────────────
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { studentId, password } = req.body || {};
    if (!studentId || !password) {
      return res.status(400).json({ error: 'Student ID and password are required' });
    }

    const clientRef = req.app.get('discordClient');
    const principal = await loginWithPassword(studentId.trim(), password, clientRef);
    if (!principal) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = createBrowserSession(principal);
    res.cookie(COOKIE_NAME, token, cookieOpts());

    log(`Login: studentId=${studentId}, role=${principal.role}`);
    res.json({ principal });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/logout ──────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  const token = req.cookies[COOKIE_NAME];
  if (token) destroyBrowserSession(token);
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

// ─── GET /api/auth/discord — Start Discord OAuth flow ───────────────────────
router.get('/discord', (req, res) => {
  if (!OAUTH_ENABLED) return res.status(503).json({ error: 'Discord OAuth is not configured' });

  const startFlow = (linkStudentId) => {
    const auth = getAuthorizeUrl(linkStudentId);
    if (!auth) return res.status(503).json({ error: 'Discord OAuth is not configured' });
    res.redirect(auth.url);
  };

  // Plain login — no session needed.
  if (req.query.link !== '1') return startFlow(null);

  // Account linking — only for a signed-in student. The student ID comes from
  // the verified session, never from the query string.
  cookieSessionMiddleware(req, res, () => {
    if (!req.principal || !req.principal.user.studentId) {
      return res.redirect('/login?login_error=login_required');
    }
    startFlow(req.principal.user.studentId);
  });
});

// ─── GET /api/auth/discord/callback — OAuth callback ────────────────────────
router.get('/discord/callback', async (req, res, next) => {
  try {
    const { code, state, error } = req.query;

    if (error) return res.redirect('/?login_error=oauth_denied');
    if (!code || !state) return res.redirect('/?login_error=oauth_missing_params');

    const stateData = consumeState(state);
    if (!stateData) return res.redirect('/?login_error=oauth_invalid_state');

    const discordUser = await exchangeCode(code);
    if (!discordUser) return res.redirect('/?login_error=oauth_exchange_failed');

    // Verify guild membership via the bot client or Discord REST API fallback
    const clientRef = req.app.get('discordClient');
    let guildMember = null;
    let principal = null;

    if (clientRef) {
      try {
        const guild = await clientRef.guilds.fetch(GUILD_ID);
        guildMember = await guild.members.fetch(discordUser.id);
      } catch { /* not in guild */ }
    } else {
      guildMember = await fetchGuildMember(discordUser.id);
    }

    if (stateData.linkStudentId) {
      // Account linking flow: bind this Discord ID to the signed-in student.
      try {
        await linkDiscordAccount(stateData.linkStudentId, discordUser.id);
      } catch (err) {
        const reason = err.statusCode === 409 ? 'discord_already_linked' : 'link_failed';
        return res.redirect(`/account?link_error=${reason}`);
      }

      // Refresh the session so the new Discord ID shows up immediately.
      try {
        const refreshed = await resolvePrincipal(null, discordUser.id, guildMember);
        if (refreshed) {
          const token = createBrowserSession(refreshed);
          res.cookie(COOKIE_NAME, token, cookieOpts());
        }
      } catch { /* session refresh is best-effort */ }

      log(`Discord linked: studentId=${stateData.linkStudentId}, discordId=${discordUser.id}`);
      return res.redirect('/account?link_status=linked');
    }

    // Resolve principal based on Discord identity
    principal = await resolvePrincipal(null, discordUser.id, guildMember);

    if (!principal) {
      // Discord account not linked to any student record and not a teacher
      return res.redirect('/?login_error=discord_not_linked');
    }

    const token = createBrowserSession(principal);
    res.cookie(COOKIE_NAME, token, cookieOpts());

    log(`Discord OAuth login: discordId=${discordUser.id}, role=${principal.role}`);
    res.redirect('/');
  } catch (err) {
    log('OAuth callback error:', err.message);
    res.redirect('/?login_error=oauth_failed');
  }
});

// ─── GET /api/auth/csrf — Return active CSRF token ─────────────────────────
router.get('/csrf', (req, res) => {
  const token = req.cookies[CSRF_COOKIE];
  res.json({ csrfToken: token || '' });
});

// ─── GET /api/auth/me — Current principal ───────────────────────────────────
router.get('/me', cookieSessionMiddleware, (req, res) => {
  res.json({ principal: req.principal || null });
});

module.exports = router;
