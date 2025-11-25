DROP INDEX `comp_event_slug_idx`;--> statement-breakpoint
DROP INDEX `comp_event_group_unique_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `comp_event_group_unique_idx` ON `competition_event_groups` (`organizingTeamId`,`slug`);--> statement-breakpoint
DROP INDEX `comp_reg_unique_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `comp_reg_unique_idx` ON `competition_registrations` (`eventId`,`userId`);