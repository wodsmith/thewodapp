CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`fileName` text NOT NULL,
	`r2Key` text NOT NULL,
	`vendor` text NOT NULL,
	`description` text,
	`amountCents` integer,
	`currency` text DEFAULT 'USD' NOT NULL,
	`subscriptionTerm` text,
	`category` text,
	`invoiceDate` text,
	`dueDate` text,
	`status` text DEFAULT 'unpaid' NOT NULL,
	`contentType` text,
	`fileSize` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0
);
