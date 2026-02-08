-- Add competition_events table for per-event settings (submission windows for online competitions)
CREATE TABLE `competition_events` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`competitionId` text NOT NULL,
	`trackWorkoutId` text NOT NULL,
	`submissionOpensAt` text,
	`submissionClosesAt` text,
	FOREIGN KEY (`competitionId`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `competition_events_competition_idx` ON `competition_events` (`competitionId`);
--> statement-breakpoint
CREATE INDEX `competition_events_workout_idx` ON `competition_events` (`trackWorkoutId`);
--> statement-breakpoint
CREATE UNIQUE INDEX `competition_events_comp_workout_idx` ON `competition_events` (`competitionId`, `trackWorkoutId`);
