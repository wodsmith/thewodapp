-- Create judge_assignment_versions table
CREATE TABLE `judge_assignment_versions` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`trackWorkoutId` text NOT NULL,
	`version` integer NOT NULL,
	`publishedAt` integer NOT NULL,
	`publishedBy` text,
	`notes` text(1000),
	`isActive` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`trackWorkoutId`) REFERENCES `track_workout`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`publishedBy`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `judge_assignment_versions_workout_idx` ON `judge_assignment_versions` (`trackWorkoutId`);--> statement-breakpoint
CREATE INDEX `judge_assignment_versions_active_idx` ON `judge_assignment_versions` (`trackWorkoutId`,`isActive`);--> statement-breakpoint
CREATE UNIQUE INDEX `judge_assignment_versions_unique_idx` ON `judge_assignment_versions` (`trackWorkoutId`,`version`);--> statement-breakpoint

-- Rename competition_heat_volunteers to judge_heat_assignments
ALTER TABLE `competition_heat_volunteers` RENAME TO `judge_heat_assignments`;--> statement-breakpoint

-- Add new columns to judge_heat_assignments
ALTER TABLE `judge_heat_assignments` ADD `versionId` text REFERENCES `judge_assignment_versions`(`id`) ON UPDATE no action ON DELETE set null;--> statement-breakpoint
ALTER TABLE `judge_heat_assignments` ADD `isManualOverride` integer DEFAULT 0 NOT NULL;--> statement-breakpoint

-- Drop old indexes
DROP INDEX IF EXISTS `competition_heat_volunteers_heat_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `competition_heat_volunteers_membership_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `competition_heat_volunteers_unique_idx`;--> statement-breakpoint

-- Create new indexes with updated names
CREATE INDEX `judge_heat_assignments_heat_idx` ON `judge_heat_assignments` (`heatId`);--> statement-breakpoint
CREATE INDEX `judge_heat_assignments_membership_idx` ON `judge_heat_assignments` (`membershipId`);--> statement-breakpoint
CREATE INDEX `judge_heat_assignments_version_idx` ON `judge_heat_assignments` (`versionId`);--> statement-breakpoint
CREATE UNIQUE INDEX `judge_heat_assignments_unique_idx` ON `judge_heat_assignments` (`heatId`,`membershipId`);
