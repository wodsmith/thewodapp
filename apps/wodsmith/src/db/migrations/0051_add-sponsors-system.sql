CREATE TABLE `sponsor_groups` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`competitionId` text NOT NULL,
	`name` text(100) NOT NULL,
	`displayOrder` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`competitionId`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sponsor_groups_competition_idx` ON `sponsor_groups` (`competitionId`);--> statement-breakpoint
CREATE INDEX `sponsor_groups_order_idx` ON `sponsor_groups` (`competitionId`,`displayOrder`);--> statement-breakpoint
CREATE TABLE `sponsors` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`competitionId` text,
	`userId` text,
	`groupId` text,
	`name` text(255) NOT NULL,
	`logoUrl` text(600),
	`website` text(600),
	`displayOrder` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`competitionId`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`groupId`) REFERENCES `sponsor_groups`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `sponsors_competition_idx` ON `sponsors` (`competitionId`);--> statement-breakpoint
CREATE INDEX `sponsors_user_idx` ON `sponsors` (`userId`);--> statement-breakpoint
CREATE INDEX `sponsors_group_idx` ON `sponsors` (`groupId`);--> statement-breakpoint
CREATE INDEX `sponsors_competition_order_idx` ON `sponsors` (`competitionId`,`groupId`,`displayOrder`);--> statement-breakpoint
CREATE INDEX `sponsors_user_order_idx` ON `sponsors` (`userId`,`displayOrder`);--> statement-breakpoint
ALTER TABLE `track_workout` ADD `sponsorId` text REFERENCES sponsors(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `track_workout_sponsor_idx` ON `track_workout` (`sponsorId`);