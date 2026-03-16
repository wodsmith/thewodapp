CREATE TABLE `product_coupon_redemptions` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`coupon_id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`purchase_id` varchar(255),
	`competition_id` varchar(255),
	`amount_off_cents` int NOT NULL,
	`stripe_coupon_id` varchar(255),
	`redeemed_at` datetime NOT NULL,
	CONSTRAINT `product_coupon_redemptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_coupon_redemptions_purchase_idx` UNIQUE(`purchase_id`)
);
--> statement-breakpoint
CREATE TABLE `product_coupons` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`code` varchar(100) NOT NULL,
	`type` varchar(50) NOT NULL DEFAULT 'competition',
	`product_id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`created_by` varchar(255) NOT NULL,
	`amount_off_cents` int NOT NULL,
	`max_redemptions` int,
	`current_redemptions` int NOT NULL DEFAULT 0,
	`expires_at` datetime,
	`is_active` tinyint NOT NULL DEFAULT 1,
	CONSTRAINT `product_coupons_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_coupons_code_idx` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `series_division_mappings` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`group_id` varchar(255) NOT NULL,
	`competition_id` varchar(255) NOT NULL,
	`competition_division_id` varchar(255) NOT NULL,
	`series_division_id` varchar(255) NOT NULL,
	CONSTRAINT `series_division_mappings_id` PRIMARY KEY(`id`),
	CONSTRAINT `sdm_group_comp_div_idx` UNIQUE(`group_id`,`competition_id`,`competition_division_id`)
);
--> statement-breakpoint
CREATE TABLE `series_template_divisions` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`group_id` varchar(255) NOT NULL,
	`division_id` varchar(255) NOT NULL,
	`fee_cents` int NOT NULL DEFAULT 0,
	`description` text,
	`max_spots` int,
	CONSTRAINT `series_template_divisions_id` PRIMARY KEY(`id`),
	CONSTRAINT `std_group_division_idx` UNIQUE(`group_id`,`division_id`)
);
--> statement-breakpoint
CREATE TABLE `score_verification_logs` (
	`id` varchar(255) NOT NULL,
	`score_id` varchar(255) NOT NULL,
	`competition_id` varchar(255),
	`track_workout_id` varchar(255),
	`athlete_user_id` varchar(255) NOT NULL,
	`action` varchar(20) NOT NULL,
	`original_score_value` int,
	`original_status` varchar(50),
	`original_secondary_value` int,
	`original_tiebreak_value` int,
	`new_score_value` int,
	`new_status` varchar(50),
	`new_secondary_value` int,
	`new_tiebreak_value` int,
	`penalty_type` varchar(20),
	`penalty_percentage` int,
	`no_rep_count` int,
	`performed_by_user_id` varchar(255) NOT NULL,
	`performed_at` datetime NOT NULL,
	CONSTRAINT `score_verification_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `review_notes` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`video_submission_id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`type` enum('general','no-rep') NOT NULL DEFAULT 'general',
	`content` text NOT NULL,
	`timestamp_seconds` int,
	`movement_id` varchar(255),
	CONSTRAINT `review_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `video_votes` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`video_submission_id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`vote_type` varchar(20) NOT NULL,
	`reason` varchar(50),
	`reason_detail` text,
	`voted_at` datetime NOT NULL,
	CONSTRAINT `video_votes_id` PRIMARY KEY(`id`),
	CONSTRAINT `video_votes_user_submission_idx` UNIQUE(`user_id`,`video_submission_id`)
);
--> statement-breakpoint
ALTER TABLE `track_workouts` MODIFY COLUMN `track_order` decimal(6,2) NOT NULL;--> statement-breakpoint
ALTER TABLE `competitions` ADD `max_total_registrations` int unsigned;--> statement-breakpoint
ALTER TABLE `track_workouts` ADD `parent_event_id` varchar(255);--> statement-breakpoint
ALTER TABLE `scores` ADD `verification_status` varchar(20);--> statement-breakpoint
ALTER TABLE `scores` ADD `verified_at` datetime;--> statement-breakpoint
ALTER TABLE `scores` ADD `verified_by_user_id` varchar(255);--> statement-breakpoint
ALTER TABLE `scores` ADD `penalty_type` varchar(20);--> statement-breakpoint
ALTER TABLE `scores` ADD `penalty_percentage` int;--> statement-breakpoint
ALTER TABLE `scores` ADD `no_rep_count` int;--> statement-breakpoint
ALTER TABLE `video_submissions` ADD `review_status` varchar(50) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `video_submissions` ADD `status_updated_at` datetime;--> statement-breakpoint
ALTER TABLE `video_submissions` ADD `reviewer_notes` text;--> statement-breakpoint
ALTER TABLE `video_submissions` ADD `reviewed_at` datetime;--> statement-breakpoint
ALTER TABLE `video_submissions` ADD `reviewed_by` varchar(255);--> statement-breakpoint
CREATE INDEX `product_coupon_redemptions_coupon_idx` ON `product_coupon_redemptions` (`coupon_id`);--> statement-breakpoint
CREATE INDEX `product_coupon_redemptions_user_idx` ON `product_coupon_redemptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `product_coupons_team_product_idx` ON `product_coupons` (`team_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `product_coupons_product_active_idx` ON `product_coupons` (`product_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `sdm_group_idx` ON `series_division_mappings` (`group_id`);--> statement-breakpoint
CREATE INDEX `sdm_competition_idx` ON `series_division_mappings` (`competition_id`);--> statement-breakpoint
CREATE INDEX `std_group_idx` ON `series_template_divisions` (`group_id`);--> statement-breakpoint
CREATE INDEX `idx_svlog_score` ON `score_verification_logs` (`score_id`);--> statement-breakpoint
CREATE INDEX `idx_svlog_performer` ON `score_verification_logs` (`performed_by_user_id`,`performed_at`);--> statement-breakpoint
CREATE INDEX `review_notes_submission_idx` ON `review_notes` (`video_submission_id`);--> statement-breakpoint
CREATE INDEX `review_notes_user_idx` ON `review_notes` (`user_id`);--> statement-breakpoint
CREATE INDEX `review_notes_team_idx` ON `review_notes` (`team_id`);--> statement-breakpoint
CREATE INDEX `video_votes_submission_idx` ON `video_votes` (`video_submission_id`);--> statement-breakpoint
CREATE INDEX `video_votes_user_idx` ON `video_votes` (`user_id`);--> statement-breakpoint
CREATE INDEX `track_workout_parent_idx` ON `track_workouts` (`parent_event_id`);