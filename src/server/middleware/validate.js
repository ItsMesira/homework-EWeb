// server/middleware/validate.js — Lightweight request body validation
//
// No external dependency (no Joi/Zod). Provides a simple schema-based
// validator that trims strings, coerces types, checks required/optional,
// enforces max lengths, and strips unknown keys.
//
// Usage:
//   const { validateBody } = require('../middleware/validate');
//   router.post('/', validateBody({
//     title:     { type: 'string', required: true, maxLength: 200 },
//     subjectCode: { type: 'string', required: true, maxLength: 20 },
//     dueDate:   { type: 'string', required: true },  // YYYY-MM-DD HH:mm
//     details:   { type: 'string', required: false, maxLength: 2000 },
//     link:      { type: 'string', required: false, maxLength: 500 },
//   }), handler);

const { log } = require('./logger');

// Characters that signal formula injection in spreadsheet contexts
const FORMULA_PREFIX = /^[=+\-@]/;

/**
 * Creates an Express middleware that validates req.body against a schema.
 * On success, replaces req.body with the cleaned object.
 * On failure, responds 400 with a descriptive error.
 *
 * @param {Object} schema - { fieldName: { type, required, maxLength, enum, trim } }
 * @returns {Function} Express middleware
 */
function validateBody(schema) {
  return (req, res, next) => {
    const raw = req.body || {};
    const cleaned = {};
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      let value = raw[field];

      // Handle undefined/null
      if (value === undefined || value === null || value === '') {
        if (rules.required) {
          errors.push(`${field} is required`);
        }
        continue;
      }

      // Trim strings
      if (rules.type === 'string' && typeof value === 'string' && rules.trim !== false) {
        value = value.trim();
      }

      // Type coercion / validation
      switch (rules.type) {
        case 'string':
          if (typeof value !== 'string') {
            // Convert numbers/booleans to string
            value = String(value);
          }
          if (rules.maxLength && value.length > rules.maxLength) {
            errors.push(`${field} exceeds ${rules.maxLength} characters`);
            continue;
          }
          // Reject formula-injection attempts for fields that may end up in Sheets
          if (rules.noFormula && FORMULA_PREFIX.test(value)) {
            errors.push(`${field} starts with an invalid character`);
            continue;
          }
          // Enum check
          if (rules.enum && !rules.enum.includes(value)) {
            errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
            continue;
          }
          break;

        case 'number':
          const num = Number(value);
          if (isNaN(num)) {
            errors.push(`${field} must be a number`);
            continue;
          }
          value = num;
          if (rules.min !== undefined && value < rules.min) {
            errors.push(`${field} must be >= ${rules.min}`);
          }
          if (rules.max !== undefined && value > rules.max) {
            errors.push(`${field} must be <= ${rules.max}`);
          }
          break;

        case 'boolean':
          if (typeof value === 'string') {
            value = value === 'true' || value === '1';
          }
          if (typeof value !== 'boolean') {
            errors.push(`${field} must be a boolean`);
            continue;
          }
          break;

        case 'date':
          if (typeof value !== 'string') {
            errors.push(`${field} must be a date string`);
            continue;
          }
          // Basic YYYY-MM-DD or YYYY-MM-DD HH:mm check
          if (!/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/.test(value)) {
            errors.push(`${field} must be in YYYY-MM-DD or YYYY-MM-DD HH:mm format`);
            continue;
          }
          break;

        case 'array':
          if (!Array.isArray(value)) {
            errors.push(`${field} must be an array`);
            continue;
          }
          if (rules.maxItems && value.length > rules.maxItems) {
            errors.push(`${field} exceeds ${rules.maxItems} items`);
          }
          break;

        default:
          // Unknown type — pass through
          break;
      }

      cleaned[field] = value;
    }

    if (errors.length > 0) {
      log('[Validate] Rejected:', errors.join('; '));
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    // Replace body with cleaned version (unknown keys stripped)
    req.body = cleaned;
    next();
  };
}

/**
 * Validates query parameters with the same schema approach.
 */
function validateQuery(schema) {
  return (req, res, next) => {
    const raw = { ...req.query };
    const cleaned = {};
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      let value = raw[field];

      if (value === undefined || value === null || value === '') {
        if (rules.required) {
          errors.push(`${field} is required`);
        }
        continue;
      }

      if (rules.type === 'number') {
        const num = Number(value);
        if (isNaN(num)) {
          errors.push(`${field} must be a number`);
          continue;
        }
        value = num;
      }

      if (rules.enum && !rules.enum.includes(String(value))) {
        errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
        continue;
      }

      cleaned[field] = value;
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    req.validatedQuery = cleaned;
    next();
  };
}

module.exports = { validateBody, validateQuery };
