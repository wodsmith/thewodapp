CREATE TABLE `competition_groups` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`organizingTeamId` text NOT NULL,
	`slug` text(255) NOT NULL,
	`name` text(255) NOT NULL,
	`description` text(1000),
	FOREIGN KEY (`organizingTeamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competition_groups_org_slug_idx` ON `competition_groups` (`organizingTeamId`,`slug`);--> statement-breakpoint
CREATE TABLE `competition_registrations` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`eventId` text NOT NULL,
	`userId` text NOT NULL,
	`teamMemberId` text NOT NULL,
	`divisionId` text,
	`registeredAt` integer NOT NULL,
	FOREIGN KEY (`eventId`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`teamMemberId`) REFERENCES `team_membership`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`divisionId`) REFERENCES `scaling_levels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competition_registrations_event_user_idx` ON `competition_registrations` (`eventId`,`userId`);--> statement-breakpoint
CREATE INDEX `competition_registrations_user_idx` ON `competition_registrations` (`userId`);--> statement-breakpoint
CREATE INDEX `competition_registrations_event_idx` ON `competition_registrations` (`eventId`);--> statement-breakpoint
CREATE INDEX `competition_registrations_division_idx` ON `competition_registrations` (`divisionId`);--> statement-breakpoint
CREATE TABLE `competitions` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`organizingTeamId` text NOT NULL,
	`competitionTeamId` text NOT NULL,
	`groupId` text,
	`slug` text(255) NOT NULL,
	`name` text(255) NOT NULL,
	`description` text(2000),
	`startDate` integer NOT NULL,
	`endDate` integer NOT NULL,
	`registrationOpensAt` integer,
	`registrationClosesAt` integer,
	`settings` text(10000),
	FOREIGN KEY (`organizingTeamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`competitionTeamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`groupId`) REFERENCES `competition_groups`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competitions_slug_unique` ON `competitions` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `competitions_slug_idx` ON `competitions` (`slug`);--> statement-breakpoint
CREATE INDEX `competitions_organizing_team_idx` ON `competitions` (`organizingTeamId`);--> statement-breakpoint
CREATE INDEX `competitions_competition_team_idx` ON `competitions` (`competitionTeamId`);--> statement-breakpoint
CREATE INDEX `competitions_group_idx` ON `competitions` (`groupId`);--> statement-breakpoint
CREATE INDEX `competitions_start_date_idx` ON `competitions` (`startDate`);--> statement-breakpoint
ALTER TABLE `team` ADD `type` text(50) DEFAULT 'gym' NOT NULL;--> statement-breakpoint
ALTER TABLE `team` ADD `parentOrganizationId` text REFERENCES team(id) ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE `team` ADD `competitionMetadata` text(10000);--> statement-breakpoint
CREATE INDEX `team_type_idx` ON `team` (`type`);--> statement-breakpoint
CREATE INDEX `team_parent_org_idx` ON `team` (`parentOrganizationId`);--> statement-breakpoint
ALTER TABLE `user` ADD `gender` text;--> statement-breakpoint
ALTER TABLE `user` ADD `dateOfBirth` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `athleteProfile` text(10000);--> statement-breakpoint
CREATE INDEX `user_gender_idx` ON `user` (`gender`);--> statement-breakpoint
CREATE INDEX `user_dob_idx` ON `user` (`dateOfBirth`);--> statement-breakpoint
-- Backfill existing teams with proper type values
-- Personal teams should have type='personal', all others remain 'gym' (default)
UPDATE `team` SET `type` = 'personal' WHERE `isPersonalTeam` = 1;