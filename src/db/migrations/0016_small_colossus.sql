CREATE TABLE `passkey_credential` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`credentialId` text(255) NOT NULL,
	`credentialPublicKey` text(255) NOT NULL,
	`counter` integer NOT NULL,
	`transports` text(255),
	`aaguid` text(255),
	`userAgent` text(255),
	`ipAddress` text(100),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `passkey_credential_credentialId_unique` ON `passkey_credential` (`credentialId`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `passkey_credential` (`userId`);--> statement-breakpoint
CREATE INDEX `credential_id_idx` ON `passkey_credential` (`credentialId`);--> statement-breakpoint
CREATE TABLE `user` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`firstName` text(255),
	`lastName` text(255),
	`email` text(255),
	`passwordHash` text,
	`role` text DEFAULT 'user' NOT NULL,
	`emailVerified` integer,
	`signUpIpAddress` text(100),
	`googleAccountId` text(255),
	`avatar` text(600),
	`currentCredits` integer DEFAULT 0 NOT NULL,
	`lastCreditRefreshAt` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE INDEX `email_idx` ON `user` (`email`);--> statement-breakpoint
CREATE INDEX `google_account_id_idx` ON `user` (`googleAccountId`);--> statement-breakpoint
CREATE INDEX `role_idx` ON `user` (`role`);--> statement-breakpoint
CREATE TABLE `credit_transaction` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`amount` integer NOT NULL,
	`remainingAmount` integer DEFAULT 0 NOT NULL,
	`type` text NOT NULL,
	`description` text(255) NOT NULL,
	`expirationDate` integer,
	`expirationDateProcessedAt` integer,
	`paymentIntentId` text(255),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `credit_transaction_user_id_idx` ON `credit_transaction` (`userId`);--> statement-breakpoint
CREATE INDEX `credit_transaction_type_idx` ON `credit_transaction` (`type`);--> statement-breakpoint
CREATE INDEX `credit_transaction_created_at_idx` ON `credit_transaction` (`createdAt`);--> statement-breakpoint
CREATE INDEX `credit_transaction_expiration_date_idx` ON `credit_transaction` (`expirationDate`);--> statement-breakpoint
CREATE INDEX `credit_transaction_payment_intent_id_idx` ON `credit_transaction` (`paymentIntentId`);--> statement-breakpoint
CREATE TABLE `purchased_item` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`itemType` text NOT NULL,
	`itemId` text NOT NULL,
	`purchasedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `purchased_item_user_id_idx` ON `purchased_item` (`userId`);--> statement-breakpoint
CREATE INDEX `purchased_item_type_idx` ON `purchased_item` (`itemType`);--> statement-breakpoint
CREATE INDEX `purchased_item_user_item_idx` ON `purchased_item` (`userId`,`itemType`,`itemId`);--> statement-breakpoint
CREATE TABLE `team_invitation` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`teamId` text NOT NULL,
	`email` text(255) NOT NULL,
	`roleId` text NOT NULL,
	`isSystemRole` integer DEFAULT 1 NOT NULL,
	`token` text(255) NOT NULL,
	`invitedBy` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`acceptedAt` integer,
	`acceptedBy` text,
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invitedBy`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`acceptedBy`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_invitation_token_unique` ON `team_invitation` (`token`);--> statement-breakpoint
CREATE INDEX `team_invitation_team_id_idx` ON `team_invitation` (`teamId`);--> statement-breakpoint
CREATE INDEX `team_invitation_email_idx` ON `team_invitation` (`email`);--> statement-breakpoint
CREATE INDEX `team_invitation_token_idx` ON `team_invitation` (`token`);--> statement-breakpoint
CREATE TABLE `team_membership` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`teamId` text NOT NULL,
	`userId` text NOT NULL,
	`roleId` text NOT NULL,
	`isSystemRole` integer DEFAULT 1 NOT NULL,
	`invitedBy` text,
	`invitedAt` integer,
	`joinedAt` integer,
	`expiresAt` integer,
	`isActive` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invitedBy`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `team_membership_team_id_idx` ON `team_membership` (`teamId`);--> statement-breakpoint
CREATE INDEX `team_membership_user_id_idx` ON `team_membership` (`userId`);--> statement-breakpoint
CREATE INDEX `team_membership_unique_idx` ON `team_membership` (`teamId`,`userId`);--> statement-breakpoint
CREATE TABLE `team_role` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`teamId` text NOT NULL,
	`name` text(255) NOT NULL,
	`description` text(1000),
	`permissions` text NOT NULL,
	`metadata` text(5000),
	`isEditable` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `team_role_team_id_idx` ON `team_role` (`teamId`);--> statement-breakpoint
CREATE INDEX `team_role_name_unique_idx` ON `team_role` (`teamId`,`name`);--> statement-breakpoint
CREATE TABLE `team` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`name` text(255) NOT NULL,
	`slug` text(255) NOT NULL,
	`description` text(1000),
	`avatarUrl` text(600),
	`settings` text(10000),
	`billingEmail` text(255),
	`planId` text(100),
	`planExpiresAt` integer,
	`creditBalance` integer DEFAULT 0 NOT NULL,
	`defaultTrackId` text,
	`isPersonalTeam` integer DEFAULT 0 NOT NULL,
	`personalTeamOwnerId` text,
	FOREIGN KEY (`personalTeamOwnerId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_slug_unique` ON `team` (`slug`);--> statement-breakpoint
CREATE INDEX `team_slug_idx` ON `team` (`slug`);--> statement-breakpoint
CREATE INDEX `team_personal_owner_idx` ON `team` (`personalTeamOwnerId`);--> statement-breakpoint
CREATE TABLE `movements` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `results` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` integer NOT NULL,
	`workout_id` text,
	`type` text NOT NULL,
	`notes` text,
	`programming_track_id` text,
	`scheduled_workout_instance_id` text,
	`scale` text,
	`wod_score` text,
	`set_count` integer,
	`distance` integer,
	`time` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sets` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`result_id` text NOT NULL,
	`set_number` integer NOT NULL,
	`notes` text,
	`reps` integer,
	`weight` integer,
	`status` text,
	`distance` integer,
	`time` integer,
	`score` integer,
	FOREIGN KEY (`result_id`) REFERENCES `results`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `spicy_tags` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `spicy_tags_name_unique` ON `spicy_tags` (`name`);--> statement-breakpoint
CREATE TABLE `workout_movements` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`workout_id` text,
	`movement_id` text,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`movement_id`) REFERENCES `movements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workout_tags` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`workout_id` text NOT NULL,
	`tag_id` text NOT NULL,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `spicy_tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workouts` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`scope` text DEFAULT 'private' NOT NULL,
	`scheme` text NOT NULL,
	`reps_per_round` integer,
	`rounds_to_score` integer DEFAULT 1,
	`user_id` text,
	`sugar_id` text,
	`tiebreak_scheme` text,
	`secondary_scheme` text,
	`source_track_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
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
CREATE TABLE `programming_track` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`name` text(255) NOT NULL,
	`description` text(1000),
	`type` text NOT NULL,
	`ownerTeamId` text,
	`isPublic` integer DEFAULT 0 NOT NULL,
	`pricingType` text DEFAULT 'free' NOT NULL,
	`price` integer,
	`currency` text(3) DEFAULT 'usd',
	`billingInterval` text,
	`stripePriceId` text(255),
	`stripeProductId` text(255),
	`trialPeriodDays` integer DEFAULT 0,
	FOREIGN KEY (`ownerTeamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `programming_track_type_idx` ON `programming_track` (`type`);--> statement-breakpoint
CREATE INDEX `programming_track_owner_idx` ON `programming_track` (`ownerTeamId`);--> statement-breakpoint
CREATE INDEX `programming_track_pricing_type_idx` ON `programming_track` (`pricingType`);--> statement-breakpoint
CREATE INDEX `programming_track_stripe_price_idx` ON `programming_track` (`stripePriceId`);--> statement-breakpoint
CREATE TABLE `scheduled_workout_instance` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`teamId` text NOT NULL,
	`trackWorkoutId` text NOT NULL,
	`scheduledDate` integer NOT NULL,
	`teamSpecificNotes` text(1000),
	`scalingGuidanceForDay` text(1000),
	`classTimes` text(500),
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`trackWorkoutId`) REFERENCES `track_workout`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `scheduled_workout_instance_team_idx` ON `scheduled_workout_instance` (`teamId`);--> statement-breakpoint
CREATE INDEX `scheduled_workout_instance_date_idx` ON `scheduled_workout_instance` (`scheduledDate`);--> statement-breakpoint
CREATE TABLE `team_programming_track` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`teamId` text NOT NULL,
	`trackId` text NOT NULL,
	`isActive` integer DEFAULT 1 NOT NULL,
	`subscribedAt` integer NOT NULL,
	`startDayOffset` integer DEFAULT 0 NOT NULL,
	`paymentStatus` text DEFAULT 'pending' NOT NULL,
	`stripeCustomerId` text(255),
	`stripeSubscriptionId` text(255),
	`stripePaymentIntentId` text(255),
	`subscriptionExpiresAt` integer,
	`cancelledAt` integer,
	`cancelAtPeriodEnd` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`teamId`, `trackId`),
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`trackId`) REFERENCES `programming_track`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `team_programming_track_active_idx` ON `team_programming_track` (`isActive`);--> statement-breakpoint
CREATE INDEX `team_programming_track_team_idx` ON `team_programming_track` (`teamId`);--> statement-breakpoint
CREATE INDEX `team_programming_track_payment_status_idx` ON `team_programming_track` (`paymentStatus`);--> statement-breakpoint
CREATE INDEX `team_programming_track_stripe_subscription_idx` ON `team_programming_track` (`stripeSubscriptionId`);--> statement-breakpoint
CREATE INDEX `team_programming_track_expires_at_idx` ON `team_programming_track` (`subscriptionExpiresAt`);--> statement-breakpoint
CREATE TABLE `track_workout` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`trackId` text NOT NULL,
	`workoutId` text NOT NULL,
	`dayNumber` integer NOT NULL,
	`weekNumber` integer,
	`notes` text(1000),
	FOREIGN KEY (`trackId`) REFERENCES `programming_track`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workoutId`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `track_workout_track_idx` ON `track_workout` (`trackId`);--> statement-breakpoint
CREATE INDEX `track_workout_day_idx` ON `track_workout` (`dayNumber`);--> statement-breakpoint
CREATE INDEX `track_workout_workoutid_idx` ON `track_workout` (`workoutId`);--> statement-breakpoint
CREATE INDEX `track_workout_unique_idx` ON `track_workout` (`trackId`,`workoutId`,`dayNumber`);