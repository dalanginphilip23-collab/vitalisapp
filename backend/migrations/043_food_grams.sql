-- 043_food_grams.sql — gram-based nutrition:
--   food_catalog.serving_grams — grams in ONE reference serving, so the manual
--     form can scale the catalog's per-serving macros to any user weight
--     (GET /api/food-catalog now returns per-100 g values derived from this).
--   food_logs.grams — the portion the user actually weighed and logged.
--
-- Weights describe the serving AS EATEN (cooked where the label implies a
-- prepared dish: rice/pasta/ramen/soups). Rows without a defensible weight
-- stay NULL — the UI then asks for manual macros instead of guessing.
--
-- Idempotent: duplicate-column errors are ignored by the runner and the
-- UPDATEs are absolute values (safe to re-run).
SET FOREIGN_KEY_CHECKS=0;

ALTER TABLE `food_catalog`
  ADD COLUMN `serving_grams` decimal(7,1) DEFAULT NULL AFTER `serving_label`;

ALTER TABLE `food_logs`
  ADD COLUMN `grams` decimal(7,1) DEFAULT NULL AFTER `serving`;

-- Deterministic labels first (also covers any future rows seeded with these).
UPDATE `food_catalog` SET `serving_grams` = 100.0 WHERE `serving_label` = '100 g';
UPDATE `food_catalog` SET `serving_grams` = 28.3 WHERE `serving_label` = '1 oz';

-- Curated reference weights for the seeded catalog (see 037). ELSE keeps the
-- 100 g / 1 oz values set above.
UPDATE `food_catalog`
SET `serving_grams` = CASE `name`
  WHEN 'Banana' THEN 118.0
  WHEN 'Apple' THEN 182.0
  WHEN 'Orange' THEN 131.0
  WHEN 'Strawberries' THEN 152.0
  WHEN 'Blueberries' THEN 148.0
  WHEN 'Grapes' THEN 151.0
  WHEN 'Mango' THEN 165.0
  WHEN 'Pineapple' THEN 165.0
  WHEN 'Watermelon' THEN 152.0
  WHEN 'Avocado' THEN 100.0
  WHEN 'Raisins' THEN 43.0
  WHEN 'Dates' THEN 72.0
  WHEN 'Boiled egg' THEN 50.0
  WHEN 'Fried egg' THEN 50.0
  WHEN 'Egg white' THEN 33.0
  WHEN 'Omelette (2 eggs)' THEN 120.0
  WHEN 'Chicken wings, fried' THEN 300.0
  WHEN 'Bacon' THEN 24.0
  WHEN 'Lentils, cooked' THEN 198.0
  WHEN 'Black beans, cooked' THEN 172.0
  WHEN 'Chickpeas, cooked' THEN 164.0
  WHEN 'Kidney beans, cooked' THEN 177.0
  WHEN 'Edamame' THEN 155.0
  WHEN 'Hummus' THEN 30.0
  WHEN 'White rice, cooked' THEN 158.0
  WHEN 'Brown rice, cooked' THEN 195.0
  WHEN 'Quinoa, cooked' THEN 185.0
  WHEN 'Pasta, cooked' THEN 140.0
  WHEN 'Spaghetti with tomato sauce' THEN 250.0
  WHEN 'Mac and cheese' THEN 200.0
  WHEN 'Ramen, instant' THEN 380.0
  WHEN 'Bread, white' THEN 28.0
  WHEN 'Bread, whole wheat' THEN 32.0
  WHEN 'Bagel, plain' THEN 105.0
  WHEN 'Croissant' THEN 57.0
  WHEN 'Tortilla, flour' THEN 49.0
  WHEN 'Pancakes' THEN 150.0
  WHEN 'French toast' THEN 130.0
  WHEN 'Waffles' THEN 150.0
  WHEN 'Oatmeal, cooked' THEN 234.0
  WHEN 'Breakfast cereal, flakes' THEN 28.0
  WHEN 'Granola' THEN 61.0
  WHEN 'Milk, whole' THEN 244.0
  WHEN 'Milk, skim' THEN 245.0
  WHEN 'Almond milk, unsweetened' THEN 240.0
  WHEN 'Greek yogurt, plain' THEN 245.0
  WHEN 'Yogurt, fruit-flavored' THEN 245.0
  WHEN 'Cheddar cheese' THEN 28.0
  WHEN 'Cottage cheese' THEN 113.0
  WHEN 'Cream cheese' THEN 15.0
  WHEN 'Butter' THEN 14.0
  WHEN 'Peanut butter' THEN 32.0
  WHEN 'Trail mix' THEN 38.0
  WHEN 'Pizza, cheese' THEN 107.0
  WHEN 'Cheeseburger' THEN 200.0
  WHEN 'Beef burrito' THEN 250.0
  WHEN 'Chicken taco' THEN 100.0
  WHEN 'Chicken sandwich, fried' THEN 200.0
  WHEN 'Hot dog' THEN 120.0
  WHEN 'Club sandwich' THEN 180.0
  WHEN 'Turkey sandwich' THEN 250.0
  WHEN 'Sushi roll, salmon' THEN 180.0
  WHEN 'Pad thai' THEN 300.0
  WHEN 'Fried rice' THEN 198.0
  WHEN 'Chicken curry with rice' THEN 400.0
  WHEN 'Caesar salad with chicken' THEN 350.0
  WHEN 'Greek salad' THEN 300.0
  WHEN 'French fries' THEN 117.0
  WHEN 'Mashed potatoes' THEN 210.0
  WHEN 'Baked potato' THEN 173.0
  WHEN 'Sweet potato, baked' THEN 150.0
  WHEN 'Corn on the cob' THEN 90.0
  WHEN 'Broccoli, steamed' THEN 156.0
  WHEN 'Carrots, raw' THEN 128.0
  WHEN 'Mixed greens salad' THEN 85.0
  WHEN 'Tomato soup' THEN 245.0
  WHEN 'Chicken noodle soup' THEN 240.0
  WHEN 'Chocolate chip cookie' THEN 30.0
  WHEN 'Brownie' THEN 56.0
  WHEN 'Ice cream, vanilla' THEN 66.0
  WHEN 'Donut, glazed' THEN 60.0
  WHEN 'Muffin, blueberry' THEN 113.0
  WHEN 'Cake, chocolate' THEN 95.0
  WHEN 'Energy bar' THEN 45.0
  WHEN 'Protein shake, whey' THEN 32.0
  WHEN 'Protein bar' THEN 60.0
  WHEN 'Honey' THEN 21.0
  WHEN 'Black coffee' THEN 240.0
  WHEN 'Latte' THEN 350.0
  WHEN 'Orange juice' THEN 248.0
  WHEN 'Cola' THEN 330.0
  WHEN 'Diet cola' THEN 330.0
  WHEN 'Beer' THEN 355.0
  WHEN 'Red wine' THEN 147.0
  WHEN 'Green smoothie' THEN 240.0
  ELSE `serving_grams`
END;

SET FOREIGN_KEY_CHECKS=1;
