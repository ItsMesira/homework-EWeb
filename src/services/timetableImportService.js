// services/timetableImportService.js — OCR-based timetable import pipeline
//
// 7-step pipeline:
//   1. Upload image (buffer) — optionally to Cloudinary for reference
//   2. Send to Google Cloud Vision (DOCUMENT_TEXT_DETECTION)
//   3. Extract text blocks with bounding boxes
//   4. Reconstruct grid (rows=periods, columns=days)
//   5. Deduplicate against existing timetable
//   6. Save as draft in TimetableImports sheet
//   7. Teacher reviews → confirm (batch upsert) or reject

const { SHEETS, DEFAULT_CLASS_ID, DEFAULT_TERM, DEFAULT_SCHOOL_YEAR, VISION_ENABLED, CLOUDINARY_ENABLED } = require('../config');
const { readSheet, readSheetWithRows, appendRow, updateRow } = require('../utils/sheets');
const { generateId, PREFIXES } = require('../utils/ids');
const { nowISO } = require('../utils/dates');
const { detectDocumentText } = require('../server/integrations/vision');
const { uploadBuffer } = require('../server/integrations/cloudinary');
const { batchUpsertCells, getTimetableGrid, MAX_PERIOD } = require('./timetableService');
const { normalizeSubjectCode } = require('./subjectService');

const DAYS = 5; // Mon–Fri

// ─── Grid reconstruction ─────────────────────────────────────────────────────

/**
 * Compute the average Y of a block's vertices.
 */
function avgY(block) {
  const ys = block.vertices.map((v) => v.y);
  return ys.reduce((a, b) => a + b, 0) / ys.length;
}

/**
 * Compute the average X of a block's vertices.
 */
function avgX(block) {
  const xs = block.vertices.map((v) => v.x);
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * Group blocks into rows by Y proximity.
 * Blocks within `tolerance` pixels of each other (vertically) are the same row.
 */
function groupIntoRows(blocks, tolerance = 30) {
  if (blocks.length === 0) return [];
  const sorted = [...blocks].sort((a, b) => avgY(a) - avgY(b));
  const rows = [];
  let currentRow = [sorted[0]];
  let currentY = avgY(sorted[0]);

  for (let i = 1; i < sorted.length; i++) {
    const y = avgY(sorted[i]);
    if (Math.abs(y - currentY) <= tolerance) {
      currentRow.push(sorted[i]);
      currentY = (currentY * (currentRow.length - 1) + y) / currentRow.length;
    } else {
      rows.push(currentRow);
      currentRow = [sorted[i]];
      currentY = y;
    }
  }
  rows.push(currentRow);
  return rows;
}

/**
 * Detect the cell type from text.
 * Returns { cellType, subjectCode, label }
 */
function classifyCell(text) {
  const trimmed = text.trim();
  if (!trimmed) return { cellType: 'free', subjectCode: '', label: '' };

  const lower = trimmed.toLowerCase();

  // Break / lunch / free patterns (Thai + English)
  if (/^(พัก|break|brk|recess|วิ่ง|pe|ก\.พล)$/i.test(lower) ||
      /^(กินข้าว|lunch|meal|พักกลางวัน)$/i.test(lower) ||
      /^(ห้อง|home room|homeroom|เวลาว่าง|free|ว่าง)$/i.test(lower)) {
    if (/lunch|กินข้าว|พักกลางวัน/.test(lower)) return { cellType: 'lunch', subjectCode: '', label: trimmed };
    if (/break|พัก|วิ่ง|pe|ก\.พล/i.test(lower)) return { cellType: 'break', subjectCode: '', label: trimmed };
    return { cellType: 'free', subjectCode: '', label: trimmed };
  }

  // Try to extract a subject code (e.g., "EN-101", "MA201", "PHY-301")
  const codeMatch = trimmed.match(/([A-Z]{2,4}[-]?\d{2,3})/i);
  if (codeMatch) {
    const code = normalizeSubjectCode(codeMatch[1]);
    // The rest of the text (after the code) is the label/instructor
    const rest = trimmed.replace(codeMatch[0], '').trim();
    return { cellType: 'subject', subjectCode: code, label: rest || '' };
  }

  // Default: treat as a subject with the text as label
  return { cellType: 'subject', subjectCode: '', label: trimmed };
}

/**
 * Reconstruct a 5×9 grid from OCR blocks.
 *
 * @param {Array} blocks — Vision API text blocks with vertices
 * @returns {Object} grid — { [day(1-5)]: { [period(1-9)]: { cellType, subjectCode, label, instructor, confidence } } }
 */
function reconstructGrid(blocks) {
  const rows = groupIntoRows(blocks);

  // Skip the first row if it looks like a header (day names)
  // "จันทร์", "อังคาร", etc. or "Monday", "Tuesday", etc.
  let dataRows = rows;
  if (rows.length > 0) {
    const headerText = rows[0].map((b) => b.text).join(' ').toLowerCase();
    if (headerText.includes('จันทร์') || headerText.includes('monday') || headerText.includes('day') || headerText.includes('period')) {
      dataRows = rows.slice(1);
    }
  }

  // Determine the number of columns (days) — usually 5
  // Use the row with the most blocks as reference
  const maxCols = Math.max(...dataRows.map((r) => r.length), 1);
  const numDays = Math.min(maxCols, DAYS);

  const grid = {};
  for (let day = 1; day <= DAYS; day++) {
    grid[day] = {};
    for (let period = 1; period <= MAX_PERIOD; period++) {
      grid[day][period] = { cellType: 'free', subjectCode: '', label: '', instructor: '', confidence: 0 };
    }
  }

  // Map data rows to periods and columns to days
  for (let rowIdx = 0; rowIdx < Math.min(dataRows.length, MAX_PERIOD); rowIdx++) {
    const period = rowIdx + 1;
    const rowBlocks = [...dataRows[rowIdx]].sort((a, b) => avgX(a) - avgX(b));

    // If the first column looks like a period number, skip it
    let startCol = 0;
    if (rowBlocks.length > 0 && /^\d+$/.test(rowBlocks[0].text.trim())) {
      startCol = 1;
    }

    for (let colIdx = startCol; colIdx < Math.min(rowBlocks.length, startCol + numDays); colIdx++) {
      const day = colIdx - startCol + 1;
      if (day > DAYS) break;

      const block = rowBlocks[colIdx];
      const { cellType, subjectCode, label } = classifyCell(block.text);
      grid[day][period] = {
        cellType,
        subjectCode,
        label,
        instructor: '',
        confidence: block.confidence || 0.5,
      };
    }
  }

  return grid;
}

// ─── Import lifecycle ────────────────────────────────────────────────────────

/**
 * Step 1-6: Upload image, run OCR, reconstruct grid, save as draft.
 *
 * @param {Buffer} imageBuffer
 * @param {number} term
 * @param {number} schoolYear
 * @param {string} createdBy
 * @returns {Promise<{ importId: string, draft: object }>}
 */
async function createImport(imageBuffer, term = DEFAULT_TERM, schoolYear = DEFAULT_SCHOOL_YEAR, createdBy = '') {
  if (!VISION_ENABLED) {
    throw new Error('OCR import requires VISION_CREDENTIALS to be configured');
  }

  // Step 2-3: Run OCR
  const ocrResult = await detectDocumentText(imageBuffer);

  // Step 4: Reconstruct grid
  const grid = reconstructGrid(ocrResult.blocks);

  // Step 5: Deduplicate — mark cells that match existing timetable
  const existingGrid = await getTimetableGrid(term, schoolYear);
  const duplicates = [];
  for (let day = 1; day <= DAYS; day++) {
    for (let period = 1; period <= MAX_PERIOD; period++) {
      const existing = existingGrid[day]?.[period];
      const draft = grid[day][period];
      if (existing && existing.cellType !== 'free' && draft.cellType !== 'free') {
        if (existing.subjectCode === draft.subjectCode && existing.label === draft.label) {
          draft.isDuplicate = true;
          duplicates.push({ day, period });
        }
      }
    }
  }

  // Optional: upload image to Cloudinary for reference
  let cloudinaryPublicId = '';
  if (CLOUDINARY_ENABLED) {
    try {
      const upload = await uploadBuffer(imageBuffer, {
        folder: 'emble/timetable-imports',
        resourceType: 'image',
      });
      cloudinaryPublicId = upload.publicId;
    } catch { /* non-critical */ }
  }

  // Step 6: Save as draft
  const importId = generateId(PREFIXES.IMPORT);
  const draft = {
    grid,
    duplicates,
    ocrConfidence: ocrResult.blocks.length > 0
      ? ocrResult.blocks.reduce((sum, b) => sum + (b.confidence || 0), 0) / ocrResult.blocks.length
      : 0,
    blockCount: ocrResult.blocks.length,
  };

  await appendRow(SHEETS.TIMETABLE_IMPORTS, [
    importId,
    DEFAULT_CLASS_ID,
    term,
    schoolYear,
    cloudinaryPublicId,
    'draft',
    JSON.stringify(draft),
    1, // revision
    createdBy,
    nowISO(),
    nowISO(),
    '', // confirmedAt
  ]);

  return { importId, draft };
}

/**
 * Get an import by ID.
 */
async function getImport(importId) {
  const rows = await readSheet(SHEETS.TIMETABLE_IMPORTS);
  const row = rows.find((r) => r.importId === importId);
  if (!row) return null;

  let draft = null;
  try { draft = JSON.parse(row.draftJson); } catch { /* corrupted */ }

  return {
    importId: row.importId,
    classId: row.classId,
    term: parseInt(row.term, 10),
    schoolYear: parseInt(row.schoolYear, 10),
    cloudinaryPublicId: row.cloudinaryPublicId,
    status: row.status,
    draft,
    revision: parseInt(row.revision, 10) || 1,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    confirmedAt: row.confirmedAt || null,
  };
}

/**
 * List all imports (newest first).
 */
async function listImports() {
  const rows = await readSheet(SHEETS.TIMETABLE_IMPORTS);
  return rows
    .map((r) => ({
      importId: r.importId,
      term: parseInt(r.term, 10),
      schoolYear: parseInt(r.schoolYear, 10),
      status: r.status,
      revision: parseInt(r.revision, 10) || 1,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      confirmedAt: r.confirmedAt || null,
    }))
    .reverse(); // newest first
}

/**
 * Step 7: Confirm a draft — batch upsert cells into the Timetable.
 * Only non-free, non-duplicate cells are upserted (unless forceOverwrite is true).
 *
 * @param {string} importId
 * @param {object} editedGrid — optional edited grid (overrides the draft)
 * @param {string} confirmedBy
 * @param {boolean} forceOverwrite — overwrite duplicate cells
 */
async function confirmImport(importId, editedGrid, confirmedBy, forceOverwrite = false) {
  const rows = await readSheetWithRows(SHEETS.TIMETABLE_IMPORTS);
  const row = rows.find((r) => r.importId === importId);
  if (!row) throw new Error('Import not found');
  if (row.status !== 'draft') throw new Error(`Import is in '${row.status}' state, cannot confirm`);

  const draft = editedGrid || (row.draftJson ? JSON.parse(row.draftJson).grid : null);
  if (!draft) throw new Error('No draft grid available');

  const term = parseInt(row.term, 10);
  const schoolYear = parseInt(row.schoolYear, 10);

  // Collect cells to upsert
  const cells = [];
  for (let day = 1; day <= DAYS; day++) {
    for (let period = 1; period <= MAX_PERIOD; period++) {
      const cell = draft[day]?.[period];
      if (!cell || cell.cellType === 'free') continue;
      if (cell.isDuplicate && !forceOverwrite) continue;
      cells.push({
        day, period,
        cellType: cell.cellType,
        subjectCode: cell.subjectCode,
        label: cell.label,
        instructor: cell.instructor || '',
        term, schoolYear,
      });
    }
  }

  // Batch upsert
  const results = await batchUpsertCells(cells, confirmedBy);

  // Update import status
  row.status = 'confirmed';
  row.confirmedAt = nowISO();
  row.updatedAt = nowISO();
  await updateRow(SHEETS.TIMETABLE_IMPORTS, row._rowIndex, [
    row.importId, row.classId, row.term, row.schoolYear, row.cloudinaryPublicId,
    'confirmed', row.draftJson, row.revision, row.createdBy, row.createdAt, row.updatedAt, row.confirmedAt,
  ]);

  return { importId, status: 'confirmed', upserted: results.length, results };
}

/**
 * Reject a draft import.
 */
async function rejectImport(importId) {
  const rows = await readSheetWithRows(SHEETS.TIMETABLE_IMPORTS);
  const row = rows.find((r) => r.importId === importId);
  if (!row) throw new Error('Import not found');
  if (row.status !== 'draft') throw new Error(`Import is in '${row.status}' state, cannot reject`);

  row.status = 'rejected';
  row.updatedAt = nowISO();
  await updateRow(SHEETS.TIMETABLE_IMPORTS, row._rowIndex, [
    row.importId, row.classId, row.term, row.schoolYear, row.cloudinaryPublicId,
    'rejected', row.draftJson, row.revision, row.createdBy, row.createdAt, row.updatedAt, row.confirmedAt || '',
  ]);

  return { importId, status: 'rejected' };
}

module.exports = {
  createImport,
  getImport,
  listImports,
  confirmImport,
  rejectImport,
  // Exposed for testing
  reconstructGrid,
  classifyCell,
  groupIntoRows,
};
