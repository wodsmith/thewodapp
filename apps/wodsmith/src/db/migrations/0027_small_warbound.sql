-- First add the column as nullable
ALTER TABLE `generated_schedules` ADD `location_id` text REFERENCES locations(id);

-- Update existing records to have a default location (we'll use the first location for the team)
-- This is a placeholder - in production you'd want to handle this more carefully
UPDATE `generated_schedules` 
SET `location_id` = (
  SELECT `id` FROM `locations` 
  WHERE `team_id` = `generated_schedules`.`team_id` 
  LIMIT 1
)
WHERE `location_id` IS NULL;