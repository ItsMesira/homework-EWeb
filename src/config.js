// config.js — Central configuration for Emble Bot + Web Dashboard
require('dotenv').config();

// ─── Startup env validation ────────────────────────────────────────────────
// Core required vars for the Discord bot
const REQUIRED_ENV = [
  'DISCORD_TOKEN',
  'CLIENT_ID',
  'GUILD_ID',
  'GOOGLE_SHEET_ID',
  'GOOGLE_CREDENTIALS',
];

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(
    `Missing required environment variables: ${missing.join(', ')}\n` +
    'Copy .env.example to .env and fill in all values.'
  );
  process.exit(1);
}

// Validate that GOOGLE_CREDENTIALS is parseable JSON early
try {
  JSON.parse(process.env.GOOGLE_CREDENTIALS);
} catch {
  console.error('GOOGLE_CREDENTIALS is not valid JSON — check the value.');
  process.exit(1);
}

// ─── Default class ───────────────────────────────────────────────────────────
const DEFAULT_CLASS_ID    = 'MEP4-744';
const DEFAULT_CLASS_NAME  = 'MEP4';
const DEFAULT_ROOM        = '744';
const DEFAULT_TERM        = 2;
const DEFAULT_SCHOOL_YEAR = 2569;
const DEFAULT_TIMEZONE    = 'Asia/Bangkok';

// ─── Determine if web features are enabled ───────────────────────────────────
const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-only-secret-change-me-in-prod-32-chars';

const WEB_ENABLED = process.env.WEB_ENABLED !== 'false';

const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || process.env.CLIENT_SECRET || '';
const DISCORD_REDIRECT_URI  = process.env.DISCORD_REDIRECT_URI  || `${APP_URL}/api/auth/discord/callback`;

const OAUTH_ENABLED = !!(
  WEB_ENABLED &&
  DISCORD_CLIENT_SECRET &&
  DISCORD_REDIRECT_URI
);

const VISION_ENABLED  = !!process.env.VISION_CREDENTIALS;
const CLOUDINARY_ENABLED = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);
const PUSH_ENABLED = !!(
  process.env.VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY
);

// Validate Vision credentials JSON if provided
if (VISION_ENABLED) {
  try { JSON.parse(process.env.VISION_CREDENTIALS); }
  catch { console.error('VISION_CREDENTIALS is not valid JSON.'); process.exit(1); }
}

module.exports = {
  // ─── Discord ──────────────────────────────────────────────────────────────
  TOKEN:            process.env.DISCORD_TOKEN,
  CLIENT_ID:        process.env.CLIENT_ID,
  GUILD_ID:         process.env.GUILD_ID,
  PANEL_CHANNEL_ID: process.env.PANEL_CHANNEL_ID || '1506267894068285542',
  SUMMARY_USER_ID:  process.env.SUMMARY_USER_ID  || '918320537443385396',
  ADMIN_ROLE_ID:    process.env.ADMIN_ROLE_ID     || '1480919691982667826',

  // Discord OAuth
  DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI,

  // ─── Google Sheets ────────────────────────────────────────────────────────
  SHEET_ID:           process.env.GOOGLE_SHEET_ID,
  GOOGLE_CREDENTIALS: process.env.GOOGLE_CREDENTIALS,

  // ─── Web ──────────────────────────────────────────────────────────────────
  APP_URL,
  SESSION_SECRET,
  PORT:           parseInt(process.env.PORT || '3000', 10),
  WEB_ENABLED,
  OAUTH_ENABLED,
  VISION_ENABLED,
  CLOUDINARY_ENABLED,
  PUSH_ENABLED,

  // Vision OCR
  VISION_CREDENTIALS: process.env.VISION_CREDENTIALS || '',

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY:    process.env.CLOUDINARY_API_KEY    || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',

  // Web Push
  VAPID_PUBLIC_KEY:  process.env.VAPID_PUBLIC_KEY  || '',
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY  || '',
  PUSH_SUBJECT:      process.env.PUSH_SUBJECT       || '',

  // ─── Sheet tab names ──────────────────────────────────────────────────────
  SHEETS: {
    // Existing tabs (column positions preserved)
    USERS:      'Users',
    SUBJECTS:   'Subjects',
    HOMEWORK:   'Homework',
    COMPLETION: 'Completion',
    // New tabs for the dashboard
    CLASSES:              'Classes',
    CLASS_MEMBERS:        'ClassMembers',
    PRESIDENT_APPOINTMENTS: 'PresidentAppointments',
    TIMETABLE:            'Timetable',
    TIMETABLE_IMPORTS:    'TimetableImports',
    HOMEWORK_ATTACHMENTS: 'HomeworkAttachments',
    ANNOUNCEMENTS:        'Announcements',
    SETTINGS:             'Settings',
    PUSH_SUBSCRIPTIONS:   'PushSubscriptions',
    NOTIFICATION_DELIVERIES: 'NotificationDeliveries',
    AUDIT_LOG:            'AuditLog',
  },

  // ─── Default class ────────────────────────────────────────────────────────
  DEFAULT_CLASS_ID,
  DEFAULT_CLASS_NAME,
  DEFAULT_ROOM,
  DEFAULT_TERM,
  DEFAULT_SCHOOL_YEAR,
  DEFAULT_TIMEZONE,

  // ─── Session config ───────────────────────────────────────────────────────
  SESSION_TIMEOUT: 2 * 60 * 60 * 1000,       // 2 hours (Discord in-memory sessions)
  BROWSER_SESSION_IDLE:    30 * 60 * 1000,    // 30 min idle expiry
  BROWSER_SESSION_ABSOLUTE: 8 * 60 * 60 * 1000, // 8 hour absolute expiry

  // ─── Reminder deduplication ───────────────────────────────────────────────
  REMINDER_DEDUP_TTL: 25 * 60 * 60 * 1000,  // 25 hours

  // ─── Upload limits ────────────────────────────────────────────────────────
  MAX_UPLOAD_BYTES:   10 * 1024 * 1024, // 10 MB
  MAX_ATTACHMENTS_PER_HW: 10,
};
