-- Add capacity limits to divisions
-- Competition-level default and division-specific override

ALTER TABLE `competitions` ADD `defaultMaxSpotsPerDivision` integer;
ALTER TABLE `competition_divisions` ADD `maxSpots` integer;
