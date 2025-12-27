-- Make invitedBy nullable on team_invitation for volunteer self-signups
-- SQLite doesn't support ALTER COLUMN, so we need to recreate the table

PRAGMA foreign_keys=OFF;--> statement-breakpoint

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
);--> statement-breakpoint

INSERT INTO `__new_team_invitation`("createdAt", "updatedAt", "updateCounter", "id", "teamId", "email", "roleId", "isSystemRole", "token", "invitedBy", "expiresAt", "acceptedAt", "acceptedBy", "metadata") 
SELECT "createdAt", "updatedAt", "updateCounter", "id", "teamId", "email", "roleId", "isSystemRole", "token", "invitedBy", "expiresAt", "acceptedAt", "acceptedBy", "metadata" 
FROM `team_invitation`;--> statement-breakpoint

DROP TABLE `team_invitation`;--> statement-breakpoint

ALTER TABLE `__new_team_invitation` RENAME TO `team_invitation`;--> statement-breakpoint

PRAGMA foreign_keys=ON;--> statement-breakpoint

CREATE UNIQUE INDEX `team_invitation_token_unique` ON `team_invitation` (`token`);--> statement-breakpoint
CREATE INDEX `team_invitation_team_id_idx` ON `team_invitation` (`teamId`);--> statement-breakpoint
CREATE INDEX `team_invitation_email_idx` ON `team_invitation` (`email`);
