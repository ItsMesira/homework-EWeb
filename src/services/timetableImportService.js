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

const { SHEETS, DEFAULT_CLASS_ID, DEFAULT_TERM, DEFAULT_SCHOOL_YEAR, VISION_ENABLED, GEMINI_API_KEY, GEMINI_ENABLED, CLOUDINARY_ENABLED } = require('../config');
const { readSheet, readSheetWithRows, appendRow, updateRow } = require('../utils/sheets');
const { generateId, PREFIXES } = require('../utils/ids');
const { nowISO } = require('../utils/dates');
const { detectDocumentText } = require('../server/integrations/vision');
const { uploadBuffer } = require('../server/integrations/cloudinary');
const { batchUpsertCells, getTimetableGrid, MAX_PERIOD } = require('./timetableService');
const { normalizeSubjectCode } = require('./subjectService');

const DAYS = 5; // Mon–Fri

/**
 * Extract timetable using Google AI Studio Gemini API (100% free, no credit card required).
 */
async function extractWithGemini(imageBuffer, apiKey) {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 8) {
    const err = new Error('กรุณาระบุ Gemini API Key (สามารถรับฟรีได้ที่ https://aistudio.google.com โดยไม่ต้องกรอกบัตรเครดิต)');
    err.statusCode = 400;
    throw err;
  }

  const cleanKey = apiKey.trim();
  const base64Data = imageBuffer.toString('base64');

  let mimeType = 'image/jpeg';
  if (imageBuffer.length > 4) {
    if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && imageBuffer[2] === 0x4E && imageBuffer[3] === 0x47) {
      mimeType = 'image/png';
    } else if (imageBuffer[0] === 0x52 && imageBuffer[1] === 0x49 && imageBuffer[2] === 0x46 && imageBuffer[3] === 0x46) {
      mimeType = 'image/webp';
    }
  }

  const prompt = `You are an AI assistant specialized in analyzing Thai and English school timetables and schedules.
Analyze this image of a school timetable.
Extract the schedule into a 5-day (Day 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday) and 9-period (Period 1 to 9) grid.
Output valid JSON ONLY matching this structure:
{
  "grid": {
    "1": {
      "1": { "cellType": "subject", "subjectCode": "ว31101", "label": "วิทยาศาสตร์", "instructor": "ครูสมศรี" }
    }
  }
}
Rules:
- Days are numbered 1 (Monday/จันทร์), 2 (Tuesday/อังคาร), 3 (Wednesday/พุธ), 4 (Thursday/พฤหัสบดี), 5 (Friday/ศุกร์).
- Periods are numbered 1 to 9.
- cellType MUST be one of: "subject", "free", "lunch", "break", "activity".
- If a period is lunch (พักกลางวัน, Lunch), set cellType="lunch", label="พักกลางวัน".
- If a period is break/recess (พัก), set cellType="break", label="พัก".
- If a period is activity/homeroom/guidance (แนะแนว, ชุมนุม, ลูกเสือ, กิจกรรม, โฮมรูม), set cellType="activity", label=name of activity.
- If a period is empty or free or dash, set cellType="free", subjectCode="", label="", instructor="".
- For subject periods:
  - If there is a subject code (e.g. ว31101, ค31101, EN-101, MA201, SCI-1), put it in "subjectCode".
  - If there is a subject title (e.g. ฟิสิกส์, คณิตศาสตร์, English), put it in "label".
  - If there is a teacher/instructor name (e.g. ครูสมศรี, T. John), put it in "instructor".
- Ensure ALL 5 days (1 to 5) and ALL 9 periods (1 to 9) are included in the returned grid.`;

  // Dynamically discover supported models for this key
  let candidateModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-2.5-flash', 'gemini-1.5-pro'];
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
    if (listRes.ok) {
      const listData = await listRes.json();
      if (Array.isArray(listData.models) && listData.models.length > 0) {
        const supported = listData.models
          .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
          .map((m) => m.name.replace(/^models\//, ''));
        if (supported.length > 0) {
          const preferred = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'];
          const matched = preferred.filter((p) => supported.includes(p));
          candidateModels = [...matched, ...supported.filter((s) => !preferred.includes(s))];
        }
      }
    } else {
      const listErr = await listRes.json().catch(() => ({}));
      const errMsg = listErr.error?.message || '';
      if (listRes.status === 400 && errMsg.toLowerCase().includes('api key not valid')) {
        const err = new Error('API Key ไม่ถูกต้อง กรุณาคัดลอกคีย์ฟรีจาก https://aistudio.google.com');
        err.statusCode = 400;
        throw err;
      }
    }
  } catch (err) {
    if (err.statusCode) throw err;
  }

  // Try API versions: v1beta and v1
  const apiVersions = ['v1beta', 'v1'];
  let lastError = null;

  for (const version of apiVersions) {
    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${cleanKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inlineData: { mimeType, data: base64Data } }
              ]
            }],
            generationConfig: {
              responseMimeType: 'application/json'
            }
          })
        });

        if (!res.ok) {
          const errorText = await res.text();
          let parsedErr;
          try { parsedErr = JSON.parse(errorText); } catch { /* ignore */ }
          const apiMsg = parsedErr?.error?.message || errorText;
          if (res.status === 400 && apiMsg.toLowerCase().includes('api key not valid')) {
            const err = new Error('API Key ไม่ถูกต้อง กรุณารับคีย์ฟรีใหม่ที่ https://aistudio.google.com');
            err.statusCode = 400;
            throw err;
          }
          lastError = new Error(`${model} (${version}) error ${res.status}: ${apiMsg}`);
          continue;
        }

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) continue;

        const parsed = JSON.parse(text);
        if (parsed && parsed.grid) {
          return parsed.grid;
        }
      } catch (err) {
        if (err.statusCode) throw err;
        lastError = err;
        continue;
      }
    }
  }

  const userErr = new Error(
    'ไม่สามารถเข้าถึงโมเดล Gemini ด้วย API Key นี้ได้ (หรือโปรเจกต์ยังไม่ได้เปิด Generative Language API) ' +
    'แนะนำให้สร้าง API Key ฟรีโดยตรงที่ https://aistudio.google.com หรือใช้วิธี "วางจาก Sheets / Excel" (ฟรี 100% ไม่ต้องใช้ API)'
  );
  userErr.statusCode = 400;
  throw userErr;
}

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
 * Step 1-6: Upload image, run OCR (Gemini free API or Cloud Vision), reconstruct grid, save as draft.
 *
 * @param {Buffer} imageBuffer
 * @param {number} term
 * @param {number} schoolYear
 * @param {string} createdBy
 * @param {string} geminiApiKey — Optional user-supplied Google AI Studio key
 * @returns {Promise<{ importId: string, draft: object }>}
 */
async function createImport(imageBuffer, term = DEFAULT_TERM, schoolYear = DEFAULT_SCHOOL_YEAR, createdBy = '', geminiApiKey = '') {
  let grid;
  let blockCount = 0;
  let ocrConfidence = 0.95;

  const activeGeminiKey = geminiApiKey || GEMINI_API_KEY;

  if (activeGeminiKey) {
    const rawGrid = await extractWithGemini(imageBuffer, activeGeminiKey);
    grid = {};
    for (let day = 1; day <= DAYS; day++) {
      grid[day] = {};
      for (let period = 1; period <= MAX_PERIOD; period++) {
        const c = rawGrid?.[day]?.[period] || rawGrid?.[String(day)]?.[String(period)] || {};
        grid[day][period] = {
          cellType: c.cellType || 'free',
          subjectCode: c.subjectCode ? normalizeSubjectCode(c.subjectCode) : '',
          label: c.label || '',
          instructor: c.instructor || '',
          confidence: 0.95,
        };
        if (grid[day][period].cellType !== 'free') blockCount++;
      }
    }
  } else if (VISION_ENABLED) {
    const ocrResult = await detectDocumentText(imageBuffer);
    grid = reconstructGrid(ocrResult.blocks);
    blockCount = ocrResult.blocks.length;
    ocrConfidence = ocrResult.blocks.length > 0
      ? ocrResult.blocks.reduce((sum, b) => sum + (b.confidence || 0), 0) / ocrResult.blocks.length
      : 0;
  } else {
    throw new Error('OCR requires a Gemini API Key (get one for free with no credit card at https://aistudio.google.com) or Cloud Vision credentials.');
  }

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
    ocrConfidence,
    blockCount,
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
