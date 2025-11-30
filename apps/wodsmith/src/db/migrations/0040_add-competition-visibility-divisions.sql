-- Rename competition_division_fees table to competition_divisions
ALTER TABLE `competition_division_fees` RENAME TO `competition_divisions`;
--> statement-breakpoint
-- Add description column to competition_divisions
ALTER TABLE `competition_divisions` ADD `description` text(2000);
--> statement-breakpoint
-- Add visibility column to competitions (default: public)
ALTER TABLE `competitions` ADD `visibility` text(10) DEFAULT 'public' NOT NULL;
--> statement-breakpoint
-- Recreate indexes with new names (drop old, create new)
DROP INDEX IF EXISTS `competition_division_fees_unique_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `competition_division_fees_competition_idx`;
--> statement-breakpoint
CREATE UNIQUE INDEX `competition_divisions_unique_idx` ON `competition_divisions` (`competitionId`,`divisionId`);
--> statement-breakpoint
CREATE INDEX `competition_divisions_competition_idx` ON `competition_divisions` (`competitionId`);
