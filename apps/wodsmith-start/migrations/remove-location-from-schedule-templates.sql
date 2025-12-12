-- Migration: Remove locationId from schedule_templates table
-- This migration makes schedule templates location-agnostic so they can be used by any location

-- SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
-- First, create a new table without the location_id column
CREATE TABLE schedule_templates_new (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL REFERENCES team(id),
    name TEXT NOT NULL,
    class_catalog_id TEXT NOT NULL REFERENCES class_catalog(id),
    createdAt INTEGER,
    updatedAt INTEGER,
    updateCounter INTEGER
);

-- Copy data from the old table to the new table
INSERT INTO schedule_templates_new (id, team_id, name, class_catalog_id, createdAt, updatedAt, updateCounter)
SELECT id, team_id, name, class_catalog_id, createdAt, updatedAt, updateCounter
FROM schedule_templates;

-- Drop the old table
DROP TABLE schedule_templates;

-- Rename the new table to the original name
ALTER TABLE schedule_templates_new RENAME TO schedule_templates;

-- Recreate any indexes if needed
-- (Add any indexes that were on the original table here)