-- 039_admin_audit.sql — Module 7 (Admin Panel): audit trail for every admin
-- action performed through /api/admin (role changes, deactivations, force
-- sign-outs, user deletions, community moderation).
--
-- admin_actions:
--   admin_user_id   who performed the action (the signed-in admin).
--   action          verb: 'role_change' | 'deactivate' | 'reactivate' |
--                   'force_signout' | 'delete_user' | 'delete_post'.
--   target_user_id  affected user, if any. ON DELETE SET NULL so the audit
--                   row survives a hard user delete — the details column
--                   snapshots the email at action time.
--   details         human-readable one-liner (e.g. "member → admin",
--                   "reason: abuse report #12").
--
-- Read by GET /api/admin/audit; written by every mutating admin endpoint.
-- NOTE: run this BEFORE using the admin panel — audit writes are fail-soft
-- (logged to console) so a missing table never blocks an admin action, but
-- the audit history would be lost.
--
-- Idempotent: safe to run twice (runner ignores 1050/1060/1061/1091).

SET FOREIGN_KEY_CHECKS=0;

CREATE TABLE IF NOT EXISTS `admin_actions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `admin_user_id` int(11) NOT NULL,
  `action` varchar(50) NOT NULL,
  `target_user_id` int(11) DEFAULT NULL,
  `details` varchar(500) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_admin_actions_admin` (`admin_user_id`),
  KEY `idx_admin_actions_target` (`target_user_id`),
  KEY `idx_admin_actions_created` (`created_at`),
  CONSTRAINT `admin_actions_ibfk_1` FOREIGN KEY (`admin_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `admin_actions_ibfk_2` FOREIGN KEY (`target_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SET FOREIGN_KEY_CHECKS=1;
