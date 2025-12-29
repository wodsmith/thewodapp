-- Add unique constraint to workout_scaling_descriptions table
-- This enables efficient upsert operations using ON CONFLICT

-- First, drop the existing non-unique index
DROP INDEX IF EXISTS `workout_scaling_desc_lookup_idx`;

-- Create the unique index
CREATE UNIQUE INDEX `workout_scaling_desc_unique_idx` ON `workout_scaling_descriptions` (`workoutId`,`scalingLevelId`);
