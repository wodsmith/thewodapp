-- Add competition_events table for per-event settings (submission windows for online competitions)
CREATE TABLE `competition_events` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`update_counter` integer DEFAULT 0,
	`competition_id` text NOT NULL,
	`track_workout_id` text NOT NULL,
	`submission_opens_at` text,
	`submission_closes_at` text,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `competition_events_competition_idx` ON `competition_events` (`competition_id`);
--> statement-breakpoint
CREATE INDEX `competition_events_workout_idx` ON `competition_events` (`track_workout_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `competition_events_comp_workout_idx` ON `competition_events` (`competition_id`, `track_workout_id`);
