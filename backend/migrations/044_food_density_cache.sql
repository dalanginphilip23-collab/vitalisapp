-- 044_food_density_cache.sql — AI per-100 g nutrition estimates, cached by
-- normalized food name. The manual meal form asks Gemini for a density when a
-- dish is not in `food_catalog`; storing it makes repeat foods instant and
-- keeps AI quota/cost bounded. Catalog rows are never written here.
--
-- Source is kept so the UI can label an estimate. Rows are validated/clamped
-- in src/utils/nutrition.js before insert.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS (runner also ignores 1050/1146).
SET FOREIGN_KEY_CHECKS=0;

CREATE TABLE IF NOT EXISTS `food_nutrition_cache` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name_normalized` varchar(160) NOT NULL,
  `display_name` varchar(150) NOT NULL,
  `calories` int(11) NOT NULL DEFAULT 0,
  `protein` decimal(6,2) NOT NULL DEFAULT 0.00,
  `carbs` decimal(6,2) NOT NULL DEFAULT 0.00,
  `fat` decimal(6,2) NOT NULL DEFAULT 0.00,
  `source` varchar(20) NOT NULL DEFAULT 'ai',
  `model` varchar(80) DEFAULT NULL,
  `hit_count` int(11) NOT NULL DEFAULT 1,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_food_density_name` (`name_normalized`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SET FOREIGN_KEY_CHECKS=1;
