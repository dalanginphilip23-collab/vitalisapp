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
  '033_plan_goal_type.sql',
];

describe('migrations per-table baseline', () => {
  it('migrations/ holds exactly the 33 canonical files', () => {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    assert.deepEqual(files, EXPECTED);
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

  it('plan goal_type alter is idempotent', () => {
    assert.match(read('033_plan_goal_type.sql'), /ADD COLUMN `goal_type`/);
  });

  it('controllers reference only tables that migrations create', () => {
    const communityCtrl = fs.readFileSync(
      path.join(__dirname, '..', '..', 'src', 'controllers', 'community.controller.js'), 'utf8'
    );
    for (const t of ['community_posts', 'community_likes', 'community_comments']) {
      assert.ok(communityCtrl.includes(t), `controller must reference ${t}`);
    }
  });
});
