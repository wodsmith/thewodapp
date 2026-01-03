-- Migration: Add unique constraints for team entitlement tables
-- These are required for onConflictDoUpdate() to work properly in D1

-- Drop the old regular indexes (if they exist)
DROP INDEX IF EXISTS `team_feature_entitlement_unique_active_idx`;
DROP INDEX IF EXISTS `team_limit_entitlement_unique_active_idx`;

-- Create unique indexes for team_feature_entitlement (teamId, featureId)
CREATE UNIQUE INDEX `team_feature_entitlement_team_feature_unique` ON `team_feature_entitlement` (`teamId`,`featureId`);

-- Create unique indexes for team_limit_entitlement (teamId, limitId)
CREATE UNIQUE INDEX `team_limit_entitlement_team_limit_unique` ON `team_limit_entitlement` (`teamId`,`limitId`);

-- Create unique index for team_entitlement_override (teamId, type, key)
CREATE UNIQUE INDEX `team_entitlement_override_team_type_key_unique` ON `team_entitlement_override` (`teamId`,`type`,`key`);
