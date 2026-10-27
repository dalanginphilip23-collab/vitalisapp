# Migrations — Vitalis (one table per file)

44 canonical files: `001_users.sql` … `029_workout_logs.sql` + `030_seeds.sql` +
`031_landing_visits.sql` + `032_personal_plans.sql` + `033_user_allergies.sql` +
`034_workout_sets.sql` + `035_training_preferences.sql` +
`036_account_governance.sql` + `037_meal_type_food_catalog.sql` +
`038_progress_module.sql` + `039_admin_audit.sql` + `040_admin_seed.sql` +
`041_goal_recalibration.sql` + `042_progress_cadence.sql` +
`043_food_grams.sql` + `044_food_density_cache.sql`.
Each table file is self-contained (`SET FOREIGN_KEY_CHECKS=0/1` + single
`CREATE TABLE IF NOT EXISTS`). Seeds use `INSERT IGNORE`.
Runner `src/db/migrate.js` applies pending `*.sql` in lexicographic order,
tracked in `_migrations`. Next migration: `045_<slug>.sql`
(`npm run db:create -- <slug>`).

## History

- Pre-2026-09-25: 28-file evolving history (`001-034` + gaps), squashed into a
  single `001_baseline.sql` (live schema dump).
- 2026-09-25: baseline split byte-identical into 29 per-table files + seeds
  (parents first: users → plans → contents → exercises, then alphabetical).
  Original baseline retired after scratch-DB verification.
- Full pre-squash backup: `backups/pre-squash-2026-09-25.sql`.
- Live databases keep old `_migrations` rows (`001-034` era + `001_baseline.sql`)
  as inert history — the runner only looks at files on disk. Fresh databases
  apply the 31 files to the identical schema.
- 2026-10-20: `034_workout_sets.sql` — Module 5: `workout_sets` (per-set reps/
  weight/duration/distance) + `workout_logs` columns `paused_seconds`,
  `pause_started_at`, `difficulty_rating`, `session_notes` (pause/resume +
  post-workout self-report; sets power manual weight-session logging).
- 2026-10-20: `035_training_preferences.sql` — Module 5: equipment /
  preferred days / session minutes / location (recommendation inputs;
  day-cycling schedule + fit-to-minutes + equipment alternatives).
- 2026-10-20: `036_account_governance.sql` — Module 1: `users.accepted_terms_at` /
  `accepted_terms_version` (consent audit), `users.status`
  ('active' | 'deactivated' — soft deactivation + login-time reactivation),
  `users.role` ('member' | 'admin' — requireAdmin middleware; first admins
  via ADMIN_EMAILS env or scripts/set-admin.js).
- 2026-10-20: `037_meal_type_food_catalog.sql` — Module 4: `food_logs.meal_type`
  (real meal slot; backfills legacy rows that stored it in `serving`) +
  `food_catalog` seeded table (~110 foods) backing GET /api/food-catalog?q=
  autocomplete.
- 2026-10-20: `038_progress_module.sql` — Module 6: `progress_photos`
  (front/side/back, private, Gemini review/rating fields) + `body_measurements`
  (weight/BF%/tapes, one row per user per date; weight mirrors to
  `bmi_records`).
- 2026-10-20: `039_admin_audit.sql` — Module 7: `admin_actions` audit trail
  (who/what/when/target + details) written by every mutating /api/admin
  endpoint, read by GET /api/admin/audit. Target FK is ON DELETE SET NULL so
  audit rows survive a hard user delete. RUN BEFORE USING THE ADMIN PANEL.
- 2026-10-24: `041_goal_recalibration.sql` — Module 8 (adaptive loop):
  `fitness_goals.calibrated_weight_kg` + `calibrated_at` track which weight the
  goals' daily_kcal/macros were last computed from. Weigh-ins drift-detect
  (≥2 kg / ≥5%) and auto-recalibrate via bmi service; manual force via
  POST /api/goals/active/:userId/recalibrate. Baseline `weight_kg` untouched —
  progress math keeps its origin.
- 2026-10-21: `040_admin_seed.sql` — Module 7: seeds the default admin login
  `admin@gmail.com` / `12345678` (bcrypt, 10 rounds) with role='admin',
  verified + onboarding complete. Idempotent; never overwrites an existing
  password — only repairs role/status/verification. Change the password from
  Profile after first login. Required columns come from 036.
- 2026-10-27: `043_food_grams.sql` — Module 4: `food_catalog.serving_grams`
  (grams in one reference serving; curated for all 114 seeded foods) and
  `food_logs.grams` (portion actually logged). Backs gram-based manual entry:
  GET /api/food-catalog now returns per-100 g values, and the form scales them
  to the user's weight.
- 2026-10-27: `044_food_density_cache.sql` — Module 4: `food_nutrition_cache`,
  an AI per-100 g estimate cache keyed by normalized food name. Repeat dishes
  are instant and don't spend AI quota; values are validated/clamped in
  `src/utils/nutrition.js` before insert.

## Rules

- Table files use `CREATE TABLE IF NOT EXISTS`; new migrations use plain `ALTER`.
- Seeds must use `INSERT IGNORE` (runner does NOT ignore `1062`).
- Never renumber files or edit an applied file — add a new numbered file.
