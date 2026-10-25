-- 040_admin_seed.sql — Module 7 (Admin Panel): seed the default admin login.
--
-- Creates (or promotes) the dedicated admin account used to reach /admin:
--   email:    admin@gmail.com
--   password: 12345678
--   role:     admin, verified, onboarding marked complete so login lands
--             directly in the console instead of the onboarding wizard.
--
-- Safety:
--   * Idempotent — ON DUPLICATE KEY makes re-runs harmless.
--   * NEVER overwrites an existing password. If the account already exists,
--     only the role/status/verification flags are repaired. Change the
--     password from Profile (or scripts/set-admin.js) after first login.
--   * Requires migrations 001 (users) and 036 (role/status/terms columns).
--
-- Run order: 039 (audit table) then 040 (this file).
-- The password below is a bcrypt hash of "12345678" (10 rounds).

SET FOREIGN_KEY_CHECKS=0;

INSERT INTO `users`
  (`name`, `email`, `password`, `is_verified`, `onboarding_completed`,
   `accepted_terms_at`, `accepted_terms_version`, `status`, `role`)
VALUES
  ('Vitalis Admin', 'admin@gmail.com',
   '$2b$10$nRmo/jnklbzPAdBuIFRqJu3b69VdhC6yyiFWq0gDc9wkg1agFnJU6',
   1, 1, NOW(), '1.0', 'active', 'admin')
ON DUPLICATE KEY UPDATE
  `role` = 'admin',
  `status` = 'active',
  `is_verified` = 1,
  `onboarding_completed` = 1;

SET FOREIGN_KEY_CHECKS=1;
