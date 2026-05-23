CREATE TABLE `entry_relations` (
	`id` text PRIMARY KEY NOT NULL,
	`source_entry_id` text NOT NULL,
	`field_id` text NOT NULL,
	`target_entry_id` text NOT NULL,
	`sort_order` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`source_entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`field_id`) REFERENCES `fields`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entry_relations_source_field_target_unique` ON `entry_relations` (`source_entry_id`,`field_id`,`target_entry_id`);