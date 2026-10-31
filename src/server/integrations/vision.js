// server/integrations/vision.js — Google Cloud Vision API wrapper for OCR
//
// Uses @google-cloud/vision with VISION_CREDENTIALS (JSON service account).
// When VISION_ENABLED is false, all operations return gracefully.

const { VISION_ENABLED, VISION_CREDENTIALS } = require('../../config');

let client = null;

function getClient() {
  if (!VISION_ENABLED) return null;
  if (client) return client;

  const { ImageAnnotatorClient } = require('@google-cloud/vision');
  client = new ImageAnnotatorClient({
    credentials: JSON.parse(VISION_CREDENTIALS),
  });
  return client;
}

/**
 * Run DOCUMENT_TEXT_DETECTION on an image buffer.
 * Returns an array of text blocks with bounding box info.
 *
 * @param {Buffer} imageBuffer
 * @returns {Promise<{
 *   fullText: string,
 *   blocks: Array<{
 *     text: string,
 *     vertices: { x: number, y: number }[],
 *     confidence: number,
 *   }>
 * }>}
 */
async function detectDocumentText(imageBuffer) {
  const vision = getClient();
  if (!vision) throw new Error('Vision API is not configured');

  const [result] = await vision.documentTextDetection({
    image: { content: imageBuffer },
  });

  const annotation = result.fullTextAnnotation;
  if (!annotation) {
    return { fullText: '', blocks: [] };
  }

  const fullText = annotation.text || '';
  const blocks = [];

  // Extract pages → blocks → paragraphs → words
  if (annotation.pages) {
    for (const page of annotation.pages) {
      if (!page.blocks) continue;
      for (const block of page.blocks) {
        if (!block.paragraphs) continue;
        for (const para of block.paragraphs) {
          if (!para.words) continue;
          // Join words in this paragraph
          const words = para.words.map((w) =>
            (w.symbols || []).map((s) => s.text).join('')
          );
          const text = words.join(' ');

          // Get bounding box vertices
          const vertices = (para.boundingBox?.vertices || []).map((v) => ({
            x: v.x || 0,
            y: v.y || 0,
          }));

          // Confidence: paragraph level
          const confidence = para.confidence || 0;

          blocks.push({ text, vertices, confidence });
        }
      }
    }
  }

  return { fullText, blocks };
}

module.exports = {
  isConfigured: VISION_ENABLED,
  detectDocumentText,
};
