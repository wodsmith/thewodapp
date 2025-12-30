-- Waivers table for competition liability waivers
CREATE TABLE `waivers` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`competitionId` text NOT NULL,
	`title` text(255) NOT NULL,
	`content` text(50000) NOT NULL,
	`required` integer DEFAULT true NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`competitionId`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `waivers_competition_idx` ON `waivers` (`competitionId`);
--> statement-breakpoint
CREATE INDEX `waivers_position_idx` ON `waivers` (`competitionId`,`position`);
--> statement-breakpoint

-- Waiver signatures table for tracking who signed what
CREATE TABLE `waiver_signatures` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`waiverId` text NOT NULL,
	`userId` text NOT NULL,
	`registrationId` text,
	`signedAt` integer NOT NULL,
	`ipAddress` text(45),
	FOREIGN KEY (`waiverId`) REFERENCES `waivers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`registrationId`) REFERENCES `competition_registrations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `waiver_signatures_waiver_idx` ON `waiver_signatures` (`waiverId`);
--> statement-breakpoint
CREATE INDEX `waiver_signatures_user_idx` ON `waiver_signatures` (`userId`);
--> statement-breakpoint
CREATE INDEX `waiver_signatures_registration_idx` ON `waiver_signatures` (`registrationId`);
--> statement-breakpoint
CREATE INDEX `waiver_signatures_waiver_user_idx` ON `waiver_signatures` (`waiverId`,`userId`);
