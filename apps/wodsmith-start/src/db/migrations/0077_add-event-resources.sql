-- Migration: Add event resources table
-- Allows organizers to attach various resources to competition events

CREATE TABLE `event_resources` (
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`update_counter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`title` text(255) NOT NULL,
	`description` text(5000),
	`url` text(2048),
	`sort_order` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `track_workout`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `event_resources_event_idx` ON `event_resources` (`event_id`);
--> statement-breakpoint
CREATE INDEX `event_resources_event_order_idx` ON `event_resources` (`event_id`,`sort_order`);
