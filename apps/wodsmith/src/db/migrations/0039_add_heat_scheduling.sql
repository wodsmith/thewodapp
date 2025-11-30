-- Create competition_floors table for venue floor/area management
CREATE TABLE `competition_floors` (
	`id` text PRIMARY KEY NOT NULL,
	`competitionId` text NOT NULL,
	`name` text(255) NOT NULL,
	`capacity` integer DEFAULT 10 NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`competitionId`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `competition_floors_competition_idx` ON `competition_floors` (`competitionId`);--> statement-breakpoint
CREATE INDEX `competition_floors_position_idx` ON `competition_floors` (`position`);--> statement-breakpoint

-- Create competition_heats table for heat scheduling
CREATE TABLE `competition_heats` (
	`id` text PRIMARY KEY NOT NULL,
	`competitionId` text NOT NULL,
	`trackWorkoutId` text NOT NULL,
	`floorId` text NOT NULL,
	`heatNumber` integer NOT NULL,
	`startTime` integer NOT NULL,
	`targetDivisionId` text,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`competitionId`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trackWorkoutId`) REFERENCES `track_workout`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`floorId`) REFERENCES `competition_floors`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`targetDivisionId`) REFERENCES `scaling_level`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
CREATE INDEX `competition_heats_competition_idx` ON `competition_heats` (`competitionId`);--> statement-breakpoint
CREATE INDEX `competition_heats_workout_idx` ON `competition_heats` (`trackWorkoutId`);--> statement-breakpoint
CREATE INDEX `competition_heats_floor_idx` ON `competition_heats` (`floorId`);--> statement-breakpoint
CREATE INDEX `competition_heats_time_idx` ON `competition_heats` (`startTime`);--> statement-breakpoint

-- Create heat_assignments table for athlete/team assignments to heats
CREATE TABLE `heat_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`heatId` text NOT NULL,
	`registrationId` text NOT NULL,
	`laneNumber` integer,
	`checkInAt` integer,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`heatId`) REFERENCES `competition_heats`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`registrationId`) REFERENCES `competition_registration`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `heat_assignments_heat_idx` ON `heat_assignments` (`heatId`);--> statement-breakpoint
CREATE INDEX `heat_assignments_registration_idx` ON `heat_assignments` (`registrationId`);--> statement-breakpoint
CREATE UNIQUE INDEX `heat_assignments_unique_idx` ON `heat_assignments` (`heatId`,`registrationId`);
