-- Add event judging sheets table for competition event PDF uploads
CREATE TABLE `event_judging_sheets` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`competitionId` text NOT NULL,
	`trackWorkoutId` text NOT NULL,
	`title` text(255) NOT NULL,
	`r2Key` text(600) NOT NULL,
	`url` text(600) NOT NULL,
	`originalFilename` text(255) NOT NULL,
	`fileSize` integer NOT NULL,
	`mimeType` text(100) NOT NULL,
	`uploadedBy` text NOT NULL,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`competitionId`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trackWorkoutId`) REFERENCES `track_workout`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploadedBy`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `event_judging_sheets_competition_idx` ON `event_judging_sheets` (`competitionId`);
--> statement-breakpoint
CREATE INDEX `event_judging_sheets_event_idx` ON `event_judging_sheets` (`trackWorkoutId`);
--> statement-breakpoint
CREATE INDEX `event_judging_sheets_uploaded_by_idx` ON `event_judging_sheets` (`uploadedBy`);
--> statement-breakpoint
CREATE INDEX `event_judging_sheets_sort_idx` ON `event_judging_sheets` (`trackWorkoutId`, `sortOrder`);
