Error: ENOENT: no such file or directory, scandir '/home/user/thewodapp/apps/wodsmith/.wrangler/state/v3/d1'
    at read (node:fs:1488:35)
    at readdirSyncRecursive (node:fs:1506:5)
    at Object.readdirSync (node:fs:1580:12)
    at getLocalD1DB (/home/user/thewodapp/apps/wodsmith/drizzle.config.ts:9:5)
    at Object.<anonymous> (/home/user/thewodapp/apps/wodsmith/drizzle.config.ts:40:11)
    at Module._compile (node:internal/modules/cjs/loader:1706:14)
    at Module._compile (/home/user/thewodapp/node_modules/.pnpm/drizzle-kit@0.30.6/node_modules/drizzle-kit/bin.cjs:14147:30)
    at node:internal/modules/cjs/loader:1839:10
    at Object.newLoader [as .ts] (/home/user/thewodapp/node_modules/.pnpm/drizzle-kit@0.30.6/node_modules/drizzle-kit/bin.cjs:14151:13)
    at Module.load (node:internal/modules/cjs/loader:1441:32) {
  errno: -2,
  code: 'ENOENT',
  syscall: 'scandir',
  path: '/home/user/thewodapp/apps/wodsmith/.wrangler/state/v3/d1'
}
CREATE TABLE `affiliates` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`name` text(255) NOT NULL,
	`location` text(255),
	`verificationStatus` text DEFAULT 'unverified' NOT NULL,
	`ownerTeamId` text,
	FOREIGN KEY (`ownerTeamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE UNIQUE INDEX `affiliates_name_unique` ON `affiliates` (`name`);
CREATE INDEX `affiliates_name_idx` ON `affiliates` (`name`);
CREATE INDEX `affiliates_owner_team_idx` ON `affiliates` (`ownerTeamId`);
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

CREATE INDEX `credit_transaction_user_id_idx` ON `credit_transaction` (`userId`);
CREATE INDEX `credit_transaction_type_idx` ON `credit_transaction` (`type`);
CREATE INDEX `credit_transaction_created_at_idx` ON `credit_transaction` (`createdAt`);
CREATE INDEX `credit_transaction_expiration_date_idx` ON `credit_transaction` (`expirationDate`);
CREATE INDEX `credit_transaction_payment_intent_id_idx` ON `credit_transaction` (`paymentIntentId`);
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

CREATE INDEX `purchased_item_user_id_idx` ON `purchased_item` (`userId`);
CREATE INDEX `purchased_item_type_idx` ON `purchased_item` (`itemType`);
CREATE INDEX `purchased_item_user_item_idx` ON `purchased_item` (`userId`,`itemType`,`itemId`);
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

CREATE UNIQUE INDEX `commerce_product_resource_idx` ON `commerce_product` (`type`,`resourceId`);
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

CREATE INDEX `commerce_purchase_user_idx` ON `commerce_purchase` (`userId`);
CREATE INDEX `commerce_purchase_product_idx` ON `commerce_purchase` (`productId`);
CREATE INDEX `commerce_purchase_status_idx` ON `commerce_purchase` (`status`);
CREATE INDEX `commerce_purchase_stripe_session_idx` ON `commerce_purchase` (`stripeCheckoutSessionId`);
CREATE INDEX `commerce_purchase_competition_idx` ON `commerce_purchase` (`competitionId`);
CREATE TABLE `competition_divisions` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`competitionId` text NOT NULL,
	`divisionId` text NOT NULL,
	`feeCents` integer NOT NULL,
	`description` text(2000),
	FOREIGN KEY (`competitionId`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`divisionId`) REFERENCES `scaling_levels`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `competition_divisions_unique_idx` ON `competition_divisions` (`competitionId`,`divisionId`);
CREATE INDEX `competition_divisions_competition_idx` ON `competition_divisions` (`competitionId`);
CREATE TABLE `competition_groups` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`organizingTeamId` text NOT NULL,
	`slug` text(255) NOT NULL,
	`name` text(255) NOT NULL,
	`description` text(1000),
	FOREIGN KEY (`organizingTeamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `competition_groups_org_slug_idx` ON `competition_groups` (`organizingTeamId`,`slug`);
CREATE TABLE `competition_heat_assignments` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`heatId` text NOT NULL,
	`registrationId` text NOT NULL,
	`laneNumber` integer NOT NULL,
	FOREIGN KEY (`heatId`) REFERENCES `competition_heats`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`registrationId`) REFERENCES `competition_registrations`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `competition_heat_assignments_heat_idx` ON `competition_heat_assignments` (`heatId`);
CREATE UNIQUE INDEX `competition_heat_assignments_reg_idx` ON `competition_heat_assignments` (`heatId`,`registrationId`);
CREATE UNIQUE INDEX `competition_heat_assignments_lane_idx` ON `competition_heat_assignments` (`heatId`,`laneNumber`);
CREATE TABLE `competition_heats` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`competitionId` text NOT NULL,
	`trackWorkoutId` text NOT NULL,
	`venueId` text,
	`heatNumber` integer NOT NULL,
	`scheduledTime` integer,
	`durationMinutes` integer,
	`divisionId` text,
	`notes` text(500),
	FOREIGN KEY (`competitionId`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`venueId`) REFERENCES `competition_venues`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`divisionId`) REFERENCES `scaling_levels`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE INDEX `competition_heats_competition_idx` ON `competition_heats` (`competitionId`);
CREATE INDEX `competition_heats_workout_idx` ON `competition_heats` (`trackWorkoutId`);
CREATE INDEX `competition_heats_time_idx` ON `competition_heats` (`scheduledTime`);
CREATE UNIQUE INDEX `competition_heats_workout_number_idx` ON `competition_heats` (`trackWorkoutId`,`heatNumber`);
CREATE TABLE `competition_registrations` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`eventId` text NOT NULL,
	`userId` text NOT NULL,
	`teamMemberId` text NOT NULL,
	`divisionId` text,
	`registeredAt` integer NOT NULL,
	`teamName` text(255),
	`captainUserId` text,
	`athleteTeamId` text,
	`pendingTeammates` text(5000),
	`metadata` text(10000),
	`commercePurchaseId` text,
	`paymentStatus` text(20),
	`paidAt` integer,
	FOREIGN KEY (`eventId`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`teamMemberId`) REFERENCES `team_membership`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`divisionId`) REFERENCES `scaling_levels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`captainUserId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`athleteTeamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE UNIQUE INDEX `competition_registrations_event_user_idx` ON `competition_registrations` (`eventId`,`userId`);
CREATE INDEX `competition_registrations_user_idx` ON `competition_registrations` (`userId`);
CREATE INDEX `competition_registrations_event_idx` ON `competition_registrations` (`eventId`);
CREATE INDEX `competition_registrations_division_idx` ON `competition_registrations` (`divisionId`);
CREATE INDEX `competition_registrations_captain_idx` ON `competition_registrations` (`captainUserId`);
CREATE INDEX `competition_registrations_athlete_team_idx` ON `competition_registrations` (`athleteTeamId`);
CREATE INDEX `competition_registrations_purchase_idx` ON `competition_registrations` (`commercePurchaseId`);
CREATE TABLE `competition_venues` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`competitionId` text NOT NULL,
	`name` text(100) NOT NULL,
	`laneCount` integer DEFAULT 3 NOT NULL,
	`transitionMinutes` integer DEFAULT 3 NOT NULL,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`competitionId`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `competition_venues_competition_idx` ON `competition_venues` (`competitionId`);
CREATE INDEX `competition_venues_sort_idx` ON `competition_venues` (`competitionId`,`sortOrder`);
CREATE TABLE `competitions` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`organizingTeamId` text NOT NULL,
	`competitionTeamId` text NOT NULL,
	`groupId` text,
	`slug` text(255) NOT NULL,
	`name` text(255) NOT NULL,
	`description` text(2000),
	`startDate` integer NOT NULL,
	`endDate` integer NOT NULL,
	`registrationOpensAt` integer,
	`registrationClosesAt` integer,
	`settings` text(10000),
	`defaultRegistrationFeeCents` integer DEFAULT 0,
	`platformFeePercentage` integer,
	`platformFeeFixed` integer,
	`passStripeFeesToCustomer` integer DEFAULT false,
	`passPlatformFeesToCustomer` integer DEFAULT true,
	`visibility` text(10) DEFAULT 'public' NOT NULL,
	`status` text(15) DEFAULT 'draft' NOT NULL,
	`profileImageUrl` text(600),
	`bannerImageUrl` text(600),
	FOREIGN KEY (`organizingTeamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`competitionTeamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`groupId`) REFERENCES `competition_groups`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE UNIQUE INDEX `competitions_slug_unique` ON `competitions` (`slug`);
CREATE INDEX `competitions_organizing_team_idx` ON `competitions` (`organizingTeamId`);
CREATE INDEX `competitions_competition_team_idx` ON `competitions` (`competitionTeamId`);
CREATE INDEX `competitions_group_idx` ON `competitions` (`groupId`);
CREATE INDEX `competitions_start_date_idx` ON `competitions` (`startDate`);
CREATE TABLE `entitlement` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`entitlementTypeId` text NOT NULL,
	`userId` text NOT NULL,
	`teamId` text,
	`sourceType` text NOT NULL,
	`sourceId` text NOT NULL,
	`metadata` text,
	`expiresAt` integer,
	`deletedAt` integer,
	FOREIGN KEY (`entitlementTypeId`) REFERENCES `entitlement_type`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `entitlement_user_id_idx` ON `entitlement` (`userId`);
CREATE INDEX `entitlement_team_id_idx` ON `entitlement` (`teamId`);
CREATE INDEX `entitlement_type_idx` ON `entitlement` (`entitlementTypeId`);
CREATE INDEX `entitlement_source_idx` ON `entitlement` (`sourceType`,`sourceId`);
CREATE INDEX `entitlement_deleted_at_idx` ON `entitlement` (`deletedAt`);
CREATE TABLE `entitlement_type` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`name` text(100) NOT NULL,
	`description` text(500)
);

CREATE UNIQUE INDEX `entitlement_type_name_unique` ON `entitlement_type` (`name`);
CREATE TABLE `feature` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`key` text(100) NOT NULL,
	`name` text(100) NOT NULL,
	`description` text(500),
	`category` text NOT NULL,
	`isActive` integer DEFAULT 1 NOT NULL
);

CREATE UNIQUE INDEX `feature_key_unique` ON `feature` (`key`);
CREATE TABLE `limit` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`key` text(100) NOT NULL,
	`name` text(100) NOT NULL,
	`description` text(500),
	`unit` text(50) NOT NULL,
	`resetPeriod` text DEFAULT 'never' NOT NULL,
	`isActive` integer DEFAULT 1 NOT NULL
);

CREATE UNIQUE INDEX `limit_key_unique` ON `limit` (`key`);
CREATE TABLE `plan_feature` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`planId` text NOT NULL,
	`featureId` text NOT NULL,
	FOREIGN KEY (`planId`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`featureId`) REFERENCES `feature`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `plan_feature_plan_id_idx` ON `plan_feature` (`planId`);
CREATE INDEX `plan_feature_feature_id_idx` ON `plan_feature` (`featureId`);
CREATE INDEX `plan_feature_unique_idx` ON `plan_feature` (`planId`,`featureId`);
CREATE TABLE `plan_limit` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`planId` text NOT NULL,
	`limitId` text NOT NULL,
	`value` integer NOT NULL,
	FOREIGN KEY (`planId`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`limitId`) REFERENCES `limit`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `plan_limit_plan_id_idx` ON `plan_limit` (`planId`);
CREATE INDEX `plan_limit_limit_id_idx` ON `plan_limit` (`limitId`);
CREATE INDEX `plan_limit_unique_idx` ON `plan_limit` (`planId`,`limitId`);
CREATE TABLE `plan` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`name` text(100) NOT NULL,
	`description` text(500),
	`price` integer NOT NULL,
	`interval` text,
	`isActive` integer DEFAULT 1 NOT NULL,
	`isPublic` integer DEFAULT 1 NOT NULL,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	`entitlements` text,
	`stripePriceId` text(255),
	`stripeProductId` text(255)
);

CREATE TABLE `team_addon` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`teamId` text NOT NULL,
	`addonId` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`status` text NOT NULL,
	`expiresAt` integer,
	`stripeSubscriptionItemId` text(255),
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `team_addon_team_id_idx` ON `team_addon` (`teamId`);
CREATE INDEX `team_addon_status_idx` ON `team_addon` (`status`);
CREATE TABLE `team_entitlement_override` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`teamId` text NOT NULL,
	`type` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`reason` text(500),
	`expiresAt` integer,
	`createdBy` text,
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`createdBy`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `team_entitlement_override_team_id_idx` ON `team_entitlement_override` (`teamId`);
CREATE INDEX `team_entitlement_override_type_idx` ON `team_entitlement_override` (`type`);
CREATE TABLE `team_feature_entitlement` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`teamId` text NOT NULL,
	`featureId` text NOT NULL,
	`source` text DEFAULT 'plan' NOT NULL,
	`sourcePlanId` text,
	`expiresAt` integer,
	`isActive` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`featureId`) REFERENCES `feature`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sourcePlanId`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `team_feature_entitlement_team_id_idx` ON `team_feature_entitlement` (`teamId`);
CREATE INDEX `team_feature_entitlement_feature_id_idx` ON `team_feature_entitlement` (`featureId`);
CREATE INDEX `team_feature_entitlement_unique_active_idx` ON `team_feature_entitlement` (`teamId`,`featureId`);
CREATE TABLE `team_limit_entitlement` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`teamId` text NOT NULL,
	`limitId` text NOT NULL,
	`value` integer NOT NULL,
	`source` text DEFAULT 'plan' NOT NULL,
	`sourcePlanId` text,
	`expiresAt` integer,
	`isActive` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`limitId`) REFERENCES `limit`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sourcePlanId`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `team_limit_entitlement_team_id_idx` ON `team_limit_entitlement` (`teamId`);
CREATE INDEX `team_limit_entitlement_limit_id_idx` ON `team_limit_entitlement` (`limitId`);
CREATE INDEX `team_limit_entitlement_unique_active_idx` ON `team_limit_entitlement` (`teamId`,`limitId`);
CREATE TABLE `team_subscription` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`teamId` text NOT NULL,
	`planId` text NOT NULL,
	`status` text NOT NULL,
	`currentPeriodStart` integer NOT NULL,
	`currentPeriodEnd` integer NOT NULL,
	`cancelAtPeriodEnd` integer DEFAULT 0 NOT NULL,
	`trialStart` integer,
	`trialEnd` integer,
	`stripeSubscriptionId` text(255),
	`stripeCustomerId` text(255),
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`planId`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `team_subscription_team_id_idx` ON `team_subscription` (`teamId`);
CREATE INDEX `team_subscription_status_idx` ON `team_subscription` (`status`);
CREATE TABLE `team_usage` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`teamId` text NOT NULL,
	`limitKey` text NOT NULL,
	`currentValue` integer DEFAULT 0 NOT NULL,
	`periodStart` integer NOT NULL,
	`periodEnd` integer NOT NULL,
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `team_usage_team_id_idx` ON `team_usage` (`teamId`);
CREATE INDEX `team_usage_limit_key_idx` ON `team_usage` (`limitKey`);
CREATE INDEX `team_usage_unique_idx` ON `team_usage` (`teamId`,`limitKey`,`periodStart`);
CREATE TABLE `organizer_request` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`teamId` text NOT NULL,
	`userId` text NOT NULL,
	`reason` text(2000) NOT NULL,
	`status` text(20) DEFAULT 'pending' NOT NULL,
	`adminNotes` text(2000),
	`reviewedBy` text,
	`reviewedAt` integer,
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewedBy`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `organizer_request_team_idx` ON `organizer_request` (`teamId`);
CREATE INDEX `organizer_request_user_idx` ON `organizer_request` (`userId`);
CREATE INDEX `organizer_request_status_idx` ON `organizer_request` (`status`);
CREATE TABLE `programming_track` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`name` text(255) NOT NULL,
	`description` text(1000),
	`type` text NOT NULL,
	`ownerTeamId` text,
	`scalingGroupId` text,
	`isPublic` integer DEFAULT 0 NOT NULL,
	`competitionId` text,
	FOREIGN KEY (`ownerTeamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`competitionId`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `programming_track_type_idx` ON `programming_track` (`type`);
CREATE INDEX `programming_track_owner_idx` ON `programming_track` (`ownerTeamId`);
CREATE INDEX `programming_track_scaling_idx` ON `programming_track` (`scalingGroupId`);
CREATE INDEX `programming_track_competition_idx` ON `programming_track` (`competitionId`);
CREATE TABLE `scheduled_workout_instance` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`teamId` text NOT NULL,
	`trackWorkoutId` text,
	`workoutId` text,
	`scheduledDate` integer NOT NULL,
	`teamSpecificNotes` text(1000),
	`scalingGuidanceForDay` text(1000),
	`classTimes` text(500),
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`trackWorkoutId`) REFERENCES `track_workout`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workoutId`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `scheduled_workout_instance_team_idx` ON `scheduled_workout_instance` (`teamId`);
CREATE INDEX `scheduled_workout_instance_date_idx` ON `scheduled_workout_instance` (`scheduledDate`);
CREATE INDEX `scheduled_workout_instance_workout_idx` ON `scheduled_workout_instance` (`workoutId`);
CREATE TABLE `team_programming_track` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`teamId` text NOT NULL,
	`trackId` text NOT NULL,
	`isActive` integer DEFAULT 1 NOT NULL,
	`subscribedAt` integer NOT NULL,
	`startDayOffset` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`teamId`, `trackId`),
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`trackId`) REFERENCES `programming_track`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `team_programming_track_active_idx` ON `team_programming_track` (`isActive`);
CREATE INDEX `team_programming_track_team_idx` ON `team_programming_track` (`teamId`);
CREATE TABLE `track_workout` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`trackId` text NOT NULL,
	`workoutId` text NOT NULL,
	`trackOrder` integer NOT NULL,
	`notes` text(1000),
	`pointsMultiplier` integer DEFAULT 100,
	`heatStatus` text(20) DEFAULT 'draft',
	`eventStatus` text(20) DEFAULT 'draft',
	`sponsorId` text,
	FOREIGN KEY (`trackId`) REFERENCES `programming_track`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workoutId`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sponsorId`) REFERENCES `sponsors`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE INDEX `track_workout_track_idx` ON `track_workout` (`trackId`);
CREATE INDEX `track_workout_order_idx` ON `track_workout` (`trackOrder`);
CREATE INDEX `track_workout_workoutid_idx` ON `track_workout` (`workoutId`);
CREATE INDEX `track_workout_unique_idx` ON `track_workout` (`trackId`,`workoutId`,`trackOrder`);
CREATE INDEX `track_workout_sponsor_idx` ON `track_workout` (`sponsorId`);
CREATE TABLE `scaling_groups` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`title` text(255) NOT NULL,
	`description` text(1000),
	`teamId` text,
	`isDefault` integer DEFAULT 0 NOT NULL,
	`isSystem` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `scaling_groups_team_idx` ON `scaling_groups` (`teamId`);
CREATE INDEX `scaling_groups_default_idx` ON `scaling_groups` (`isDefault`);
CREATE INDEX `scaling_groups_system_idx` ON `scaling_groups` (`isSystem`);
CREATE TABLE `scaling_levels` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`scalingGroupId` text NOT NULL,
	`label` text(100) NOT NULL,
	`position` integer NOT NULL,
	`teamSize` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`scalingGroupId`) REFERENCES `scaling_groups`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `scaling_levels_group_idx` ON `scaling_levels` (`scalingGroupId`);
CREATE INDEX `scaling_levels_position_idx` ON `scaling_levels` (`scalingGroupId`,`position`);
CREATE TABLE `workout_scaling_descriptions` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`workoutId` text NOT NULL,
	`scalingLevelId` text NOT NULL,
	`description` text(2000),
	FOREIGN KEY (`workoutId`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scalingLevelId`) REFERENCES `scaling_levels`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `workout_scaling_desc_workout_idx` ON `workout_scaling_descriptions` (`workoutId`);
CREATE UNIQUE INDEX `workout_scaling_desc_unique_idx` ON `workout_scaling_descriptions` (`workoutId`,`scalingLevelId`);
CREATE TABLE `class_catalog` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`duration_minutes` integer DEFAULT 60 NOT NULL,
	`max_participants` integer DEFAULT 20 NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `class_catalog_to_skills` (
	`class_catalog_id` text NOT NULL,
	`skill_id` text NOT NULL,
	PRIMARY KEY(`class_catalog_id`, `skill_id`),
	FOREIGN KEY (`class_catalog_id`) REFERENCES `class_catalog`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `coach_blackout_dates` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`coach_id` text NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer NOT NULL,
	`reason` text,
	FOREIGN KEY (`coach_id`) REFERENCES `coaches`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `coach_recurring_unavailability` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`coach_id` text NOT NULL,
	`day_of_week` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`description` text,
	FOREIGN KEY (`coach_id`) REFERENCES `coaches`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `coach_to_skills` (
	`coach_id` text NOT NULL,
	`skill_id` text NOT NULL,
	PRIMARY KEY(`coach_id`, `skill_id`),
	FOREIGN KEY (`coach_id`) REFERENCES `coaches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `coaches` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`team_id` text NOT NULL,
	`weekly_class_limit` integer,
	`scheduling_preference` text,
	`scheduling_notes` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `coach_user_team_unique_idx` ON `coaches` (`user_id`,`team_id`);
CREATE TABLE `generated_schedules` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`location_id` text NOT NULL,
	`week_start_date` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `locations` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`name` text NOT NULL,
	`capacity` integer DEFAULT 20 NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `schedule_template_class_required_skills` (
	`template_class_id` text NOT NULL,
	`skill_id` text NOT NULL,
	PRIMARY KEY(`template_class_id`, `skill_id`),
	FOREIGN KEY (`template_class_id`) REFERENCES `schedule_template_classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `schedule_template_classes` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`day_of_week` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`required_coaches` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `schedule_templates`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `schedule_templates` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`name` text NOT NULL,
	`class_catalog_id` text NOT NULL,
	`location_id` text NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`class_catalog_id`) REFERENCES `class_catalog`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `scheduled_classes` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`schedule_id` text NOT NULL,
	`coach_id` text,
	`class_catalog_id` text NOT NULL,
	`location_id` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	FOREIGN KEY (`schedule_id`) REFERENCES `generated_schedules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`coach_id`) REFERENCES `coaches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`class_catalog_id`) REFERENCES `class_catalog`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `skills` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `score_rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`score_id` text NOT NULL,
	`round_number` integer NOT NULL,
	`value` integer NOT NULL,
	`scheme_override` text,
	`status` text,
	`secondary_value` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`score_id`) REFERENCES `scores`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `idx_score_rounds_score` ON `score_rounds` (`score_id`,`round_number`);
CREATE UNIQUE INDEX `idx_score_rounds_unique` ON `score_rounds` (`score_id`,`round_number`);
CREATE TABLE `scores` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`team_id` text NOT NULL,
	`workout_id` text NOT NULL,
	`competition_event_id` text,
	`scheduled_workout_instance_id` text,
	`scheme` text NOT NULL,
	`score_type` text DEFAULT 'max' NOT NULL,
	`score_value` integer,
	`tiebreak_scheme` text,
	`tiebreak_value` integer,
	`time_cap_ms` integer,
	`secondary_value` integer,
	`status` text DEFAULT 'scored' NOT NULL,
	`status_order` integer DEFAULT 0 NOT NULL,
	`sort_key` text,
	`scaling_level_id` text,
	`as_rx` integer DEFAULT false NOT NULL,
	`notes` text,
	`recorded_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`scaling_level_id`) REFERENCES `scaling_levels`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `idx_scores_user` ON `scores` (`user_id`,`recorded_at`);
CREATE INDEX `idx_scores_workout` ON `scores` (`workout_id`,`team_id`,`status_order`,`sort_key`);
CREATE INDEX `idx_scores_competition` ON `scores` (`competition_event_id`,`status_order`,`sort_key`);
CREATE INDEX `idx_scores_scheduled` ON `scores` (`scheduled_workout_instance_id`);
CREATE UNIQUE INDEX `idx_scores_competition_user_unique` ON `scores` (`competition_event_id`,`user_id`);
CREATE TABLE `sponsor_groups` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`competitionId` text NOT NULL,
	`name` text(100) NOT NULL,
	`displayOrder` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`competitionId`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `sponsor_groups_competition_idx` ON `sponsor_groups` (`competitionId`);
CREATE INDEX `sponsor_groups_order_idx` ON `sponsor_groups` (`competitionId`,`displayOrder`);
CREATE TABLE `sponsors` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`competitionId` text,
	`userId` text,
	`groupId` text,
	`name` text(255) NOT NULL,
	`logoUrl` text(600),
	`website` text(600),
	`displayOrder` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`competitionId`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`groupId`) REFERENCES `sponsor_groups`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE INDEX `sponsors_competition_idx` ON `sponsors` (`competitionId`);
CREATE INDEX `sponsors_user_idx` ON `sponsors` (`userId`);
CREATE INDEX `sponsors_group_idx` ON `sponsors` (`groupId`);
CREATE INDEX `sponsors_competition_order_idx` ON `sponsors` (`competitionId`,`groupId`,`displayOrder`);
CREATE INDEX `sponsors_user_order_idx` ON `sponsors` (`userId`,`displayOrder`);
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

CREATE UNIQUE INDEX `team_invitation_token_unique` ON `team_invitation` (`token`);
CREATE INDEX `team_invitation_team_id_idx` ON `team_invitation` (`teamId`);
CREATE INDEX `team_invitation_email_idx` ON `team_invitation` (`email`);
CREATE INDEX `team_invitation_token_idx` ON `team_invitation` (`token`);
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

CREATE INDEX `team_membership_team_id_idx` ON `team_membership` (`teamId`);
CREATE INDEX `team_membership_user_id_idx` ON `team_membership` (`userId`);
CREATE INDEX `team_membership_unique_idx` ON `team_membership` (`teamId`,`userId`);
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

CREATE INDEX `team_role_team_id_idx` ON `team_role` (`teamId`);
CREATE INDEX `team_role_name_unique_idx` ON `team_role` (`teamId`,`name`);
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
	`currentPlanId` text(100),
	`defaultTrackId` text,
	`defaultScalingGroupId` text,
	`isPersonalTeam` integer DEFAULT 0 NOT NULL,
	`personalTeamOwnerId` text,
	`type` text(50) DEFAULT 'gym' NOT NULL,
	`parentOrganizationId` text,
	`competitionMetadata` text(10000),
	`stripeConnectedAccountId` text,
	`stripeAccountStatus` text(20),
	`stripeAccountType` text(20),
	`stripeOnboardingCompletedAt` integer,
	FOREIGN KEY (`personalTeamOwnerId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parentOrganizationId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `team_slug_unique` ON `team` (`slug`);
CREATE INDEX `team_slug_idx` ON `team` (`slug`);
CREATE INDEX `team_personal_owner_idx` ON `team` (`personalTeamOwnerId`);
CREATE INDEX `team_default_scaling_idx` ON `team` (`defaultScalingGroupId`);
CREATE INDEX `team_type_idx` ON `team` (`type`);
CREATE INDEX `team_parent_org_idx` ON `team` (`parentOrganizationId`);
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
	`ipAddress` text(128),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX `passkey_credential_credentialId_unique` ON `passkey_credential` (`credentialId`);
CREATE INDEX `user_id_idx` ON `passkey_credential` (`userId`);
CREATE INDEX `credential_id_idx` ON `passkey_credential` (`credentialId`);
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
	`signUpIpAddress` text(128),
	`googleAccountId` text(255),
	`avatar` text(600),
	`currentCredits` integer DEFAULT 0 NOT NULL,
	`lastCreditRefreshAt` integer,
	`gender` text,
	`dateOfBirth` integer,
	`affiliateName` text(255),
	`athleteProfile` text(10000)
);

CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);
CREATE INDEX `email_idx` ON `user` (`email`);
CREATE INDEX `google_account_id_idx` ON `user` (`googleAccountId`);
CREATE INDEX `role_idx` ON `user` (`role`);
CREATE INDEX `user_gender_idx` ON `user` (`gender`);
CREATE INDEX `user_dob_idx` ON `user` (`dateOfBirth`);
CREATE TABLE `movements` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL
);

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
	`scaling_level_id` text,
	`as_rx` integer DEFAULT false NOT NULL,
	`wod_score` text,
	`set_count` integer,
	`distance` integer,
	`time` integer,
	`competition_event_id` text,
	`competition_registration_id` text,
	`score_status` text,
	`tie_break_score` text,
	`secondary_score` text,
	`entered_by` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`competition_event_id`) REFERENCES `track_workout`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`competition_registration_id`) REFERENCES `competition_registrations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`entered_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE INDEX `results_scaling_level_idx` ON `results` (`scaling_level_id`);
CREATE INDEX `results_workout_scaling_idx` ON `results` (`workout_id`,`scaling_level_id`);
CREATE INDEX `results_leaderboard_idx` ON `results` (`workout_id`,`scaling_level_id`,`wod_score`);
CREATE INDEX `results_user_idx` ON `results` (`user_id`);
CREATE INDEX `results_date_idx` ON `results` (`date`);
CREATE INDEX `results_workout_idx` ON `results` (`workout_id`);
CREATE INDEX `results_competition_event_idx` ON `results` (`competition_event_id`,`scaling_level_id`);
CREATE UNIQUE INDEX `results_competition_unique_idx` ON `results` (`competition_event_id`,`user_id`);
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
	FOREIGN KEY (`result_id`) REFERENCES `results`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `spicy_tags` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);

CREATE UNIQUE INDEX `spicy_tags_name_unique` ON `spicy_tags` (`name`);
CREATE TABLE `workout_movements` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`workout_id` text,
	`movement_id` text,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`movement_id`) REFERENCES `movements`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `workout_tags` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`workout_id` text NOT NULL,
	`tag_id` text NOT NULL,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `spicy_tags`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `workouts` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`scope` text DEFAULT 'private' NOT NULL,
	`scheme` text NOT NULL,
	`score_type` text,
	`reps_per_round` integer,
	`rounds_to_score` integer DEFAULT 1,
	`team_id` text,
	`sugar_id` text,
	`tiebreak_scheme` text,
	`time_cap` integer,
	`source_track_id` text,
	`source_workout_id` text,
	`scaling_group_id` text,
	FOREIGN KEY (`team_id`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_track_id`) REFERENCES `programming_track`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE INDEX `workouts_scaling_group_idx` ON `workouts` (`scaling_group_id`);
CREATE INDEX `workouts_team_idx` ON `workouts` (`team_id`);
CREATE INDEX `workouts_source_track_idx` ON `workouts` (`source_track_id`);
