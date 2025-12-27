CREATE TABLE `team_feature_entitlement` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`teamId` text NOT NULL,
	`featureId` text NOT NULL,
	`source` text DEFAULT 'plan' NOT NULL,
	`sourcePlanId` text,
	`expiresAt` integer,
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`featureId`) REFERENCES `feature`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sourcePlanId`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `team_feature_entitlement_team_id_idx` ON `team_feature_entitlement` (`teamId`);--> statement-breakpoint
CREATE INDEX `team_feature_entitlement_feature_id_idx` ON `team_feature_entitlement` (`featureId`);--> statement-breakpoint
CREATE INDEX `team_feature_entitlement_unique_idx` ON `team_feature_entitlement` (`teamId`,`featureId`);--> statement-breakpoint
CREATE TABLE `team_limit_entitlement` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`teamId` text NOT NULL,
	`limitId` text NOT NULL,
	`value` integer NOT NULL,
	`source` text DEFAULT 'plan' NOT NULL,
	`sourcePlanId` text,
	`expiresAt` integer,
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`limitId`) REFERENCES `limit`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sourcePlanId`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `team_limit_entitlement_team_id_idx` ON `team_limit_entitlement` (`teamId`);--> statement-breakpoint
CREATE INDEX `team_limit_entitlement_limit_id_idx` ON `team_limit_entitlement` (`limitId`);--> statement-breakpoint
CREATE INDEX `team_limit_entitlement_unique_idx` ON `team_limit_entitlement` (`teamId`,`limitId`);