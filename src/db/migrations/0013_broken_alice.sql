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
	`defaultTrackId` text
);
--> statement-breakpoint
INSERT INTO `__new_team`("createdAt", "updatedAt", "updateCounter", "id", "name", "slug", "description", "avatarUrl", "settings", "billingEmail", "planId", "planExpiresAt", "creditBalance", "defaultTrackId") SELECT "createdAt", "updatedAt", "updateCounter", "id", "name", "slug", "description", "avatarUrl", "settings", "billingEmail", "planId", "planExpiresAt", "creditBalance", "defaultTrackId" FROM `team`;--> statement-breakpoint
DROP TABLE `team`;--> statement-breakpoint
ALTER TABLE `__new_team` RENAME TO `team`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `team_slug_unique` ON `team` (`slug`);--> statement-breakpoint
CREATE INDEX `team_slug_idx` ON `team` (`slug`);--> statement-breakpoint
CREATE INDEX `track_workout_workoutid_idx` ON `track_workout` (`workoutId`);