CREATE TABLE `scaling_groups` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`title` text(255) NOT NULL,
	`description` text(1000),
	`teamId` text,
	`isDefault` integer DEFAULT 0 NOT NULL,
	`isSystem` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scaling_groups_team_idx` ON `scaling_groups` (`teamId`);--> statement-breakpoint
CREATE INDEX `scaling_groups_default_idx` ON `scaling_groups` (`isDefault`);--> statement-breakpoint
CREATE INDEX `scaling_groups_system_idx` ON `scaling_groups` (`isSystem`);--> statement-breakpoint
CREATE TABLE `scaling_levels` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`scalingGroupId` text NOT NULL,
	`label` text(100) NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`scalingGroupId`) REFERENCES `scaling_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scaling_levels_group_idx` ON `scaling_levels` (`scalingGroupId`);--> statement-breakpoint
CREATE INDEX `scaling_levels_position_idx` ON `scaling_levels` (`scalingGroupId`,`position`);--> statement-breakpoint
CREATE TABLE `workout_scaling_descriptions` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`workoutId` text NOT NULL,
	`scalingLevelId` text NOT NULL,
	`description` text(2000),
	FOREIGN KEY (`workoutId`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scalingLevelId`) REFERENCES `scaling_levels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workout_scaling_desc_workout_idx` ON `workout_scaling_descriptions` (`workoutId`);--> statement-breakpoint
CREATE INDEX `workout_scaling_desc_lookup_idx` ON `workout_scaling_descriptions` (`workoutId`,`scalingLevelId`);--> statement-breakpoint
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
ALTER TABLE `programming_track` ADD `scalingGroupId` text;--> statement-breakpoint
ALTER TABLE `team` ADD `defaultScalingGroupId` text;--> statement-breakpoint
ALTER TABLE `results` ADD `scaling_level_id` text;--> statement-breakpoint
ALTER TABLE `results` ADD `as_rx` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `results_scaling_level_idx` ON `results` (`scaling_level_id`);--> statement-breakpoint
CREATE INDEX `results_workout_scaling_idx` ON `results` (`workout_id`,`scaling_level_id`);--> statement-breakpoint
CREATE INDEX `results_leaderboard_idx` ON `results` (`workout_id`,`scaling_level_id`,`wod_score`);--> statement-breakpoint
CREATE INDEX `results_user_idx` ON `results` (`user_id`);--> statement-breakpoint
CREATE INDEX `results_date_idx` ON `results` (`date`);--> statement-breakpoint
CREATE INDEX `results_workout_idx` ON `results` (`workout_id`);--> statement-breakpoint
ALTER TABLE `workouts` ADD `scaling_group_id` text;