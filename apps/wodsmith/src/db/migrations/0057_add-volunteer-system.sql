CREATE TABLE IF NOT EXISTS `competition_heat_volunteers` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`heatId` text NOT NULL,
	`membershipId` text NOT NULL,
	`laneNumber` integer,
	`position` text(50),
	`instructions` text(500),
	FOREIGN KEY (`heatId`) REFERENCES `competition_heats`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`membershipId`) REFERENCES `team_membership`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `competition_heat_volunteers_heat_idx` ON `competition_heat_volunteers` (`heatId`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `competition_heat_volunteers_membership_idx` ON `competition_heat_volunteers` (`membershipId`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `competition_heat_volunteers_unique_idx` ON `competition_heat_volunteers` (`heatId`,`membershipId`);--> statement-breakpoint
ALTER TABLE `team_membership` ADD `metadata` text(5000);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_scores_competition_user_unique` ON `scores` (`competition_event_id`,`user_id`);--> statement-breakpoint
ALTER TABLE `scores` DROP COLUMN `secondary_scheme`;--> statement-breakpoint
ALTER TABLE `workouts` DROP COLUMN `secondary_scheme`;