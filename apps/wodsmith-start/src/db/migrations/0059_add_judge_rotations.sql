CREATE TABLE `competition_judge_rotations` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`competitionId` text NOT NULL,
	`trackWorkoutId` text NOT NULL,
	`membershipId` text NOT NULL,
	`startingHeat` integer NOT NULL,
	`startingLane` integer NOT NULL,
	`heatsCount` integer NOT NULL,
	`laneShiftPattern` text(20) DEFAULT 'stay' NOT NULL,
	`notes` text(500),
	FOREIGN KEY (`competitionId`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trackWorkoutId`) REFERENCES `track_workout`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`membershipId`) REFERENCES `team_membership`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `competition_judge_rotations_competition_idx` ON `competition_judge_rotations` (`competitionId`);--> statement-breakpoint
CREATE INDEX `competition_judge_rotations_workout_idx` ON `competition_judge_rotations` (`trackWorkoutId`);--> statement-breakpoint
CREATE INDEX `competition_judge_rotations_membership_idx` ON `competition_judge_rotations` (`membershipId`);--> statement-breakpoint
CREATE INDEX `competition_judge_rotations_event_heat_idx` ON `competition_judge_rotations` (`trackWorkoutId`,`startingHeat`);--> statement-breakpoint
ALTER TABLE `competitions` ADD `defaultHeatsPerRotation` integer DEFAULT 4;--> statement-breakpoint
ALTER TABLE `competitions` ADD `defaultLaneShiftPattern` text(20) DEFAULT 'stay';