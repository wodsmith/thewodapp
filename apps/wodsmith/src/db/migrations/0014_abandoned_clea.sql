PRAGMA defer_foreign_keys = ON;

ALTER TABLE `team_programming_track` RENAME COLUMN "addedAt" TO "subscribedAt";--> statement-breakpoint
ALTER TABLE `team_programming_track` ADD `startDayOffset` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `team_programming_track_team_idx` ON `team_programming_track` (`teamId`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_workouts` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`scope` text DEFAULT 'private' NOT NULL,
	`scheme` text NOT NULL,
	`reps_per_round` integer,
	`rounds_to_score` integer DEFAULT 1,
	`team_id` text,
	`sugar_id` text,
	`tiebreak_scheme` text,
	`secondary_scheme` text,
	`source_track_id` text,
	FOREIGN KEY (`team_id`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_workouts`("createdAt", "updatedAt", "updateCounter", "id", "name", "description", "scope", "scheme", "reps_per_round", "rounds_to_score", "team_id", "sugar_id", "tiebreak_scheme", "secondary_scheme", "source_track_id") SELECT "createdAt", "updatedAt", "updateCounter", "id", "name", "description", "scope", "scheme", "reps_per_round", "rounds_to_score", "team_id", "sugar_id", "tiebreak_scheme", "secondary_scheme", "source_track_id" FROM `workouts`;--> statement-breakpoint
DROP TABLE `workouts`;--> statement-breakpoint
ALTER TABLE `__new_workouts` RENAME TO `workouts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_results` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` integer NOT NULL,
	`workout_id` text,
	`type` text NOT NULL,
	`notes` text,
	`programming_track_id` text,
	`scheduled_workout_instance_id` text,
	`scale` text,
	`wod_score` text,
	`set_count` integer,
	`distance` integer,
	`time` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_results`("createdAt", "updatedAt", "updateCounter", "id", "user_id", "date", "workout_id", "type", "notes", "programming_track_id", "scheduled_workout_instance_id", "scale", "wod_score", "set_count", "distance", "time") SELECT "createdAt", "updatedAt", "updateCounter", "id", "user_id", "date", "workout_id", "type", "notes", "programming_track_id", "scheduled_workout_instance_id", "scale", "wod_score", "set_count", "distance", "time" FROM `results`;--> statement-breakpoint
DROP TABLE `results`;--> statement-breakpoint
ALTER TABLE `__new_results` RENAME TO `results`;--> statement-breakpoint
CREATE TABLE `__new_passkey_credential` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`credentialId` text(255) NOT NULL,
	`credentialPublicKey` text(255) NOT NULL,
	`counter` integer NOT NULL,
	`transports` text(255),
	`aaguid` text(255),
	`userAgent` text(255),
	`ipAddress` text(128),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_passkey_credential`("createdAt", "updatedAt", "updateCounter", "id", "userId", "credentialId", "credentialPublicKey", "counter", "transports", "aaguid", "userAgent", "ipAddress") SELECT "createdAt", "updatedAt", "updateCounter", "id", "userId", "credentialId", "credentialPublicKey", "counter", "transports", "aaguid", "userAgent", "ipAddress" FROM `passkey_credential`;--> statement-breakpoint
DROP TABLE `passkey_credential`;--> statement-breakpoint
ALTER TABLE `__new_passkey_credential` RENAME TO `passkey_credential`;--> statement-breakpoint
CREATE UNIQUE INDEX `passkey_credential_credentialId_unique` ON `passkey_credential` (`credentialId`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `passkey_credential` (`userId`);--> statement-breakpoint
CREATE INDEX `credential_id_idx` ON `passkey_credential` (`credentialId`);--> statement-breakpoint
CREATE TABLE `__new_user` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`firstName` text(255),
	`lastName` text(255),
	`email` text(255),
	`passwordHash` text,
	`role` text DEFAULT 'user' NOT NULL,
	`emailVerified` integer,
	`signUpIpAddress` text(128),
	`googleAccountId` text(255),
	`avatar` text(600),
	`currentCredits` integer DEFAULT 0 NOT NULL,
	`lastCreditRefreshAt` integer
);
--> statement-breakpoint
INSERT INTO `__new_user`("createdAt", "updatedAt", "updateCounter", "id", "firstName", "lastName", "email", "passwordHash", "role", "emailVerified", "signUpIpAddress", "googleAccountId", "avatar", "currentCredits", "lastCreditRefreshAt") SELECT "createdAt", "updatedAt", "updateCounter", "id", "firstName", "lastName", "email", "passwordHash", "role", "emailVerified", "signUpIpAddress", "googleAccountId", "avatar", "currentCredits", "lastCreditRefreshAt" FROM `user`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE INDEX `email_idx` ON `user` (`email`);--> statement-breakpoint
CREATE INDEX `google_account_id_idx` ON `user` (`googleAccountId`);--> statement-breakpoint
CREATE INDEX `role_idx` ON `user` (`role`);

PRAGMA defer_foreign_keys = OFF;