DROP INDEX `team_feature_entitlement_unique_idx`;--> statement-breakpoint
ALTER TABLE `team_feature_entitlement` ADD `isActive` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `team_feature_entitlement_unique_active_idx` ON `team_feature_entitlement` (`teamId`,`featureId`,`isActive`);--> statement-breakpoint
DROP INDEX `team_limit_entitlement_unique_idx`;--> statement-breakpoint
ALTER TABLE `team_limit_entitlement` ADD `isActive` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `team_limit_entitlement_unique_active_idx` ON `team_limit_entitlement` (`teamId`,`limitId`,`isActive`);