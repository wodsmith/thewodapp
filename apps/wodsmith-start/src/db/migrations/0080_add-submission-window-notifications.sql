-- Add submission_window_notifications table for tracking sent notifications
CREATE TABLE `submission_window_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`competitionId` text NOT NULL,
	`competitionEventId` text NOT NULL,
	`registrationId` text NOT NULL,
	`userId` text NOT NULL,
	`type` text NOT NULL,
	`sentToEmail` text,
	FOREIGN KEY (`competitionId`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`competitionEventId`) REFERENCES `competition_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`registrationId`) REFERENCES `competition_registrations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `submission_window_notif_competition_idx` ON `submission_window_notifications` (`competitionId`);
--> statement-breakpoint
CREATE INDEX `submission_window_notif_event_idx` ON `submission_window_notifications` (`competitionEventId`);
--> statement-breakpoint
CREATE INDEX `submission_window_notif_user_idx` ON `submission_window_notifications` (`userId`);
--> statement-breakpoint
CREATE UNIQUE INDEX `submission_window_notif_unique_idx` ON `submission_window_notifications` (`competitionEventId`, `registrationId`, `type`);
