CREATE TABLE `training_cheers` (
	`result_id` varchar(64) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	CONSTRAINT `training_cheers_result_id_user_id_pk` PRIMARY KEY(`result_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `training_results` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(64) NOT NULL,
	`session_id` varchar(64) NOT NULL,
	`block_id` varchar(64) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`published_version` int NOT NULL,
	`block` json NOT NULL,
	`score_value` bigint,
	`display_score` varchar(100) NOT NULL,
	`scaling` varchar(10) NOT NULL,
	`modification` text NOT NULL,
	`notes` text NOT NULL,
	`audience` varchar(10) NOT NULL,
	`unit` varchar(2) NOT NULL,
	`completed` boolean NOT NULL,
	CONSTRAINT `training_results_id` PRIMARY KEY(`id`),
	CONSTRAINT `training_result_version_uq` UNIQUE(`session_id`,`block_id`,`user_id`,`published_version`)
);
--> statement-breakpoint
CREATE TABLE `training_sessions` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(64) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`track_id` varchar(255) NOT NULL,
	`training_date` varchar(10) NOT NULL,
	`timezone` varchar(100) NOT NULL,
	`revision` int NOT NULL DEFAULT 1,
	`published_version` int NOT NULL DEFAULT 0,
	`draft` json,
	`published` json,
	CONSTRAINT `training_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `training_session_occurrence_uq` UNIQUE(`team_id`,`track_id`,`training_date`)
);
--> statement-breakpoint
CREATE INDEX `training_result_user_idx` ON `training_results` (`user_id`,`updated_at`);
