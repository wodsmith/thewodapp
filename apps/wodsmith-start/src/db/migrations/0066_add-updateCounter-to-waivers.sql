-- Add missing updateCounter column to waivers and waiver_signatures tables
-- This column is defined in commonColumns but was missing from the original migration

ALTER TABLE `waivers` ADD COLUMN `updateCounter` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `waiver_signatures` ADD COLUMN `updateCounter` integer DEFAULT 0;--> statement-breakpoint

-- Add per-heat schedule publishing timestamp (moved from 0068 to make idempotent)
-- NULL = not published, timestamp = when the heat's schedule was published to athletes
ALTER TABLE `competition_heats` ADD COLUMN `schedulePublishedAt` integer;
