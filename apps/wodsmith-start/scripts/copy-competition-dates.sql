-- Copy date fields from competitions_new to competitions
-- This script updates the competitions table with date values from competitions_new

UPDATE competitions
SET
  startDate = (SELECT startDate FROM competitions_new WHERE competitions_new.id = competitions.id),
  endDate = (SELECT endDate FROM competitions_new WHERE competitions_new.id = competitions.id),
  registrationOpensAt = (SELECT registrationOpensAt FROM competitions_new WHERE competitions_new.id = competitions.id),
  registrationClosesAt = (SELECT registrationClosesAt FROM competitions_new WHERE competitions_new.id = competitions.id)
WHERE EXISTS (SELECT 1 FROM competitions_new WHERE competitions_new.id = competitions.id);
