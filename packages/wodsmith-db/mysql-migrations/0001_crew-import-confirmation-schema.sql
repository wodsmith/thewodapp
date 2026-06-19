CREATE TABLE `crew_assignment_confirmations` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`competition_id` varchar(255) NOT NULL,
	`assignment_type` varchar(30) NOT NULL,
	`assignment_id` varchar(255) NOT NULL,
	`membership_id` varchar(255),
	`invitation_id` varchar(255),
	`competition_invite_id` varchar(255),
	`email` varchar(255),
	`token_hash` varchar(255) NOT NULL,
	`status` varchar(30) NOT NULL DEFAULT 'pending',
	`sent_at` datetime,
	`responded_at` datetime,
	`expires_at` datetime,
	`response_note` text,
	`last_reminder_at` datetime,
	`reminder_count` int NOT NULL DEFAULT 0,
	CONSTRAINT `crew_assignment_confirmations_id` PRIMARY KEY(`id`),
	CONSTRAINT `crew_assignment_confirmations_token_hash_unique_idx` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `crew_import_rows` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`import_id` varchar(255) NOT NULL,
	`row_number` int NOT NULL,
	`raw_row` json,
	`normalized_row` json,
	`target_type` varchar(30),
	`target_id` varchar(255),
	`action` varchar(20),
	`warnings` json,
	`errors` json,
	CONSTRAINT `crew_import_rows_id` PRIMARY KEY(`id`),
	CONSTRAINT `crew_import_rows_import_row_unique_idx` UNIQUE(`import_id`,`row_number`)
);
--> statement-breakpoint
CREATE TABLE `crew_imports` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`competition_id` varchar(255) NOT NULL,
	`kind` varchar(30) NOT NULL DEFAULT 'unknown',
	`source_platform` varchar(100),
	`uploaded_by` varchar(255),
	`original_filename` varchar(500),
	`file_key` varchar(1024),
	`mime_type` varchar(255),
	`status` varchar(20) NOT NULL DEFAULT 'uploaded',
	`parser_version` varchar(100),
	`headers` json,
	`column_mapping` json,
	`summary` json,
	`warning_count` int NOT NULL DEFAULT 0,
	`error_count` int NOT NULL DEFAULT 0,
	`row_count` int NOT NULL DEFAULT 0,
	`created_count` int NOT NULL DEFAULT 0,
	`updated_count` int NOT NULL DEFAULT 0,
	`skipped_count` int NOT NULL DEFAULT 0,
	`applied_at` datetime,
	`applied_by` varchar(255),
	CONSTRAINT `crew_imports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `crew_assignment_confirmations_competition_idx` ON `crew_assignment_confirmations` (`competition_id`);--> statement-breakpoint
CREATE INDEX `crew_assignment_confirmations_assignment_idx` ON `crew_assignment_confirmations` (`assignment_type`,`assignment_id`);--> statement-breakpoint
CREATE INDEX `crew_assignment_confirmations_status_idx` ON `crew_assignment_confirmations` (`status`);--> statement-breakpoint
CREATE INDEX `crew_assignment_confirmations_membership_idx` ON `crew_assignment_confirmations` (`membership_id`);--> statement-breakpoint
CREATE INDEX `crew_assignment_confirmations_invitation_idx` ON `crew_assignment_confirmations` (`invitation_id`);--> statement-breakpoint
CREATE INDEX `crew_assignment_confirmations_competition_invite_idx` ON `crew_assignment_confirmations` (`competition_invite_id`);--> statement-breakpoint
CREATE INDEX `crew_assignment_confirmations_email_idx` ON `crew_assignment_confirmations` (`email`);--> statement-breakpoint
CREATE INDEX `crew_assignment_confirmations_expires_idx` ON `crew_assignment_confirmations` (`expires_at`);--> statement-breakpoint
CREATE INDEX `crew_import_rows_import_idx` ON `crew_import_rows` (`import_id`);--> statement-breakpoint
CREATE INDEX `crew_import_rows_target_idx` ON `crew_import_rows` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `crew_import_rows_action_idx` ON `crew_import_rows` (`action`);--> statement-breakpoint
CREATE INDEX `crew_imports_competition_idx` ON `crew_imports` (`competition_id`);--> statement-breakpoint
CREATE INDEX `crew_imports_status_idx` ON `crew_imports` (`status`);--> statement-breakpoint
CREATE INDEX `crew_imports_kind_idx` ON `crew_imports` (`kind`);--> statement-breakpoint
CREATE INDEX `crew_imports_uploaded_by_idx` ON `crew_imports` (`uploaded_by`);--> statement-breakpoint
CREATE INDEX `crew_imports_applied_by_idx` ON `crew_imports` (`applied_by`);