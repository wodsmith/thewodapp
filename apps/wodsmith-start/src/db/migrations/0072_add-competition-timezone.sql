-- Add timezone column to competitions table
-- IANA timezone for competition dates and deadlines (e.g., "America/Denver")
-- Default to America/Denver for existing competitions

ALTER TABLE "competitions" ADD COLUMN "timezone" text DEFAULT 'America/Denver';
