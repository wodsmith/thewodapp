CREATE TABLE `movements` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `results` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` integer NOT NULL,
	`workout_id` text,
	`type` text NOT NULL,
	`notes` text,
	`scale` text,
	`wod_score` text,
	`set_count` integer,
	`distance` integer,
	`time` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sets` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`result_id` text NOT NULL,
	`set_number` integer NOT NULL,
	`reps` integer,
	`weight` integer,
	`status` text,
	`distance` integer,
	`time` integer,
	`score` integer,
	FOREIGN KEY (`result_id`) REFERENCES `results`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `spicy_tags` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `spicy_tags_name_unique` ON `spicy_tags` (`name`);--> statement-breakpoint
CREATE TABLE `workout_movements` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`workout_id` text,
	`movement_id` text,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`movement_id`) REFERENCES `movements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workout_tags` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`workout_id` text NOT NULL,
	`tag_id` text NOT NULL,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `spicy_tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workouts` (
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
	`user_id` text,
	`sugar_id` text,
	`tiebreak_scheme` text,
	`secondary_scheme` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
