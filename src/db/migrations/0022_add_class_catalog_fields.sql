CREATE TABLE `class_catalog_to_skills` (
	`class_catalog_id` text NOT NULL,
	`skill_id` text NOT NULL,
	PRIMARY KEY(`class_catalog_id`, `skill_id`),
	FOREIGN KEY (`class_catalog_id`) REFERENCES `class_catalog`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `class_catalog` ADD `duration_minutes` integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE `class_catalog` ADD `max_participants` integer DEFAULT 20 NOT NULL;