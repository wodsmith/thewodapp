-- Migrate competition date columns from INTEGER to TEXT
-- This script:
-- 1. Drops the existing INTEGER date columns from competitions
-- 2. Re-adds them as TEXT columns
-- 3. Copies converted date values from competitions_new

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
