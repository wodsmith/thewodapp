PRAGMA defer_foreign_keys = ON;

CREATE TABLE `programming_track_payment` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`trackId` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text(3) NOT NULL,
	`paymentType` text NOT NULL,
	`status` text NOT NULL,
	`stripePaymentIntentId` text(255),
	`stripeSubscriptionId` text(255),
	`stripeInvoiceId` text(255),
	`stripeCustomerId` text(255) NOT NULL,
	`failureReason` text(500),
	`refundedAt` integer,
	`refundAmount` integer,
	`periodStart` integer,
	`periodEnd` integer,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`trackId`) REFERENCES `programming_track`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `programming_track_payment_user_idx` ON `programming_track_payment` (`userId`);--> statement-breakpoint
CREATE INDEX `programming_track_payment_track_idx` ON `programming_track_payment` (`trackId`);--> statement-breakpoint
CREATE INDEX `programming_track_payment_status_idx` ON `programming_track_payment` (`status`);--> statement-breakpoint
CREATE INDEX `programming_track_payment_stripe_payment_intent_idx` ON `programming_track_payment` (`stripePaymentIntentId`);--> statement-breakpoint
CREATE INDEX `programming_track_payment_stripe_subscription_idx` ON `programming_track_payment` (`stripeSubscriptionId`);--> statement-breakpoint
CREATE INDEX `programming_track_payment_created_at_idx` ON `programming_track_payment` (`createdAt`);--> statement-breakpoint
ALTER TABLE `programming_track` ADD `pricingType` text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `programming_track` ADD `price` integer;--> statement-breakpoint
ALTER TABLE `programming_track` ADD `currency` text(3) DEFAULT 'usd';--> statement-breakpoint
ALTER TABLE `programming_track` ADD `billingInterval` text;--> statement-breakpoint
ALTER TABLE `programming_track` ADD `stripePriceId` text(255);--> statement-breakpoint
ALTER TABLE `programming_track` ADD `stripeProductId` text(255);--> statement-breakpoint
ALTER TABLE `programming_track` ADD `trialPeriodDays` integer DEFAULT 0;--> statement-breakpoint
CREATE INDEX `programming_track_pricing_type_idx` ON `programming_track` (`pricingType`);--> statement-breakpoint
CREATE INDEX `programming_track_stripe_price_idx` ON `programming_track` (`stripePriceId`);--> statement-breakpoint
ALTER TABLE `team_programming_track` ADD `subscribedAt` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `team_programming_track` ADD `startDayOffset` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `team_programming_track` ADD `paymentStatus` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `team_programming_track` ADD `stripeCustomerId` text(255);--> statement-breakpoint
ALTER TABLE `team_programming_track` ADD `stripeSubscriptionId` text(255);--> statement-breakpoint
ALTER TABLE `team_programming_track` ADD `stripePaymentIntentId` text(255);--> statement-breakpoint
ALTER TABLE `team_programming_track` ADD `subscriptionExpiresAt` integer;--> statement-breakpoint
ALTER TABLE `team_programming_track` ADD `cancelledAt` integer;--> statement-breakpoint
ALTER TABLE `team_programming_track` ADD `cancelAtPeriodEnd` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `team_programming_track_team_idx` ON `team_programming_track` (`teamId`);--> statement-breakpoint
CREATE INDEX `team_programming_track_payment_status_idx` ON `team_programming_track` (`paymentStatus`);--> statement-breakpoint
CREATE INDEX `team_programming_track_stripe_subscription_idx` ON `team_programming_track` (`stripeSubscriptionId`);--> statement-breakpoint
CREATE INDEX `team_programming_track_expires_at_idx` ON `team_programming_track` (`subscriptionExpiresAt`);--> statement-breakpoint
ALTER TABLE `team_programming_track` DROP COLUMN `addedAt`;

PRAGMA defer_foreign_keys = OFF;