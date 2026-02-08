DROP INDEX `judge_heat_assignments_unique_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `judge_heat_assignments_unique_idx` ON `judge_heat_assignments` (`heatId`,`membershipId`,`versionId`);