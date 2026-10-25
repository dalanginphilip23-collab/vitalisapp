-- 036_account_governance.sql — Module 1 (Security & Privacy) leftovers:
-- consent audit trail, soft account deactivation, admin roles.
--
-- users additions:
--   accepted_terms_at       moment the account accepted the Terms of Use +
--                           Privacy Policy (registration / Google sign-up).
--   accepted_terms_version  legal-text version accepted (e.g. '2026-09').
--                           Bump whenever the legal copy materially changes.
--   status                  'active' | 'deactivated'. Deactivation is soft:
--                           password-confirmed, signs out everywhere via
--                           token_version, keeps all data; login offers
--                           one-click reactivation.
--   role                    'member' | 'admin'. requireAdmin middleware gates
--                           Module 7's admin panel. Promote via ADMIN_EMAILS
--                           (registration) or scripts/set-admin.js.
--
-- Idempotent: safe to run twice (runner ignores 1050/1060/1061/1091).

SET FOREIGN_KEY_CHECKS=0;

ALTER TABLE `users`
  ADD COLUMN `accepted_terms_at` datetime DEFAULT NULL AFTER `onboarding_completed`,
  ADD COLUMN `accepted_terms_version` varchar(20) DEFAULT NULL AFTER `accepted_terms_at`,
  ADD COLUMN `status` varchar(20) NOT NULL DEFAULT 'active' AFTER `accepted_terms_version`,
  ADD COLUMN `role` varchar(20) NOT NULL DEFAULT 'member' AFTER `status`;

SET FOREIGN_KEY_CHECKS=1;
