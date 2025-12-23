CREATE TABLE `entitlement` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`entitlementTypeId` text NOT NULL,
	`userId` text NOT NULL,
	`teamId` text,
	`sourceType` text NOT NULL,
	`sourceId` text NOT NULL,
	`metadata` text,
	`expiresAt` integer,
	`deletedAt` integer,
	FOREIGN KEY (`entitlementTypeId`) REFERENCES `entitlement_type`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `entitlement_user_id_idx` ON `entitlement` (`userId`);--> statement-breakpoint
CREATE INDEX `entitlement_team_id_idx` ON `entitlement` (`teamId`);--> statement-breakpoint
CREATE INDEX `entitlement_type_idx` ON `entitlement` (`entitlementTypeId`);--> statement-breakpoint
CREATE INDEX `entitlement_source_idx` ON `entitlement` (`sourceType`,`sourceId`);--> statement-breakpoint
CREATE INDEX `entitlement_deleted_at_idx` ON `entitlement` (`deletedAt`);--> statement-breakpoint
CREATE TABLE `entitlement_type` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`name` text(100) NOT NULL,
	`description` text(500)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entitlement_type_name_unique` ON `entitlement_type` (`name`);--> statement-breakpoint
CREATE TABLE `plan` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`name` text(100) NOT NULL,
	`description` text(500),
	`price` integer NOT NULL,
	`interval` text,
	`isActive` integer DEFAULT 1 NOT NULL,
	`isPublic` integer DEFAULT 1 NOT NULL,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	`entitlements` text NOT NULL,
	`stripePriceId` text(255),
	`stripeProductId` text(255)
);
--> statement-breakpoint
CREATE TABLE `team_addon` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`teamId` text NOT NULL,
	`addonId` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`status` text NOT NULL,
	`expiresAt` integer,
	`stripeSubscriptionItemId` text(255),
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `team_addon_team_id_idx` ON `team_addon` (`teamId`);--> statement-breakpoint
CREATE INDEX `team_addon_status_idx` ON `team_addon` (`status`);--> statement-breakpoint
CREATE TABLE `team_entitlement_override` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`teamId` text NOT NULL,
	`type` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`reason` text(500),
	`expiresAt` integer,
	`createdBy` text,
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`createdBy`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `team_entitlement_override_team_id_idx` ON `team_entitlement_override` (`teamId`);--> statement-breakpoint
CREATE INDEX `team_entitlement_override_type_idx` ON `team_entitlement_override` (`type`);--> statement-breakpoint
CREATE TABLE `team_subscription` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`teamId` text NOT NULL,
	`planId` text NOT NULL,
	`status` text NOT NULL,
	`currentPeriodStart` integer NOT NULL,
	`currentPeriodEnd` integer NOT NULL,
	`cancelAtPeriodEnd` integer DEFAULT 0 NOT NULL,
	`trialStart` integer,
	`trialEnd` integer,
	`stripeSubscriptionId` text(255),
	`stripeCustomerId` text(255),
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`planId`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `team_subscription_team_id_idx` ON `team_subscription` (`teamId`);--> statement-breakpoint
CREATE INDEX `team_subscription_status_idx` ON `team_subscription` (`status`);--> statement-breakpoint
CREATE TABLE `team_usage` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`teamId` text NOT NULL,
	`limitKey` text NOT NULL,
	`currentValue` integer DEFAULT 0 NOT NULL,
	`periodStart` integer NOT NULL,
	`periodEnd` integer NOT NULL,
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `team_usage_team_id_idx` ON `team_usage` (`teamId`);--> statement-breakpoint
CREATE INDEX `team_usage_limit_key_idx` ON `team_usage` (`limitKey`);--> statement-breakpoint
CREATE INDEX `team_usage_unique_idx` ON `team_usage` (`teamId`,`limitKey`,`periodStart`);--> statement-breakpoint
ALTER TABLE `team` ADD `currentPlanId` text(100);