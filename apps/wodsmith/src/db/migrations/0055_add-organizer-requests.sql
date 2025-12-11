CREATE TABLE `organizer_request` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`teamId` text NOT NULL,
	`userId` text NOT NULL,
	`reason` text(2000) NOT NULL,
	`status` text(20) DEFAULT 'pending' NOT NULL,
	`adminNotes` text(2000),
	`reviewedBy` text,
	`reviewedAt` integer,
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewedBy`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `organizer_request_team_idx` ON `organizer_request` (`teamId`);--> statement-breakpoint
CREATE INDEX `organizer_request_user_idx` ON `organizer_request` (`userId`);--> statement-breakpoint
CREATE INDEX `organizer_request_status_idx` ON `organizer_request` (`status`);