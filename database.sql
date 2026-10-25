-- database.sql - Vitalis full schema + seed data
-- Generated for a clean XAMPP (MariaDB 10.4) / MySQL 8 phpMyAdmin import.
--
-- Source of truth:
--   backend/migrations/001..029, 031  (table schema)
--   backend/migrations/032            (plans / fitness_goals alterations)
--   backend/src/db/seeds/plans_full.sql (plans, plan_contents, plan_exercises)
--
-- What this does:
--   1. Creates database `fitnessapp` and selects it.
--   2. Drops and recreates all 30 application tables (clean reset).
--   3. Loads the 6 plan programs with all days and exercises.
--   4. Fills `_migrations` so `npm run db:migrate` reports nothing pending.
--
-- Safe to paste straight into the phpMyAdmin "Import" tab or the SQL tab.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET @OLD_SQL_MODE = @@SQL_MODE;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

CREATE DATABASE IF NOT EXISTS `fitnessapp`
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `fitnessapp`;

-- --------------------------------------------------------
-- Drop existing tables (clean reset)
-- --------------------------------------------------------
DROP TABLE IF EXISTS `_migrations`;
DROP TABLE IF EXISTS `landing_visits`;
DROP TABLE IF EXISTS `workout_logs`;
DROP TABLE IF EXISTS `user_settings`;
DROP TABLE IF EXISTS `user_sessions`;
DROP TABLE IF EXISTS `user_profiles`;
DROP TABLE IF EXISTS `user_plans`;
DROP TABLE IF EXISTS `user_plan_progress`;
DROP TABLE IF EXISTS `user_nutrient_goals`;
DROP TABLE IF EXISTS `sleep_logs`;
DROP TABLE IF EXISTS `password_reset_otps`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `messages`;
DROP TABLE IF EXISTS `friendships`;
DROP TABLE IF EXISTS `food_logs`;
DROP TABLE IF EXISTS `fitness_goals`;
DROP TABLE IF EXISTS `email_verifications`;
DROP TABLE IF EXISTS `daily_stats`;
DROP TABLE IF EXISTS `daily_checkins`;
DROP TABLE IF EXISTS `community_comments`;
DROP TABLE IF EXISTS `community_likes`;
DROP TABLE IF EXISTS `community_posts`;
DROP TABLE IF EXISTS `bmi_records`;
DROP TABLE IF EXISTS `ai_insight_cache`;
DROP TABLE IF EXISTS `ai_daily_usage`;
DROP TABLE IF EXISTS `activity_kudos`;
DROP TABLE IF EXISTS `activity_logs`;
DROP TABLE IF EXISTS `plan_exercises`;
DROP TABLE IF EXISTS `plan_contents`;
DROP TABLE IF EXISTS `plans`;
DROP TABLE IF EXISTS `users`;

-- --------------------------------------------------------
-- Schema
-- --------------------------------------------------------
-- ===== 001_users.sql =====
-- 001_users.sql — baseline split (idempotent, one table per file)
-- Source: 001_baseline.sql squash of 001-034. Runner ignores duplicates.
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `email` varchar(191) NOT NULL,
  `password` varchar(255) NOT NULL,
  `fitness_goal` varchar(100) DEFAULT NULL,
  `avatar_url` longtext DEFAULT NULL,
  `is_online` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_verified` tinyint(1) NOT NULL DEFAULT 0,
  `onboarding_completed` tinyint(1) NOT NULL DEFAULT 0,
  `token_version` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_email` (`email`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 002_plans.sql =====
-- 002_plans.sql — baseline split (idempotent, one table per file)
-- Source: 001_baseline.sql squash of 001-034. Runner ignores duplicates.
CREATE TABLE IF NOT EXISTS `plans` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `title` varchar(200) NOT NULL,
  `tag` varchar(100) DEFAULT NULL,
  `intensity` varchar(50) DEFAULT NULL,
  `duration` varchar(50) DEFAULT NULL,
  `target_focus` varchar(100) DEFAULT NULL,
  `price` decimal(8,2) DEFAULT 0.00,
  `image_seed` varchar(100) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `duration_days` int(11) DEFAULT NULL,
  `difficulty` varchar(50) DEFAULT NULL,
  `image_url` varchar(500) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_plan_title` (`title`),
  KEY `idx_difficulty` (`difficulty`),
  KEY `idx_duration_days` (`duration_days`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 003_plan_contents.sql =====
-- 003_plan_contents.sql — baseline split (idempotent, one table per file)
-- Source: 001_baseline.sql squash of 001-034. Runner ignores duplicates.
CREATE TABLE IF NOT EXISTS `plan_contents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `plan_id` int(11) NOT NULL,
  `day_number` int(11) NOT NULL,
  `title` varchar(200) DEFAULT NULL,
  `activity_type` varchar(100) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `duration_mins` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_plan_day` (`plan_id`,`day_number`),
  KEY `idx_plan_id` (`plan_id`),
  KEY `idx_day_number` (`day_number`),
  CONSTRAINT `plan_contents_ibfk_1` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 004_plan_exercises.sql =====
-- 004_plan_exercises.sql — baseline split (idempotent, one table per file)
-- Source: 001_baseline.sql squash of 001-034. Runner ignores duplicates.
CREATE TABLE IF NOT EXISTS `plan_exercises` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `plan_content_id` int(11) NOT NULL,
  `exercise_order` int(11) NOT NULL DEFAULT 1,
  `exercise_name` varchar(150) NOT NULL,
  `sets` int(11) DEFAULT NULL,
  `reps` varchar(50) DEFAULT NULL,
  `duration_seconds` int(11) DEFAULT NULL,
  `rest_seconds` int(11) DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_plan_content_id` (`plan_content_id`),
  CONSTRAINT `plan_exercises_ibfk_1` FOREIGN KEY (`plan_content_id`) REFERENCES `plan_contents` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 005_activity_logs.sql =====
-- 005_activity_logs.sql — baseline split (idempotent, one table per file)
-- Source: 001_baseline.sql squash of 001-034. Runner ignores duplicates.
CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `duration` int(11) DEFAULT NULL COMMENT 'in seconds',
  `distance` decimal(10,2) DEFAULT NULL COMMENT 'in kilometers',
  `pace` varchar(20) DEFAULT NULL,
  `calories` int(11) DEFAULT NULL,
  `is_gps` tinyint(1) NOT NULL DEFAULT 1,
  `route` longtext DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_user_created` (`user_id`,`created_at`),
  CONSTRAINT `activity_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 006_activity_kudos.sql =====
-- 006_activity_kudos.sql — baseline split (idempotent, one table per file)
-- Source: 001_baseline.sql squash of 001-034. Runner ignores duplicates.
CREATE TABLE IF NOT EXISTS `activity_kudos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `activity_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_activity_user` (`activity_id`,`user_id`),
  KEY `idx_activity` (`activity_id`),
  KEY `fk_kudos_user` (`user_id`),
  CONSTRAINT `fk_kudos_activity` FOREIGN KEY (`activity_id`) REFERENCES `activity_logs` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_kudos_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 007_ai_daily_usage.sql =====
-- 007_ai_daily_usage.sql — baseline split (idempotent, one table per file)
-- Source: 001_baseline.sql squash of 001-034. Runner ignores duplicates.
CREATE TABLE IF NOT EXISTS `ai_daily_usage` (
  `user_id` int(11) NOT NULL,
  `usage_day` date NOT NULL,
  `count` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`user_id`,`usage_day`),
  CONSTRAINT `fk_ai_usage_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 008_ai_insight_cache.sql =====
-- 008_ai_insight_cache.sql — baseline split (idempotent, one table per file)
-- Source: 001_baseline.sql squash of 001-034. Runner ignores duplicates.
CREATE TABLE IF NOT EXISTS `ai_insight_cache` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `data_signature` varchar(255) NOT NULL DEFAULT '',
  `sleep_suggestion` text DEFAULT NULL,
  `activity_suggestion` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ai_cache_user_sig` (`user_id`,`data_signature`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_updated_at` (`updated_at`),
  CONSTRAINT `ai_insight_cache_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 009_bmi_records.sql =====
-- 009_bmi_records.sql — baseline split (idempotent, one table per file)
-- Source: 001_baseline.sql squash of 001-034. Runner ignores duplicates.
CREATE TABLE IF NOT EXISTS `bmi_records` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `weight_kg` decimal(5,2) DEFAULT NULL,
  `height_cm` decimal(5,2) DEFAULT NULL,
  `bmi` decimal(5,2) DEFAULT NULL,
  `bmi_category` varchar(50) DEFAULT NULL,
  `recorded_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_recorded_at` (`recorded_at`),
  KEY `idx_user_recorded` (`user_id`,`recorded_at`),
  CONSTRAINT `bmi_records_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 010_community_posts.sql =====
-- 010_community_posts.sql — baseline split (idempotent, one table per file)
-- Source: 001_baseline.sql squash of 001-034. Runner ignores duplicates.
CREATE TABLE IF NOT EXISTS `community_posts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `author_name` varchar(100) NOT NULL,
  `text` varchar(1000) NOT NULL,
  `tag` varchar(40) NOT NULL DEFAULT 'General',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created` (`created_at`),
  KEY `idx_user_created` (`user_id`,`created_at`),
  KEY `idx_tag_created` (`tag`,`created_at`),
  CONSTRAINT `fk_community_posts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 011_community_likes.sql =====
-- 011_community_likes.sql — baseline split (idempotent, one table per file)
-- Source: 001_baseline.sql squash of 001-034. Runner ignores duplicates.
CREATE TABLE IF NOT EXISTS `community_likes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `post_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_post_user` (`post_id`,`user_id`),
  KEY `idx_post` (`post_id`),
  KEY `fk_community_likes_user` (`user_id`),
  CONSTRAINT `fk_community_likes_post` FOREIGN KEY (`post_id`) REFERENCES `community_posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_community_likes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 012_community_comments.sql =====
-- 012_community_comments.sql — baseline split (idempotent, one table per file)
-- Source: 001_baseline.sql squash of 001-034. Runner ignores duplicates.
CREATE TABLE IF NOT EXISTS `community_comments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `post_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `author_name` varchar(100) NOT NULL,
  `text` varchar(500) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_post_created` (`post_id`,`created_at`),
  KEY `fk_community_comments_user` (`user_id`),
  KEY `idx_post_user_created` (`post_id`,`user_id`,`created_at`),
  CONSTRAINT `fk_community_comments_post` FOREIGN KEY (`post_id`) REFERENCES `community_posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_community_comments_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 013_daily_checkins.sql =====
-- 013_daily_checkins.sql — baseline split (idempotent, one table per file)
-- Source: 001_baseline.sql squash of 001-034. Runner ignores duplicates.
CREATE TABLE IF NOT EXISTS `daily_checkins` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `checkin_date` date NOT NULL,
  `sleep_hours` decimal(4,1) DEFAULT NULL,
  `sleep_quality` varchar(20) DEFAULT NULL,
  `stress_level` varchar(20) DEFAULT NULL,
  `soreness_level` varchar(20) DEFAULT NULL,
  `energy_level` varchar(20) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_checkin_user_date` (`user_id`,`checkin_date`),
  KEY `idx_checkin_user` (`user_id`),
  KEY `idx_checkin_date` (`checkin_date`),
  CONSTRAINT `daily_checkins_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 014_daily_stats.sql =====
-- 014_daily_stats.sql — baseline split (idempotent, one table per file)
-- Source: 001_baseline.sql squash of 001-034. Runner ignores duplicates.
CREATE TABLE IF NOT EXISTS `daily_stats` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `stat_date` date NOT NULL,
  `calories_burned` int(11) DEFAULT 0,
  `steps` int(11) DEFAULT 0,
  `workout_duration_mins` int(11) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_date` (`user_id`,`stat_date`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_stat_date` (`stat_date`),
  KEY `idx_user_date` (`user_id`,`stat_date`),
  CONSTRAINT `daily_stats_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 015_email_verifications.sql =====
-- 015_email_verifications.sql — baseline split (idempotent, one table per file)
-- Source: 001_baseline.sql squash of 001-034. Runner ignores duplicates.
CREATE TABLE IF NOT EXISTS `email_verifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `token_hash` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_user_used_expires` (`user_id`,`used`,`expires_at`),
  CONSTRAINT `email_verifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 016_fitness_goals.sql =====
-- 016_fitness_goals.sql — baseline split (idempotent, one table per file)
-- Source: 001_baseline.sql squash of 001-034. Runner ignores duplicates.
CREATE TABLE IF NOT EXISTS `fitness_goals` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `dob` date DEFAULT NULL,
  `sex` varchar(20) DEFAULT NULL,
  `height_cm` decimal(5,1) DEFAULT NULL,
  `weight_kg` decimal(5,1) DEFAULT NULL,
  `bmi` decimal(4,1) DEFAULT NULL,
  `goal_type` varchar(30) NOT NULL DEFAULT 'MAINTAIN_WEIGHT',
  `target_weight_kg` decimal(5,1) DEFAULT NULL,
  `pace` varchar(20) DEFAULT NULL,
  `focus` varchar(40) DEFAULT NULL,
  `activity_level` varchar(30) DEFAULT NULL,
  `sleep_hours` decimal(3,1) DEFAULT NULL,
  `sleep_quality` varchar(20) DEFAULT NULL,
  `stress_level` varchar(20) DEFAULT NULL,
  `exercise_freq` varchar(20) DEFAULT NULL,
  `recovery_level` varchar(20) DEFAULT NULL,
  `daily_kcal` int(11) DEFAULT NULL,
  `protein_g` int(11) DEFAULT NULL,
  `carbs_g` int(11) DEFAULT NULL,
  `fat_g` int(11) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_status` (`user_id`,`status`),
  CONSTRAINT `fitness_goals_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 017_food_logs.sql =====
-- 017_food_logs.sql — baseline split (idempotent, one table per file)
-- Source: 001_baseline.sql squash of 001-034. Runner ignores duplicates.
CREATE TABLE IF NOT EXISTS `food_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `food_name` varchar(200) NOT NULL,
  `serving` varchar(100) DEFAULT NULL,
  `calories` int(11) DEFAULT 0,
  `protein` decimal(10,2) DEFAULT NULL,
  `carbs` decimal(10,2) DEFAULT NULL,
  `fat` decimal(10,2) DEFAULT NULL,
  `saturated_fat` decimal(10,2) DEFAULT 0.00,
  `trans_fat` decimal(10,2) DEFAULT 0.00,
  `polyunsaturated_fat` decimal(10,2) DEFAULT 0.00,
  `monounsaturated_fat` decimal(10,2) DEFAULT 0.00,
  `image_url` varchar(500) DEFAULT NULL,
  `logged_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_logged_at` (`logged_at`),
  KEY `idx_user_logged` (`user_id`,`logged_at`),
  CONSTRAINT `food_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 018_friendships.sql =====
-- 018_friendships.sql — baseline split (idempotent, one table per file)
-- Source: 001_baseline.sql squash of 001-034. Runner ignores duplicates.
CREATE TABLE IF NOT EXISTS `friendships` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `friend_id` int(11) NOT NULL,
  `status` varchar(50) DEFAULT 'pending',
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_friendship` (`user_id`,`friend_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_friend_id` (`friend_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `friendships_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `friendships_ibfk_2` FOREIGN KEY (`friend_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 019_messages.sql =====
-- 019_messages.sql — baseline split (idempotent, one table per file)
-- Source: 001_baseline.sql squash of 001-034. Runner ignores duplicates.
CREATE TABLE IF NOT EXISTS `messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sender_id` int(11) NOT NULL,
  `receiver_id` int(11) NOT NULL,
  `content` text NOT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(10,8) DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `sent_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_sender_id` (`sender_id`),
  KEY `idx_receiver_id` (`receiver_id`),
  KEY `idx_sent_at` (`sent_at`),
  KEY `idx_is_read` (`is_read`),
  KEY `idx_receiver_read_sent` (`receiver_id`,`is_read`,`sent_at`),
  CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `messages_ibfk_2` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 020_notifications.sql =====
-- 020_notifications.sql — baseline split (idempotent, one table per file)
-- Source: 001_baseline.sql squash of 001-034. Runner ignores duplicates.
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `message` varchar(500) NOT NULL,
  `type` varchar(50) DEFAULT 'info',
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `category` varchar(30) NOT NULL DEFAULT 'SYSTEM',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_is_read` (`is_read`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_user_cat_created` (`user_id`,`category`,`created_at`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 021_password_reset_otps.sql =====
-- 021_password_reset_otps.sql — baseline split (idempotent, one table per file)
-- Source: 001_baseline.sql squash of 001-034. Runner ignores duplicates.
CREATE TABLE IF NOT EXISTS `password_reset_otps` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `otp_hash` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_used` (`used`),
  KEY `idx_expires_at` (`expires_at`),
  KEY `idx_user_used_expires` (`user_id`,`used`,`expires_at`),
  CONSTRAINT `password_reset_otps_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 022_sleep_logs.sql =====
-- 022_sleep_logs.sql — baseline split (idempotent, one table per file)
-- Source: 001_baseline.sql squash of 001-034. Runner ignores duplicates.
CREATE TABLE IF NOT EXISTS `sleep_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `sleep_duration` int(11) DEFAULT NULL,
  `sleep_quality` int(11) DEFAULT NULL,
  `recovery_score` int(11) DEFAULT NULL,
  `water_intake_ml` int(11) DEFAULT NULL,
  `recorded_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_recorded_at` (`recorded_at`),
  KEY `idx_user_recorded` (`user_id`,`recorded_at`),
  CONSTRAINT `sleep_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 023_user_nutrient_goals.sql =====
-- 023_user_nutrient_goals.sql — baseline split (idempotent, one table per file)
-- Source: 001_baseline.sql squash of 001-034. Runner ignores duplicates.
CREATE TABLE IF NOT EXISTS `user_nutrient_goals` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `nutrient` varchar(40) NOT NULL COMMENT 'PROTEIN, CARBOHYDRATES, FAT, TRANS_FAT, SATURATED_FAT, POLYUNSATURATED_FAT, MONOUNSATURATED_FAT',
  `target_value` decimal(10,2) DEFAULT NULL COMMENT 'user goal amount (e.g. grams)',
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_nutrient` (`user_id`,`nutrient`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_user_active` (`user_id`,`is_active`),
  CONSTRAINT `fk_nutrient_goals_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 024_user_plan_progress.sql =====
-- 024_user_plan_progress.sql — baseline split (idempotent, one table per file)
-- Source: 001_baseline.sql squash of 001-034. Runner ignores duplicates.
CREATE TABLE IF NOT EXISTS `user_plan_progress` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `plan_id` int(11) NOT NULL,
  `day_number` int(11) NOT NULL,
  `is_completed` tinyint(1) DEFAULT 0,
  `completed_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_plan_day` (`user_id`,`plan_id`,`day_number`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_plan_id` (`plan_id`),
  KEY `idx_is_completed` (`is_completed`),
  CONSTRAINT `user_plan_progress_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_plan_progress_ibfk_2` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 025_user_plans.sql =====
-- 025_user_plans.sql — baseline split (idempotent, one table per file)
-- Source: 001_baseline.sql squash of 001-034. Runner ignores duplicates.
CREATE TABLE IF NOT EXISTS `user_plans` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `plan_id` int(11) NOT NULL,
  `enrolled_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_plan` (`user_id`,`plan_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_plan_id` (`plan_id`),
  CONSTRAINT `user_plans_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_plans_ibfk_2` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 026_user_profiles.sql =====
-- 026_user_profiles.sql — baseline split (idempotent, one table per file)
-- Source: 001_baseline.sql squash of 001-034. Runner ignores duplicates.
CREATE TABLE IF NOT EXISTS `user_profiles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `contact` varchar(20) DEFAULT NULL,
  `bio` text DEFAULT NULL,
  `avatar_url` longtext DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `height_cm` decimal(5,1) DEFAULT NULL,
  `weight_kg` decimal(5,1) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `user_profiles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 027_user_sessions.sql =====
-- 027_user_sessions.sql — baseline split (idempotent, one table per file)
-- Source: 001_baseline.sql squash of 001-034. Runner ignores duplicates.
CREATE TABLE IF NOT EXISTS `user_sessions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `device` varchar(100) DEFAULT NULL,
  `browser` varchar(100) DEFAULT NULL,
  `os` varchar(100) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `location` varchar(100) DEFAULT NULL,
  `is_current` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_is_current` (`is_current`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_user_current_created` (`user_id`,`is_current`,`created_at`),
  CONSTRAINT `user_sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 028_user_settings.sql =====
-- 028_user_settings.sql — baseline split (idempotent, one table per file)
-- Source: 001_baseline.sql squash of 001-034. Runner ignores duplicates.
CREATE TABLE IF NOT EXISTS `user_settings` (
  `user_id` int(11) NOT NULL,
  `units` varchar(20) NOT NULL DEFAULT 'metric',
  `step_goal` int(11) NOT NULL DEFAULT 8000,
  `theme` varchar(20) NOT NULL DEFAULT 'system',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_user_settings_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 029_workout_logs.sql =====
-- 029_workout_logs.sql — baseline split (idempotent, one table per file)
-- Source: 001_baseline.sql squash of 001-034. Runner ignores duplicates.
CREATE TABLE IF NOT EXISTS `workout_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `workout_type` varchar(100) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `rep_count` int(11) DEFAULT 0,
  `start_time` datetime DEFAULT current_timestamp(),
  `end_time` datetime DEFAULT NULL,
  `duration_seconds` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_start_time` (`start_time`),
  KEY `idx_user_status_start` (`user_id`,`status`,`start_time`),
  CONSTRAINT `workout_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 031_landing_visits.sql =====
-- 031_landing_visits.sql — unique-per-day landing visitor counter (privacy-friendly).
-- Stores only a salted SHA-256 of the client IP + visit date. No raw IPs, no PII.
-- Runner is idempotent (IGNORED_ERRNOS covers 1050/1060/1061): safe to re-run.

CREATE TABLE IF NOT EXISTS `landing_visits` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ip_hash` CHAR(64) NOT NULL,
  `visit_date` DATE NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_landing_visits_hash_date` (`ip_hash`, `visit_date`),
  KEY `idx_landing_visits_date` (`visit_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 032_personal_plans.sql (owner/template + goal source columns)
-- --------------------------------------------------------
-- 032_personal_plans.sql — personal user plans (idempotent ALTER migration)
-- Runner ignores duplicate errors (1060,1061,1091,1826,1830,1832). Use plain ALTER.
-- NULL owner_user_id + is_template=1 = marketplace template (existing rows).
-- Set owner_user_id + is_template=0 = user-owned personal plan.
ALTER TABLE `plans` ADD COLUMN `owner_user_id` int(11) DEFAULT NULL;
ALTER TABLE `plans` ADD COLUMN `is_template` tinyint(1) DEFAULT 1;
ALTER TABLE `plans` ADD INDEX `idx_owner` (`owner_user_id`);
ALTER TABLE `plans` ADD CONSTRAINT `plans_ibfk_owner` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

ALTER TABLE `fitness_goals` ADD COLUMN `source_plan_id` int(11) DEFAULT NULL;
ALTER TABLE `fitness_goals` ADD INDEX `idx_source_plan` (`source_plan_id`);
ALTER TABLE `fitness_goals` ADD CONSTRAINT `fitness_goals_ibfk_plan` FOREIGN KEY (`source_plan_id`) REFERENCES `plans` (`id`) ON DELETE SET NULL;

UPDATE `plans` SET `is_template` = 1 WHERE `owner_user_id` IS NULL;

-- --------------------------------------------------------
-- Seed data: plans, plan_contents, plan_exercises
-- --------------------------------------------------------
INSERT INTO `plans` (`id`, `name`, `title`, `tag`, `intensity`, `duration`, `target_focus`, `price`, `image_seed`, `description`, `duration_days`, `difficulty`, `image_url`, `created_at`) VALUES
(40, '', 'Foundations of Strength', 'Strength', 'Beginner', '4 Weeks', 'Full-Body Strength & Power', 0.00, 'foundations', 'A beginner-friendly progressive program built around the big compound lifts, designed to teach solid technique before adding load.', 28, NULL, NULL, '2026-06-17 18:37:01'),
(41, '', 'Iron Forge Protocol', 'Strength', 'Advanced', '8 Weeks', 'Hypertrophy & Max Strength', 19.99, 'ironforge', 'An advanced 8-week hypertrophy block for lifters chasing serious size and max-effort numbers.', 56, NULL, NULL, '2026-06-17 18:37:01'),
(42, '', 'Fat Loss Sprint', 'Fat Loss', 'Moderate', '2 Weeks', 'Fat Loss', 9.99, 'fatloss', 'A high-intensity 2-week metabolic conditioning block combining circuits with short rest intervals.', 14, NULL, NULL, '2026-06-17 18:37:01'),
(43, '', 'Cardio Surge', 'Cardio', 'Moderate', '4 Weeks', 'Cardio Endurance', 0.00, 'cardiosurge', 'A 4-week run/row/bike progression that builds aerobic base and VO2 max without burning you out.', 28, NULL, NULL, '2026-06-17 18:37:01'),
(44, '', 'Mobility Reset', 'Recovery', 'Beginner', '1 Week', 'Recovery', 0.00, 'mobilityreset', 'A gentle 7-day mobility and recovery block to loosen tight joints and reset movement quality.', 7, NULL, NULL, '2026-06-17 18:37:01'),
(45, '', 'Total Flexibility Flow', 'Flexibility', 'Beginner', '2 Weeks', 'Flexibility', 4.99, 'flexflow', 'A 2-week daily stretching routine focused on hip, shoulder, and spine flexibility.', 14, NULL, NULL, '2026-06-17 18:37:01');

INSERT INTO `plan_contents` (`id`, `plan_id`, `day_number`, `title`, `activity_type`, `description`, `duration_mins`, `created_at`) VALUES
(249, 44, 1, 'Morning Mobility Wake-Up', 'Mobility', 'A gentle full-body flow to open up the joints and get blood flowing before the day starts.', 15, '2026-06-17 18:37:01'),
(250, 44, 2, 'Hip Opener Flow', 'Mobility', 'Targeted hip flexor, glute, and adductor stretches to counter the effects of prolonged sitting.', 20, '2026-06-17 18:37:01'),
(251, 44, 3, 'Active Recovery Walk', 'Recovery', 'A relaxed-pace walk paired with deep breathing to promote circulation without adding fatigue.', 30, '2026-06-17 18:37:01'),
(252, 44, 4, 'Shoulder & Spine Reset', 'Mobility', 'Thoracic rotations and shoulder circles to restore upper-body range of motion.', 18, '2026-06-17 18:37:01'),
(253, 44, 5, 'Foam Rolling & Breathwork', 'Recovery', 'Self-myofascial release on major muscle groups followed by five minutes of diaphragmatic breathing.', 15, '2026-06-17 18:37:01'),
(254, 44, 6, 'Full-Body Stretch Flow', 'Mobility', 'A slow, continuous stretch sequence covering every major muscle group.', 25, '2026-06-17 18:37:01'),
(255, 44, 7, 'Rest & Reflect', 'Recovery', 'A true rest day - light walking only, plus a few minutes reflecting on how your body feels after the week.', 10, '2026-06-17 18:37:01'),
(411, 40, 1, 'Week 1: Full-Body Strength A', 'Strength', 'Squat, bench press, and bent-over row at light, controlled loads to groove the core movement patterns.', 45, '2026-06-20 19:50:12'),
(412, 40, 2, 'Week 1: Mobility & Core', 'Mobility', 'Hip, shoulder, and ankle mobility drills paired with a basic anti-rotation core circuit.', 25, '2026-06-20 19:50:12'),
(413, 40, 3, 'Week 1: Full-Body Strength B', 'Strength', 'Deadlift, overhead press, and pull-up (or assisted row) variations focusing on bracing and bar path.', 45, '2026-06-20 19:50:12'),
(414, 40, 4, 'Week 1: Active Recovery Walk', 'Recovery', 'A brisk outdoor or treadmill walk to promote blood flow and aid recovery between lifting days.', 30, '2026-06-20 19:50:12'),
(415, 40, 5, 'Week 1: Full-Body Strength C', 'Strength', 'Front squat, incline press, and single-arm row to round out weekly volume with fresh angles.', 45, '2026-06-20 19:50:12'),
(416, 40, 6, 'Week 1: Conditioning Circuit', 'Cardio', 'Light kettlebell or bodyweight circuit to build work capacity without interfering with strength gains.', 30, '2026-06-20 19:50:12'),
(417, 40, 7, 'Week 1: Rest Day', 'Recovery', 'Full rest. Prioritize sleep, hydration, and protein intake to support muscle repair.', 10, '2026-06-20 19:50:12'),
(418, 40, 8, 'Week 2: Full-Body Strength A', 'Strength', 'Squat, bench press, and bent-over row at light, controlled loads to groove the core movement patterns.', 45, '2026-06-20 19:50:12'),
(419, 40, 9, 'Week 2: Mobility & Core', 'Mobility', 'Hip, shoulder, and ankle mobility drills paired with a basic anti-rotation core circuit.', 25, '2026-06-20 19:50:12'),
(420, 40, 10, 'Week 2: Full-Body Strength B', 'Strength', 'Deadlift, overhead press, and pull-up (or assisted row) variations focusing on bracing and bar path.', 45, '2026-06-20 19:50:12'),
(421, 40, 11, 'Week 2: Active Recovery Walk', 'Recovery', 'A brisk outdoor or treadmill walk to promote blood flow and aid recovery between lifting days.', 30, '2026-06-20 19:50:12'),
(422, 40, 12, 'Week 2: Full-Body Strength C', 'Strength', 'Front squat, incline press, and single-arm row to round out weekly volume with fresh angles.', 45, '2026-06-20 19:50:12'),
(423, 40, 13, 'Week 2: Conditioning Circuit', 'Cardio', 'Light kettlebell or bodyweight circuit to build work capacity without interfering with strength gains.', 30, '2026-06-20 19:50:12'),
(424, 40, 14, 'Week 2: Rest Day', 'Recovery', 'Full rest. Prioritize sleep, hydration, and protein intake to support muscle repair.', 10, '2026-06-20 19:50:12'),
(425, 40, 15, 'Week 3: Full-Body Strength A', 'Strength', 'Squat, bench press, and bent-over row at light, controlled loads to groove the core movement patterns.', 45, '2026-06-20 19:50:12'),
(426, 40, 16, 'Week 3: Mobility & Core', 'Mobility', 'Hip, shoulder, and ankle mobility drills paired with a basic anti-rotation core circuit.', 25, '2026-06-20 19:50:12'),
(427, 40, 17, 'Week 3: Full-Body Strength B', 'Strength', 'Deadlift, overhead press, and pull-up (or assisted row) variations focusing on bracing and bar path.', 45, '2026-06-20 19:50:12'),
(428, 40, 18, 'Week 3: Active Recovery Walk', 'Recovery', 'A brisk outdoor or treadmill walk to promote blood flow and aid recovery between lifting days.', 30, '2026-06-20 19:50:12'),
(429, 40, 19, 'Week 3: Full-Body Strength C', 'Strength', 'Front squat, incline press, and single-arm row to round out weekly volume with fresh angles.', 45, '2026-06-20 19:50:12'),
(430, 40, 20, 'Week 3: Conditioning Circuit', 'Cardio', 'Light kettlebell or bodyweight circuit to build work capacity without interfering with strength gains.', 30, '2026-06-20 19:50:12'),
(431, 40, 21, 'Week 3: Rest Day', 'Recovery', 'Full rest. Prioritize sleep, hydration, and protein intake to support muscle repair.', 10, '2026-06-20 19:50:12'),
(432, 40, 22, 'Week 4: Full-Body Strength A', 'Strength', 'Squat, bench press, and bent-over row at light, controlled loads to groove the core movement patterns.', 45, '2026-06-20 19:50:12'),
(433, 40, 23, 'Week 4: Mobility & Core', 'Mobility', 'Hip, shoulder, and ankle mobility drills paired with a basic anti-rotation core circuit.', 25, '2026-06-20 19:50:12'),
(434, 40, 24, 'Week 4: Full-Body Strength B', 'Strength', 'Deadlift, overhead press, and pull-up (or assisted row) variations focusing on bracing and bar path.', 45, '2026-06-20 19:50:12'),
(435, 40, 25, 'Week 4: Active Recovery Walk', 'Recovery', 'A brisk outdoor or treadmill walk to promote blood flow and aid recovery between lifting days.', 30, '2026-06-20 19:50:12'),
(436, 40, 26, 'Week 4: Full-Body Strength C', 'Strength', 'Front squat, incline press, and single-arm row to round out weekly volume with fresh angles.', 45, '2026-06-20 19:50:12'),
(437, 40, 27, 'Week 4: Conditioning Circuit', 'Cardio', 'Light kettlebell or bodyweight circuit to build work capacity without interfering with strength gains.', 30, '2026-06-20 19:50:12'),
(438, 40, 28, 'Week 4: Rest Day', 'Recovery', 'Full rest. Prioritize sleep, hydration, and protein intake to support muscle repair.', 10, '2026-06-20 19:50:12'),
(439, 41, 1, 'Week 1: Push Day - Chest/Shoulders/Triceps', 'Strength', 'Heavy bench press, overhead press, and dip variations followed by isolation work to failure.', 60, '2026-06-20 19:50:12'),
(440, 41, 2, 'Week 1: Pull Day - Back/Biceps', 'Strength', 'Weighted pull-ups, barbell rows, and deadlift variations with a biceps finisher superset.', 60, '2026-06-20 19:50:12'),
(441, 41, 3, 'Week 1: Leg Day - Quads/Hamstrings/Glutes', 'Strength', 'Back squat or front squat as the primary lift, followed by Romanian deadlifts and accessory leg work.', 65, '2026-06-20 19:50:12'),
(442, 41, 4, 'Week 1: Active Recovery & Mobility', 'Mobility', 'Foam rolling, hip and thoracic mobility work, and light cardio to flush fatigue before the next push.', 20, '2026-06-20 19:50:12'),
(443, 41, 5, 'Week 1: Upper Body Hypertrophy', 'Strength', 'Moderate-load, high-volume upper body supersets targeting chest, back, and shoulders.', 55, '2026-06-20 19:50:12'),
(444, 41, 6, 'Week 1: Lower Body & Core', 'Strength', 'Lunges, leg press, and weighted core circuit to close out the training week with volume.', 55, '2026-06-20 19:50:12'),
(445, 41, 7, 'Week 1: Rest Day', 'Recovery', 'Complete rest. This is where the growth happens - eat, sleep, and let the muscle rebuild.', 10, '2026-06-20 19:50:12'),
(446, 41, 8, 'Week 2: Push Day - Chest/Shoulders/Triceps', 'Strength', 'Heavy bench press, overhead press, and dip variations followed by isolation work to failure.', 60, '2026-06-20 19:50:12'),
(447, 41, 9, 'Week 2: Pull Day - Back/Biceps', 'Strength', 'Weighted pull-ups, barbell rows, and deadlift variations with a biceps finisher superset.', 60, '2026-06-20 19:50:12'),
(448, 41, 10, 'Week 2: Leg Day - Quads/Hamstrings/Glutes', 'Strength', 'Back squat or front squat as the primary lift, followed by Romanian deadlifts and accessory leg work.', 65, '2026-06-20 19:50:12'),
(449, 41, 11, 'Week 2: Active Recovery & Mobility', 'Mobility', 'Foam rolling, hip and thoracic mobility work, and light cardio to flush fatigue before the next push.', 20, '2026-06-20 19:50:12'),
(450, 41, 12, 'Week 2: Upper Body Hypertrophy', 'Strength', 'Moderate-load, high-volume upper body supersets targeting chest, back, and shoulders.', 55, '2026-06-20 19:50:12'),
(451, 41, 13, 'Week 2: Lower Body & Core', 'Strength', 'Lunges, leg press, and weighted core circuit to close out the training week with volume.', 55, '2026-06-20 19:50:12'),
(452, 41, 14, 'Week 2: Rest Day', 'Recovery', 'Complete rest. This is where the growth happens - eat, sleep, and let the muscle rebuild.', 10, '2026-06-20 19:50:12'),
(453, 41, 15, 'Week 3: Push Day - Chest/Shoulders/Triceps', 'Strength', 'Heavy bench press, overhead press, and dip variations followed by isolation work to failure.', 60, '2026-06-20 19:50:12'),
(454, 41, 16, 'Week 3: Pull Day - Back/Biceps', 'Strength', 'Weighted pull-ups, barbell rows, and deadlift variations with a biceps finisher superset.', 60, '2026-06-20 19:50:12'),
(455, 41, 17, 'Week 3: Leg Day - Quads/Hamstrings/Glutes', 'Strength', 'Back squat or front squat as the primary lift, followed by Romanian deadlifts and accessory leg work.', 65, '2026-06-20 19:50:12'),
(456, 41, 18, 'Week 3: Active Recovery & Mobility', 'Mobility', 'Foam rolling, hip and thoracic mobility work, and light cardio to flush fatigue before the next push.', 20, '2026-06-20 19:50:12'),
(457, 41, 19, 'Week 3: Upper Body Hypertrophy', 'Strength', 'Moderate-load, high-volume upper body supersets targeting chest, back, and shoulders.', 55, '2026-06-20 19:50:12'),
(458, 41, 20, 'Week 3: Lower Body & Core', 'Strength', 'Lunges, leg press, and weighted core circuit to close out the training week with volume.', 55, '2026-06-20 19:50:12'),
(459, 41, 21, 'Week 3: Rest Day', 'Recovery', 'Complete rest. This is where the growth happens - eat, sleep, and let the muscle rebuild.', 10, '2026-06-20 19:50:12'),
(460, 41, 22, 'Week 4: Push Day - Chest/Shoulders/Triceps', 'Strength', 'Heavy bench press, overhead press, and dip variations followed by isolation work to failure.', 60, '2026-06-20 19:50:12'),
(461, 41, 23, 'Week 4: Pull Day - Back/Biceps', 'Strength', 'Weighted pull-ups, barbell rows, and deadlift variations with a biceps finisher superset.', 60, '2026-06-20 19:50:12'),
(462, 41, 24, 'Week 4: Leg Day - Quads/Hamstrings/Glutes', 'Strength', 'Back squat or front squat as the primary lift, followed by Romanian deadlifts and accessory leg work.', 65, '2026-06-20 19:50:12'),
(463, 41, 25, 'Week 4: Active Recovery & Mobility', 'Mobility', 'Foam rolling, hip and thoracic mobility work, and light cardio to flush fatigue before the next push.', 20, '2026-06-20 19:50:12'),
(464, 41, 26, 'Week 4: Upper Body Hypertrophy', 'Strength', 'Moderate-load, high-volume upper body supersets targeting chest, back, and shoulders.', 55, '2026-06-20 19:50:12'),
(465, 41, 27, 'Week 4: Lower Body & Core', 'Strength', 'Lunges, leg press, and weighted core circuit to close out the training week with volume.', 55, '2026-06-20 19:50:12'),
(466, 41, 28, 'Week 4: Rest Day', 'Recovery', 'Complete rest. This is where the growth happens - eat, sleep, and let the muscle rebuild.', 10, '2026-06-20 19:50:12'),
(467, 41, 29, 'Week 5: Push Day - Chest/Shoulders/Triceps', 'Strength', 'Heavy bench press, overhead press, and dip variations followed by isolation work to failure.', 60, '2026-06-20 19:50:12'),
(468, 41, 30, 'Week 5: Pull Day - Back/Biceps', 'Strength', 'Weighted pull-ups, barbell rows, and deadlift variations with a biceps finisher superset.', 60, '2026-06-20 19:50:12'),
(469, 41, 31, 'Week 5: Leg Day - Quads/Hamstrings/Glutes', 'Strength', 'Back squat or front squat as the primary lift, followed by Romanian deadlifts and accessory leg work.', 65, '2026-06-20 19:50:12'),
(470, 41, 32, 'Week 5: Active Recovery & Mobility', 'Mobility', 'Foam rolling, hip and thoracic mobility work, and light cardio to flush fatigue before the next push.', 20, '2026-06-20 19:50:12'),
(471, 41, 33, 'Week 5: Upper Body Hypertrophy', 'Strength', 'Moderate-load, high-volume upper body supersets targeting chest, back, and shoulders.', 55, '2026-06-20 19:50:12'),
(472, 41, 34, 'Week 5: Lower Body & Core', 'Strength', 'Lunges, leg press, and weighted core circuit to close out the training week with volume.', 55, '2026-06-20 19:50:12'),
(473, 41, 35, 'Week 5: Rest Day', 'Recovery', 'Complete rest. This is where the growth happens - eat, sleep, and let the muscle rebuild.', 10, '2026-06-20 19:50:12'),
(474, 41, 36, 'Week 6: Push Day - Chest/Shoulders/Triceps', 'Strength', 'Heavy bench press, overhead press, and dip variations followed by isolation work to failure.', 60, '2026-06-20 19:50:12'),
(475, 41, 37, 'Week 6: Pull Day - Back/Biceps', 'Strength', 'Weighted pull-ups, barbell rows, and deadlift variations with a biceps finisher superset.', 60, '2026-06-20 19:50:12'),
(476, 41, 38, 'Week 6: Leg Day - Quads/Hamstrings/Glutes', 'Strength', 'Back squat or front squat as the primary lift, followed by Romanian deadlifts and accessory leg work.', 65, '2026-06-20 19:50:12'),
(477, 41, 39, 'Week 6: Active Recovery & Mobility', 'Mobility', 'Foam rolling, hip and thoracic mobility work, and light cardio to flush fatigue before the next push.', 20, '2026-06-20 19:50:12'),
(478, 41, 40, 'Week 6: Upper Body Hypertrophy', 'Strength', 'Moderate-load, high-volume upper body supersets targeting chest, back, and shoulders.', 55, '2026-06-20 19:50:12'),
(479, 41, 41, 'Week 6: Lower Body & Core', 'Strength', 'Lunges, leg press, and weighted core circuit to close out the training week with volume.', 55, '2026-06-20 19:50:12'),
(480, 41, 42, 'Week 6: Rest Day', 'Recovery', 'Complete rest. This is where the growth happens - eat, sleep, and let the muscle rebuild.', 10, '2026-06-20 19:50:12'),
(481, 41, 43, 'Week 7: Push Day - Chest/Shoulders/Triceps', 'Strength', 'Heavy bench press, overhead press, and dip variations followed by isolation work to failure.', 60, '2026-06-20 19:50:12'),
(482, 41, 44, 'Week 7: Pull Day - Back/Biceps', 'Strength', 'Weighted pull-ups, barbell rows, and deadlift variations with a biceps finisher superset.', 60, '2026-06-20 19:50:12'),
(483, 41, 45, 'Week 7: Leg Day - Quads/Hamstrings/Glutes', 'Strength', 'Back squat or front squat as the primary lift, followed by Romanian deadlifts and accessory leg work.', 65, '2026-06-20 19:50:12'),
(484, 41, 46, 'Week 7: Active Recovery & Mobility', 'Mobility', 'Foam rolling, hip and thoracic mobility work, and light cardio to flush fatigue before the next push.', 20, '2026-06-20 19:50:12'),
(485, 41, 47, 'Week 7: Upper Body Hypertrophy', 'Strength', 'Moderate-load, high-volume upper body supersets targeting chest, back, and shoulders.', 55, '2026-06-20 19:50:12'),
(486, 41, 48, 'Week 7: Lower Body & Core', 'Strength', 'Lunges, leg press, and weighted core circuit to close out the training week with volume.', 55, '2026-06-20 19:50:12'),
(487, 41, 49, 'Week 7: Rest Day', 'Recovery', 'Complete rest. This is where the growth happens - eat, sleep, and let the muscle rebuild.', 10, '2026-06-20 19:50:12'),
(488, 41, 50, 'Week 8: Push Day - Chest/Shoulders/Triceps', 'Strength', 'Heavy bench press, overhead press, and dip variations followed by isolation work to failure.', 60, '2026-06-20 19:50:12'),
(489, 41, 51, 'Week 8: Pull Day - Back/Biceps', 'Strength', 'Weighted pull-ups, barbell rows, and deadlift variations with a biceps finisher superset.', 60, '2026-06-20 19:50:12'),
(490, 41, 52, 'Week 8: Leg Day - Quads/Hamstrings/Glutes', 'Strength', 'Back squat or front squat as the primary lift, followed by Romanian deadlifts and accessory leg work.', 65, '2026-06-20 19:50:12'),
(491, 41, 53, 'Week 8: Active Recovery & Mobility', 'Mobility', 'Foam rolling, hip and thoracic mobility work, and light cardio to flush fatigue before the next push.', 20, '2026-06-20 19:50:12'),
(492, 41, 54, 'Week 8: Upper Body Hypertrophy', 'Strength', 'Moderate-load, high-volume upper body supersets targeting chest, back, and shoulders.', 55, '2026-06-20 19:50:12'),
(493, 41, 55, 'Week 8: Lower Body & Core', 'Strength', 'Lunges, leg press, and weighted core circuit to close out the training week with volume.', 55, '2026-06-20 19:50:12'),
(494, 41, 56, 'Week 8: Rest Day', 'Recovery', 'Complete rest. This is where the growth happens - eat, sleep, and let the muscle rebuild.', 10, '2026-06-20 19:50:12'),
(495, 42, 1, 'Week 1: Full-Body HIIT Circuit', 'HIIT', '40 seconds work / 20 seconds rest full-body circuit combining squats, push-ups, and mountain climbers.', 30, '2026-06-20 19:50:12'),
(496, 42, 2, 'Week 1: Steady-State Cardio', 'Cardio', 'Sustained moderate-pace cardio (jog, bike, or row) to build an aerobic base for fat oxidation.', 35, '2026-06-20 19:50:12'),
(497, 42, 3, 'Week 1: Lower-Body Burner Circuit', 'HIIT', 'Jump squats, lunges, and glute bridges in a fast-paced circuit to spike heart rate and burn calories.', 30, '2026-06-20 19:50:12'),
(498, 42, 4, 'Week 1: Active Recovery Walk', 'Recovery', 'An easy-paced walk to support recovery while still keeping daily activity levels elevated.', 20, '2026-06-20 19:50:12'),
(499, 42, 5, 'Week 1: Upper-Body & Core Circuit', 'HIIT', 'Push-ups, plank variations, and battle-rope or band work in a high-intensity superset format.', 30, '2026-06-20 19:50:12'),
(500, 42, 6, 'Week 1: Interval Sprints', 'Cardio', 'Short, hard sprint intervals with full recovery between rounds to maximize calorie burn.', 25, '2026-06-20 19:50:12'),
(501, 42, 7, 'Week 1: Rest & Recharge', 'Recovery', 'A full rest day to let the nervous system recover from the week\'s high-intensity work.', 10, '2026-06-20 19:50:12'),
(502, 42, 8, 'Week 2: Full-Body HIIT Circuit', 'HIIT', '40 seconds work / 20 seconds rest full-body circuit combining squats, push-ups, and mountain climbers.', 30, '2026-06-20 19:50:12'),
(503, 42, 9, 'Week 2: Steady-State Cardio', 'Cardio', 'Sustained moderate-pace cardio (jog, bike, or row) to build an aerobic base for fat oxidation.', 35, '2026-06-20 19:50:12'),
(504, 42, 10, 'Week 2: Lower-Body Burner Circuit', 'HIIT', 'Jump squats, lunges, and glute bridges in a fast-paced circuit to spike heart rate and burn calories.', 30, '2026-06-20 19:50:12'),
(505, 42, 11, 'Week 2: Active Recovery Walk', 'Recovery', 'An easy-paced walk to support recovery while still keeping daily activity levels elevated.', 20, '2026-06-20 19:50:12'),
(506, 42, 12, 'Week 2: Upper-Body & Core Circuit', 'HIIT', 'Push-ups, plank variations, and battle-rope or band work in a high-intensity superset format.', 30, '2026-06-20 19:50:12'),
(507, 42, 13, 'Week 2: Interval Sprints', 'Cardio', 'Short, hard sprint intervals with full recovery between rounds to maximize calorie burn.', 25, '2026-06-20 19:50:12'),
(508, 42, 14, 'Week 2: Rest & Recharge', 'Recovery', 'A full rest day to let the nervous system recover from the week\'s high-intensity work.', 10, '2026-06-20 19:50:12'),
(509, 43, 1, 'Week 1: Easy Aerobic Base', 'Cardio', 'Low-intensity run, row, or bike session designed to build aerobic base without accumulating fatigue.', 30, '2026-06-20 19:50:12'),
(510, 43, 2, 'Week 1: Tempo Intervals', 'Cardio', 'Comfortably-hard tempo intervals to push lactate threshold and improve sustained pace.', 25, '2026-06-20 19:50:12'),
(511, 43, 3, 'Week 1: Cross-Train Session', 'Cardio', 'A change of modality (bike or row) to build fitness while reducing repetitive impact stress.', 35, '2026-06-20 19:50:12'),
(512, 43, 4, 'Week 1: Mobility & Stretch', 'Mobility', 'Lower-body and hip mobility work to keep joints healthy under increasing training volume.', 20, '2026-06-20 19:50:12'),
(513, 43, 5, 'Week 1: Long Steady Endurance', 'Cardio', 'An extended steady-pace session to build endurance capacity and mental toughness.', 40, '2026-06-20 19:50:12'),
(514, 43, 6, 'Week 1: Hill or Resistance Intervals', 'Cardio', 'Uphill or resisted intervals to build power and strength alongside aerobic capacity.', 30, '2026-06-20 19:50:12'),
(515, 43, 7, 'Week 1: Rest Day', 'Recovery', 'Full rest to allow the cardiovascular system to adapt to the week\'s training load.', 10, '2026-06-20 19:50:12'),
(516, 43, 8, 'Week 2: Easy Aerobic Base', 'Cardio', 'Low-intensity run, row, or bike session designed to build aerobic base without accumulating fatigue.', 30, '2026-06-20 19:50:12'),
(517, 43, 9, 'Week 2: Tempo Intervals', 'Cardio', 'Comfortably-hard tempo intervals to push lactate threshold and improve sustained pace.', 25, '2026-06-20 19:50:12'),
(518, 43, 10, 'Week 2: Cross-Train Session', 'Cardio', 'A change of modality (bike or row) to build fitness while reducing repetitive impact stress.', 35, '2026-06-20 19:50:12'),
(519, 43, 11, 'Week 2: Mobility & Stretch', 'Mobility', 'Lower-body and hip mobility work to keep joints healthy under increasing training volume.', 20, '2026-06-20 19:50:12'),
(520, 43, 12, 'Week 2: Long Steady Endurance', 'Cardio', 'An extended steady-pace session to build endurance capacity and mental toughness.', 40, '2026-06-20 19:50:12'),
(521, 43, 13, 'Week 2: Hill or Resistance Intervals', 'Cardio', 'Uphill or resisted intervals to build power and strength alongside aerobic capacity.', 30, '2026-06-20 19:50:12'),
(522, 43, 14, 'Week 2: Rest Day', 'Recovery', 'Full rest to allow the cardiovascular system to adapt to the week\'s training load.', 10, '2026-06-20 19:50:12'),
(523, 43, 15, 'Week 3: Easy Aerobic Base', 'Cardio', 'Low-intensity run, row, or bike session designed to build aerobic base without accumulating fatigue.', 30, '2026-06-20 19:50:12'),
(524, 43, 16, 'Week 3: Tempo Intervals', 'Cardio', 'Comfortably-hard tempo intervals to push lactate threshold and improve sustained pace.', 25, '2026-06-20 19:50:12'),
(525, 43, 17, 'Week 3: Cross-Train Session', 'Cardio', 'A change of modality (bike or row) to build fitness while reducing repetitive impact stress.', 35, '2026-06-20 19:50:12'),
(526, 43, 18, 'Week 3: Mobility & Stretch', 'Mobility', 'Lower-body and hip mobility work to keep joints healthy under increasing training volume.', 20, '2026-06-20 19:50:12'),
(527, 43, 19, 'Week 3: Long Steady Endurance', 'Cardio', 'An extended steady-pace session to build endurance capacity and mental toughness.', 40, '2026-06-20 19:50:12'),
(528, 43, 20, 'Week 3: Hill or Resistance Intervals', 'Cardio', 'Uphill or resisted intervals to build power and strength alongside aerobic capacity.', 30, '2026-06-20 19:50:12'),
(529, 43, 21, 'Week 3: Rest Day', 'Recovery', 'Full rest to allow the cardiovascular system to adapt to the week\'s training load.', 10, '2026-06-20 19:50:12'),
(530, 43, 22, 'Week 4: Easy Aerobic Base', 'Cardio', 'Low-intensity run, row, or bike session designed to build aerobic base without accumulating fatigue.', 30, '2026-06-20 19:50:12'),
(531, 43, 23, 'Week 4: Tempo Intervals', 'Cardio', 'Comfortably-hard tempo intervals to push lactate threshold and improve sustained pace.', 25, '2026-06-20 19:50:12'),
(532, 43, 24, 'Week 4: Cross-Train Session', 'Cardio', 'A change of modality (bike or row) to build fitness while reducing repetitive impact stress.', 35, '2026-06-20 19:50:12'),
(533, 43, 25, 'Week 4: Mobility & Stretch', 'Mobility', 'Lower-body and hip mobility work to keep joints healthy under increasing training volume.', 20, '2026-06-20 19:50:12'),
(534, 43, 26, 'Week 4: Long Steady Endurance', 'Cardio', 'An extended steady-pace session to build endurance capacity and mental toughness.', 40, '2026-06-20 19:50:12'),
(535, 43, 27, 'Week 4: Hill or Resistance Intervals', 'Cardio', 'Uphill or resisted intervals to build power and strength alongside aerobic capacity.', 30, '2026-06-20 19:50:12'),
(536, 43, 28, 'Week 4: Rest Day', 'Recovery', 'Full rest to allow the cardiovascular system to adapt to the week\'s training load.', 10, '2026-06-20 19:50:12'),
(537, 45, 1, 'Week 1: Lower Body Flexibility', 'Flexibility', 'Hamstring, quad, and calf stretches held for extended duration to improve lower-body range of motion.', 20, '2026-06-20 19:50:12'),
(538, 45, 2, 'Week 1: Upper Body & Shoulder Flow', 'Flexibility', 'Chest, shoulder, and thoracic spine stretches to counter rounded-shoulder posture.', 20, '2026-06-20 19:50:12'),
(539, 45, 3, 'Week 1: Hip & Spine Mobility', 'Flexibility', 'Deep hip openers and spinal rotations to improve everyday movement quality.', 20, '2026-06-20 19:50:12'),
(540, 45, 4, 'Week 1: Full-Body Stretch Flow', 'Flexibility', 'A continuous, slow-paced stretch sequence covering every major muscle group.', 25, '2026-06-20 19:50:12'),
(541, 45, 5, 'Week 1: Hamstring & Posterior Chain', 'Flexibility', 'Targeted posterior chain stretches to address tight hamstrings and lower back.', 20, '2026-06-20 19:50:12'),
(542, 45, 6, 'Week 1: Deep Stretch & Breathwork', 'Flexibility', 'Long-held passive stretches paired with diaphragmatic breathing for a parasympathetic reset.', 25, '2026-06-20 19:50:12'),
(543, 45, 7, 'Week 1: Rest & Reflect', 'Recovery', 'A light rest day - gentle movement only, plus reflection on flexibility gains so far.', 10, '2026-06-20 19:50:12'),
(544, 45, 8, 'Week 2: Lower Body Flexibility', 'Flexibility', 'Hamstring, quad, and calf stretches held for extended duration to improve lower-body range of motion.', 20, '2026-06-20 19:50:12'),
(545, 45, 9, 'Week 2: Upper Body & Shoulder Flow', 'Flexibility', 'Chest, shoulder, and thoracic spine stretches to counter rounded-shoulder posture.', 20, '2026-06-20 19:50:12'),
(546, 45, 10, 'Week 2: Hip & Spine Mobility', 'Flexibility', 'Deep hip openers and spinal rotations to improve everyday movement quality.', 20, '2026-06-20 19:50:12'),
(547, 45, 11, 'Week 2: Full-Body Stretch Flow', 'Flexibility', 'A continuous, slow-paced stretch sequence covering every major muscle group.', 25, '2026-06-20 19:50:12'),
(548, 45, 12, 'Week 2: Hamstring & Posterior Chain', 'Flexibility', 'Targeted posterior chain stretches to address tight hamstrings and lower back.', 20, '2026-06-20 19:50:12'),
(549, 45, 13, 'Week 2: Deep Stretch & Breathwork', 'Flexibility', 'Long-held passive stretches paired with diaphragmatic breathing for a parasympathetic reset.', 25, '2026-06-20 19:50:12'),
(550, 45, 14, 'Week 2: Rest & Reflect', 'Recovery', 'A light rest day - gentle movement only, plus reflection on flexibility gains so far.', 10, '2026-06-20 19:50:12');

INSERT INTO `plan_exercises` (`id`, `plan_content_id`, `exercise_order`, `exercise_name`, `sets`, `reps`, `duration_seconds`, `rest_seconds`, `notes`) VALUES
(1, 411, 1, 'Barbell Back Squat', 3, '10', NULL, 90, 'Controlled tempo, focus on depth'),
(2, 411, 2, 'Flat Barbell Bench Press', 3, '10', NULL, 90, NULL),
(3, 411, 3, 'Bent-Over Barbell Row', 3, '10', NULL, 90, NULL),
(4, 411, 4, 'Plank Hold', 3, NULL, 30, 45, NULL),
(5, 412, 1, 'World\'s Greatest Stretch', 2, '8', NULL, 30, 'Each side'),
(6, 412, 2, 'Band/PVC Shoulder Pass-Throughs', 2, '12', NULL, 30, NULL),
(7, 412, 3, 'Ankle Rocks', 2, '10', NULL, 20, 'Each side'),
(8, 412, 4, 'Pallof Press', 3, '12', NULL, 30, 'Each side, anti-rotation core'),
(9, 413, 1, 'Conventional Deadlift', 3, '8', NULL, 120, 'Reset each rep'),
(10, 413, 2, 'Standing Overhead Press', 3, '8', NULL, 90, NULL),
(11, 413, 3, 'Assisted Pull-Up or Inverted Row', 3, '8', NULL, 90, NULL),
(12, 413, 4, 'Dead Bug', 3, '12', NULL, 30, NULL),
(13, 414, 1, 'Brisk Walk', 1, NULL, 1800, NULL, 'Easy, conversational pace'),
(14, 415, 1, 'Front Squat', 3, '8', NULL, 90, NULL),
(15, 415, 2, 'Incline Dumbbell Press', 3, '10', NULL, 90, NULL),
(16, 415, 3, 'Single-Arm Dumbbell Row', 3, '10', NULL, 75, 'Each side'),
(17, 415, 4, 'Hanging Knee Raise', 3, '12', NULL, 45, NULL),
(18, 416, 1, 'Kettlebell Swings', 4, '15', NULL, 30, NULL),
(19, 416, 2, 'Goblet Squats', 4, '15', NULL, 30, NULL),
(20, 416, 3, 'Push-Up to Renegade Row', 4, '10', NULL, 30, NULL),
(21, 416, 4, 'Mountain Climbers', 4, NULL, 30, 30, NULL),
(22, 417, 1, 'Full Rest Day', NULL, NULL, NULL, NULL, 'Prioritize sleep, hydration, and protein intake'),
(23, 418, 1, 'Barbell Back Squat', 3, '10', NULL, 90, 'Controlled tempo, focus on depth'),
(24, 418, 2, 'Flat Barbell Bench Press', 3, '10', NULL, 90, NULL),
(25, 418, 3, 'Bent-Over Barbell Row', 3, '10', NULL, 90, NULL),
(26, 418, 4, 'Plank Hold', 3, NULL, 30, 45, NULL),
(27, 419, 1, 'World\'s Greatest Stretch', 2, '8', NULL, 30, 'Each side'),
(28, 419, 2, 'Band/PVC Shoulder Pass-Throughs', 2, '12', NULL, 30, NULL),
(29, 419, 3, 'Ankle Rocks', 2, '10', NULL, 20, 'Each side'),
(30, 419, 4, 'Pallof Press', 3, '12', NULL, 30, 'Each side, anti-rotation core'),
(31, 420, 1, 'Conventional Deadlift', 3, '8', NULL, 120, 'Reset each rep'),
(32, 420, 2, 'Standing Overhead Press', 3, '8', NULL, 90, NULL),
(33, 420, 3, 'Assisted Pull-Up or Inverted Row', 3, '8', NULL, 90, NULL),
(34, 420, 4, 'Dead Bug', 3, '12', NULL, 30, NULL),
(35, 421, 1, 'Brisk Walk', 1, NULL, 1800, NULL, 'Easy, conversational pace'),
(36, 422, 1, 'Front Squat', 3, '8', NULL, 90, NULL),
(37, 422, 2, 'Incline Dumbbell Press', 3, '10', NULL, 90, NULL),
(38, 422, 3, 'Single-Arm Dumbbell Row', 3, '10', NULL, 75, 'Each side'),
(39, 422, 4, 'Hanging Knee Raise', 3, '12', NULL, 45, NULL),
(40, 423, 1, 'Kettlebell Swings', 4, '15', NULL, 30, NULL),
(41, 423, 2, 'Goblet Squats', 4, '15', NULL, 30, NULL),
(42, 423, 3, 'Push-Up to Renegade Row', 4, '10', NULL, 30, NULL),
(43, 423, 4, 'Mountain Climbers', 4, NULL, 30, 30, NULL),
(44, 424, 1, 'Full Rest Day', NULL, NULL, NULL, NULL, 'Prioritize sleep, hydration, and protein intake'),
(45, 425, 1, 'Barbell Back Squat', 3, '10', NULL, 90, 'Controlled tempo, focus on depth'),
(46, 425, 2, 'Flat Barbell Bench Press', 3, '10', NULL, 90, NULL),
(47, 425, 3, 'Bent-Over Barbell Row', 3, '10', NULL, 90, NULL),
(48, 425, 4, 'Plank Hold', 3, NULL, 30, 45, NULL),
(49, 426, 1, 'World\'s Greatest Stretch', 2, '8', NULL, 30, 'Each side'),
(50, 426, 2, 'Band/PVC Shoulder Pass-Throughs', 2, '12', NULL, 30, NULL),
(51, 426, 3, 'Ankle Rocks', 2, '10', NULL, 20, 'Each side'),
(52, 426, 4, 'Pallof Press', 3, '12', NULL, 30, 'Each side, anti-rotation core'),
(53, 427, 1, 'Conventional Deadlift', 3, '8', NULL, 120, 'Reset each rep'),
(54, 427, 2, 'Standing Overhead Press', 3, '8', NULL, 90, NULL),
(55, 427, 3, 'Assisted Pull-Up or Inverted Row', 3, '8', NULL, 90, NULL),
(56, 427, 4, 'Dead Bug', 3, '12', NULL, 30, NULL),
(57, 428, 1, 'Brisk Walk', 1, NULL, 1800, NULL, 'Easy, conversational pace'),
(58, 429, 1, 'Front Squat', 3, '8', NULL, 90, NULL),
(59, 429, 2, 'Incline Dumbbell Press', 3, '10', NULL, 90, NULL),
(60, 429, 3, 'Single-Arm Dumbbell Row', 3, '10', NULL, 75, 'Each side'),
(61, 429, 4, 'Hanging Knee Raise', 3, '12', NULL, 45, NULL),
(62, 430, 1, 'Kettlebell Swings', 4, '15', NULL, 30, NULL),
(63, 430, 2, 'Goblet Squats', 4, '15', NULL, 30, NULL),
(64, 430, 3, 'Push-Up to Renegade Row', 4, '10', NULL, 30, NULL),
(65, 430, 4, 'Mountain Climbers', 4, NULL, 30, 30, NULL),
(66, 431, 1, 'Full Rest Day', NULL, NULL, NULL, NULL, 'Prioritize sleep, hydration, and protein intake'),
(67, 432, 1, 'Barbell Back Squat', 3, '10', NULL, 90, 'Controlled tempo, focus on depth'),
(68, 432, 2, 'Flat Barbell Bench Press', 3, '10', NULL, 90, NULL),
(69, 432, 3, 'Bent-Over Barbell Row', 3, '10', NULL, 90, NULL),
(70, 432, 4, 'Plank Hold', 3, NULL, 30, 45, NULL),
(71, 433, 1, 'World\'s Greatest Stretch', 2, '8', NULL, 30, 'Each side'),
(72, 433, 2, 'Band/PVC Shoulder Pass-Throughs', 2, '12', NULL, 30, NULL),
(73, 433, 3, 'Ankle Rocks', 2, '10', NULL, 20, 'Each side'),
(74, 433, 4, 'Pallof Press', 3, '12', NULL, 30, 'Each side, anti-rotation core'),
(75, 434, 1, 'Conventional Deadlift', 3, '8', NULL, 120, 'Reset each rep'),
(76, 434, 2, 'Standing Overhead Press', 3, '8', NULL, 90, NULL),
(77, 434, 3, 'Assisted Pull-Up or Inverted Row', 3, '8', NULL, 90, NULL),
(78, 434, 4, 'Dead Bug', 3, '12', NULL, 30, NULL),
(79, 435, 1, 'Brisk Walk', 1, NULL, 1800, NULL, 'Easy, conversational pace'),
(80, 436, 1, 'Front Squat', 3, '8', NULL, 90, NULL),
(81, 436, 2, 'Incline Dumbbell Press', 3, '10', NULL, 90, NULL),
(82, 436, 3, 'Single-Arm Dumbbell Row', 3, '10', NULL, 75, 'Each side'),
(83, 436, 4, 'Hanging Knee Raise', 3, '12', NULL, 45, NULL),
(84, 437, 1, 'Kettlebell Swings', 4, '15', NULL, 30, NULL),
(85, 437, 2, 'Goblet Squats', 4, '15', NULL, 30, NULL),
(86, 437, 3, 'Push-Up to Renegade Row', 4, '10', NULL, 30, NULL),
(87, 437, 4, 'Mountain Climbers', 4, NULL, 30, 30, NULL),
(88, 438, 1, 'Full Rest Day', NULL, NULL, NULL, NULL, 'Prioritize sleep, hydration, and protein intake'),
(89, 439, 1, 'Barbell Bench Press', 4, '6', NULL, 120, NULL),
(90, 439, 2, 'Standing Barbell Overhead Press', 4, '8', NULL, 90, NULL),
(91, 439, 3, 'Weighted Dips', 3, '10', NULL, 90, NULL),
(92, 439, 4, 'Cable Lateral Raise', 3, '15', NULL, 45, NULL),
(93, 439, 5, 'Triceps Rope Pushdown', 3, '12', NULL, 45, NULL),
(94, 440, 1, 'Weighted Pull-Ups', 4, '6', NULL, 120, NULL),
(95, 440, 2, 'Barbell Bent-Over Row', 4, '8', NULL, 90, NULL),
(96, 440, 3, 'Romanian Deadlift', 3, '8', NULL, 90, NULL),
(97, 440, 4, 'Seated Cable Row', 3, '12', NULL, 60, NULL),
(98, 440, 5, 'Barbell Bicep Curl', 3, '12', NULL, 45, NULL),
(99, 441, 1, 'Back Squat', 4, '6', NULL, 150, NULL),
(100, 441, 2, 'Romanian Deadlift', 3, '10', NULL, 90, NULL),
(101, 441, 3, 'Walking Lunges', 3, '12', NULL, 60, 'Each leg'),
(102, 441, 4, 'Leg Press', 3, '12', NULL, 75, NULL),
(103, 441, 5, 'Standing Calf Raise', 4, '15', NULL, 45, NULL),
(104, 442, 1, 'Foam Rolling - Full Body', 1, NULL, 600, NULL, NULL),
(105, 442, 2, 'Hip 90/90 Stretch', 2, NULL, 45, 15, 'Each side'),
(106, 442, 3, 'Thoracic Spine Rotations', 2, '10', NULL, 20, 'Each side'),
(107, 442, 4, 'Light Cycling or Walking', 1, NULL, 900, NULL, 'Easy effort'),
(108, 443, 1, 'Incline DB Press + Chest-Supported Row (superset)', 4, '12', NULL, 60, NULL),
(109, 443, 2, 'DB Shoulder Press + Face Pull (superset)', 3, '12', NULL, 60, NULL),
(110, 443, 3, 'Cable Fly + Lat Pulldown (superset)', 3, '15', NULL, 45, NULL),
(111, 444, 1, 'Bulgarian Split Squat', 3, '10', NULL, 60, 'Each leg'),
(112, 444, 2, 'Lying Leg Curl', 3, '12', NULL, 60, NULL),
(113, 444, 3, 'Hanging Leg Raise', 3, '15', NULL, 45, NULL),
(114, 444, 4, 'Weighted Plank', 3, NULL, 45, 45, NULL),
(115, 445, 1, 'Full Rest Day', NULL, NULL, NULL, NULL, 'Growth happens here - eat, sleep, recover'),
(116, 446, 1, 'Barbell Bench Press', 4, '6', NULL, 120, NULL),
(117, 446, 2, 'Standing Barbell Overhead Press', 4, '8', NULL, 90, NULL),
(118, 446, 3, 'Weighted Dips', 3, '10', NULL, 90, NULL),
(119, 446, 4, 'Cable Lateral Raise', 3, '15', NULL, 45, NULL),
(120, 446, 5, 'Triceps Rope Pushdown', 3, '12', NULL, 45, NULL),
(121, 447, 1, 'Weighted Pull-Ups', 4, '6', NULL, 120, NULL),
(122, 447, 2, 'Barbell Bent-Over Row', 4, '8', NULL, 90, NULL),
(123, 447, 3, 'Romanian Deadlift', 3, '8', NULL, 90, NULL),
(124, 447, 4, 'Seated Cable Row', 3, '12', NULL, 60, NULL),
(125, 447, 5, 'Barbell Bicep Curl', 3, '12', NULL, 45, NULL),
(126, 448, 1, 'Back Squat', 4, '6', NULL, 150, NULL),
(127, 448, 2, 'Romanian Deadlift', 3, '10', NULL, 90, NULL),
(128, 448, 3, 'Walking Lunges', 3, '12', NULL, 60, 'Each leg'),
(129, 448, 4, 'Leg Press', 3, '12', NULL, 75, NULL),
(130, 448, 5, 'Standing Calf Raise', 4, '15', NULL, 45, NULL),
(131, 449, 1, 'Foam Rolling - Full Body', 1, NULL, 600, NULL, NULL),
(132, 449, 2, 'Hip 90/90 Stretch', 2, NULL, 45, 15, 'Each side'),
(133, 449, 3, 'Thoracic Spine Rotations', 2, '10', NULL, 20, 'Each side'),
(134, 449, 4, 'Light Cycling or Walking', 1, NULL, 900, NULL, 'Easy effort'),
(135, 450, 1, 'Incline DB Press + Chest-Supported Row (superset)', 4, '12', NULL, 60, NULL),
(136, 450, 2, 'DB Shoulder Press + Face Pull (superset)', 3, '12', NULL, 60, NULL),
(137, 450, 3, 'Cable Fly + Lat Pulldown (superset)', 3, '15', NULL, 45, NULL),
(138, 451, 1, 'Bulgarian Split Squat', 3, '10', NULL, 60, 'Each leg'),
(139, 451, 2, 'Lying Leg Curl', 3, '12', NULL, 60, NULL),
(140, 451, 3, 'Hanging Leg Raise', 3, '15', NULL, 45, NULL),
(141, 451, 4, 'Weighted Plank', 3, NULL, 45, 45, NULL),
(142, 452, 1, 'Full Rest Day', NULL, NULL, NULL, NULL, 'Growth happens here - eat, sleep, recover'),
(143, 453, 1, 'Barbell Bench Press', 4, '6', NULL, 120, NULL),
(144, 453, 2, 'Standing Barbell Overhead Press', 4, '8', NULL, 90, NULL),
(145, 453, 3, 'Weighted Dips', 3, '10', NULL, 90, NULL),
(146, 453, 4, 'Cable Lateral Raise', 3, '15', NULL, 45, NULL),
(147, 453, 5, 'Triceps Rope Pushdown', 3, '12', NULL, 45, NULL),
(148, 454, 1, 'Weighted Pull-Ups', 4, '6', NULL, 120, NULL),
(149, 454, 2, 'Barbell Bent-Over Row', 4, '8', NULL, 90, NULL),
(150, 454, 3, 'Romanian Deadlift', 3, '8', NULL, 90, NULL),
(151, 454, 4, 'Seated Cable Row', 3, '12', NULL, 60, NULL),
(152, 454, 5, 'Barbell Bicep Curl', 3, '12', NULL, 45, NULL),
(153, 455, 1, 'Back Squat', 4, '6', NULL, 150, NULL),
(154, 455, 2, 'Romanian Deadlift', 3, '10', NULL, 90, NULL),
(155, 455, 3, 'Walking Lunges', 3, '12', NULL, 60, 'Each leg'),
(156, 455, 4, 'Leg Press', 3, '12', NULL, 75, NULL),
(157, 455, 5, 'Standing Calf Raise', 4, '15', NULL, 45, NULL),
(158, 456, 1, 'Foam Rolling - Full Body', 1, NULL, 600, NULL, NULL),
(159, 456, 2, 'Hip 90/90 Stretch', 2, NULL, 45, 15, 'Each side'),
(160, 456, 3, 'Thoracic Spine Rotations', 2, '10', NULL, 20, 'Each side'),
(161, 456, 4, 'Light Cycling or Walking', 1, NULL, 900, NULL, 'Easy effort'),
(162, 457, 1, 'Incline DB Press + Chest-Supported Row (superset)', 4, '12', NULL, 60, NULL),
(163, 457, 2, 'DB Shoulder Press + Face Pull (superset)', 3, '12', NULL, 60, NULL),
(164, 457, 3, 'Cable Fly + Lat Pulldown (superset)', 3, '15', NULL, 45, NULL),
(165, 458, 1, 'Bulgarian Split Squat', 3, '10', NULL, 60, 'Each leg'),
(166, 458, 2, 'Lying Leg Curl', 3, '12', NULL, 60, NULL),
(167, 458, 3, 'Hanging Leg Raise', 3, '15', NULL, 45, NULL),
(168, 458, 4, 'Weighted Plank', 3, NULL, 45, 45, NULL),
(169, 459, 1, 'Full Rest Day', NULL, NULL, NULL, NULL, 'Growth happens here - eat, sleep, recover'),
(170, 460, 1, 'Barbell Bench Press', 4, '6', NULL, 120, NULL),
(171, 460, 2, 'Standing Barbell Overhead Press', 4, '8', NULL, 90, NULL),
(172, 460, 3, 'Weighted Dips', 3, '10', NULL, 90, NULL),
(173, 460, 4, 'Cable Lateral Raise', 3, '15', NULL, 45, NULL),
(174, 460, 5, 'Triceps Rope Pushdown', 3, '12', NULL, 45, NULL),
(175, 461, 1, 'Weighted Pull-Ups', 4, '6', NULL, 120, NULL),
(176, 461, 2, 'Barbell Bent-Over Row', 4, '8', NULL, 90, NULL),
(177, 461, 3, 'Romanian Deadlift', 3, '8', NULL, 90, NULL),
(178, 461, 4, 'Seated Cable Row', 3, '12', NULL, 60, NULL),
(179, 461, 5, 'Barbell Bicep Curl', 3, '12', NULL, 45, NULL),
(180, 462, 1, 'Back Squat', 4, '6', NULL, 150, NULL),
(181, 462, 2, 'Romanian Deadlift', 3, '10', NULL, 90, NULL),
(182, 462, 3, 'Walking Lunges', 3, '12', NULL, 60, 'Each leg'),
(183, 462, 4, 'Leg Press', 3, '12', NULL, 75, NULL),
(184, 462, 5, 'Standing Calf Raise', 4, '15', NULL, 45, NULL),
(185, 463, 1, 'Foam Rolling - Full Body', 1, NULL, 600, NULL, NULL),
(186, 463, 2, 'Hip 90/90 Stretch', 2, NULL, 45, 15, 'Each side'),
(187, 463, 3, 'Thoracic Spine Rotations', 2, '10', NULL, 20, 'Each side'),
(188, 463, 4, 'Light Cycling or Walking', 1, NULL, 900, NULL, 'Easy effort'),
(189, 464, 1, 'Incline DB Press + Chest-Supported Row (superset)', 4, '12', NULL, 60, NULL),
(190, 464, 2, 'DB Shoulder Press + Face Pull (superset)', 3, '12', NULL, 60, NULL),
(191, 464, 3, 'Cable Fly + Lat Pulldown (superset)', 3, '15', NULL, 45, NULL),
(192, 465, 1, 'Bulgarian Split Squat', 3, '10', NULL, 60, 'Each leg'),
(193, 465, 2, 'Lying Leg Curl', 3, '12', NULL, 60, NULL),
(194, 465, 3, 'Hanging Leg Raise', 3, '15', NULL, 45, NULL),
(195, 465, 4, 'Weighted Plank', 3, NULL, 45, 45, NULL),
(196, 466, 1, 'Full Rest Day', NULL, NULL, NULL, NULL, 'Growth happens here - eat, sleep, recover'),
(197, 467, 1, 'Barbell Bench Press', 4, '6', NULL, 120, NULL),
(198, 467, 2, 'Standing Barbell Overhead Press', 4, '8', NULL, 90, NULL),
(199, 467, 3, 'Weighted Dips', 3, '10', NULL, 90, NULL),
(200, 467, 4, 'Cable Lateral Raise', 3, '15', NULL, 45, NULL),
(201, 467, 5, 'Triceps Rope Pushdown', 3, '12', NULL, 45, NULL),
(202, 468, 1, 'Weighted Pull-Ups', 4, '6', NULL, 120, NULL),
(203, 468, 2, 'Barbell Bent-Over Row', 4, '8', NULL, 90, NULL),
(204, 468, 3, 'Romanian Deadlift', 3, '8', NULL, 90, NULL),
(205, 468, 4, 'Seated Cable Row', 3, '12', NULL, 60, NULL),
(206, 468, 5, 'Barbell Bicep Curl', 3, '12', NULL, 45, NULL),
(207, 469, 1, 'Back Squat', 4, '6', NULL, 150, NULL),
(208, 469, 2, 'Romanian Deadlift', 3, '10', NULL, 90, NULL),
(209, 469, 3, 'Walking Lunges', 3, '12', NULL, 60, 'Each leg'),
(210, 469, 4, 'Leg Press', 3, '12', NULL, 75, NULL),
(211, 469, 5, 'Standing Calf Raise', 4, '15', NULL, 45, NULL),
(212, 470, 1, 'Foam Rolling - Full Body', 1, NULL, 600, NULL, NULL),
(213, 470, 2, 'Hip 90/90 Stretch', 2, NULL, 45, 15, 'Each side'),
(214, 470, 3, 'Thoracic Spine Rotations', 2, '10', NULL, 20, 'Each side'),
(215, 470, 4, 'Light Cycling or Walking', 1, NULL, 900, NULL, 'Easy effort'),
(216, 471, 1, 'Incline DB Press + Chest-Supported Row (superset)', 4, '12', NULL, 60, NULL),
(217, 471, 2, 'DB Shoulder Press + Face Pull (superset)', 3, '12', NULL, 60, NULL),
(218, 471, 3, 'Cable Fly + Lat Pulldown (superset)', 3, '15', NULL, 45, NULL),
(219, 472, 1, 'Bulgarian Split Squat', 3, '10', NULL, 60, 'Each leg'),
(220, 472, 2, 'Lying Leg Curl', 3, '12', NULL, 60, NULL),
(221, 472, 3, 'Hanging Leg Raise', 3, '15', NULL, 45, NULL),
(222, 472, 4, 'Weighted Plank', 3, NULL, 45, 45, NULL),
(223, 473, 1, 'Full Rest Day', NULL, NULL, NULL, NULL, 'Growth happens here - eat, sleep, recover'),
(224, 474, 1, 'Barbell Bench Press', 4, '6', NULL, 120, NULL),
(225, 474, 2, 'Standing Barbell Overhead Press', 4, '8', NULL, 90, NULL),
(226, 474, 3, 'Weighted Dips', 3, '10', NULL, 90, NULL),
(227, 474, 4, 'Cable Lateral Raise', 3, '15', NULL, 45, NULL),
(228, 474, 5, 'Triceps Rope Pushdown', 3, '12', NULL, 45, NULL),
(229, 475, 1, 'Weighted Pull-Ups', 4, '6', NULL, 120, NULL),
(230, 475, 2, 'Barbell Bent-Over Row', 4, '8', NULL, 90, NULL),
(231, 475, 3, 'Romanian Deadlift', 3, '8', NULL, 90, NULL),
(232, 475, 4, 'Seated Cable Row', 3, '12', NULL, 60, NULL),
(233, 475, 5, 'Barbell Bicep Curl', 3, '12', NULL, 45, NULL),
(234, 476, 1, 'Back Squat', 4, '6', NULL, 150, NULL),
(235, 476, 2, 'Romanian Deadlift', 3, '10', NULL, 90, NULL),
(236, 476, 3, 'Walking Lunges', 3, '12', NULL, 60, 'Each leg'),
(237, 476, 4, 'Leg Press', 3, '12', NULL, 75, NULL),
(238, 476, 5, 'Standing Calf Raise', 4, '15', NULL, 45, NULL),
(239, 477, 1, 'Foam Rolling - Full Body', 1, NULL, 600, NULL, NULL),
(240, 477, 2, 'Hip 90/90 Stretch', 2, NULL, 45, 15, 'Each side'),
(241, 477, 3, 'Thoracic Spine Rotations', 2, '10', NULL, 20, 'Each side'),
(242, 477, 4, 'Light Cycling or Walking', 1, NULL, 900, NULL, 'Easy effort'),
(243, 478, 1, 'Incline DB Press + Chest-Supported Row (superset)', 4, '12', NULL, 60, NULL),
(244, 478, 2, 'DB Shoulder Press + Face Pull (superset)', 3, '12', NULL, 60, NULL),
(245, 478, 3, 'Cable Fly + Lat Pulldown (superset)', 3, '15', NULL, 45, NULL),
(246, 479, 1, 'Bulgarian Split Squat', 3, '10', NULL, 60, 'Each leg'),
(247, 479, 2, 'Lying Leg Curl', 3, '12', NULL, 60, NULL),
(248, 479, 3, 'Hanging Leg Raise', 3, '15', NULL, 45, NULL),
(249, 479, 4, 'Weighted Plank', 3, NULL, 45, 45, NULL),
(250, 480, 1, 'Full Rest Day', NULL, NULL, NULL, NULL, 'Growth happens here - eat, sleep, recover'),
(251, 481, 1, 'Barbell Bench Press', 4, '6', NULL, 120, NULL),
(252, 481, 2, 'Standing Barbell Overhead Press', 4, '8', NULL, 90, NULL),
(253, 481, 3, 'Weighted Dips', 3, '10', NULL, 90, NULL),
(254, 481, 4, 'Cable Lateral Raise', 3, '15', NULL, 45, NULL),
(255, 481, 5, 'Triceps Rope Pushdown', 3, '12', NULL, 45, NULL),
(256, 482, 1, 'Weighted Pull-Ups', 4, '6', NULL, 120, NULL),
(257, 482, 2, 'Barbell Bent-Over Row', 4, '8', NULL, 90, NULL),
(258, 482, 3, 'Romanian Deadlift', 3, '8', NULL, 90, NULL),
(259, 482, 4, 'Seated Cable Row', 3, '12', NULL, 60, NULL),
(260, 482, 5, 'Barbell Bicep Curl', 3, '12', NULL, 45, NULL),
(261, 483, 1, 'Back Squat', 4, '6', NULL, 150, NULL),
(262, 483, 2, 'Romanian Deadlift', 3, '10', NULL, 90, NULL),
(263, 483, 3, 'Walking Lunges', 3, '12', NULL, 60, 'Each leg'),
(264, 483, 4, 'Leg Press', 3, '12', NULL, 75, NULL),
(265, 483, 5, 'Standing Calf Raise', 4, '15', NULL, 45, NULL),
(266, 484, 1, 'Foam Rolling - Full Body', 1, NULL, 600, NULL, NULL),
(267, 484, 2, 'Hip 90/90 Stretch', 2, NULL, 45, 15, 'Each side'),
(268, 484, 3, 'Thoracic Spine Rotations', 2, '10', NULL, 20, 'Each side'),
(269, 484, 4, 'Light Cycling or Walking', 1, NULL, 900, NULL, 'Easy effort'),
(270, 485, 1, 'Incline DB Press + Chest-Supported Row (superset)', 4, '12', NULL, 60, NULL),
(271, 485, 2, 'DB Shoulder Press + Face Pull (superset)', 3, '12', NULL, 60, NULL),
(272, 485, 3, 'Cable Fly + Lat Pulldown (superset)', 3, '15', NULL, 45, NULL),
(273, 486, 1, 'Bulgarian Split Squat', 3, '10', NULL, 60, 'Each leg'),
(274, 486, 2, 'Lying Leg Curl', 3, '12', NULL, 60, NULL),
(275, 486, 3, 'Hanging Leg Raise', 3, '15', NULL, 45, NULL),
(276, 486, 4, 'Weighted Plank', 3, NULL, 45, 45, NULL),
(277, 487, 1, 'Full Rest Day', NULL, NULL, NULL, NULL, 'Growth happens here - eat, sleep, recover'),
(278, 488, 1, 'Barbell Bench Press', 4, '6', NULL, 120, NULL),
(279, 488, 2, 'Standing Barbell Overhead Press', 4, '8', NULL, 90, NULL),
(280, 488, 3, 'Weighted Dips', 3, '10', NULL, 90, NULL),
(281, 488, 4, 'Cable Lateral Raise', 3, '15', NULL, 45, NULL),
(282, 488, 5, 'Triceps Rope Pushdown', 3, '12', NULL, 45, NULL),
(283, 489, 1, 'Weighted Pull-Ups', 4, '6', NULL, 120, NULL),
(284, 489, 2, 'Barbell Bent-Over Row', 4, '8', NULL, 90, NULL),
(285, 489, 3, 'Romanian Deadlift', 3, '8', NULL, 90, NULL),
(286, 489, 4, 'Seated Cable Row', 3, '12', NULL, 60, NULL),
(287, 489, 5, 'Barbell Bicep Curl', 3, '12', NULL, 45, NULL),
(288, 490, 1, 'Back Squat', 4, '6', NULL, 150, NULL),
(289, 490, 2, 'Romanian Deadlift', 3, '10', NULL, 90, NULL),
(290, 490, 3, 'Walking Lunges', 3, '12', NULL, 60, 'Each leg'),
(291, 490, 4, 'Leg Press', 3, '12', NULL, 75, NULL),
(292, 490, 5, 'Standing Calf Raise', 4, '15', NULL, 45, NULL),
(293, 491, 1, 'Foam Rolling - Full Body', 1, NULL, 600, NULL, NULL),
(294, 491, 2, 'Hip 90/90 Stretch', 2, NULL, 45, 15, 'Each side'),
(295, 491, 3, 'Thoracic Spine Rotations', 2, '10', NULL, 20, 'Each side'),
(296, 491, 4, 'Light Cycling or Walking', 1, NULL, 900, NULL, 'Easy effort'),
(297, 492, 1, 'Incline DB Press + Chest-Supported Row (superset)', 4, '12', NULL, 60, NULL),
(298, 492, 2, 'DB Shoulder Press + Face Pull (superset)', 3, '12', NULL, 60, NULL),
(299, 492, 3, 'Cable Fly + Lat Pulldown (superset)', 3, '15', NULL, 45, NULL),
(300, 493, 1, 'Bulgarian Split Squat', 3, '10', NULL, 60, 'Each leg'),
(301, 493, 2, 'Lying Leg Curl', 3, '12', NULL, 60, NULL),
(302, 493, 3, 'Hanging Leg Raise', 3, '15', NULL, 45, NULL),
(303, 493, 4, 'Weighted Plank', 3, NULL, 45, 45, NULL),
(304, 494, 1, 'Full Rest Day', NULL, NULL, NULL, NULL, 'Growth happens here - eat, sleep, recover'),
(305, 495, 1, 'Bodyweight Squats', NULL, NULL, 40, 20, '4 rounds total circuit'),
(306, 495, 2, 'Push-Ups', NULL, NULL, 40, 20, NULL),
(307, 495, 3, 'Mountain Climbers', NULL, NULL, 40, 20, NULL),
(308, 495, 4, 'Jumping Jacks', NULL, NULL, 40, 20, NULL),
(309, 496, 1, 'Jog / Bike / Row - Moderate Pace', 1, NULL, 1800, NULL, NULL),
(310, 497, 1, 'Jump Squats', NULL, NULL, 40, 20, '4 rounds total circuit'),
(311, 497, 2, 'Walking Lunges', NULL, NULL, 40, 20, NULL),
(312, 497, 3, 'Glute Bridges', NULL, NULL, 40, 20, NULL),
(313, 498, 1, 'Easy-Paced Walk', 1, NULL, 1200, NULL, NULL),
(314, 499, 1, 'Push-Ups', NULL, NULL, 40, 20, '4 rounds total circuit'),
(315, 499, 2, 'Plank Shoulder Taps', NULL, NULL, 40, 20, NULL),
(316, 499, 3, 'Resistance Band Rows', NULL, NULL, 40, 20, NULL),
(317, 500, 1, 'Sprint Intervals', 8, NULL, 20, 90, '20s hard sprint, 90s walk recovery'),
(318, 501, 1, 'Full Rest Day', NULL, NULL, NULL, NULL, 'Let the nervous system recover'),
(319, 502, 1, 'Bodyweight Squats', NULL, NULL, 40, 20, '4 rounds total circuit'),
(320, 502, 2, 'Push-Ups', NULL, NULL, 40, 20, NULL),
(321, 502, 3, 'Mountain Climbers', NULL, NULL, 40, 20, NULL),
(322, 502, 4, 'Jumping Jacks', NULL, NULL, 40, 20, NULL),
(323, 503, 1, 'Jog / Bike / Row - Moderate Pace', 1, NULL, 1800, NULL, NULL),
(324, 504, 1, 'Jump Squats', NULL, NULL, 40, 20, '4 rounds total circuit'),
(325, 504, 2, 'Walking Lunges', NULL, NULL, 40, 20, NULL),
(326, 504, 3, 'Glute Bridges', NULL, NULL, 40, 20, NULL),
(327, 505, 1, 'Easy-Paced Walk', 1, NULL, 1200, NULL, NULL),
(328, 506, 1, 'Push-Ups', NULL, NULL, 40, 20, '4 rounds total circuit'),
(329, 506, 2, 'Plank Shoulder Taps', NULL, NULL, 40, 20, NULL),
(330, 506, 3, 'Resistance Band Rows', NULL, NULL, 40, 20, NULL),
(331, 507, 1, 'Sprint Intervals', 8, NULL, 20, 90, '20s hard sprint, 90s walk recovery'),
(332, 508, 1, 'Full Rest Day', NULL, NULL, NULL, NULL, 'Let the nervous system recover'),
(333, 509, 1, 'Easy Run / Bike / Row', 1, NULL, 1800, NULL, 'Zone 2, conversational pace'),
(334, 510, 1, 'Tempo Intervals', 5, NULL, 240, 120, '4 min comfortably-hard, 2 min easy'),
(335, 511, 1, 'Bike or Row Cross-Train', 1, NULL, 2100, NULL, 'Moderate pace, low impact'),
(336, 512, 1, 'Hip Flexor Stretch', 2, NULL, 45, 15, 'Each side'),
(337, 512, 2, 'Hamstring Stretch', 2, NULL, 45, 15, 'Each side'),
(338, 512, 3, 'Foam Roll - Calves & IT Band', 1, NULL, 300, NULL, NULL),
(339, 513, 1, 'Long Steady Run / Bike', 1, NULL, 2400, NULL, 'Steady aerobic pace'),
(340, 514, 1, 'Hill Sprints or Resisted Intervals', 6, NULL, 60, 90, '60s hard, 90s recovery'),
(341, 515, 1, 'Full Rest Day', NULL, NULL, NULL, NULL, 'Let the cardiovascular system adapt'),
(342, 516, 1, 'Easy Run / Bike / Row', 1, NULL, 1800, NULL, 'Zone 2, conversational pace'),
(343, 517, 1, 'Tempo Intervals', 5, NULL, 240, 120, '4 min comfortably-hard, 2 min easy'),
(344, 518, 1, 'Bike or Row Cross-Train', 1, NULL, 2100, NULL, 'Moderate pace, low impact'),
(345, 519, 1, 'Hip Flexor Stretch', 2, NULL, 45, 15, 'Each side'),
(346, 519, 2, 'Hamstring Stretch', 2, NULL, 45, 15, 'Each side'),
(347, 519, 3, 'Foam Roll - Calves & IT Band', 1, NULL, 300, NULL, NULL),
(348, 520, 1, 'Long Steady Run / Bike', 1, NULL, 2400, NULL, 'Steady aerobic pace'),
(349, 521, 1, 'Hill Sprints or Resisted Intervals', 6, NULL, 60, 90, '60s hard, 90s recovery'),
(350, 522, 1, 'Full Rest Day', NULL, NULL, NULL, NULL, 'Let the cardiovascular system adapt'),
(351, 523, 1, 'Easy Run / Bike / Row', 1, NULL, 1800, NULL, 'Zone 2, conversational pace'),
(352, 524, 1, 'Tempo Intervals', 5, NULL, 240, 120, '4 min comfortably-hard, 2 min easy'),
(353, 525, 1, 'Bike or Row Cross-Train', 1, NULL, 2100, NULL, 'Moderate pace, low impact'),
(354, 526, 1, 'Hip Flexor Stretch', 2, NULL, 45, 15, 'Each side'),
(355, 526, 2, 'Hamstring Stretch', 2, NULL, 45, 15, 'Each side'),
(356, 526, 3, 'Foam Roll - Calves & IT Band', 1, NULL, 300, NULL, NULL),
(357, 527, 1, 'Long Steady Run / Bike', 1, NULL, 2400, NULL, 'Steady aerobic pace'),
(358, 528, 1, 'Hill Sprints or Resisted Intervals', 6, NULL, 60, 90, '60s hard, 90s recovery'),
(359, 529, 1, 'Full Rest Day', NULL, NULL, NULL, NULL, 'Let the cardiovascular system adapt'),
(360, 530, 1, 'Easy Run / Bike / Row', 1, NULL, 1800, NULL, 'Zone 2, conversational pace'),
(361, 531, 1, 'Tempo Intervals', 5, NULL, 240, 120, '4 min comfortably-hard, 2 min easy'),
(362, 532, 1, 'Bike or Row Cross-Train', 1, NULL, 2100, NULL, 'Moderate pace, low impact'),
(363, 533, 1, 'Hip Flexor Stretch', 2, NULL, 45, 15, 'Each side'),
(364, 533, 2, 'Hamstring Stretch', 2, NULL, 45, 15, 'Each side'),
(365, 533, 3, 'Foam Roll - Calves & IT Band', 1, NULL, 300, NULL, NULL),
(366, 534, 1, 'Long Steady Run / Bike', 1, NULL, 2400, NULL, 'Steady aerobic pace'),
(367, 535, 1, 'Hill Sprints or Resisted Intervals', 6, NULL, 60, 90, '60s hard, 90s recovery'),
(368, 536, 1, 'Full Rest Day', NULL, NULL, NULL, NULL, 'Let the cardiovascular system adapt'),
(369, 537, 1, 'Standing Hamstring Stretch', 2, NULL, 45, 15, 'Each side'),
(370, 537, 2, 'Quad Stretch', 2, NULL, 45, 15, 'Each side'),
(371, 537, 3, 'Calf Stretch', 2, NULL, 45, 15, 'Each side'),
(372, 538, 1, 'Doorway Chest Stretch', 2, NULL, 45, 15, 'Each side'),
(373, 538, 2, 'Cross-Body Shoulder Stretch', 2, NULL, 30, 15, 'Each side'),
(374, 538, 3, 'Thoracic Extension Stretch', 2, NULL, 30, 15, NULL),
(375, 539, 1, 'Deep Lunge Hip Opener', 2, NULL, 45, 15, 'Each side'),
(376, 539, 2, 'Seated Spinal Twist', 2, NULL, 30, 15, 'Each side'),
(377, 539, 3, 'Cat-Cow Flow', 2, '10', NULL, 15, NULL),
(378, 540, 1, 'Full-Body Flow Sequence', 1, NULL, 1500, NULL, 'Continuous, slow-paced'),
(379, 541, 1, 'Standing Forward Fold', 2, NULL, 45, 15, NULL),
(380, 541, 2, 'Single-Leg Hamstring Stretch', 2, NULL, 45, 15, 'Each side'),
(381, 541, 3, 'Child\'s Pose (lower back)', 2, NULL, 45, 15, NULL),
(382, 542, 1, 'Long-Held Passive Stretch Sequence', 1, NULL, 900, NULL, NULL),
(383, 542, 2, 'Diaphragmatic Breathing', 1, NULL, 600, NULL, NULL),
(384, 543, 1, 'Rest & Reflect', NULL, NULL, NULL, NULL, 'Gentle movement only'),
(385, 544, 1, 'Standing Hamstring Stretch', 2, NULL, 45, 15, 'Each side'),
(386, 544, 2, 'Quad Stretch', 2, NULL, 45, 15, 'Each side'),
(387, 544, 3, 'Calf Stretch', 2, NULL, 45, 15, 'Each side'),
(388, 545, 1, 'Doorway Chest Stretch', 2, NULL, 45, 15, 'Each side'),
(389, 545, 2, 'Cross-Body Shoulder Stretch', 2, NULL, 30, 15, 'Each side'),
(390, 545, 3, 'Thoracic Extension Stretch', 2, NULL, 30, 15, NULL),
(391, 546, 1, 'Deep Lunge Hip Opener', 2, NULL, 45, 15, 'Each side'),
(392, 546, 2, 'Seated Spinal Twist', 2, NULL, 30, 15, 'Each side'),
(393, 546, 3, 'Cat-Cow Flow', 2, '10', NULL, 15, NULL),
(394, 547, 1, 'Full-Body Flow Sequence', 1, NULL, 1500, NULL, 'Continuous, slow-paced'),
(395, 548, 1, 'Standing Forward Fold', 2, NULL, 45, 15, NULL),
(396, 548, 2, 'Single-Leg Hamstring Stretch', 2, NULL, 45, 15, 'Each side'),
(397, 548, 3, 'Child\'s Pose (lower back)', 2, NULL, 45, 15, NULL),
(398, 549, 1, 'Long-Held Passive Stretch Sequence', 1, NULL, 900, NULL, NULL),
(399, 549, 2, 'Diaphragmatic Breathing', 1, NULL, 600, NULL, NULL),
(400, 550, 1, 'Rest & Reflect', NULL, NULL, NULL, NULL, 'Gentle movement only');

-- --------------------------------------------------------
-- Migration tracking
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `_migrations` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL UNIQUE,
  `applied_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `_migrations` (`name`) VALUES
  ('001_users.sql'),
  ('002_plans.sql'),
  ('003_plan_contents.sql'),
  ('004_plan_exercises.sql'),
  ('005_activity_logs.sql'),
  ('006_activity_kudos.sql'),
  ('007_ai_daily_usage.sql'),
  ('008_ai_insight_cache.sql'),
  ('009_bmi_records.sql'),
  ('010_community_posts.sql'),
  ('011_community_likes.sql'),
  ('012_community_comments.sql'),
  ('013_daily_checkins.sql'),
  ('014_daily_stats.sql'),
  ('015_email_verifications.sql'),
  ('016_fitness_goals.sql'),
  ('017_food_logs.sql'),
  ('018_friendships.sql'),
  ('019_messages.sql'),
  ('020_notifications.sql'),
  ('021_password_reset_otps.sql'),
  ('022_sleep_logs.sql'),
  ('023_user_nutrient_goals.sql'),
  ('024_user_plan_progress.sql'),
  ('025_user_plans.sql'),
  ('026_user_profiles.sql'),
  ('027_user_sessions.sql'),
  ('028_user_settings.sql'),
  ('029_workout_logs.sql'),
  ('030_seeds.sql'),
  ('031_landing_visits.sql'),
  ('032_personal_plans.sql');

SET SQL_MODE = @OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS = 1;

-- Done. Tables: 30 + _migrations.
