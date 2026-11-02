// app.js — Express application
//
// Creates the Express app with API routes, security middleware, and
// static frontend serving. Does NOT listen or start Discord — that's index.js.
//
// This file can be imported by tests without side effects.

const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const { WEB_ENABLED, SESSION_SECRET } = require('./config');
const { cookieParser, COOKIE_NAME, cookieSessionMiddleware } = require('./server/middleware/session');
const { notFoundHandler, errorHandler } = require('./server/middleware/errors');
const { log } = require('./server/middleware/logger');
const { ensureCsrfCookie, csrfProtection } = require('./server/middleware/csrf');
const { apiLimiter } = require('./server/middleware/rateLimit');

// ─── Routes ───────────────────────────────────────────────────────────────────
const authRoutes         = require('./server/routes/auth');
const metaRoutes         = require('./server/routes/meta');
const homeworkRoutes     = require('./server/routes/homework');
const completionRoutes   = require('./server/routes/completion');
const subjectRoutes      = require('./server/routes/subjects');
const timetableRoutes    = require('./server/routes/timetable');
const announcementRoutes = require('./server/routes/announcements');
const calendarRoutes     = require('./server/routes/calendar');
const analyticsRoutes    = require('./server/routes/analytics');
const teacherRoutes      = require('./server/routes/teacher');
const attachmentRoutes   = require('./server/routes/attachments');
const pushRoutes         = require('./server/routes/push');

function createApp() {
  const app = express();

  // Trust reverse proxy (Vercel, Cloudflare, etc.) for rate limiting and IP detection
  app.set('trust proxy', 1);

  // ─── Security & parsing middleware ────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: false, // Set CSP manually for SPA + API
    crossOriginEmbedderPolicy: false,
  }));

  // Custom CSP that allows inline styles/scripts for the SPA
  app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://generativelanguage.googleapis.com",
      "frame-ancestors 'none'",
    ].join('; '));
    next();
  });

  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser(SESSION_SECRET));

  // CSRF: set cookie on every request, validate on unsafe methods
  app.use(ensureCsrfCookie);

  // ─── Health check ─────────────────────────────────────────────────────────
  app.get('/healthz', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Keep old health check path for backward compat
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ─── API routes ───────────────────────────────────────────────────────────
  if (WEB_ENABLED) {
    // Rate limiting on all API routes
    app.use('/api/', apiLimiter);

    // Auth routes are exempt from CSRF (no session yet for login/logout)
    app.use('/api/auth',          authRoutes);

    // CSRF protection for all other state-changing routes
    app.use('/api/meta',          csrfProtection, metaRoutes);
    app.use('/api/homework',      csrfProtection, homeworkRoutes);
    app.use('/api/completion',    csrfProtection, completionRoutes);
    app.use('/api/homework',      csrfProtection, completionRoutes);
    app.use('/api/homework',      csrfProtection, attachmentRoutes); // /api/homework/:id/attachments
    app.use('/api/subjects',      csrfProtection, subjectRoutes);
    app.use('/api/timetable',     csrfProtection, timetableRoutes);
    app.use('/api/announcements', csrfProtection, announcementRoutes);
    app.use('/api/calendar',      calendarRoutes);
    app.use('/api/analytics',     analyticsRoutes);
    app.use('/api/teacher',       csrfProtection, teacherRoutes);
    app.use('/api/push',          csrfProtection, pushRoutes);
  } else {
    // Minimal API when web features aren't configured
    app.use('/api', (req, res) => {
      res.status(503).json({ error: 'Web features not configured. Set APP_URL and SESSION_SECRET.' });
    });
  }

  // ─── Static frontend (production) ─────────────────────────────────────────
  const distPath = fs.existsSync(path.join(__dirname, '..', 'dist'))
    ? path.join(__dirname, '..', 'dist')
    : path.join(__dirname, '..', 'web', 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));

    // SPA fallback: serve index.html for any non-API, non-file route
    app.get('*', (req, res, next) => {
      // Skip API routes and health checks
      if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
        return next();
      }
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
      next();
    });
  }

  // ─── PWA files ────────────────────────────────────────────────────────────
  const publicPath = path.join(__dirname, '..', 'public');
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
  }

  // ─── Error handling ───────────────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
