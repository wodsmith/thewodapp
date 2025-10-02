PRAGMA defer_foreign_keys = ON;--> statement-breakpoint
CREATE TABLE `__new_workouts` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`scope` text DEFAULT 'private' NOT NULL,
	`scheme` text NOT NULL,
	`reps_per_round` integer,
	`rounds_to_score` integer DEFAULT 1,
	`team_id` text,
	`sugar_id` text,
	`tiebreak_scheme` text,
	`secondary_scheme` text,
	`source_track_id` text,
	`source_workout_id` text,
	FOREIGN KEY (`team_id`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_track_id`) REFERENCES `programming_track`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_workouts`("createdAt", "updatedAt", "updateCounter", "id", "name", "description", "scope", "scheme", "reps_per_round", "rounds_to_score", "team_id", "sugar_id", "tiebreak_scheme", "secondary_scheme", "source_track_id", "source_workout_id") SELECT "createdAt", "updatedAt", "updateCounter", "id", "name", "description", "scope", "scheme", "reps_per_round", "rounds_to_score", "team_id", "sugar_id", "tiebreak_scheme", "secondary_scheme", "source_track_id", "source_workout_id" FROM `workouts`;--> statement-breakpoint
DROP TABLE `workouts`;--> statement-breakpoint
ALTER TABLE `__new_workouts` RENAME TO `workouts`;--> statement-breakpoint
PRAGMA defer_foreign_keys = OFF;