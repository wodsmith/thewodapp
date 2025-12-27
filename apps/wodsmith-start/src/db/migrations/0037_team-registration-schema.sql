DROP TABLE `competition_registration_teammates`;--> statement-breakpoint
ALTER TABLE `competition_registrations` ADD `athleteTeamId` text REFERENCES team(id);--> statement-breakpoint
ALTER TABLE `competition_registrations` ADD `pendingTeammates` text(5000);--> statement-breakpoint
CREATE INDEX `competition_registrations_athlete_team_idx` ON `competition_registrations` (`athleteTeamId`);