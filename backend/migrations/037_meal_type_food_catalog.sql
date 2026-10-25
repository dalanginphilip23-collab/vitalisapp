-- 037_meal_type_food_catalog.sql — Module 4 (Personalized Diet & Nutrition):
-- meal type persistence + searchable food catalog.
--
-- food_logs additions:
--   meal_type  Breakfast | Lunch | Dinner | Snack | Other (validated in the
--              foodLogs service). Previously the manual form stuffed the meal
--              type into `serving` and the diary had to reverse-engineer the
--              slot by string-matching; scans had no slot at all. The backfill
--              migrates those legacy rows once; new logs store it properly.
--
-- food_catalog: small curated seed (~80 common foods, per typical serving)
-- backing GET /api/food-catalog?q= autocomplete in the manual meal form.
-- Values are reference estimates — users keep editing macros after picking.
--
-- Idempotent: safe to run twice (runner ignores 1050/1060/1061/1091).

SET FOREIGN_KEY_CHECKS=0;

ALTER TABLE `food_logs`
  ADD COLUMN `meal_type` varchar(20) DEFAULT NULL AFTER `serving`;

-- One-time migration of legacy rows where the meal type lived in `serving`.
UPDATE `food_logs`
SET `meal_type` = `serving`
WHERE `meal_type` IS NULL
  AND `serving` IN ('Breakfast', 'Lunch', 'Dinner', 'Snack', 'Other');

CREATE TABLE IF NOT EXISTS `food_catalog` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `serving_label` varchar(60) DEFAULT NULL,
  `calories` int(11) DEFAULT 0,
  `protein` decimal(10,2) DEFAULT 0.00,
  `carbs` decimal(10,2) DEFAULT 0.00,
  `fat` decimal(10,2) DEFAULT 0.00,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_food_catalog_name` (`name`),
  KEY `idx_food_catalog_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT IGNORE INTO `food_catalog` (`name`, `serving_label`, `calories`, `protein`, `carbs`, `fat`) VALUES
('Banana', '1 medium', 105, 1.30, 27.00, 0.40),
('Apple', '1 medium', 95, 0.50, 25.00, 0.30),
('Orange', '1 medium', 62, 1.20, 15.40, 0.20),
('Strawberries', '1 cup', 53, 1.10, 12.70, 0.50),
('Blueberries', '1 cup', 84, 1.10, 21.00, 0.50),
('Grapes', '1 cup', 62, 0.60, 15.80, 0.30),
('Mango', '1 cup', 99, 1.40, 24.70, 0.60),
('Pineapple', '1 cup', 82, 0.90, 21.60, 0.20),
('Watermelon', '1 cup', 46, 0.90, 11.50, 0.20),
('Avocado', '1/2 fruit', 161, 2.00, 8.60, 14.70),
('Raisins', '1/4 cup', 108, 1.10, 29.00, 0.20),
('Dates', '3 pieces', 200, 1.80, 53.00, 0.30),
('Boiled egg', '1 large', 78, 6.30, 0.60, 5.30),
('Fried egg', '1 large', 90, 6.30, 0.40, 7.00),
('Egg white', '1 large', 17, 3.60, 0.20, 0.10),
('Omelette (2 eggs)', '1 serving', 200, 13.00, 2.00, 15.50),
('Chicken breast, grilled', '100 g', 165, 31.00, 0.00, 3.60),
('Chicken thigh, roasted', '100 g', 209, 26.00, 0.00, 10.90),
('Chicken wings, fried', '6 pieces', 425, 38.00, 11.00, 24.00),
('Beef steak, grilled', '100 g', 271, 25.00, 0.00, 19.00),
('Ground beef, 85% lean', '100 g', 218, 26.00, 0.00, 12.00),
('Pork chop, grilled', '100 g', 231, 26.00, 0.00, 13.60),
('Bacon', '2 slices', 86, 5.80, 0.20, 6.70),
('Salmon, baked', '100 g', 208, 20.00, 0.00, 13.40),
('Tuna, canned in water', '100 g', 116, 25.50, 0.00, 0.80),
('Shrimp, steamed', '100 g', 99, 24.00, 0.20, 0.30),
('Tilapia, cooked', '100 g', 129, 26.00, 0.00, 2.70),
('Turkey breast, sliced', '100 g', 104, 17.00, 4.20, 1.70),
('Tofu, firm', '100 g', 144, 17.00, 2.80, 8.70),
('Tempeh', '100 g', 192, 20.30, 7.60, 10.80),
('Lentils, cooked', '1 cup', 230, 18.00, 40.00, 0.80),
('Black beans, cooked', '1 cup', 227, 15.20, 40.80, 0.90),
('Chickpeas, cooked', '1 cup', 269, 14.50, 44.90, 4.20),
('Kidney beans, cooked', '1 cup', 225, 15.40, 40.40, 0.90),
('Edamame', '1 cup', 188, 18.40, 13.80, 8.10),
('Hummus', '2 tbsp', 70, 2.00, 6.00, 5.00),
('White rice, cooked', '1 cup', 205, 4.30, 45.00, 0.40),
('Brown rice, cooked', '1 cup', 218, 5.00, 46.00, 1.60),
('Quinoa, cooked', '1 cup', 222, 8.10, 39.40, 3.60),
('Pasta, cooked', '1 cup', 220, 8.10, 43.00, 1.30),
('Spaghetti with tomato sauce', '1 cup', 267, 9.50, 48.00, 4.30),
('Mac and cheese', '1 cup', 310, 13.00, 35.00, 12.00),
('Ramen, instant', '1 pack', 380, 8.00, 52.00, 15.00),
('Bread, white', '1 slice', 79, 2.70, 15.00, 1.00),
('Bread, whole wheat', '1 slice', 81, 4.00, 14.00, 1.10),
('Bagel, plain', '1 medium', 289, 11.00, 56.00, 1.70),
('Croissant', '1 medium', 231, 4.70, 26.00, 12.00),
('Tortilla, flour', '1 medium', 146, 4.00, 25.00, 3.50),
('Pancakes', '2 medium', 175, 5.00, 22.00, 7.00),
('French toast', '2 slices', 320, 12.00, 36.00, 14.00),
('Waffles', '2 round', 218, 5.90, 25.00, 10.60),
('Oatmeal, cooked', '1 cup', 154, 6.00, 27.00, 3.20),
('Breakfast cereal, flakes', '1 cup', 124, 3.00, 29.00, 0.50),
('Granola', '1/2 cup', 213, 6.10, 35.20, 6.40),
('Milk, whole', '1 cup', 149, 7.70, 11.70, 7.90),
('Milk, skim', '1 cup', 83, 8.30, 12.20, 0.20),
('Almond milk, unsweetened', '1 cup', 39, 1.50, 3.40, 2.50),
('Greek yogurt, plain', '1 cup', 146, 23.60, 9.00, 0.80),
('Yogurt, fruit-flavored', '1 cup', 243, 10.30, 46.00, 2.60),
('Cheddar cheese', '1 slice', 113, 7.00, 0.40, 9.30),
('Mozzarella', '1 oz', 85, 6.30, 0.60, 6.30),
('Cottage cheese', '1/2 cup', 110, 14.00, 4.00, 4.50),
('Cream cheese', '1 tbsp', 99, 1.70, 0.80, 9.90),
('Butter', '1 tbsp', 102, 0.10, 0.00, 11.50),
('Peanut butter', '2 tbsp', 188, 8.00, 6.00, 16.00),
('Almonds', '1 oz', 164, 6.00, 6.10, 14.20),
('Walnuts', '1 oz', 185, 4.30, 3.90, 18.50),
('Cashews', '1 oz', 157, 5.20, 8.60, 12.40),
('Mixed nuts', '1 oz', 173, 5.00, 6.00, 15.00),
('Trail mix', '1/4 cup', 173, 5.00, 17.00, 10.00),
('Pizza, cheese', '1 slice', 285, 12.00, 36.00, 10.00),
('Cheeseburger', '1 sandwich', 535, 30.00, 39.00, 28.00),
('Beef burrito', '1 burrito', 430, 17.00, 45.00, 19.00),
('Chicken taco', '1 taco', 210, 12.00, 19.00, 9.00),
('Chicken sandwich, fried', '1 sandwich', 540, 28.00, 45.00, 28.00),
('Hot dog', '1 piece', 290, 10.40, 24.30, 17.50),
('Club sandwich', '1 half', 310, 18.00, 28.00, 14.00),
('Turkey sandwich', '1 whole', 480, 25.00, 55.00, 17.00),
('Sushi roll, salmon', '6 pieces', 304, 13.00, 42.00, 7.00),
('Pad thai', '1 plate', 660, 22.00, 82.00, 27.00),
('Fried rice', '1 cup', 348, 10.00, 51.00, 11.00),
('Chicken curry with rice', '1 plate', 640, 30.00, 75.00, 24.00),
('Caesar salad with chicken', '1 bowl', 470, 33.00, 12.00, 31.00),
('Greek salad', '1 bowl', 270, 7.00, 14.00, 22.00),
('French fries', '1 medium', 378, 4.00, 48.00, 19.00),
('Potato chips', '1 oz', 152, 2.00, 15.00, 10.00),
('Mashed potatoes', '1 cup', 237, 4.00, 35.00, 9.00),
('Baked potato', '1 medium', 161, 4.30, 37.00, 0.20),
('Sweet potato, baked', '1 medium', 103, 2.30, 24.00, 0.10),
('Corn on the cob', '1 ear', 90, 3.00, 19.00, 1.30),
('Broccoli, steamed', '1 cup', 55, 3.70, 11.20, 0.60),
('Carrots, raw', '1 cup', 52, 1.20, 12.30, 0.30),
('Mixed greens salad', '1 bowl', 45, 2.00, 8.00, 0.60),
('Tomato soup', '1 cup', 130, 3.00, 23.00, 2.80),
('Chicken noodle soup', '1 cup', 120, 9.00, 12.00, 3.50),
('Chocolate chip cookie', '1 cookie', 148, 1.60, 20.00, 7.00),
('Brownie', '1 square', 243, 2.70, 39.00, 9.00),
('Ice cream, vanilla', '1/2 cup', 137, 2.30, 16.00, 7.30),
('Donut, glazed', '1 donut', 269, 3.90, 31.00, 15.00),
('Muffin, blueberry', '1 medium', 377, 5.30, 54.00, 15.00),
('Cake, chocolate', '1 slice', 352, 4.30, 51.00, 15.00),
('Energy bar', '1 bar', 180, 6.00, 22.00, 8.00),
('Protein shake, whey', '1 scoop in water', 130, 25.00, 3.00, 1.50),
('Protein bar', '1 bar', 220, 20.00, 24.00, 7.00),
('Dark chocolate', '1 oz', 170, 2.20, 13.00, 12.10),
('Honey', '1 tbsp', 64, 0.10, 17.30, 0.00),
('Black coffee', '1 cup', 2, 0.30, 0.00, 0.00),
('Latte', '1 medium', 190, 10.00, 18.00, 9.00),
('Orange juice', '1 cup', 112, 1.70, 26.00, 0.50),
('Cola', '1 can (330 ml)', 139, 0.00, 39.00, 0.00),
('Diet cola', '1 can (330 ml)', 0, 0.00, 0.00, 0.00),
('Beer', '1 bottle (355 ml)', 153, 1.60, 13.00, 0.00),
('Red wine', '5 oz', 125, 0.10, 3.80, 0.00),
('Green smoothie', '1 cup', 130, 4.00, 24.00, 2.00);

SET FOREIGN_KEY_CHECKS=1;
