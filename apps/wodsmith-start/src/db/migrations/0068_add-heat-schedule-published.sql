-- Add per-heat schedule publishing timestamp
-- NULL = not published, timestamp = when the heat's schedule was published to athletes
ALTER TABLE `competition_heats` ADD `schedulePublishedAt` integer;
