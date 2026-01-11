-- Fix column names to match Drizzle schema (camelCase)
-- SQLite doesn't support RENAME COLUMN in older versions, so we recreate

-- Add columns with correct names
ALTER TABLE `team` ADD `organizerFeePercentage` integer;--> statement-breakpoint
ALTER TABLE `team` ADD `organizerFeeFixed` integer;--> statement-breakpoint

-- Copy data from old columns (if any exists)
UPDATE `team` SET `organizerFeePercentage` = `organizer_fee_percentage` WHERE `organizer_fee_percentage` IS NOT NULL;--> statement-breakpoint
UPDATE `team` SET `organizerFeeFixed` = `organizer_fee_fixed` WHERE `organizer_fee_fixed` IS NOT NULL;--> statement-breakpoint

-- Drop old columns (SQLite 3.35+ supports DROP COLUMN)
ALTER TABLE `team` DROP COLUMN `organizer_fee_percentage`;--> statement-breakpoint
ALTER TABLE `team` DROP COLUMN `organizer_fee_fixed`;
