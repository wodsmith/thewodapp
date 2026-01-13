-- Add organizer fee override columns to team table
-- These allow setting custom platform fees for specific organizers (e.g., founding organizers)
-- Null values mean use platform defaults (4% + $4)
-- NOTE: Column names fixed to camelCase in 0070_fix-organizer-fee-column-names.sql
ALTER TABLE `team` ADD `organizer_fee_percentage` integer;--> statement-breakpoint
ALTER TABLE `team` ADD `organizer_fee_fixed` integer;
