-- Migrate competition date columns from INTEGER to TEXT
-- This script:
-- 1. Drops indexes on the competitions table
-- 2. Drops the existing INTEGER date columns from competitions
-- 3. Re-adds them as TEXT columns
-- 4. Copies converted date values from competitions_new
-- 5. Recreates the indexes

-- Drop indexes before modifying columns
DROP INDEX IF EXISTS competitions_organizing_team_idx;
DROP INDEX IF EXISTS competitions_group_idx;
DROP INDEX IF EXISTS competitions_status_idx;
DROP INDEX IF EXISTS competitions_start_date_idx;

-- Drop existing INTEGER date columns
ALTER TABLE competitions DROP COLUMN startDate;
ALTER TABLE competitions DROP COLUMN endDate;
ALTER TABLE competitions DROP COLUMN registrationOpensAt;
ALTER TABLE competitions DROP COLUMN registrationClosesAt;

-- Add TEXT date columns
-- startDate and endDate are NOT NULL (required fields)
-- registrationOpensAt and registrationClosesAt are nullable (optional fields)
ALTER TABLE competitions ADD COLUMN startDate TEXT NOT NULL DEFAULT '';
ALTER TABLE competitions ADD COLUMN endDate TEXT NOT NULL DEFAULT '';
ALTER TABLE competitions ADD COLUMN registrationOpensAt TEXT;
ALTER TABLE competitions ADD COLUMN registrationClosesAt TEXT;

-- Copy converted date values from competitions_new
UPDATE competitions
SET
  startDate = (SELECT startDate FROM competitions_new WHERE competitions_new.id = competitions.id),
  endDate = (SELECT endDate FROM competitions_new WHERE competitions_new.id = competitions.id),
  registrationOpensAt = (SELECT registrationOpensAt FROM competitions_new WHERE competitions_new.id = competitions.id),
  registrationClosesAt = (SELECT registrationClosesAt FROM competitions_new WHERE competitions_new.id = competitions.id)
WHERE EXISTS (SELECT 1 FROM competitions_new WHERE competitions_new.id = competitions.id);

-- Recreate indexes
CREATE INDEX competitions_organizing_team_idx ON competitions (organizingTeamId);
CREATE INDEX competitions_group_idx ON competitions (groupId);
CREATE INDEX competitions_status_idx ON competitions (status);
CREATE INDEX competitions_start_date_idx ON competitions (startDate);
