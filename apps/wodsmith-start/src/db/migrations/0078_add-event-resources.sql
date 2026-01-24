-- Migration: Add event resources table
-- Allows organizers to attach various resources to competition events

CREATE TABLE `event_resources` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`eventId` text NOT NULL,
	`title` text(255) NOT NULL,
	`description` text(5000),
	`url` text(2048),
	`sortOrder` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`eventId`) REFERENCES `track_workout`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `event_resources_event_idx` ON `event_resources` (`eventId`);
--> statement-breakpoint
CREATE INDEX `event_resources_event_order_idx` ON `event_resources` (`eventId`,`sortOrder`);
