CREATE TABLE `personal_training_results` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(64) NOT NULL,
	`personal_session_id` varchar(64) NOT NULL,
	`item_id` varchar(64) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`block` json,
	`score_value` bigint,
	`display_score` varchar(100) NOT NULL,
	`notes` text NOT NULL,
	`unit` varchar(2) NOT NULL,
	`completed` boolean NOT NULL,
	`legacy_score_id` varchar(255),
	CONSTRAINT `personal_training_results_id` PRIMARY KEY(`id`),
	CONSTRAINT `personal_training_result_item_uq` UNIQUE(`personal_session_id`,`item_id`),
	CONSTRAINT `personal_training_result_legacy_uq` UNIQUE(`legacy_score_id`)
);
--> statement-breakpoint
CREATE TABLE `personal_training_sessions` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(64) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`training_date` varchar(10) NOT NULL,
	`revision` int NOT NULL DEFAULT 1,
	`items` json NOT NULL,
	CONSTRAINT `personal_training_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `personal_training_day_uq` UNIQUE(`user_id`,`team_id`,`training_date`)
);
--> statement-breakpoint
CREATE TABLE `training_preferences` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(64) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`default_track_id` varchar(255) NOT NULL,
	CONSTRAINT `training_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `training_preference_user_team_uq` UNIQUE(`user_id`,`team_id`)
);
--> statement-breakpoint
CREATE INDEX `personal_training_result_user_idx` ON `personal_training_results` (`user_id`,`updated_at`);
