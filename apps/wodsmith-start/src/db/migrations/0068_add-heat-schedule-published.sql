-- Add per-heat schedule publishing timestamp
-- NULL = not published, timestamp = when the heat's schedule was published to athletes
-- 
-- NOTE: This column was already added to production. This migration is now a no-op
-- to allow the migration journal to record it as applied without error.
-- Original statement: ALTER TABLE `competition_heats` ADD `schedulePublishedAt` integer;
SELECT 1;
