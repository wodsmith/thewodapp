CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text DEFAULT 'Untitled',
	`icon` text,
	`cover_image` text,
	`file_path` text NOT NULL,
	`parent_id` text,
	`parent_object_id` text,
	`sort_order` integer DEFAULT 0,
	`is_published` integer DEFAULT false,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`parent_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_object_id`) REFERENCES `objects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_file_path_unique` ON `documents` (`file_path`);--> statement-breakpoint
CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`object_id` text NOT NULL,
	`sort_order` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`object_id`) REFERENCES `objects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `entry_fields` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`field_id` text NOT NULL,
	`value` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`field_id`) REFERENCES `fields`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entry_fields_entry_field_unique` ON `entry_fields` (`entry_id`,`field_id`);--> statement-breakpoint
CREATE TABLE `fields` (
	`id` text PRIMARY KEY NOT NULL,
	`object_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`type` text NOT NULL,
	`required` integer DEFAULT false,
	`default_value` text,
	`related_object_id` text,
	`relationship_type` text,
	`enum_values` text,
	`enum_colors` text,
	`enum_multiple` integer DEFAULT false,
	`sort_order` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`object_id`) REFERENCES `objects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`related_object_id`) REFERENCES `objects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fields_object_name_unique` ON `fields` (`object_id`,`name`);--> statement-breakpoint
CREATE TABLE `objects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`icon` text,
	`default_view` text DEFAULT 'table',
	`parent_document_id` text,
	`sort_order` integer DEFAULT 0,
	`source_app` text,
	`immutable` integer DEFAULT false,
	`display_field` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `objects_name_unique` ON `objects` (`name`);--> statement-breakpoint
CREATE TABLE `statuses` (
	`id` text PRIMARY KEY NOT NULL,
	`object_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#94a3b8',
	`sort_order` integer DEFAULT 0,
	`is_default` integer DEFAULT false,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`object_id`) REFERENCES `objects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `statuses_object_name_unique` ON `statuses` (`object_id`,`name`);