-- Competition Venues Table
CREATE TABLE `competition_venues` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`competitionId` text NOT NULL,
	`name` text(100) NOT NULL,
	`laneCount` integer DEFAULT 10 NOT NULL,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`competitionId`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `competition_venues_competition_idx` ON `competition_venues` (`competitionId`);
--> statement-breakpoint
CREATE INDEX `competition_venues_sort_idx` ON `competition_venues` (`competitionId`,`sortOrder`);
--> statement-breakpoint
-- Competition Heats Table
CREATE TABLE `competition_heats` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`competitionId` text NOT NULL,
	`trackWorkoutId` text NOT NULL,
	`venueId` text,
	`heatNumber` integer NOT NULL,
	`scheduledTime` integer,
	`divisionId` text,
	`notes` text(500),
	FOREIGN KEY (`competitionId`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`venueId`) REFERENCES `competition_venues`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`divisionId`) REFERENCES `scaling_levels`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `competition_heats_competition_idx` ON `competition_heats` (`competitionId`);
--> statement-breakpoint
CREATE INDEX `competition_heats_workout_idx` ON `competition_heats` (`trackWorkoutId`);
--> statement-breakpoint
CREATE INDEX `competition_heats_time_idx` ON `competition_heats` (`scheduledTime`);
--> statement-breakpoint
CREATE UNIQUE INDEX `competition_heats_workout_number_idx` ON `competition_heats` (`trackWorkoutId`,`heatNumber`);
--> statement-breakpoint
-- Competition Heat Assignments Table
CREATE TABLE `competition_heat_assignments` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`heatId` text NOT NULL,
	`registrationId` text NOT NULL,
	`laneNumber` integer NOT NULL,
	FOREIGN KEY (`heatId`) REFERENCES `competition_heats`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`registrationId`) REFERENCES `competition_registrations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `competition_heat_assignments_heat_idx` ON `competition_heat_assignments` (`heatId`);
--> statement-breakpoint
CREATE UNIQUE INDEX `competition_heat_assignments_reg_idx` ON `competition_heat_assignments` (`heatId`,`registrationId`);
--> statement-breakpoint
CREATE UNIQUE INDEX `competition_heat_assignments_lane_idx` ON `competition_heat_assignments` (`heatId`,`laneNumber`);
