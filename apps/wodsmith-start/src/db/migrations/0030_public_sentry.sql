CREATE TABLE `plan_feature` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`planId` text NOT NULL,
	`featureId` text NOT NULL,
	FOREIGN KEY (`planId`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`featureId`) REFERENCES `feature`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `plan_feature_plan_id_idx` ON `plan_feature` (`planId`);--> statement-breakpoint
CREATE INDEX `plan_feature_feature_id_idx` ON `plan_feature` (`featureId`);--> statement-breakpoint
CREATE INDEX `plan_feature_unique_idx` ON `plan_feature` (`planId`,`featureId`);--> statement-breakpoint
CREATE TABLE `plan_limit` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`planId` text NOT NULL,
	`limitId` text NOT NULL,
	`value` integer NOT NULL,
	FOREIGN KEY (`planId`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`limitId`) REFERENCES `limit`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `plan_limit_plan_id_idx` ON `plan_limit` (`planId`);--> statement-breakpoint
CREATE INDEX `plan_limit_limit_id_idx` ON `plan_limit` (`limitId`);--> statement-breakpoint
CREATE INDEX `plan_limit_unique_idx` ON `plan_limit` (`planId`,`limitId`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_plan` (
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
	`entitlements` text,
	`stripePriceId` text(255),
	`stripeProductId` text(255)
);
--> statement-breakpoint
INSERT INTO `__new_plan`("createdAt", "updatedAt", "updateCounter", "id", "name", "description", "price", "interval", "isActive", "isPublic", "sortOrder", "entitlements", "stripePriceId", "stripeProductId") SELECT "createdAt", "updatedAt", "updateCounter", "id", "name", "description", "price", "interval", "isActive", "isPublic", "sortOrder", "entitlements", "stripePriceId", "stripeProductId" FROM `plan`;--> statement-breakpoint
DROP TABLE `plan`;--> statement-breakpoint
ALTER TABLE `__new_plan` RENAME TO `plan`;--> statement-breakpoint
PRAGMA foreign_keys=ON;