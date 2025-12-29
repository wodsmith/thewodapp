CREATE TABLE `programming_track` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`name` text(255) NOT NULL,
	`description` text(1000),
	`type` text NOT NULL,
	`ownerTeamId` text,
	`isPublic` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`ownerTeamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `programming_track_type_idx` ON `programming_track` (`type`);--> statement-breakpoint
CREATE INDEX `programming_track_owner_idx` ON `programming_track` (`ownerTeamId`);--> statement-breakpoint
CREATE TABLE `team_programming_track` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`teamId` text NOT NULL,
	`trackId` text NOT NULL,
	`isActive` integer DEFAULT 1 NOT NULL,
	`addedAt` integer NOT NULL,
	PRIMARY KEY(`teamId`, `trackId`),
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`trackId`) REFERENCES `programming_track`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `team_programming_track_active_idx` ON `team_programming_track` (`isActive`);--> statement-breakpoint
CREATE TABLE `track_workout` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`trackId` text NOT NULL,
	`workoutId` text NOT NULL,
	`dayNumber` integer NOT NULL,
	`weekNumber` integer,
	`notes` text(1000),
	FOREIGN KEY (`trackId`) REFERENCES `programming_track`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workoutId`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `track_workout_track_idx` ON `track_workout` (`trackId`);--> statement-breakpoint
CREATE INDEX `track_workout_day_idx` ON `track_workout` (`dayNumber`);--> statement-breakpoint
CREATE INDEX `track_workout_unique_idx` ON `track_workout` (`trackId`,`workoutId`,`dayNumber`);--> statement-breakpoint
ALTER TABLE `results` ADD `programming_track_id` text REFERENCES programming_track(id);--> statement-breakpoint
ALTER TABLE `team` ADD `defaultTrackId` text REFERENCES programming_track(id);--> statement-breakpoint
ALTER TABLE `workouts` ADD `source_track_id` text REFERENCES programming_track(id);