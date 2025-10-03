CREATE TABLE `scheduled_workout_instance` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`teamId` text NOT NULL,
	`trackWorkoutId` text NOT NULL,
	`scheduledDate` integer NOT NULL,
	`teamSpecificNotes` text(1000),
	`scalingGuidanceForDay` text(1000),
	`classTimes` text(500),
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`trackWorkoutId`) REFERENCES `track_workout`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `scheduled_workout_instance_team_idx` ON `scheduled_workout_instance` (`teamId`);--> statement-breakpoint
CREATE INDEX `scheduled_workout_instance_date_idx` ON `scheduled_workout_instance` (`scheduledDate`);--> statement-breakpoint
ALTER TABLE `results` ADD `scheduled_workout_instance_id` text REFERENCES scheduled_workout_instance(id);