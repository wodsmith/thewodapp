CREATE TABLE `volunteer_shift_assignments` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`shiftId` text NOT NULL,
	`membershipId` text NOT NULL,
	`notes` text(500),
	FOREIGN KEY (`shiftId`) REFERENCES `volunteer_shifts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`membershipId`) REFERENCES `team_membership`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `volunteer_shift_assignments_shift_idx` ON `volunteer_shift_assignments` (`shiftId`);--> statement-breakpoint
CREATE INDEX `volunteer_shift_assignments_membership_idx` ON `volunteer_shift_assignments` (`membershipId`);--> statement-breakpoint
CREATE UNIQUE INDEX `volunteer_shift_assignments_unique_idx` ON `volunteer_shift_assignments` (`shiftId`, `membershipId`);
