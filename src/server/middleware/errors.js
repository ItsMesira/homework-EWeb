// server/middleware/errors.js — Global error handler
const { log } = require('./logger');

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found', path: req.path });
}

function errorHandler(err, req, res, next) {
  // If headers already sent, delegate to Express default
  if (res.headersSent) return next(err);

  const status = err.statusCode || err.status || 500;
  const message = status < 500 ? err.message : 'Internal server error';

  if (status >= 500) {
    log('[Error]', err.message, err.stack);
  }

  res.status(status).json({ error: message });
}

module.exports = { notFoundHandler, errorHandler };
