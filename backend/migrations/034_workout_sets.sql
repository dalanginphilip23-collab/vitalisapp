-- 034_workout_sets.sql — Module 5 (Adaptive Workout Recommendation and Logging):
-- structured set logging + session pause + post-workout feedback.
--
-- workout_sets: one row per logged set (reps / weight / duration / distance).
-- Written by PATCH /api/workout-logs/:id/end (sets array) and the manual
-- workout logger in the Log page; read by GET /api/workout-logs/:id and the
-- progressive-overload view of workout history.
--
-- workout_logs additions:
--   paused_seconds    accumulated pause time, subtracted from duration_seconds
--                     so logged duration reflects active exercise time only.
--   pause_started_at  moment the current pause began (NULL = not paused).
--                     Cleared on resume; folded into paused_seconds on end.
--   difficulty_rating post-workout self-report 1–5 ("How did it feel?") and
--   session_notes     optional note — feed future plan adjustment (Module 5
--                     adaptive engine) WITHOUT auto-increasing intensity.
--
-- Self-report only: ratings are user-entered, never computed.
-- Idempotent: safe to run twice (runner ignores 1050/1060/1061/1091).

SET FOREIGN_KEY_CHECKS=0;

CREATE TABLE IF NOT EXISTS `workout_sets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `workout_log_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `exercise_name` varchar(150) NOT NULL,
  `set_number` int(11) NOT NULL DEFAULT 1,
  `reps` int(11) DEFAULT NULL,
  `weight_kg` decimal(6,2) DEFAULT NULL,
  `duration_seconds` int(11) DEFAULT NULL,
  `distance_meters` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_workout_sets_log` (`workout_log_id`),
  KEY `idx_workout_sets_user` (`user_id`),
  CONSTRAINT `workout_sets_ibfk_1` FOREIGN KEY (`workout_log_id`) REFERENCES `workout_logs` (`id`) ON DELETE CASCADE,
  CONSTRAINT `workout_sets_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `workout_logs`
  ADD COLUMN `paused_seconds` int(11) DEFAULT 0 AFTER `duration_seconds`,
  ADD COLUMN `pause_started_at` datetime DEFAULT NULL AFTER `paused_seconds`,
  ADD COLUMN `difficulty_rating` tinyint(4) DEFAULT NULL AFTER `pause_started_at`,
  ADD COLUMN `session_notes` varchar(500) DEFAULT NULL AFTER `difficulty_rating`;

SET FOREIGN_KEY_CHECKS=1;
