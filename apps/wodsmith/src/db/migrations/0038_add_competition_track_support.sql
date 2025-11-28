-- Rename dayNumber to trackOrder in track_workout table
ALTER TABLE `track_workout` RENAME COLUMN `dayNumber` TO `trackOrder`;--> statement-breakpoint
-- Drop weekNumber column (no longer needed)
ALTER TABLE `track_workout` DROP COLUMN `weekNumber`;--> statement-breakpoint
-- Add pointsMultiplier column for competition scoring
ALTER TABLE `track_workout` ADD `pointsMultiplier` integer DEFAULT 100;--> statement-breakpoint
-- Add competitionId column to programming_track table
ALTER TABLE `programming_track` ADD `competitionId` text REFERENCES competition(id) ON DELETE CASCADE;--> statement-breakpoint
-- Update index: drop old day index and create new order index
DROP INDEX IF EXISTS `track_workout_day_idx`;--> statement-breakpoint
CREATE INDEX `track_workout_order_idx` ON `track_workout` (`trackOrder`);--> statement-breakpoint
-- Update unique index
DROP INDEX IF EXISTS `track_workout_unique_idx`;--> statement-breakpoint
CREATE INDEX `track_workout_unique_idx` ON `track_workout` (`trackId`,`workoutId`,`trackOrder`);--> statement-breakpoint
-- Add index for competition tracks
CREATE INDEX `programming_track_competition_idx` ON `programming_track` (`competitionId`);
