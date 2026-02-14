CREATE TABLE `volunteer_shifts` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`competitionId` text NOT NULL,
	`name` text(200) NOT NULL,
	`roleType` text(50) NOT NULL,
	`startTime` integer NOT NULL,
	`endTime` integer NOT NULL,
	`location` text(200),
	`capacity` integer DEFAULT 1 NOT NULL,
	`notes` text(1000),
	FOREIGN KEY (`competitionId`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `volunteer_shifts_competition_idx` ON `volunteer_shifts` (`competitionId`);--> statement-breakpoint
CREATE INDEX `volunteer_shifts_start_time_idx` ON `volunteer_shifts` (`startTime`);
