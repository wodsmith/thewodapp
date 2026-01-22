-- Add event judging sheets table for competition event PDF uploads
CREATE TABLE `event_judging_sheets` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`update_counter` integer DEFAULT 0,
	`competition_id` text NOT NULL,
	`track_workout_id` text NOT NULL,
	`title` text(255) NOT NULL,
	`r2_key` text(600) NOT NULL,
	`url` text(600) NOT NULL,
	`original_filename` text(255) NOT NULL,
	`file_size` integer NOT NULL,
	`mime_type` text(100) NOT NULL,
	`uploaded_by` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`track_workout_id`) REFERENCES `track_workout`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `event_judging_sheets_competition_idx` ON `event_judging_sheets` (`competition_id`);
--> statement-breakpoint
CREATE INDEX `event_judging_sheets_event_idx` ON `event_judging_sheets` (`track_workout_id`);
--> statement-breakpoint
CREATE INDEX `event_judging_sheets_uploaded_by_idx` ON `event_judging_sheets` (`uploaded_by`);
--> statement-breakpoint
CREATE INDEX `event_judging_sheets_sort_idx` ON `event_judging_sheets` (`track_workout_id`, `sort_order`);
