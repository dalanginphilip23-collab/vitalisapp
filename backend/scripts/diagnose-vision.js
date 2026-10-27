// One-off diagnostic: run the real vision chain + guards on a real photo.
// Usage: node scripts/diagnose-vision.js <path-to-image>
require('../src/config/env');
const fs = require('fs');
const path = require('path');
const { analyzeFoodImage } = require('../src/config/gemini');
const { compressImageBase64 } = require('../src/utils/upload');

async function main() {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) {
    console.error('pass an image path, e.g. node scripts/diagnose-vision.js C:\\temp\\meal.jpg');
    process.exit(1);
  }
  const raw = fs.readFileSync(file);
  console.log('[diag] input file:', file, raw.length, 'bytes');

  // Mimic the controller path exactly: compress THEN analyze.
  let base64;
  try {
    const compressed = await compressImageBase64(raw.toString('base64'));
    base64 = compressed.base64;
    console.log('[diag] compressed OK —', compressed.bytes, 'bytes');
  } catch (e) {
    console.error('[diag] SHARP COMPRESS FAILED — this is the bug:', e.message);
    process.exit(1);
  }

  const t0 = Date.now();
  const result = await analyzeFoodImage(base64);
  console.log(`[diag] analyzeFoodImage took ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  let parsed;
  try { parsed = JSON.parse(result.replace(/```|json/gi, '').trim().match(/\{[\s\S]*\}/)[0]); }
  catch { parsed = { raw: result.slice(0, 200) }; }
  console.log('[diag] RESULT:', JSON.stringify(parsed, null, 2));
}

main().catch((e) => { console.error('[diag] crashed:', e); process.exit(1); });
