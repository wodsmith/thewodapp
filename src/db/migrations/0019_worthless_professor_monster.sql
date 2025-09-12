PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_scheduled_workout_instance` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`teamId` text NOT NULL,
	`trackWorkoutId` text,
	`workoutId` text,
	`scheduledDate` integer NOT NULL,
	`teamSpecificNotes` text(1000),
	`scalingGuidanceForDay` text(1000),
	`classTimes` text(500),
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`trackWorkoutId`) REFERENCES `track_workout`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workoutId`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_scheduled_workout_instance`("createdAt", "updatedAt", "updateCounter", "id", "teamId", "trackWorkoutId", "workoutId", "scheduledDate", "teamSpecificNotes", "scalingGuidanceForDay", "classTimes") SELECT "createdAt", "updatedAt", "updateCounter", "id", "teamId", "trackWorkoutId", "workoutId", "scheduledDate", "teamSpecificNotes", "scalingGuidanceForDay", "classTimes" FROM `scheduled_workout_instance`;--> statement-breakpoint
DROP TABLE `scheduled_workout_instance`;--> statement-breakpoint
ALTER TABLE `__new_scheduled_workout_instance` RENAME TO `scheduled_workout_instance`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `scheduled_workout_instance_team_idx` ON `scheduled_workout_instance` (`teamId`);--> statement-breakpoint
CREATE INDEX `scheduled_workout_instance_date_idx` ON `scheduled_workout_instance` (`scheduledDate`);--> statement-breakpoint
CREATE INDEX `scheduled_workout_instance_workout_idx` ON `scheduled_workout_instance` (`workoutId`);



	