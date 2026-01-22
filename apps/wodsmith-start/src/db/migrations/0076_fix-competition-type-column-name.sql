-- Fix column name to match Drizzle schema (camelCase)
-- Migration 0075 incorrectly created column as snake_case

-- Add column with correct name
ALTER TABLE `competitions` ADD `competitionType` text(15) DEFAULT 'in-person' NOT NULL;--> statement-breakpoint

-- Copy data from old column
UPDATE `competitions` SET `competitionType` = `competition_type`;--> statement-breakpoint

-- Drop old column (SQLite 3.35+ supports DROP COLUMN)
ALTER TABLE `competitions` DROP COLUMN `competition_type`;
