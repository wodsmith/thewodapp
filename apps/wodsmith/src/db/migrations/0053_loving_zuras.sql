CREATE TABLE `score_rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`score_id` text NOT NULL,
	`round_number` integer NOT NULL,
	`value` integer NOT NULL,
	`scheme_override` text,
	`status` text,
	`secondary_value` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`score_id`) REFERENCES `scores`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_score_rounds_score` ON `score_rounds` (`score_id`,`round_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_score_rounds_unique` ON `score_rounds` (`score_id`,`round_number`);--> statement-breakpoint
CREATE TABLE `scores` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`team_id` text NOT NULL,
	`workout_id` text NOT NULL,
	`competition_event_id` text,
	`scheduled_workout_instance_id` text,
	`scheme` text NOT NULL,
	`score_type` text DEFAULT 'max' NOT NULL,
	`score_value` integer,
	`tiebreak_scheme` text,
	`tiebreak_value` integer,
	`time_cap_ms` integer,
	`secondary_scheme` text,
	`secondary_value` integer,
	`status` text DEFAULT 'scored' NOT NULL,
	`status_order` integer DEFAULT 0 NOT NULL,
	`sort_key` text,
	`scaling_level_id` text,
	`as_rx` integer DEFAULT false NOT NULL,
	`notes` text,
	`recorded_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`scaling_level_id`) REFERENCES `scaling_levels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_scores_user` ON `scores` (`user_id`,`recorded_at`);--> statement-breakpoint
CREATE INDEX `idx_scores_workout` ON `scores` (`workout_id`,`team_id`,`status_order`,`sort_key`);--> statement-breakpoint
CREATE INDEX `idx_scores_competition` ON `scores` (`competition_event_id`,`status_order`,`sort_key`);--> statement-breakpoint
CREATE INDEX `idx_scores_scheduled` ON `scores` (`scheduled_workout_instance_id`);