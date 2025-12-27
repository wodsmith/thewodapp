CREATE TABLE `feature` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`key` text(100) NOT NULL,
	`name` text(100) NOT NULL,
	`description` text(500),
	`category` text NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`isActive` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feature_key_unique` ON `feature` (`key`);--> statement-breakpoint
CREATE TABLE `limit` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`key` text(100) NOT NULL,
	`name` text(100) NOT NULL,
	`description` text(500),
	`unit` text(50) NOT NULL,
	`resetPeriod` text DEFAULT 'never' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`isActive` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `limit_key_unique` ON `limit` (`key`);