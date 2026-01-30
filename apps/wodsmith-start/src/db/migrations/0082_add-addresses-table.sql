-- Create addresses table for normalized location data
CREATE TABLE IF NOT EXISTS `addresses` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`addressType` text(50),
	`name` text(255),
	`streetLine1` text(500),
	`streetLine2` text(500),
	`city` text(255),
	`stateProvince` text(255),
	`postalCode` text(50),
	`countryCode` text(2),
	`notes` text(1000)
);
--> statement-breakpoint
-- Add primaryAddressId FK to competitions table
ALTER TABLE `competitions` ADD `primaryAddressId` text REFERENCES `addresses`(`id`);
--> statement-breakpoint
-- Add addressId FK to competition_venues table
ALTER TABLE `competition_venues` ADD `addressId` text REFERENCES `addresses`(`id`);
