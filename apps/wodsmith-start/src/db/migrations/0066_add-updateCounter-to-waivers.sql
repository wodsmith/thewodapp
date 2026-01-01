-- Add missing updateCounter column to waivers and waiver_signatures tables
-- This column is defined in commonColumns but was missing from the original migration

ALTER TABLE `waivers` ADD COLUMN `updateCounter` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `waiver_signatures` ADD COLUMN `updateCounter` integer DEFAULT 0;
