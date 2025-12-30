-- Add waivers and waiver_signatures tables for competition waiver management

-- Drop existing tables if they exist (to fix column naming)
DROP TABLE IF EXISTS `waiver_signatures`;
DROP TABLE IF EXISTS `waivers`;

-- Waivers table: stores waiver documents for competitions
CREATE TABLE `waivers` (
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`competitionId` text NOT NULL,
	`title` text(255) NOT NULL,
	`content` text(50000) NOT NULL,
	`required` integer DEFAULT true NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`competitionId`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade
);

-- Waiver signatures table: tracks when athletes sign waivers
CREATE TABLE `waiver_signatures` (
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
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

-- Indexes for waivers table
CREATE INDEX `waivers_competition_idx` ON `waivers` (`competitionId`);
CREATE INDEX `waivers_position_idx` ON `waivers` (`competitionId`, `position`);

-- Indexes for waiver_signatures table
CREATE INDEX `waiver_signatures_waiver_idx` ON `waiver_signatures` (`waiverId`);
CREATE INDEX `waiver_signatures_user_idx` ON `waiver_signatures` (`userId`);
CREATE INDEX `waiver_signatures_registration_idx` ON `waiver_signatures` (`registrationId`);
CREATE INDEX `waiver_signatures_waiver_user_idx` ON `waiver_signatures` (`waiverId`, `userId`);
