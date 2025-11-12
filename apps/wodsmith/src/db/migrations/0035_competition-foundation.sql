CREATE TABLE `competition_event_groups` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`organizingTeamId` text NOT NULL,
	`slug` text(255) NOT NULL,
	`name` text(255) NOT NULL,
	`description` text(2000),
	`metadata` text(5000),
	FOREIGN KEY (`organizingTeamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `comp_event_group_org_team_idx` ON `competition_event_groups` (`organizingTeamId`);--> statement-breakpoint
CREATE INDEX `comp_event_group_slug_idx` ON `competition_event_groups` (`slug`);--> statement-breakpoint
CREATE INDEX `comp_event_group_unique_idx` ON `competition_event_groups` (`organizingTeamId`,`slug`);--> statement-breakpoint
CREATE TABLE `competition_events` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`organizingTeamId` text NOT NULL,
	`competitionTeamId` text NOT NULL,
	`eventGroupId` text,
	`slug` text(255) NOT NULL,
	`name` text(255) NOT NULL,
	`description` text(5000),
	`startDate` integer NOT NULL,
	`endDate` integer NOT NULL,
	`registrationOpensAt` integer,
	`registrationClosesAt` integer,
	`registrationFee` integer,
	`externalRegistrationUrl` text(600),
	`settings` text(10000),
	FOREIGN KEY (`organizingTeamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`competitionTeamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`eventGroupId`) REFERENCES `competition_event_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competition_events_slug_unique` ON `competition_events` (`slug`);--> statement-breakpoint
CREATE INDEX `comp_event_slug_idx` ON `competition_events` (`slug`);--> statement-breakpoint
CREATE INDEX `comp_event_org_team_idx` ON `competition_events` (`organizingTeamId`);--> statement-breakpoint
CREATE INDEX `comp_event_comp_team_idx` ON `competition_events` (`competitionTeamId`);--> statement-breakpoint
CREATE INDEX `comp_event_group_idx` ON `competition_events` (`eventGroupId`);--> statement-breakpoint
CREATE INDEX `comp_event_dates_idx` ON `competition_events` (`startDate`,`endDate`);--> statement-breakpoint
CREATE TABLE `competition_leaderboards` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`eventId` text NOT NULL,
	`workoutId` text,
	`divisionId` text,
	`userId` text NOT NULL,
	`rank` integer,
	`score` text(255),
	`tiebreak` text(255),
	`points` integer,
	`lastUpdated` integer NOT NULL,
	FOREIGN KEY (`eventId`) REFERENCES `competition_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workoutId`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`divisionId`) REFERENCES `scaling_levels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `comp_leaderboard_event_idx` ON `competition_leaderboards` (`eventId`);--> statement-breakpoint
CREATE INDEX `comp_leaderboard_workout_idx` ON `competition_leaderboards` (`workoutId`);--> statement-breakpoint
CREATE INDEX `comp_leaderboard_division_idx` ON `competition_leaderboards` (`divisionId`);--> statement-breakpoint
CREATE INDEX `comp_leaderboard_user_idx` ON `competition_leaderboards` (`userId`);--> statement-breakpoint
CREATE INDEX `comp_leaderboard_rank_idx` ON `competition_leaderboards` (`rank`);--> statement-breakpoint
CREATE INDEX `comp_leaderboard_event_div_rank_idx` ON `competition_leaderboards` (`eventId`,`divisionId`,`rank`);--> statement-breakpoint
CREATE TABLE `competition_registrations` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`eventId` text NOT NULL,
	`userId` text NOT NULL,
	`teamMemberId` text,
	`divisionId` text,
	`registrationData` text(10000),
	`status` text DEFAULT 'pending' NOT NULL,
	`paymentStatus` text DEFAULT 'unpaid' NOT NULL,
	`paymentIntentId` text(255),
	`registeredAt` integer NOT NULL,
	FOREIGN KEY (`eventId`) REFERENCES `competition_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`teamMemberId`) REFERENCES `team_membership`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`divisionId`) REFERENCES `scaling_levels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `comp_reg_event_idx` ON `competition_registrations` (`eventId`);--> statement-breakpoint
CREATE INDEX `comp_reg_user_idx` ON `competition_registrations` (`userId`);--> statement-breakpoint
CREATE INDEX `comp_reg_division_idx` ON `competition_registrations` (`divisionId`);--> statement-breakpoint
CREATE INDEX `comp_reg_status_idx` ON `competition_registrations` (`status`);--> statement-breakpoint
CREATE INDEX `comp_reg_unique_idx` ON `competition_registrations` (`eventId`,`userId`);--> statement-breakpoint
ALTER TABLE `team` ADD `type` text DEFAULT 'gym' NOT NULL;--> statement-breakpoint
ALTER TABLE `team` ADD `canHostCompetitions` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `team` ADD `parentOrganizationId` text REFERENCES team(id);--> statement-breakpoint
ALTER TABLE `team` ADD `competitionMetadata` text(10000);--> statement-breakpoint
-- Backfill type field based on isPersonalTeam flag
UPDATE `team` SET `type` = 'personal' WHERE `isPersonalTeam` = 1;--> statement-breakpoint
UPDATE `team` SET `type` = 'gym' WHERE `isPersonalTeam` = 0;--> statement-breakpoint
CREATE INDEX `team_type_idx` ON `team` (`type`);--> statement-breakpoint
CREATE INDEX `team_parent_org_idx` ON `team` (`parentOrganizationId`);--> statement-breakpoint
ALTER TABLE `user` ADD `gender` text;--> statement-breakpoint
ALTER TABLE `user` ADD `dateOfBirth` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `athleteProfile` text(5000);