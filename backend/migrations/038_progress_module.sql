-- 038_progress_module.sql — Module 6 (Progress Analytics & Visual Tracking):
-- progress photos (front/side/back, Gemini-analyzed) + body measurements.
--
-- progress_photos:
--   pose        'front' | 'side' | 'back' — standardized angles for comparison.
--   image_data  compressed client-side (~896px JPEG) and stored as a data URL;
--               served back through GET /api/progress/photos/:id/image (owner
--               only — photos are private to the user, never shared).
--   ai_rating   Gemini 1–5 photo-quality/visibility score (NULL = not analyzed).
--   ai_quality  per-photo Gemini review JSON (lighting/framing/pose cues).
--   ai_summary  plain-English notes; ALWAYS labeled as visual estimates.
--
-- body_measurements:
--   weight + body fat % + tape set (chest/waist/hips/arm/thigh cm). One row per
--   user per date (UNIQUE) — saving today's entry again upserts. A non-null
--   weight mirrors into bmi_records so the Body tab's BMI history and the
--   weight trend stay consistent.
--
-- Idempotent: safe to run twice (runner ignores 1050/1060/1061/1091).

SET FOREIGN_KEY_CHECKS=0;

CREATE TABLE IF NOT EXISTS `progress_photos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `pose` varchar(10) NOT NULL,
  `image_data` mediumtext DEFAULT NULL,
  `ai_rating` tinyint(4) DEFAULT NULL,
  `ai_quality` text DEFAULT NULL,
  `ai_summary` text DEFAULT NULL,
  `captured_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_progress_photo_row` (`id`),
  KEY `idx_progress_photos_user` (`user_id`),
  KEY `idx_progress_photos_pose` (`user_id`,`pose`,`captured_at`),
  CONSTRAINT `progress_photos_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `body_measurements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `recorded_at` date NOT NULL,
  `weight_kg` decimal(5,2) DEFAULT NULL,
  `body_fat_pct` decimal(4,1) DEFAULT NULL,
  `chest_cm` decimal(5,1) DEFAULT NULL,
  `waist_cm` decimal(5,1) DEFAULT NULL,
  `hips_cm` decimal(5,1) DEFAULT NULL,
  `arm_cm` decimal(5,1) DEFAULT NULL,
  `thigh_cm` decimal(5,1) DEFAULT NULL,
  `notes` varchar(300) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_body_meas_user_day` (`user_id`,`recorded_at`),
  KEY `idx_body_meas_user` (`user_id`),
  KEY `idx_body_meas_date` (`user_id`,`recorded_at`),
  CONSTRAINT `body_measurements_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SET FOREIGN_KEY_CHECKS=1;
