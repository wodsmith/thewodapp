PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_schedule_template_classes` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`day_of_week` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`required_coaches` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `schedule_templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_schedule_template_classes`("createdAt", "updatedAt", "updateCounter", "id", "template_id", "day_of_week", "start_time", "end_time", "required_coaches") SELECT "createdAt", "updatedAt", "updateCounter", "id", "template_id", "day_of_week", "start_time", "end_time", "required_coaches" FROM `schedule_template_classes`;--> statement-breakpoint
DROP TABLE `schedule_template_classes`;--> statement-breakpoint
ALTER TABLE `__new_schedule_template_classes` RENAME TO `schedule_template_classes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `schedule_templates` ADD `class_catalog_id` text NOT NULL REFERENCES class_catalog(id);--> statement-breakpoint
ALTER TABLE `schedule_templates` ADD `location_id` text NOT NULL REFERENCES locations(id);