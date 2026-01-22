
CREATE TABLE `competition_registration_answers` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`questionId` text NOT NULL,
	`registrationId` text NOT NULL,
	`userId` text NOT NULL,
	`answer` text(5000) NOT NULL,
	FOREIGN KEY (`questionId`) REFERENCES `competition_registration_questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`registrationId`) REFERENCES `competition_registrations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `comp_reg_answers_question_idx` ON `competition_registration_answers` (`questionId`);--> statement-breakpoint
CREATE INDEX `comp_reg_answers_registration_idx` ON `competition_registration_answers` (`registrationId`);--> statement-breakpoint
CREATE INDEX `comp_reg_answers_user_idx` ON `competition_registration_answers` (`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `comp_reg_answers_unique_idx` ON `competition_registration_answers` (`questionId`,`registrationId`,`userId`);--> statement-breakpoint
CREATE TABLE `competition_registration_questions` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`competitionId` text NOT NULL,
	`type` text(20) NOT NULL,
	`label` text(500) NOT NULL,
	`helpText` text(1000),
	`options` text(5000),
	`required` integer DEFAULT true NOT NULL,
	`forTeammates` integer DEFAULT false NOT NULL,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`competitionId`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `comp_reg_questions_competition_idx` ON `competition_registration_questions` (`competitionId`);--> statement-breakpoint
CREATE INDEX `comp_reg_questions_sort_idx` ON `competition_registration_questions` (`competitionId`,`sortOrder`);--> statement-breakpoint
CREATE TABLE `judge_assignment_versions` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`trackWorkoutId` text NOT NULL,
	`version` integer NOT NULL,
	`publishedAt` integer NOT NULL,
	`publishedBy` text,
	`notes` text(1000),
	`isActive` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`trackWorkoutId`) REFERENCES `track_workout`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`publishedBy`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `judge_assignment_versions_workout_idx` ON `judge_assignment_versions` (`trackWorkoutId`);--> statement-breakpoint
CREATE INDEX `judge_assignment_versions_active_idx` ON `judge_assignment_versions` (`trackWorkoutId`,`isActive`);--> statement-breakpoint
CREATE UNIQUE INDEX `judge_assignment_versions_unique_idx` ON `judge_assignment_versions` (`trackWorkoutId`,`version`);--> statement-breakpoint
CREATE TABLE `judge_heat_assignments` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`heatId` text NOT NULL,
	`membershipId` text NOT NULL,
	`rotationId` text,
	`versionId` text,
	`laneNumber` integer,
	`position` text(50),
	`instructions` text(500),
	`isManualOverride` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`heatId`) REFERENCES `competition_heats`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`membershipId`) REFERENCES `team_membership`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`rotationId`) REFERENCES `competition_judge_rotations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`versionId`) REFERENCES `judge_assignment_versions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `judge_heat_assignments_heat_idx` ON `judge_heat_assignments` (`heatId`);--> statement-breakpoint
CREATE INDEX `judge_heat_assignments_membership_idx` ON `judge_heat_assignments` (`membershipId`);--> statement-breakpoint
CREATE INDEX `judge_heat_assignments_version_idx` ON `judge_heat_assignments` (`versionId`);--> statement-breakpoint
CREATE UNIQUE INDEX `judge_heat_assignments_unique_idx` ON `judge_heat_assignments` (`heatId`,`membershipId`);--> statement-breakpoint
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
CREATE INDEX `waiver_signatures_waiver_idx` ON `waiver_signatures` (`waiverId`);--> statement-breakpoint
CREATE INDEX `waiver_signatures_user_idx` ON `waiver_signatures` (`userId`);--> statement-breakpoint
CREATE INDEX `waiver_signatures_registration_idx` ON `waiver_signatures` (`registrationId`);--> statement-breakpoint
CREATE INDEX `waiver_signatures_waiver_user_idx` ON `waiver_signatures` (`waiverId`,`userId`);--> statement-breakpoint
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
CREATE INDEX `waivers_competition_idx` ON `waivers` (`competitionId`);--> statement-breakpoint
CREATE INDEX `waivers_position_idx` ON `waivers` (`competitionId`,`position`);--> statement-breakpoint
DROP TABLE `competition_heat_volunteers`;--> statement-breakpoint
DROP INDEX `team_feature_entitlement_unique_active_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `team_feature_entitlement_team_feature_unique` ON `team_feature_entitlement` (`teamId`,`featureId`);--> statement-breakpoint
DROP INDEX `team_limit_entitlement_unique_active_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `team_limit_entitlement_team_limit_unique` ON `team_limit_entitlement` (`teamId`,`limitId`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_competitions` (
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
	`startDate` text NOT NULL,
	`endDate` text NOT NULL,
	`registrationOpensAt` text,
	`registrationClosesAt` text,
	`timezone` text(50) DEFAULT 'America/Denver',
	`settings` text(10000),
	`defaultRegistrationFeeCents` integer DEFAULT 0,
	`platformFeePercentage` integer,
	`platformFeeFixed` integer,
	`passStripeFeesToCustomer` integer DEFAULT false,
	`passPlatformFeesToCustomer` integer DEFAULT true,
	`visibility` text(10) DEFAULT 'public' NOT NULL,
	`status` text(15) DEFAULT 'draft' NOT NULL,
	`competitionType` text(15) DEFAULT 'in-person' NOT NULL,
	`profileImageUrl` text(600),
	`bannerImageUrl` text(600),
	`defaultHeatsPerRotation` integer DEFAULT 4,
	`defaultLaneShiftPattern` text(20) DEFAULT 'shift_right',
	`defaultMaxSpotsPerDivision` integer,
	FOREIGN KEY (`organizingTeamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`competitionTeamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`groupId`) REFERENCES `competition_groups`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_competitions`("createdAt", "updatedAt", "updateCounter", "id", "organizingTeamId", "competitionTeamId", "groupId", "slug", "name", "description", "startDate", "endDate", "registrationOpensAt", "registrationClosesAt", "timezone", "settings", "defaultRegistrationFeeCents", "platformFeePercentage", "platformFeeFixed", "passStripeFeesToCustomer", "passPlatformFeesToCustomer", "visibility", "status", "competitionType", "profileImageUrl", "bannerImageUrl", "defaultHeatsPerRotation", "defaultLaneShiftPattern", "defaultMaxSpotsPerDivision") SELECT "createdAt", "updatedAt", "updateCounter", "id", "organizingTeamId", "competitionTeamId", "groupId", "slug", "name", "description", "startDate", "endDate", "registrationOpensAt", "registrationClosesAt", "timezone", "settings", "defaultRegistrationFeeCents", "platformFeePercentage", "platformFeeFixed", "passStripeFeesToCustomer", "passPlatformFeesToCustomer", "visibility", "status", "competitionType", "profileImageUrl", "bannerImageUrl", "defaultHeatsPerRotation", "defaultLaneShiftPattern", "defaultMaxSpotsPerDivision" FROM `competitions`;--> statement-breakpoint
DROP TABLE `competitions`;--> statement-breakpoint
ALTER TABLE `__new_competitions` RENAME TO `competitions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `competitions_slug_unique` ON `competitions` (`slug`);--> statement-breakpoint
CREATE INDEX `competitions_organizing_team_idx` ON `competitions` (`organizingTeamId`);--> statement-breakpoint
CREATE INDEX `competitions_competition_team_idx` ON `competitions` (`competitionTeamId`);--> statement-breakpoint
CREATE INDEX `competitions_group_idx` ON `competitions` (`groupId`);--> statement-breakpoint
CREATE INDEX `competitions_start_date_idx` ON `competitions` (`startDate`);--> statement-breakpoint
CREATE TABLE `__new_team_invitation` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`teamId` text NOT NULL,
	`email` text(255) NOT NULL,
	`roleId` text NOT NULL,
	`isSystemRole` integer DEFAULT 1 NOT NULL,
	`token` text(255) NOT NULL,
	`invitedBy` text,
	`expiresAt` integer NOT NULL,
	`acceptedAt` integer,
	`acceptedBy` text,
	`metadata` text,
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invitedBy`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`acceptedBy`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_team_invitation`("createdAt", "updatedAt", "updateCounter", "id", "teamId", "email", "roleId", "isSystemRole", "token", "invitedBy", "expiresAt", "acceptedAt", "acceptedBy", "metadata") SELECT "createdAt", "updatedAt", "updateCounter", "id", "teamId", "email", "roleId", "isSystemRole", "token", "invitedBy", "expiresAt", "acceptedAt", "acceptedBy", "metadata" FROM `team_invitation`;--> statement-breakpoint
DROP TABLE `team_invitation`;--> statement-breakpoint
ALTER TABLE `__new_team_invitation` RENAME TO `team_invitation`;--> statement-breakpoint
CREATE UNIQUE INDEX `team_invitation_token_unique` ON `team_invitation` (`token`);--> statement-breakpoint
CREATE INDEX `team_invitation_team_id_idx` ON `team_invitation` (`teamId`);--> statement-breakpoint
CREATE INDEX `team_invitation_email_idx` ON `team_invitation` (`email`);--> statement-breakpoint
CREATE INDEX `team_invitation_token_idx` ON `team_invitation` (`token`);--> statement-breakpoint
ALTER TABLE `competition_divisions` ADD `maxSpots` integer;--> statement-breakpoint
ALTER TABLE `competition_heats` ADD `schedulePublishedAt` integer;--> statement-breakpoint
ALTER TABLE `track_workout` ADD `minHeatBuffer` integer DEFAULT 2;--> statement-breakpoint
ALTER TABLE `team` ADD `organizerFeePercentage` integer;--> statement-breakpoint
ALTER TABLE `team` ADD `organizerFeeFixed` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `team_entitlement_override_team_type_key_unique` ON `team_entitlement_override` (`teamId`,`type`,`key`);