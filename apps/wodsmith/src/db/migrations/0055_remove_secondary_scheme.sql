ALTER TABLE `team` ADD `stripeAccountType` text(20);--> statement-breakpoint
ALTER TABLE `scores` DROP COLUMN `secondary_scheme`;--> statement-breakpoint
ALTER TABLE `workouts` DROP COLUMN `secondary_scheme`;