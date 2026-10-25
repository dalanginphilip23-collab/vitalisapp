-- 033_user_allergies.sql — one row per allergy (a user can have many).
-- Written by POST /api/auth/complete-onboarding (onboarding step "Allergies"),
-- read by the meal-tracker scan to warn about matching foods.
-- Idempotent: safe to run twice (runner also ignores duplicates).

SET FOREIGN_KEY_CHECKS=0;

CREATE TABLE IF NOT EXISTS `user_allergies` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `allergy_name` varchar(60) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_allergy` (`user_id`,`allergy_name`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `user_allergies_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;
