// Progress — thin controller. Logic + DB live in services/progress.service.js.
// No user-id params anywhere: everything is req.user scoping (photos and
// measurements are private data; owner checks are implicit).
const service = require("../services/progress.service");
const { imageHash } = require("../services/foodLogs.service");

// GET /api/progress/activity — weekly + monthly aggregates for the chart.
async function getActivity(req, res, next) {
  try {
    res.json(await service.getActivity(req.user.id));
  } catch (e) {
    next(e);
  }
}

// GET /api/progress/overview?range=30d|90d|1y|all — multi-metric chart series.
async function getOverview(req, res, next) {
  try {
    res.json(await service.getOverview(req.user.id, req.query.range));
  } catch (e) {
    next(e);
  }
}

// GET /api/progress/photos — metadata only (images served separately).
async function getPhotos(req, res, next) {
  try {
    res.json({ photos: await service.listPhotos(req.user.id) });
  } catch (e) {
    next(e);
  }
}

// POST /api/progress/photos — { pose, image_data } (client-compressed data URL).
// Analysis is a SEPARATE call so retries don't re-upload.
async function postPhoto(req, res, next) {
  try {
    const { pose, image_data } = req.body || {};
    const photo = await service.savePhoto(req.user.id, { pose, image_data });
    res.status(201).json({ success: true, ...photo });
  } catch (e) {
    next(e);
  }
}

// GET /api/progress/photos/:id/image — streams the stored data URL back as
// image bytes (auth via cookie; owner-scoped).
async function getPhotoImage(req, res, next) {
  try {
    const photo = await service.getPhotoImage(req.user.id, req.params.photoId);
    if (!photo) return res.status(404).json({ error: "Photo not found" });
    const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec((photo.image_data || "").trim());
    if (!m) return res.status(404).json({ error: "Photo data missing" });
    res.set("Content-Type", m[1]);
    res.set("Cache-Control", "private, max-age=86400");
    res.send(Buffer.from(m[2], "base64"));
  } catch (e) {
    next(e);
  }
}

// POST /api/progress/photos/:id/analyze — Gemini per-photo review.
async function postAnalyze(req, res, next) {
  try {
    const result = await service.analyzePhoto(req.user.id, req.params.photoId);
    res.json(result);
  } catch (e) {
    if (e.name === "AIServiceError" || (e.message || "").includes("failed")) {
      return next(e);
    }
    next(e);
  }
}

// POST /api/progress/compare — { pose } latest-vs-previous Gemini comparison.
async function postCompare(req, res, next) {
  try {
    const { pose } = req.body || {};
    res.json(await service.compareLatest(req.user.id, pose));
  } catch (e) {
    next(e);
  }
}

// GET /api/progress/cadence — check-in cadence + per-pose next-allowed state.
async function getCadence(req, res, next) {
  try {
    res.json(await service.getCheckinState(req.user.id));
  } catch (e) {
    next(e);
  }
}

// PUT /api/progress/cadence — { cadence: 'weekly' | 'monthly' }.
async function putCadence(req, res, next) {
  try {
    res.json(await service.setCadence(req.user.id, (req.body || {}).cadence));
  } catch (e) {
    next(e);
  }
}

// DELETE /api/progress/photos/:id
async function deletePhoto(req, res, next) {
  try {
    const ok = await service.deletePhoto(req.user.id, req.params.photoId);
    if (!ok) return res.status(404).json({ error: "Photo not found" });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

// GET /api/progress/measurements
async function getMeasurements(req, res, next) {
  try {
    res.json({ measurements: await service.listMeasurements(req.user.id, req.query?.limit) });
  } catch (e) {
    next(e);
  }
}

// POST /api/progress/measurements — upsert by date; weight mirrors to BMI.
async function postMeasurements(req, res, next) {
  try {
    res.json(await service.saveMeasurements(req.user.id, req.body || {}));
  } catch (e) {
    next(e);
  }
}

// DELETE /api/progress/measurements/:id
async function deleteMeasurement(req, res, next) {
  try {
    const ok = await service.deleteMeasurement(req.user.id, req.params.measurementId);
    if (!ok) return res.status(404).json({ error: "Measurement not found" });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

// GET /api/progress/export.csv — text attachment (workouts + measurements + photos).
async function getExport(req, res, next) {
  try {
    const csv = await service.buildExportCsv(req.user.id);
    res.set("Content-Type", "text/csv; charset=utf-8");
    res.set("Content-Disposition", `attachment; filename="vitalis-progress-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (e) {
    next(e);
  }
}

// GET /api/progress/diary.txt — AI progress letter (text attachment).
async function getDiary(req, res, next) {
  try {
    const text = await service.buildDiary(req.user.id);
    res.set("Content-Type", "text/plain; charset=utf-8");
    res.set("Content-Disposition", `attachment; filename="vitalis-diary-${new Date().toISOString().slice(0, 10)}.txt"`);
    res.send(text);
  } catch (e) {
    next(e);
  }
}

module.exports = {
  getActivity,
  getOverview,
  getPhotos,
  postPhoto,
  getPhotoImage,
  postAnalyze,
  postCompare,
  getCadence,
  putCadence,
  deletePhoto,
  getMeasurements,
  postMeasurements,
  deleteMeasurement,
  getExport,
  getDiary,
  imageHash,
};
