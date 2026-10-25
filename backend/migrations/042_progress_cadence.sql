-- 042_progress_cadence.sql — progress photo check-in cadence per user.
-- cadence_days is the ENFORCED minimum gap between two uploads of the SAME
-- pose (7 = weekly, 30 = monthly). A pose's first photo is always allowed.
-- Latest-vs-previous Gemini compare pairs up with this for fair before/after.

SET FOREIGN_KEY_CHECKS=0;

CREATE TABLE IF NOT EXISTS `progress_settings` (
  `user_id` int(11) NOT NULL,
  `cadence_days` tinyint(3) unsigned NOT NULL DEFAULT 30,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_progress_settings_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;
