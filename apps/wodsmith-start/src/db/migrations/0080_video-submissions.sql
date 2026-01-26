CREATE TABLE `video_submissions` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`registration_id` text NOT NULL,
	`track_workout_id` text NOT NULL,
	`user_id` text NOT NULL,
	`video_url` text(2000) NOT NULL,
	`notes` text(1000),
	`submitted_at` integer NOT NULL,
	FOREIGN KEY (`registration_id`) REFERENCES `competition_registrations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `video_submissions_reg_event_idx` ON `video_submissions` (`registration_id`,`track_workout_id`);
--> statement-breakpoint
CREATE INDEX `video_submissions_user_idx` ON `video_submissions` (`user_id`);
--> statement-breakpoint
CREATE INDEX `video_submissions_event_idx` ON `video_submissions` (`track_workout_id`);
--> statement-breakpoint
CREATE INDEX `video_submissions_registration_idx` ON `video_submissions` (`registration_id`);
