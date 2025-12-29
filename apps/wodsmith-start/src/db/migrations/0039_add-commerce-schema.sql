CREATE TABLE `commerce_product` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`name` text(255) NOT NULL,
	`type` text(50) NOT NULL,
	`resourceId` text NOT NULL,
	`priceCents` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `commerce_product_resource_idx` ON `commerce_product` (`type`,`resourceId`);--> statement-breakpoint
CREATE TABLE `commerce_purchase` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`productId` text NOT NULL,
	`status` text(20) NOT NULL,
	`competitionId` text,
	`divisionId` text,
	`totalCents` integer NOT NULL,
	`platformFeeCents` integer NOT NULL,
	`stripeFeeCents` integer NOT NULL,
	`organizerNetCents` integer NOT NULL,
	`stripeCheckoutSessionId` text,
	`stripePaymentIntentId` text,
	`metadata` text(10000),
	`completedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`productId`) REFERENCES `commerce_product`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `commerce_purchase_user_idx` ON `commerce_purchase` (`userId`);--> statement-breakpoint
CREATE INDEX `commerce_purchase_product_idx` ON `commerce_purchase` (`productId`);--> statement-breakpoint
CREATE INDEX `commerce_purchase_status_idx` ON `commerce_purchase` (`status`);--> statement-breakpoint
CREATE INDEX `commerce_purchase_stripe_session_idx` ON `commerce_purchase` (`stripeCheckoutSessionId`);--> statement-breakpoint
CREATE INDEX `commerce_purchase_competition_idx` ON `commerce_purchase` (`competitionId`);--> statement-breakpoint
CREATE TABLE `competition_division_fees` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`competitionId` text NOT NULL,
	`divisionId` text NOT NULL,
	`feeCents` integer NOT NULL,
	FOREIGN KEY (`competitionId`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`divisionId`) REFERENCES `scaling_levels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competition_division_fees_unique_idx` ON `competition_division_fees` (`competitionId`,`divisionId`);--> statement-breakpoint
CREATE INDEX `competition_division_fees_competition_idx` ON `competition_division_fees` (`competitionId`);--> statement-breakpoint
ALTER TABLE `competition_registrations` ADD `commercePurchaseId` text;--> statement-breakpoint
ALTER TABLE `competition_registrations` ADD `paymentStatus` text(20);--> statement-breakpoint
ALTER TABLE `competition_registrations` ADD `paidAt` integer;--> statement-breakpoint
CREATE INDEX `competition_registrations_purchase_idx` ON `competition_registrations` (`commercePurchaseId`);--> statement-breakpoint
ALTER TABLE `competitions` ADD `defaultRegistrationFeeCents` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `competitions` ADD `platformFeePercentage` integer;--> statement-breakpoint
ALTER TABLE `competitions` ADD `platformFeeFixed` integer;--> statement-breakpoint
ALTER TABLE `competitions` ADD `passStripeFeesToCustomer` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `team` ADD `stripeConnectedAccountId` text;--> statement-breakpoint
ALTER TABLE `team` ADD `stripeAccountStatus` text(20);--> statement-breakpoint
ALTER TABLE `team` ADD `stripeOnboardingCompletedAt` integer;