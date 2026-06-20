CREATE TABLE `crew_department_leads` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`competition_id` varchar(255) NOT NULL,
	`membership_id` varchar(255),
	`invitation_id` varchar(255),
	`email` varchar(255),
	`name` varchar(255),
	`role_type` varchar(50),
	`venue_id` varchar(255),
	`starts_at` datetime,
	`ends_at` datetime,
	`scope` json,
	`status` varchar(20) NOT NULL DEFAULT 'invited',
	`assigned_by` varchar(255),
	`accepted_at` datetime,
	`revoked_at` datetime,
	`notes` text,
	`metadata` json,
	CONSTRAINT `crew_department_leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crew_import_mapping_presets` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`competition_id` varchar(255),
	`kind` varchar(30) NOT NULL,
	`source_platform` varchar(100) NOT NULL DEFAULT 'csv',
	`name` varchar(255),
	`header_fingerprint` varchar(255) NOT NULL,
	`headers` json NOT NULL,
	`column_mapping` json NOT NULL,
	`parser_version` varchar(100),
	`last_used_at` datetime,
	`metadata` json,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	CONSTRAINT `crew_import_mapping_presets_id` PRIMARY KEY(`id`),
	CONSTRAINT `crew_import_mapping_presets_lookup_unique_idx` UNIQUE(`team_id`,`source_platform`,`kind`,`header_fingerprint`)
);
--> statement-breakpoint
CREATE TABLE `crew_template_presets` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`competition_id` varchar(255),
	`kind` varchar(40) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`preset_data` json NOT NULL,
	`metadata` json,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`is_archived` boolean NOT NULL DEFAULT false,
	CONSTRAINT `crew_template_presets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `crew_department_leads_competition_idx` ON `crew_department_leads` (`competition_id`);--> statement-breakpoint
CREATE INDEX `crew_department_leads_team_idx` ON `crew_department_leads` (`team_id`);--> statement-breakpoint
CREATE INDEX `crew_department_leads_membership_idx` ON `crew_department_leads` (`membership_id`);--> statement-breakpoint
CREATE INDEX `crew_department_leads_invitation_idx` ON `crew_department_leads` (`invitation_id`);--> statement-breakpoint
CREATE INDEX `crew_department_leads_email_idx` ON `crew_department_leads` (`email`);--> statement-breakpoint
CREATE INDEX `crew_department_leads_role_idx` ON `crew_department_leads` (`role_type`);--> statement-breakpoint
CREATE INDEX `crew_department_leads_venue_idx` ON `crew_department_leads` (`venue_id`);--> statement-breakpoint
CREATE INDEX `crew_department_leads_status_idx` ON `crew_department_leads` (`status`);--> statement-breakpoint
CREATE INDEX `crew_department_leads_time_idx` ON `crew_department_leads` (`starts_at`,`ends_at`);--> statement-breakpoint
CREATE INDEX `crew_import_mapping_presets_team_kind_idx` ON `crew_import_mapping_presets` (`team_id`,`kind`);--> statement-breakpoint
CREATE INDEX `crew_import_mapping_presets_competition_idx` ON `crew_import_mapping_presets` (`competition_id`);--> statement-breakpoint
CREATE INDEX `crew_import_mapping_presets_last_used_idx` ON `crew_import_mapping_presets` (`last_used_at`);--> statement-breakpoint
CREATE INDEX `crew_template_presets_team_kind_idx` ON `crew_template_presets` (`team_id`,`kind`);--> statement-breakpoint
CREATE INDEX `crew_template_presets_competition_idx` ON `crew_template_presets` (`competition_id`);--> statement-breakpoint
CREATE INDEX `crew_template_presets_created_by_idx` ON `crew_template_presets` (`created_by`);--> statement-breakpoint
CREATE INDEX `crew_template_presets_archived_idx` ON `crew_template_presets` (`is_archived`);