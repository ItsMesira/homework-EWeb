// server/middleware/logger.js — Simple structured logger
function log(...args) {
  console.log(`[${new Date().toISOString()}] [API]`, ...args);
}

module.exports = { log };
