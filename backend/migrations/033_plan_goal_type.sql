-- 033_plan_goal_type.sql — store the training goal on user plans (idempotent ALTER migration)
-- Runner ignores duplicate errors (1060,1061,1091). Use plain ALTER.
-- goal_type mirrors fitness_goals.goal_type so plan creation can filter
-- exercises by goal (muscle gain vs fat loss). NULL = pre-goal plans.

SET FOREIGN_KEY_CHECKS=0;

ALTER TABLE `plans` ADD COLUMN `goal_type` varchar(32) DEFAULT NULL;

SET FOREIGN_KEY_CHECKS=1;
