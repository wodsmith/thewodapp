-- Migration: Add minHeatBuffer to track_workout table
-- Minimum number of heats a judge must rest between rotations
-- Default value: 2, nullable to inherit from competition or system defaults

ALTER TABLE track_workout ADD COLUMN minHeatBuffer INTEGER DEFAULT 2;