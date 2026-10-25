-- 035_training_preferences.sql — Module 5 local storage for the personalization
-- inputs the spec assigns to this module's workout recommendation engine:
--   equipment             JSON array of strings the user actually trains with
--                         (e.g. ["Bodyweight","Dumbbells"]) — "none allowed".
--   preferred_days        JSON array of weekday ints, 0=Sun … 6=Sat. Drives the
--                         day-cycling schedule on the Plans tracker.
--   session_duration_mins preferred session length (20/30/45/60 or custom).
--                         Drives "fit to N minutes" plan-day trimming.
--   workout_location      descriptive only (Home/Gym/…) — optional.
--
-- One row per user (PK user_id, upsert on PUT /api/training-preferences).
-- Self-report only: values are never used to auto-increase intensity.
-- Idempotent: safe to run twice (runner ignores 1050/1060/1061/1091).

SET FOREIGN_KEY_CHECKS=0;

CREATE TABLE IF NOT EXISTS `training_preferences` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `equipment` json DEFAULT NULL,
  `preferred_days` json DEFAULT NULL,
  `session_duration_mins` int(11) DEFAULT NULL,
  `workout_location` varchar(50) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_training_prefs_user` (`user_id`),
  CONSTRAINT `training_preferences_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;
