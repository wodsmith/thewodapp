CREATE TABLE `affiliates` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`name` text(255) NOT NULL,
	`location` text(255),
	`verificationStatus` text DEFAULT 'unverified' NOT NULL,
	`ownerTeamId` text,
	FOREIGN KEY (`ownerTeamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `affiliates_name_unique` ON `affiliates` (`name`);--> statement-breakpoint
CREATE INDEX `affiliates_name_idx` ON `affiliates` (`name`);--> statement-breakpoint
CREATE INDEX `affiliates_owner_team_idx` ON `affiliates` (`ownerTeamId`);--> statement-breakpoint
CREATE TABLE `competition_registration_teammates` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`registrationId` text NOT NULL,
	`userId` text,
	`email` text(255) NOT NULL,
	`firstName` text(255),
	`lastName` text(255),
	`affiliateId` text,
	`inviteToken` text(255),
	`invitedAt` integer,
	`acceptedAt` integer,
	`position` integer NOT NULL,
	`isCaptain` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	FOREIGN KEY (`registrationId`) REFERENCES `competition_registrations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`affiliateId`) REFERENCES `affiliates`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_teammates_reg_email_idx` ON `competition_registration_teammates` (`registrationId`,`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `crm_teammates_reg_user_idx` ON `competition_registration_teammates` (`registrationId`,`userId`) WHERE "competition_registration_teammates"."userId" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `crm_teammates_invite_token_idx` ON `competition_registration_teammates` (`inviteToken`) WHERE "competition_registration_teammates"."inviteToken" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `crm_teammates_reg_idx` ON `competition_registration_teammates` (`registrationId`);--> statement-breakpoint
CREATE INDEX `crm_teammates_user_idx` ON `competition_registration_teammates` (`userId`);--> statement-breakpoint
CREATE INDEX `crm_teammates_email_idx` ON `competition_registration_teammates` (`email`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_team` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`name` text(255) NOT NULL,
	`slug` text(255) NOT NULL,
	`description` text(1000),
	`avatarUrl` text(600),
	`settings` text(10000),
	`billingEmail` text(255),
	`planId` text(100),
	`planExpiresAt` integer,
	`creditBalance` integer DEFAULT 0 NOT NULL,
	`currentPlanId` text(100),
	`defaultTrackId` text,
	`defaultScalingGroupId` text,
	`isPersonalTeam` integer DEFAULT 0 NOT NULL,
	`personalTeamOwnerId` text,
	`type` text(50) DEFAULT 'gym' NOT NULL,
	`parentOrganizationId` text,
	`competitionMetadata` text(10000),
	FOREIGN KEY (`personalTeamOwnerId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parentOrganizationId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_team`("createdAt", "updatedAt", "updateCounter", "id", "name", "slug", "description", "avatarUrl", "settings", "billingEmail", "planId", "planExpiresAt", "creditBalance", "currentPlanId", "defaultTrackId", "defaultScalingGroupId", "isPersonalTeam", "personalTeamOwnerId", "type", "parentOrganizationId", "competitionMetadata") SELECT "createdAt", "updatedAt", "updateCounter", "id", "name", "slug", "description", "avatarUrl", "settings", "billingEmail", "planId", "planExpiresAt", "creditBalance", "currentPlanId", "defaultTrackId", "defaultScalingGroupId", "isPersonalTeam", "personalTeamOwnerId", "type", "parentOrganizationId", "competitionMetadata" FROM `team`;--> statement-breakpoint
DROP TABLE `team`;--> statement-breakpoint
ALTER TABLE `__new_team` RENAME TO `team`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `team_slug_unique` ON `team` (`slug`);--> statement-breakpoint
CREATE INDEX `team_slug_idx` ON `team` (`slug`);--> statement-breakpoint
CREATE INDEX `team_personal_owner_idx` ON `team` (`personalTeamOwnerId`);--> statement-breakpoint
CREATE INDEX `team_default_scaling_idx` ON `team` (`defaultScalingGroupId`);--> statement-breakpoint
CREATE INDEX `team_type_idx` ON `team` (`type`);--> statement-breakpoint
CREATE INDEX `team_parent_org_idx` ON `team` (`parentOrganizationId`);--> statement-breakpoint
ALTER TABLE `competition_registrations` ADD `teamName` text(255);--> statement-breakpoint
ALTER TABLE `competition_registrations` ADD `captainUserId` text REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `competition_registrations` ADD `metadata` text(10000);--> statement-breakpoint
CREATE INDEX `competition_registrations_captain_idx` ON `competition_registrations` (`captainUserId`);--> statement-breakpoint
ALTER TABLE `scaling_levels` ADD `teamSize` integer DEFAULT 1 NOT NULL;