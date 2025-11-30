-- Add competition-specific fields to results table
ALTER TABLE `results` ADD `competition_event_id` text;--> statement-breakpoint
ALTER TABLE `results` ADD `competition_registration_id` text;--> statement-breakpoint
ALTER TABLE `results` ADD `score_status` text;--> statement-breakpoint
ALTER TABLE `results` ADD `tie_break_score` text;--> statement-breakpoint
ALTER TABLE `results` ADD `entered_by` text REFERENCES users(id) ON DELETE SET NULL;--> statement-breakpoint
-- Add indexes for competition queries
CREATE INDEX `results_competition_event_idx` ON `results` (`competition_event_id`, `scaling_level_id`);--> statement-breakpoint
CREATE INDEX `results_competition_unique_idx` ON `results` (`competition_event_id`, `user_id`);
