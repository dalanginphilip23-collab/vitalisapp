const express=require('express');
const router=express.Router();
const verifyUser=require('../middleware/verifyUser');
const { aiLimiter, writeLimiter, meLimiter }=require('../middleware/rateLimits');
const aiQuota=require('../middleware/aiQuota');
const controller=require('../controllers/progress.controller');

// Module 6 — everything owner-scoped via req.user (photos/measurements are
// private); AI endpoints burn the same daily aiQuota budget as meal scans.
const read=meLimiter();

router.get('/activity', verifyUser, read, controller.getActivity);
// Multi-metric overview for the Logs progress chart (30d/90d/1y/all).
router.get('/overview', verifyUser, read, controller.getOverview);

// Photos: upload first, analyze separately (retry-friendly, quota-safe).
// NOTE Express 5: no :param(\d+) constraints — ownership + 404 handling is
// in the service/controller anyway.
router.get('/photos', verifyUser, read, controller.getPhotos);
router.post('/photos', verifyUser, writeLimiter(), controller.postPhoto);
router.get('/photos/:photoId/image', verifyUser, read, controller.getPhotoImage);
router.post('/photos/:photoId/analyze', verifyUser, aiLimiter(), aiQuota, controller.postAnalyze);
router.delete('/photos/:photoId', verifyUser, writeLimiter(), controller.deletePhoto);
router.post('/compare', verifyUser, aiLimiter(), aiQuota, controller.postCompare);

// Photo check-in cadence (weekly/monthly) + per-pose next-allowed cooldowns.
router.get('/cadence', verifyUser, read, controller.getCadence);
router.put('/cadence', verifyUser, writeLimiter(), controller.putCadence);

// Body measurements: upsert-by-date + delete.
router.get('/measurements', verifyUser, read, controller.getMeasurements);
router.post('/measurements', verifyUser, writeLimiter(), controller.postMeasurements);
router.delete('/measurements/:measurementId', verifyUser, writeLimiter(), controller.deleteMeasurement);

// Export: one CSV bundle + AI diary letter.
router.get('/export.csv', verifyUser, writeLimiter(), controller.getExport);
router.get('/diary.txt', verifyUser, aiLimiter(), aiQuota, controller.getDiary);

module.exports=router;
