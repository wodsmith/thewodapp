-- Migration: Add unique constraints for team entitlement tables
-- These are required for onConflictDoUpdate() to work properly in D1

-- Drop the old regular indexes (if they exist)
DROP INDEX IF EXISTS `team_feature_entitlement_unique_active_idx`;
DROP INDEX IF EXISTS `team_limit_entitlement_unique_active_idx`;

-- Remove duplicates from team_feature_entitlement before creating unique index
-- Keep the most recently updated record for each (teamId, featureId) pair
DELETE FROM `team_feature_entitlement`
WHERE `id` NOT IN (
  SELECT `id` FROM (
    SELECT `id`, ROW_NUMBER() OVER (
      PARTITION BY `teamId`, `featureId`
      ORDER BY COALESCE(`updatedAt`, `createdAt`) DESC
    ) as rn
    FROM `team_feature_entitlement`
  ) WHERE rn = 1
);

-- Remove duplicates from team_limit_entitlement before creating unique index
-- Keep the most recently updated record for each (teamId, limitId) pair
DELETE FROM `team_limit_entitlement`
WHERE `id` NOT IN (
  SELECT `id` FROM (
    SELECT `id`, ROW_NUMBER() OVER (
      PARTITION BY `teamId`, `limitId`
      ORDER BY COALESCE(`updatedAt`, `createdAt`) DESC
    ) as rn
    FROM `team_limit_entitlement`
  ) WHERE rn = 1
);

-- Remove duplicates from team_entitlement_override before creating unique index
-- Keep the most recently updated record for each (teamId, type, key) tuple
DELETE FROM `team_entitlement_override`
WHERE `id` NOT IN (
  SELECT `id` FROM (
    SELECT `id`, ROW_NUMBER() OVER (
      PARTITION BY `teamId`, `type`, `key`
      ORDER BY COALESCE(`updatedAt`, `createdAt`) DESC
    ) as rn
    FROM `team_entitlement_override`
  ) WHERE rn = 1
);

-- Create unique indexes for team_feature_entitlement (teamId, featureId)
CREATE UNIQUE INDEX `team_feature_entitlement_team_feature_unique` ON `team_feature_entitlement` (`teamId`,`featureId`);

-- Create unique indexes for team_limit_entitlement (teamId, limitId)
CREATE UNIQUE INDEX `team_limit_entitlement_team_limit_unique` ON `team_limit_entitlement` (`teamId`,`limitId`);

-- Create unique index for team_entitlement_override (teamId, type, key)
CREATE UNIQUE INDEX `team_entitlement_override_team_type_key_unique` ON `team_entitlement_override` (`teamId`,`type`,`key`);
