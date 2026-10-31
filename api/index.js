// api/index.js — Vercel Serverless Function entry point
//
// Mounts the Express app (API routes + security middleware) as a Vercel Serverless Function.
const { createApp } = require('../src/app');

const app = createApp();

module.exports = app;
