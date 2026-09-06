CREATE TABLE `external_workout_import_items` (
	`id` varchar(64) NOT NULL,
	`import_id` varchar(64) NOT NULL,
	`component_index` int NOT NULL,
	`workout_id` varchar(255) NOT NULL,
	`track_workout_id` varchar(255) NOT NULL,
	CONSTRAINT `external_workout_import_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `external_import_component_uq` UNIQUE(`import_id`,`component_index`),
	CONSTRAINT `external_import_track_workout_uq` UNIQUE(`track_workout_id`)
);
--> statement-breakpoint
CREATE TABLE `external_workout_imports` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(64) NOT NULL,
	`provider` varchar(32) NOT NULL,
	`track_id` varchar(255) NOT NULL,
	`source_date` varchar(10) NOT NULL,
	`source_url` varchar(255) NOT NULL,
	`source_id` varchar(64),
	`source_modified` varchar(64),
	`source_hash` varchar(64),
	`source_markdown` text,
	`normalized` json,
	`parser_version` varchar(32),
	`model` varchar(128),
	`workflow_id` varchar(128) NOT NULL,
	`status` varchar(32) NOT NULL,
	`kind` varchar(16),
	`error` text,
	`published_at` datetime,
	CONSTRAINT `external_workout_imports_id` PRIMARY KEY(`id`),
	CONSTRAINT `external_import_source_uq` UNIQUE(`provider`,`track_id`,`source_date`)
);
--> statement-breakpoint
CREATE INDEX `external_import_status_idx` ON `external_workout_imports` (`status`,`source_date`);
