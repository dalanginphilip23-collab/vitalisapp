-- 041_goal_recalibration.sql — adaptive goal targets (Module 8).
-- The active goal's daily_kcal/macros are generated from the weight at goal
-- creation. As the user weighs in over time, the body that plan was built
-- for drifts away. These columns track WHICH weight the targets were last
-- computed from (calibrated_weight_kg), so services can:
--   1. auto-recalibrate on a weigh-in that drifts >= 2 kg / >= 5% from the
--      calibrated reference, and
--   2. power the manual "Recalibrate to current weight" action
--      (POST /api/goals/active/:userId/recalibrate).
-- NULL calibrated_weight_kg = never recalibrated (goal start weight is the
-- reference). Runner ignores duplicate-column errors, so this is idempotent.

SET FOREIGN_KEY_CHECKS=0;

ALTER TABLE `fitness_goals` ADD COLUMN `calibrated_weight_kg` double DEFAULT NULL;
ALTER TABLE `fitness_goals` ADD COLUMN `calibrated_at` datetime DEFAULT NULL;

SET FOREIGN_KEY_CHECKS=1;
