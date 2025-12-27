-- Remove deprecated limits: max_teams, max_file_storage_mb, max_video_storage_mb
-- First, delete team limit entitlements that reference these limits
DELETE FROM `team_limit_entitlement`
WHERE `limitId` IN (
  SELECT `id` FROM `limit`
  WHERE `key` IN ('max_teams', 'max_file_storage_mb', 'max_video_storage_mb')
);--> statement-breakpoint

-- Delete plan limits that reference these limits
DELETE FROM `plan_limit`
WHERE `limitId` IN (
  SELECT `id` FROM `limit`
  WHERE `key` IN ('max_teams', 'max_file_storage_mb', 'max_video_storage_mb')
);--> statement-breakpoint

-- Delete team usage records for these limits
DELETE FROM `team_usage`
WHERE `limitKey` IN ('max_teams', 'max_file_storage_mb', 'max_video_storage_mb');--> statement-breakpoint

-- Delete the limit definitions
DELETE FROM `limit`
WHERE `key` IN ('max_teams', 'max_file_storage_mb', 'max_video_storage_mb');--> statement-breakpoint

-- Update indexes
DROP INDEX `team_feature_entitlement_unique_active_idx`;--> statement-breakpoint
CREATE INDEX `team_feature_entitlement_unique_active_idx` ON `team_feature_entitlement` (`teamId`,`featureId`);--> statement-breakpoint
DROP INDEX `team_limit_entitlement_unique_active_idx`;--> statement-breakpoint
CREATE INDEX `team_limit_entitlement_unique_active_idx` ON `team_limit_entitlement` (`teamId`,`limitId`);