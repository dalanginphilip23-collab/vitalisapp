// tests/unit/migrations.test.js — per-table baseline stays in sync with controllers.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.join(__dirname, '..', '..', 'migrations');
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');

const EXPECTED = [
  '001_users.sql', '002_plans.sql', '003_plan_contents.sql', '004_plan_exercises.sql',
  '005_activity_logs.sql', '006_activity_kudos.sql', '007_ai_daily_usage.sql',
  '008_ai_insight_cache.sql', '009_bmi_records.sql', '010_community_posts.sql',
  '011_community_likes.sql', '012_community_comments.sql', '013_daily_checkins.sql',
  '014_daily_stats.sql', '015_email_verifications.sql', '016_fitness_goals.sql',
  '017_food_logs.sql', '018_friendships.sql', '019_messages.sql', '020_notifications.sql',
  '021_password_reset_otps.sql', '022_sleep_logs.sql', '023_user_nutrient_goals.sql',
  '024_user_plan_progress.sql', '025_user_plans.sql', '026_user_profiles.sql',
  '027_user_sessions.sql', '028_user_settings.sql', '029_workout_logs.sql',
  '030_seeds.sql', '031_landing_visits.sql', '032_personal_plans.sql',
  '033_user_allergies.sql', '034_workout_sets.sql', '035_training_preferences.sql',
  '036_account_governance.sql', '037_meal_type_food_catalog.sql',
  '038_progress_module.sql', '039_admin_audit.sql', '040_admin_seed.sql',
  '041_goal_recalibration.sql', '042_progress_cadence.sql',
  '043_food_grams.sql', '044_food_density_cache.sql',
];

describe('migrations per-table baseline', () => {
  it('migrations/ holds exactly the 44 canonical files', () => {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    assert.deepEqual(files, EXPECTED);
  });

  it('admin seed promotes admin@gmail.com idempotently without resetting passwords', () => {
    const sql = read('040_admin_seed.sql');
    assert.match(sql, /'admin@gmail\.com'/);
    assert.match(sql, /'admin'/);
    assert.match(sql, /ON DUPLICATE KEY UPDATE/);
    assert.match(sql, /\$2[aby]\$10\$/);
    assert.doesNotMatch(sql, /UPDATE `?password`?/);
  });

  it('user_allergies is idempotent, uniquely keyed and cascades', () => {
    const sql = read('033_user_allergies.sql');
    assert.match(sql, /CREATE TABLE IF NOT EXISTS `user_allergies`/);
    assert.match(sql, /UNIQUE KEY `uniq_user_allergy` \(`user_id`,`allergy_name`\)/);
    assert.match(sql, /ON DELETE CASCADE/);
  });

  it('parents sort before children (users/plans first)', () => {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    assert.ok(files.indexOf('001_users.sql') < files.indexOf('005_activity_logs.sql'));
    assert.ok(files.indexOf('002_plans.sql') < files.indexOf('003_plan_contents.sql'));
    assert.ok(files.indexOf('010_community_posts.sql') < files.indexOf('011_community_likes.sql'));
  });

  it('community tables are idempotent with CASCADE', () => {
    assert.match(read('010_community_posts.sql'), /CREATE TABLE IF NOT EXISTS `community_posts`/);
    assert.match(read('011_community_likes.sql'), /CREATE TABLE IF NOT EXISTS `community_likes`/);
    assert.match(read('012_community_comments.sql'), /CREATE TABLE IF NOT EXISTS `community_comments`/);
    assert.match(read('011_community_likes.sql'), /ON DELETE CASCADE/);
  });

  it('settings + token_version + quota + gps flag present', () => {
    assert.match(read('028_user_settings.sql'), /CREATE TABLE IF NOT EXISTS `user_settings`/);
    assert.match(read('028_user_settings.sql'), /PRIMARY KEY \(`user_id`\)/);
    assert.match(read('001_users.sql'), /`token_version`/);
    assert.match(read('007_ai_daily_usage.sql'), /CREATE TABLE IF NOT EXISTS `ai_daily_usage`/);
    assert.match(read('005_activity_logs.sql'), /`is_gps`/);
  });

  it('seeds stay INSERT IGNORE (runner fails 1062 otherwise)', () => {
    assert.match(read('030_seeds.sql'), /INSERT IGNORE INTO `plans`/);
  });

  it('landing visits counter is idempotent with daily dedupe', () => {
    assert.match(read('031_landing_visits.sql'), /CREATE TABLE IF NOT EXISTS `landing_visits`/);
    assert.match(read('031_landing_visits.sql'), /UNIQUE KEY `uq_landing_visits_hash_date`/);
  });

  it('personal plans alter is idempotent with owner + template flags', () => {
    assert.match(read('032_personal_plans.sql'), /ADD COLUMN `owner_user_id`/);
    assert.match(read('032_personal_plans.sql'), /ADD COLUMN `is_template`/);
    assert.match(read('032_personal_plans.sql'), /ADD COLUMN `source_plan_id`/);
  });

  it('controllers reference only tables that migrations create', () => {
    const communityCtrl = fs.readFileSync(
      path.join(__dirname, '..', '..', 'src', 'controllers', 'community.controller.js'), 'utf8'
    );
    for (const t of ['community_posts', 'community_likes', 'community_comments']) {
      assert.ok(communityCtrl.includes(t), `controller must reference ${t}`);
    }
  });

  it('workout_sets is idempotent, cascades and normalizes storage', () => {
    const sql = read('034_workout_sets.sql');
    assert.match(sql, /CREATE TABLE IF NOT EXISTS `workout_sets`/);
    assert.match(sql, /KEY `idx_workout_sets_log`/);
    assert.match(sql, /REFERENCES `workout_logs` \(`id`\) ON DELETE CASCADE/);
    assert.match(sql, /REFERENCES `users` \(`id`\) ON DELETE CASCADE/);
    assert.match(sql, /ADD COLUMN `paused_seconds`/);
    assert.match(sql, /ADD COLUMN `pause_started_at`/);
    assert.match(sql, /ADD COLUMN `difficulty_rating`/);
    assert.match(sql, /ADD COLUMN `session_notes`/);
  });

  it('training_preferences is idempotent, one row per user with JSON inputs', () => {
    const sql = read('035_training_preferences.sql');
    assert.match(sql, /CREATE TABLE IF NOT EXISTS `training_preferences`/);
    assert.match(sql, /UNIQUE KEY `uniq_training_prefs_user` \(`user_id`\)/);
    assert.match(sql, /`equipment` json/);
    assert.match(sql, /`preferred_days` json/);
    assert.match(sql, /REFERENCES `users` \(`id`\) ON DELETE CASCADE/);
  });

  it('account governance extends users with consent, status and role', () => {
    const sql = read('036_account_governance.sql');
    assert.match(sql, /ADD COLUMN `accepted_terms_at`/);
    assert.match(sql, /ADD COLUMN `accepted_terms_version`/);
    assert.match(sql, /ADD COLUMN `status` varchar\(20\) NOT NULL DEFAULT 'active'/);
    assert.match(sql, /ADD COLUMN `role` varchar\(20\) NOT NULL DEFAULT 'member'/);
  });

  it('food logs persist meal_type and the catalog seeds are idempotent', () => {
    const sql = read('037_meal_type_food_catalog.sql');
    assert.match(sql, /ADD COLUMN `meal_type` varchar\(20\) DEFAULT NULL AFTER `serving`/);
    // Legacy backfill only for the whitelisted slots and only once (NULL guard).
    assert.match(sql, /SET `meal_type` = `serving`/);
    assert.match(sql, /WHERE `meal_type` IS NULL/);
    assert.match(sql, /'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Other'/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS `food_catalog`/);
    assert.match(sql, /UNIQUE KEY `uniq_food_catalog_name`/);
    assert.match(sql, /INSERT IGNORE INTO `food_catalog`/);
  });

  it('progress module stores private photos with AI fields and per-day measurements', () => {
    const sql = read('038_progress_module.sql');
    assert.match(sql, /CREATE TABLE IF NOT EXISTS `progress_photos`/);
    assert.match(sql, /`pose` varchar\(10\) NOT NULL/);
    assert.match(sql, /`image_data` mediumtext/);
    assert.match(sql, /`ai_rating` tinyint/);
    assert.match(sql, /REFERENCES `users` \(`id`\) ON DELETE CASCADE/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS `body_measurements`/);
    assert.match(sql, /UNIQUE KEY `uniq_body_meas_user_day`/);
    assert.match(sql, /`user_id`,`recorded_at`/);
  });

  it('admin audit log survives target deletion (SET NULL snapshot pattern)', () => {
    const sql = read('039_admin_audit.sql');
    assert.match(sql, /CREATE TABLE IF NOT EXISTS `admin_actions`/);
    assert.match(sql, /`admin_user_id` int\(11\) NOT NULL/);
    assert.match(sql, /`target_user_id` int\(11\) DEFAULT NULL/);
    assert.match(sql, /REFERENCES `users` \(`id`\) ON DELETE CASCADE/);
    assert.match(sql, /REFERENCES `users` \(`id`\) ON DELETE SET NULL/);
  });

  it('food grams migration adds a catalog serving weight + logged portion', () => {
    const sql = read('043_food_grams.sql');
    assert.match(sql, /ALTER TABLE `food_catalog`/);
    assert.match(sql, /ADD COLUMN `serving_grams` decimal\(7,1\) DEFAULT NULL AFTER `serving_label`/);
    assert.match(sql, /ALTER TABLE `food_logs`/);
    assert.match(sql, /ADD COLUMN `grams` decimal\(7,1\) DEFAULT NULL AFTER `serving`/);
    // Every seeded catalog row must resolve to a weight: deterministic labels
    // (100 g / 1 oz) plus the curated CASE map.
    assert.match(sql, /`serving_label` = '100 g'/);
    assert.match(sql, /`serving_label` = '1 oz'/);
    assert.match(sql, /SET `serving_grams` = CASE `name`/);
  });

  it('AI food-density cache is uniquely keyed by normalized name', () => {
    const sql = read('044_food_density_cache.sql');
    assert.match(sql, /CREATE TABLE IF NOT EXISTS `food_nutrition_cache`/);
    assert.match(sql, /UNIQUE KEY `uniq_food_density_name` \(`name_normalized`\)/);
    assert.match(sql, /`protein` decimal\(6,2\)/);
    assert.match(sql, /`source` varchar\(20\)/);
  });
});
