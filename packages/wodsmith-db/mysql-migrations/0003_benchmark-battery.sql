CREATE TABLE `benchmark_batteries` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`owner_team_id` varchar(255),
	`owner_key` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`categories` text NOT NULL,
	`rating_bands` text NOT NULL,
	`max_tier` int NOT NULL DEFAULT 10,
	`score_max` int NOT NULL DEFAULT 100,
	`video_policy` varchar(20) NOT NULL DEFAULT 'never',
	`is_open_join` boolean NOT NULL DEFAULT false,
	`variant_scaling_group_id` varchar(255),
	`competition_id` varchar(255),
	`status` varchar(20) NOT NULL DEFAULT 'draft',
	CONSTRAINT `benchmark_batteries_id` PRIMARY KEY(`id`),
	CONSTRAINT `benchmark_batteries_owner_key_unique` UNIQUE(`owner_key`),
	CONSTRAINT `benchmark_batteries_competition_unique` UNIQUE(`competition_id`)
);
--> statement-breakpoint
CREATE TABLE `benchmark_tests` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`battery_id` varchar(255) NOT NULL,
	`category_key` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`position` int NOT NULL,
	`scheme` varchar(255) NOT NULL,
	`score_type` varchar(255) NOT NULL,
	`input_unit` varchar(64) NOT NULL,
	`included_in_scoring` boolean NOT NULL DEFAULT true,
	`time_cap_ms` int,
	`score_model` varchar(20) NOT NULL DEFAULT 'standard',
	`hybrid_flip_tier` int,
	`hybrid_scale` text,
	CONSTRAINT `benchmark_tests_id` PRIMARY KEY(`id`),
	CONSTRAINT `benchmark_tests_battery_position_unique` UNIQUE(`battery_id`,`position`)
);
--> statement-breakpoint
CREATE TABLE `benchmark_tier_thresholds` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`test_id` varchar(255) NOT NULL,
	`variant` varchar(64) NOT NULL,
	`tier` int NOT NULL,
	`threshold_value` int NOT NULL,
	`raw_value` varchar(255) NOT NULL,
	CONSTRAINT `benchmark_tier_thresholds_id` PRIMARY KEY(`id`),
	CONSTRAINT `benchmark_thresholds_test_variant_tier_unique` UNIQUE(`test_id`,`variant`,`tier`)
);
--> statement-breakpoint
ALTER TABLE `track_workouts` ADD `benchmark_test_id` varchar(255);--> statement-breakpoint
ALTER TABLE `track_workouts` ADD `benchmark_category` varchar(64);--> statement-breakpoint
ALTER TABLE `scores` ADD `benchmark_variant` varchar(64);--> statement-breakpoint
CREATE INDEX `benchmark_batteries_owner_team_idx` ON `benchmark_batteries` (`owner_team_id`);--> statement-breakpoint
CREATE INDEX `benchmark_batteries_status_idx` ON `benchmark_batteries` (`status`);--> statement-breakpoint
CREATE INDEX `benchmark_tests_battery_idx` ON `benchmark_tests` (`battery_id`);--> statement-breakpoint
CREATE INDEX `benchmark_tests_category_idx` ON `benchmark_tests` (`battery_id`,`category_key`);--> statement-breakpoint
CREATE INDEX `benchmark_thresholds_test_variant_idx` ON `benchmark_tier_thresholds` (`test_id`,`variant`);--> statement-breakpoint
CREATE INDEX `track_workout_benchmark_test_idx` ON `track_workouts` (`benchmark_test_id`);--> statement-breakpoint
CREATE INDEX `track_workout_benchmark_category_idx` ON `track_workouts` (`benchmark_category`);--> statement-breakpoint
CREATE INDEX `idx_scores_benchmark_variant` ON `scores` (`competition_event_id`,`benchmark_variant`);
