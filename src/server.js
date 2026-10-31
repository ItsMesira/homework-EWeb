// src/server.js — Local development server entry point
require('dotenv').config();

const { createApp } = require('./app');
const { PORT, APP_URL, WEB_ENABLED } = require('./config');
const { initSheets } = require('./utils/sheets');

const app = createApp();

app.listen(PORT, async () => {
  console.log(`[Emble Web] API server running on port ${PORT} (${APP_URL})`);
  try {
    await initSheets();
    console.log('[Emble Web] Google Sheets initialized');
  } catch (err) {
    console.error('[Emble Web] Sheets initialization error:', err.message);
  }
});
