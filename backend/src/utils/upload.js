// Image upload pipeline — multer (receive) + sharp (compress/store).
// Every uploaded image is:
//   1. validated by multer (image mime, size cap),
//   2. auto-rotated + resized + re-encoded to JPEG by sharp (EXIF stripped),
//   3. written to uploads/<category>/<id>.jpg,
//   4. referenced by a short URL like /uploads/food/<id>.jpg (≤2000 chars —
//      fits the food_logs.image_url column).
// JSON-base64 callers (legacy clients) go through the same sharp pipeline via
// compressImageBase64 / compressImageBuffer, so oversized base64 payloads get
// the same downsize instead of a cryptic 413.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');
const { AppError } = require('./errors');

// Storage root: UPLOAD_DIR override, otherwise <backend>/uploads.
const UPLOAD_ROOT = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', '..', 'uploads');

// Categories double as subfolder names — bounded so path traversal can't win.
const ALLOWED_CATEGORIES = new Set(['food', 'progress', 'misc']);
const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']);

// Compress target: 1600px long edge keeps food-portion cues; ~150–300KB out.
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 82;

function ensureUploadRoot() {
  try {
    fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
  } catch (e) {
    // Static serving + multer both fail loudly if the root is unwritable.
    console.error('[upload] cannot create upload root:', e.message);
  }
}

function categoryDir(category) {
  const name = ALLOWED_CATEGORIES.has(category) ? category : 'misc';
  const dir = path.join(UPLOAD_ROOT, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Random name (uploads are never user-visible by name; DB row owns the link).
function safeFilename(originalName) {
  const ext = jpgIfImage(originalName);
  return `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}${ext || '.bin'}`;
}

// multer hands us the *uploaded* extension; sharp re-encodes to JPEG anyway,
// so anything sharp supports becomes .jpg / .png (png for transparency).
function jpgIfImage(originalName) {
  const ext = path.extname(String(originalName || '')).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '';
}

// Multer storage factory. category = uploads/<category>/ subfolder.
function makeUploader(category) {
  ensureUploadRoot();
  const dir = categoryDir(category);
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, dir),
      filename: (_req, file, cb) => cb(null, safeFilename(file.originalname)),
    }),
    limits: { fileSize: 20 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (IMAGE_MIME.has(file.mimetype)) return cb(null, true);
      cb(new AppError('Only image files (JPEG, PNG, WebP, GIF, HEIC) are allowed.', 400, 'INVALID_FILE_TYPE'));
    },
  });
}

// Turn multer's own errors into API-friendly JSON (index keys are aloof otherwise).
function normalizeMulterError(err, _req, _res, next) {
  if (!err) return next();
  if (err instanceof multer.MulterError) {
    const msg =
      err.code === 'LIMIT_FILE_SIZE' ? 'Image too large (max 20MB).' :
      err.code === 'LIMIT_FILE_COUNT' ? 'Only one image per request.' :
      err.code === 'LIMIT_UNEXPECTED_FILE' ? 'Unexpected file field. Use "image".' :
      'Upload failed: ' + err.code;
    return next(new AppError(msg, 413, 'UPLOAD_ERROR'));
  }
  return next(err);
}

// Resize/re-encode a sharp-readable source (path or buffer) to a small JPEG
// buffer. Animation/EXIF metadata is dropped on purpose (privacy + size).
async function compressImageBuffer(source, { maxWidth = MAX_DIMENSION } = {}) {
  return sharp(source)
    .rotate() // bake EXIF orientation before resizing
    .resize({ width: maxWidth, height: maxWidth, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}

// Compress + persist ONE stored file (from multer disk storage) into the
// category folder. Returns { url, buffer, bytes }. The original upload is
// discarded; the returned buffer feeds vision models without a re-read.
async function compressAndStore(file, category) {
  if (!file) return null;
  const buf = await compressImageBuffer(file.path);
  const dir = categoryDir(category);
  const name = safeFilename(file.originalname).replace(/\.[^.]+$/, '') + '.jpg';
  const target = path.join(dir, name);
  await fs.promises.writeFile(target, buf);
  fs.promises.unlink(file.path).catch(() => {}); // never keep the original
  return { url: `/uploads/${path.basename(dir)}/${name}`, buffer: buf, bytes: buf.length };
}

// Compress + persist a raw buffer (the JSON-base64 path). Same output shape.
async function compressBufferAndStore(buffer, category) {
  const dir = categoryDir(category);
  const name = safeFilename('upload').replace(/\.[^.]+$/, '') + '.jpg';
  const target = path.join(dir, name);
  const buf = await compressImageBuffer(buffer);
  await fs.promises.writeFile(target, buf);
  return { url: `/uploads/${path.basename(dir)}/${name}`, bytes: buf.length };
}

// Legacy analyze-pic: oversized base64 → server-side compress (was: hard 413).
async function compressImageBase64(base64, { maxWidth = MAX_DIMENSION } = {}) {
  const clean = String(base64 || '').includes(',') ? String(base64).split(',')[1] : String(base64 || '');
  const buf = await compressImageBuffer(Buffer.from(clean, 'base64'), { maxWidth });
  return { base64: buf.toString('base64'), bytes: buf.length };
}

module.exports = {
  UPLOAD_ROOT,
  ALLOWED_CATEGORIES,
  makeUploader,
  normalizeMulterError,
  compressImageBuffer,
  compressAndStore,
  compressBufferAndStore,
  compressImageBase64,
};
