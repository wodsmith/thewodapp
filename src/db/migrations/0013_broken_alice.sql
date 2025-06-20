PRAGMA defer_foreign_keys = ON;

-- 1. Create new team table with correct schema
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
	`defaultTrackId` text,
	`isPersonalTeam` integer DEFAULT 0 NOT NULL,
	`personalTeamOwnerId` text,
	FOREIGN KEY (`personalTeamOwnerId`) REFERENCES `user`(`id`)
);

-- 2. Copy data from old table (adding default values for new columns)
INSERT INTO `__new_team`("createdAt", "updatedAt", "updateCounter", "id", "name", "slug", "description", "avatarUrl", "settings", "billingEmail", "planId", "planExpiresAt", "creditBalance", "defaultTrackId", "isPersonalTeam", "personalTeamOwnerId") 
SELECT "createdAt", "updatedAt", "updateCounter", "id", "name", "slug", "description", "avatarUrl", "settings", "billingEmail", "planId", "planExpiresAt", "creditBalance", "defaultTrackId", 0, NULL FROM `team`;

-- 3. Drop old table
DROP TABLE `team`;

-- 4. Rename new table
ALTER TABLE `__new_team` RENAME TO `team`;

-- 5. Recreate indexes
CREATE UNIQUE INDEX `team_slug_unique` ON `team` (`slug`);
CREATE INDEX `team_slug_idx` ON `team` (`slug`);
CREATE INDEX `team_personal_owner_idx` ON `team` (`personalTeamOwnerId`);

-- 6. Create additional index for track_workout table
CREATE INDEX `track_workout_workoutid_idx` ON `track_workout` (`workoutId`);

PRAGMA defer_foreign_keys = OFF;