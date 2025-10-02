PRAGMA defer_foreign_keys = ON;--> statement-breakpoint
CREATE TABLE `__new_results` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` integer NOT NULL,
	`workout_id` text,
	`type` text NOT NULL,
	`notes` text,
	`programming_track_id` text,
	`scheduled_workout_instance_id` text,
	`scale` text,
	`wod_score` text,
	`set_count` integer,
	`distance` integer,
	`time` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_results`("createdAt", "updatedAt", "updateCounter", "id", "user_id", "date", "workout_id", "type", "notes", "programming_track_id", "scheduled_workout_instance_id", "scale", "wod_score", "set_count", "distance", "time") SELECT "createdAt", "updatedAt", "updateCounter", "id", "user_id", "date", "workout_id", "type", "notes", "programming_track_id", "scheduled_workout_instance_id", "scale", "wod_score", "set_count", "distance", "time" FROM `results`;--> statement-breakpoint
DROP TABLE `results`;--> statement-breakpoint
ALTER TABLE `__new_results` RENAME TO `results`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_sets` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`result_id` text NOT NULL,
	`set_number` integer NOT NULL,
	`notes` text,
	`reps` integer,
	`weight` integer,
	`status` text,
	`distance` integer,
	`time` integer,
	`score` integer,
	FOREIGN KEY (`result_id`) REFERENCES `results`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_sets`("createdAt", "updatedAt", "updateCounter", "id", "result_id", "set_number", "notes", "reps", "weight", "status", "distance", "time", "score") SELECT "createdAt", "updatedAt", "updateCounter", "id", "result_id", "set_number", "notes", "reps", "weight", "status", "distance", "time", "score" FROM `sets`;--> statement-breakpoint
DROP TABLE `sets`;--> statement-breakpoint
ALTER TABLE `__new_sets` RENAME TO `sets`;--> statement-breakpoint
CREATE TABLE `__new_workout_movements` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`workout_id` text,
	`movement_id` text,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`movement_id`) REFERENCES `movements`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_workout_movements`("createdAt", "updatedAt", "updateCounter", "id", "workout_id", "movement_id") SELECT "createdAt", "updatedAt", "updateCounter", "id", "workout_id", "movement_id" FROM `workout_movements`;--> statement-breakpoint
DROP TABLE `workout_movements`;--> statement-breakpoint
ALTER TABLE `__new_workout_movements` RENAME TO `workout_movements`;--> statement-breakpoint
CREATE TABLE `__new_workout_tags` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`workout_id` text NOT NULL,
	`tag_id` text NOT NULL,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `spicy_tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_workout_tags`("createdAt", "updatedAt", "updateCounter", "id", "workout_id", "tag_id") SELECT "createdAt", "updatedAt", "updateCounter", "id", "workout_id", "tag_id" FROM `workout_tags`;--> statement-breakpoint
DROP TABLE `workout_tags`;--> statement-breakpoint
ALTER TABLE `__new_workout_tags` RENAME TO `workout_tags`;--> statement-breakpoint
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
ALTER TABLE `__new_workouts` RENAME TO `workouts`;

PRAGMA defer_foreign_keys = OFF;