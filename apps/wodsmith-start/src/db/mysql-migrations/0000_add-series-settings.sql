CREATE TABLE `addresses` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`address_type` varchar(20),
	`name` varchar(255),
	`street_line1` varchar(500),
	`street_line2` varchar(500),
	`city` varchar(255),
	`state_province` varchar(255),
	`postal_code` varchar(50),
	`country_code` varchar(2),
	`notes` text,
	CONSTRAINT `addresses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `affiliates` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`location` varchar(255),
	`verification_status` varchar(255) NOT NULL DEFAULT 'unverified',
	`owner_team_id` varchar(255),
	CONSTRAINT `affiliates_id` PRIMARY KEY(`id`),
	CONSTRAINT `affiliates_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `credit_transactions` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`amount` int NOT NULL,
	`remaining_amount` int NOT NULL DEFAULT 0,
	`type` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`expiration_date` datetime,
	`expiration_date_processed_at` datetime,
	`payment_intent_id` varchar(255),
	CONSTRAINT `credit_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchased_items` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`item_type` varchar(255) NOT NULL,
	`item_id` varchar(255) NOT NULL,
	`purchased_at` datetime NOT NULL,
	CONSTRAINT `purchased_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `commerce_products` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` varchar(50) NOT NULL,
	`resource_id` varchar(255) NOT NULL,
	`price_cents` int NOT NULL,
	CONSTRAINT `commerce_products_id` PRIMARY KEY(`id`),
	CONSTRAINT `commerce_product_resource_idx` UNIQUE(`type`,`resource_id`)
);
--> statement-breakpoint
CREATE TABLE `commerce_purchases` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`product_id` varchar(255) NOT NULL,
	`status` varchar(20) NOT NULL,
	`competition_id` varchar(255),
	`division_id` varchar(255),
	`total_cents` int NOT NULL,
	`platform_fee_cents` int NOT NULL,
	`stripe_fee_cents` int NOT NULL,
	`organizer_net_cents` int NOT NULL,
	`stripe_checkout_session_id` varchar(255),
	`stripe_payment_intent_id` varchar(255),
	`metadata` text,
	`completed_at` datetime,
	CONSTRAINT `commerce_purchases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `competition_divisions` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`competition_id` varchar(255) NOT NULL,
	`division_id` varchar(255) NOT NULL,
	`fee_cents` int NOT NULL,
	`description` text,
	`max_spots` int,
	CONSTRAINT `competition_divisions_id` PRIMARY KEY(`id`),
	CONSTRAINT `competition_divisions_unique_idx` UNIQUE(`competition_id`,`division_id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_transfers` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`purchase_id` varchar(255) NOT NULL,
	`source_user_id` varchar(255) NOT NULL,
	`target_email` varchar(255) NOT NULL,
	`accepted_email` varchar(255),
	`target_user_id` varchar(255),
	`transfer_state` varchar(20) NOT NULL DEFAULT 'INITIATED',
	`initiated_by` varchar(255) NOT NULL,
	`expires_at` datetime NOT NULL,
	`completed_at` datetime,
	`cancelled_at` datetime,
	`notes` text,
	CONSTRAINT `purchase_transfers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `competition_events` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`competition_id` varchar(255) NOT NULL,
	`track_workout_id` varchar(255) NOT NULL,
	`submission_opens_at` varchar(255),
	`submission_closes_at` varchar(255),
	CONSTRAINT `competition_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `competition_events_comp_workout_idx` UNIQUE(`competition_id`,`track_workout_id`)
);
--> statement-breakpoint
CREATE TABLE `competition_groups` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`organizing_team_id` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`settings` text,
	CONSTRAINT `competition_groups_id` PRIMARY KEY(`id`),
	CONSTRAINT `competition_groups_org_slug_idx` UNIQUE(`organizing_team_id`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `competition_heat_assignments` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`heat_id` varchar(255) NOT NULL,
	`registration_id` varchar(255) NOT NULL,
	`lane_number` int NOT NULL,
	CONSTRAINT `competition_heat_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `competition_heat_assignments_reg_idx` UNIQUE(`heat_id`,`registration_id`),
	CONSTRAINT `competition_heat_assignments_lane_idx` UNIQUE(`heat_id`,`lane_number`)
);
--> statement-breakpoint
CREATE TABLE `competition_heats` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`competition_id` varchar(255) NOT NULL,
	`track_workout_id` varchar(255) NOT NULL,
	`venue_id` varchar(255),
	`heat_number` int NOT NULL,
	`scheduled_time` datetime,
	`duration_minutes` int,
	`division_id` varchar(255),
	`notes` text,
	`schedule_published_at` datetime,
	CONSTRAINT `competition_heats_id` PRIMARY KEY(`id`),
	CONSTRAINT `competition_heats_workout_number_idx` UNIQUE(`track_workout_id`,`heat_number`)
);
--> statement-breakpoint
CREATE TABLE `competition_registration_answers` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`question_id` varchar(255) NOT NULL,
	`registration_id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`answer` text NOT NULL,
	CONSTRAINT `competition_registration_answers_id` PRIMARY KEY(`id`),
	CONSTRAINT `comp_reg_answers_unique_idx` UNIQUE(`question_id`,`registration_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `competition_registration_questions` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`competition_id` varchar(255),
	`group_id` varchar(255),
	`type` varchar(20) NOT NULL,
	`label` varchar(500) NOT NULL,
	`help_text` text,
	`options` text,
	`required` boolean NOT NULL DEFAULT true,
	`for_teammates` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`question_target` varchar(20) NOT NULL DEFAULT 'athlete',
	CONSTRAINT `competition_registration_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `competition_registrations` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`event_id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`team_member_id` varchar(255) NOT NULL,
	`division_id` varchar(255),
	`registered_at` datetime NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'active',
	`team_name` varchar(255),
	`captain_user_id` varchar(255),
	`athlete_team_id` varchar(255),
	`pending_teammates` text,
	`metadata` text,
	`commerce_purchase_id` varchar(255),
	`payment_status` varchar(20),
	`paid_at` datetime,
	CONSTRAINT `competition_registrations_id` PRIMARY KEY(`id`),
	CONSTRAINT `competition_registrations_event_user_division_idx` UNIQUE(`event_id`,`user_id`,`division_id`)
);
--> statement-breakpoint
CREATE TABLE `competition_venues` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`competition_id` varchar(255) NOT NULL,
	`name` varchar(100) NOT NULL,
	`lane_count` int NOT NULL DEFAULT 3,
	`transition_minutes` int NOT NULL DEFAULT 3,
	`sort_order` int NOT NULL DEFAULT 0,
	`address_id` varchar(255),
	CONSTRAINT `competition_venues_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `competitions` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`organizing_team_id` varchar(255) NOT NULL,
	`competition_team_id` varchar(255) NOT NULL,
	`group_id` varchar(255),
	`slug` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`start_date` varchar(255) NOT NULL,
	`end_date` varchar(255) NOT NULL,
	`registration_opens_at` varchar(255),
	`registration_closes_at` varchar(255),
	`timezone` varchar(50) DEFAULT 'America/Denver',
	`settings` text,
	`default_registration_fee_cents` int DEFAULT 0,
	`platform_fee_percentage` int,
	`platform_fee_fixed` int,
	`pass_stripe_fees_to_customer` boolean DEFAULT false,
	`pass_platform_fees_to_customer` boolean DEFAULT true,
	`visibility` varchar(10) NOT NULL DEFAULT 'public',
	`status` varchar(15) NOT NULL DEFAULT 'draft',
	`competition_type` varchar(15) NOT NULL DEFAULT 'in-person',
	`profile_image_url` varchar(600),
	`banner_image_url` varchar(600),
	`default_heats_per_rotation` int DEFAULT 4,
	`default_lane_shift_pattern` varchar(20) DEFAULT 'shift_right',
	`default_max_spots_per_division` int,
	`primary_address_id` varchar(255),
	CONSTRAINT `competitions_id` PRIMARY KEY(`id`),
	CONSTRAINT `competitions_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `volunteer_registration_answers` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`question_id` varchar(255) NOT NULL,
	`invitation_id` varchar(255) NOT NULL,
	`answer` text NOT NULL,
	CONSTRAINT `volunteer_registration_answers_id` PRIMARY KEY(`id`),
	CONSTRAINT `vol_reg_answers_unique_idx` UNIQUE(`question_id`,`invitation_id`)
);
--> statement-breakpoint
CREATE TABLE `entitlements` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`entitlement_type_id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`team_id` varchar(255),
	`source_type` varchar(255) NOT NULL,
	`source_id` varchar(255) NOT NULL,
	`metadata` json,
	`expires_at` datetime,
	`deleted_at` datetime,
	CONSTRAINT `entitlements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `entitlement_types` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	CONSTRAINT `entitlement_types_id` PRIMARY KEY(`id`),
	CONSTRAINT `entitlement_types_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `features` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`key` varchar(100) NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`category` varchar(255) NOT NULL,
	`is_active` int NOT NULL DEFAULT 1,
	CONSTRAINT `features_id` PRIMARY KEY(`id`),
	CONSTRAINT `features_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `limits` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`key` varchar(100) NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`unit` varchar(50) NOT NULL,
	`reset_period` varchar(255) NOT NULL DEFAULT 'never',
	`is_active` int NOT NULL DEFAULT 1,
	CONSTRAINT `limits_id` PRIMARY KEY(`id`),
	CONSTRAINT `limits_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `plan_features` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`plan_id` varchar(255) NOT NULL,
	`feature_id` varchar(255) NOT NULL,
	CONSTRAINT `plan_features_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `plan_limits` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`plan_id` varchar(255) NOT NULL,
	`limit_id` varchar(255) NOT NULL,
	`value` int NOT NULL,
	CONSTRAINT `plan_limits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`price` int NOT NULL,
	`interval` varchar(255),
	`is_active` int NOT NULL DEFAULT 1,
	`is_public` int NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	`entitlements` json,
	`stripe_price_id` varchar(255),
	`stripe_product_id` varchar(255),
	CONSTRAINT `plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `team_addons` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`addon_id` varchar(255) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`status` varchar(255) NOT NULL,
	`expires_at` datetime,
	`stripe_subscription_item_id` varchar(255),
	CONSTRAINT `team_addons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `team_entitlement_overrides` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`type` varchar(255) NOT NULL,
	`key` varchar(255) NOT NULL,
	`value` varchar(255) NOT NULL,
	`reason` text,
	`expires_at` datetime,
	`created_by` varchar(255),
	CONSTRAINT `team_entitlement_overrides_id` PRIMARY KEY(`id`),
	CONSTRAINT `team_entitlement_override_team_type_key_unique` UNIQUE(`team_id`,`type`,`key`)
);
--> statement-breakpoint
CREATE TABLE `team_feature_entitlements` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`feature_id` varchar(255) NOT NULL,
	`source` varchar(255) NOT NULL DEFAULT 'plan',
	`source_plan_id` varchar(255),
	`expires_at` datetime,
	`is_active` int NOT NULL DEFAULT 1,
	CONSTRAINT `team_feature_entitlements_id` PRIMARY KEY(`id`),
	CONSTRAINT `team_feature_entitlement_team_feature_unique` UNIQUE(`team_id`,`feature_id`)
);
--> statement-breakpoint
CREATE TABLE `team_limit_entitlements` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`limit_id` varchar(255) NOT NULL,
	`value` int NOT NULL,
	`source` varchar(255) NOT NULL DEFAULT 'plan',
	`source_plan_id` varchar(255),
	`expires_at` datetime,
	`is_active` int NOT NULL DEFAULT 1,
	CONSTRAINT `team_limit_entitlements_id` PRIMARY KEY(`id`),
	CONSTRAINT `team_limit_entitlement_team_limit_unique` UNIQUE(`team_id`,`limit_id`)
);
--> statement-breakpoint
CREATE TABLE `team_subscriptions` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`plan_id` varchar(255) NOT NULL,
	`status` varchar(255) NOT NULL,
	`current_period_start` datetime NOT NULL,
	`current_period_end` datetime NOT NULL,
	`cancel_at_period_end` int NOT NULL DEFAULT 0,
	`trial_start` datetime,
	`trial_end` datetime,
	`stripe_subscription_id` varchar(255),
	`stripe_customer_id` varchar(255),
	CONSTRAINT `team_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `team_usages` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`limit_key` varchar(255) NOT NULL,
	`current_value` int NOT NULL DEFAULT 0,
	`period_start` datetime NOT NULL,
	`period_end` datetime NOT NULL,
	CONSTRAINT `team_usages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event_resources` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`event_id` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`url` varchar(2048),
	`sort_order` int NOT NULL DEFAULT 1,
	CONSTRAINT `event_resources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event_judging_sheets` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`competition_id` varchar(255) NOT NULL,
	`track_workout_id` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL,
	`r2_key` varchar(600) NOT NULL,
	`url` varchar(600) NOT NULL,
	`original_filename` varchar(255) NOT NULL,
	`file_size` int NOT NULL,
	`mime_type` varchar(100) NOT NULL,
	`uploaded_by` varchar(255) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `event_judging_sheets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `submission_window_notifications` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`competition_id` varchar(255) NOT NULL,
	`competition_event_id` varchar(255) NOT NULL,
	`registration_id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`type` varchar(255) NOT NULL,
	`sent_to_email` varchar(255),
	CONSTRAINT `submission_window_notifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `submission_window_notif_unique_idx` UNIQUE(`competition_event_id`,`registration_id`,`type`)
);
--> statement-breakpoint
CREATE TABLE `organizer_requests` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`reason` text NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`admin_notes` text,
	`reviewed_by` varchar(255),
	`reviewed_at` datetime,
	CONSTRAINT `organizer_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `programming_tracks` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`type` varchar(255) NOT NULL,
	`owner_team_id` varchar(255),
	`scaling_group_id` varchar(255),
	`is_public` int NOT NULL DEFAULT 0,
	`competition_id` varchar(255),
	CONSTRAINT `programming_tracks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduled_workout_instances` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`track_workout_id` varchar(255),
	`workout_id` varchar(255),
	`scheduled_date` datetime NOT NULL,
	`team_specific_notes` text,
	`scaling_guidance_for_day` text,
	`class_times` text,
	CONSTRAINT `scheduled_workout_instances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `team_programming_tracks` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`team_id` varchar(255) NOT NULL,
	`track_id` varchar(255) NOT NULL,
	`is_active` int NOT NULL DEFAULT 1,
	`subscribed_at` datetime NOT NULL,
	`start_day_offset` int NOT NULL DEFAULT 0,
	CONSTRAINT `team_programming_tracks_team_id_track_id_pk` PRIMARY KEY(`team_id`,`track_id`)
);
--> statement-breakpoint
CREATE TABLE `track_workouts` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`track_id` varchar(255) NOT NULL,
	`workout_id` varchar(255) NOT NULL,
	`track_order` int NOT NULL,
	`notes` text,
	`points_multiplier` int DEFAULT 100,
	`heat_status` varchar(20) DEFAULT 'draft',
	`event_status` varchar(20) DEFAULT 'draft',
	`sponsor_id` varchar(255),
	`default_heats_count` int,
	`default_lane_shift_pattern` varchar(20),
	`min_heat_buffer` int DEFAULT 2,
	CONSTRAINT `track_workouts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scaling_groups` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`team_id` varchar(255),
	`is_default` boolean NOT NULL DEFAULT false,
	`is_system` boolean NOT NULL DEFAULT false,
	CONSTRAINT `scaling_groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scaling_levels` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`scaling_group_id` varchar(255) NOT NULL,
	`label` varchar(100) NOT NULL,
	`position` int NOT NULL,
	`team_size` int NOT NULL DEFAULT 1,
	CONSTRAINT `scaling_levels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workout_scaling_descriptions` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`workout_id` varchar(255) NOT NULL,
	`scaling_level_id` varchar(255) NOT NULL,
	`description` text,
	CONSTRAINT `workout_scaling_descriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `workout_scaling_desc_unique_idx` UNIQUE(`workout_id`,`scaling_level_id`)
);
--> statement-breakpoint
CREATE TABLE `class_catalogs` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`duration_minutes` int NOT NULL DEFAULT 60,
	`max_participants` int NOT NULL DEFAULT 20,
	CONSTRAINT `class_catalogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `class_catalog_to_skills` (
	`class_catalog_id` varchar(255) NOT NULL,
	`skill_id` varchar(255) NOT NULL,
	CONSTRAINT `class_catalog_to_skills_class_catalog_id_skill_id_pk` PRIMARY KEY(`class_catalog_id`,`skill_id`)
);
--> statement-breakpoint
CREATE TABLE `coach_blackout_dates` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`coach_id` varchar(255) NOT NULL,
	`start_date` datetime NOT NULL,
	`end_date` datetime NOT NULL,
	`reason` text,
	CONSTRAINT `coach_blackout_dates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coach_recurring_unavailability` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`coach_id` varchar(255) NOT NULL,
	`day_of_week` int NOT NULL,
	`start_time` varchar(255) NOT NULL,
	`end_time` varchar(255) NOT NULL,
	`description` text,
	CONSTRAINT `coach_recurring_unavailability_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coach_to_skills` (
	`coach_id` varchar(255) NOT NULL,
	`skill_id` varchar(255) NOT NULL,
	CONSTRAINT `coach_to_skills_coach_id_skill_id_pk` PRIMARY KEY(`coach_id`,`skill_id`)
);
--> statement-breakpoint
CREATE TABLE `coaches` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`weekly_class_limit` int,
	`scheduling_preference` varchar(255),
	`scheduling_notes` text,
	`is_active` boolean DEFAULT true,
	CONSTRAINT `coaches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `generated_schedules` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`location_id` varchar(255) NOT NULL,
	`week_start_date` datetime NOT NULL,
	CONSTRAINT `generated_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`capacity` int NOT NULL DEFAULT 20,
	CONSTRAINT `locations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `schedule_template_class_required_skills` (
	`template_class_id` varchar(255) NOT NULL,
	`skill_id` varchar(255) NOT NULL,
	CONSTRAINT `sched_class_skills_pk` PRIMARY KEY(`template_class_id`,`skill_id`)
);
--> statement-breakpoint
CREATE TABLE `schedule_template_classes` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`template_id` varchar(255) NOT NULL,
	`day_of_week` int NOT NULL,
	`start_time` varchar(255) NOT NULL,
	`end_time` varchar(255) NOT NULL,
	`required_coaches` int NOT NULL DEFAULT 1,
	CONSTRAINT `schedule_template_classes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `schedule_templates` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`class_catalog_id` varchar(255) NOT NULL,
	`location_id` varchar(255) NOT NULL,
	CONSTRAINT `schedule_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduled_classes` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`schedule_id` varchar(255) NOT NULL,
	`coach_id` varchar(255),
	`class_catalog_id` varchar(255) NOT NULL,
	`location_id` varchar(255) NOT NULL,
	`start_time` datetime NOT NULL,
	`end_time` datetime NOT NULL,
	CONSTRAINT `scheduled_classes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `skills` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	CONSTRAINT `skills_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `score_rounds` (
	`id` varchar(255) NOT NULL,
	`score_id` varchar(255) NOT NULL,
	`round_number` int NOT NULL,
	`value` int NOT NULL,
	`scheme_override` varchar(255),
	`status` varchar(255),
	`secondary_value` int,
	`notes` text,
	`created_at` datetime NOT NULL,
	CONSTRAINT `score_rounds_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_score_rounds_unique` UNIQUE(`score_id`,`round_number`)
);
--> statement-breakpoint
CREATE TABLE `scores` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`workout_id` varchar(255) NOT NULL,
	`competition_event_id` varchar(255),
	`scheduled_workout_instance_id` varchar(255),
	`scheme` varchar(255) NOT NULL,
	`score_type` varchar(255) NOT NULL DEFAULT 'max',
	`score_value` int,
	`tiebreak_scheme` varchar(255),
	`tiebreak_value` int,
	`time_cap_ms` int,
	`secondary_value` int,
	`status` varchar(255) NOT NULL DEFAULT 'scored',
	`status_order` int NOT NULL DEFAULT 0,
	`sort_key` varchar(255),
	`scaling_level_id` varchar(255),
	`as_rx` boolean NOT NULL DEFAULT false,
	`notes` text,
	`recorded_at` datetime NOT NULL,
	CONSTRAINT `scores_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_scores_competition_user_unique` UNIQUE(`competition_event_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `sponsor_groups` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`competition_id` varchar(255) NOT NULL,
	`name` varchar(100) NOT NULL,
	`display_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `sponsor_groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sponsors` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`competition_id` varchar(255),
	`user_id` varchar(255),
	`group_id` varchar(255),
	`name` varchar(255) NOT NULL,
	`logo_url` varchar(600),
	`website` varchar(600),
	`display_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `sponsors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `team_invitations` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`role_id` varchar(255) NOT NULL,
	`is_system_role` boolean NOT NULL DEFAULT true,
	`token` varchar(255) NOT NULL,
	`invited_by` varchar(255),
	`expires_at` datetime NOT NULL,
	`accepted_at` datetime,
	`accepted_by` varchar(255),
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`metadata` text,
	CONSTRAINT `team_invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `team_invitations_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `team_memberships` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`role_id` varchar(255) NOT NULL,
	`is_system_role` boolean NOT NULL DEFAULT true,
	`invited_by` varchar(255),
	`invited_at` datetime,
	`joined_at` datetime,
	`expires_at` datetime,
	`is_active` boolean NOT NULL DEFAULT true,
	`metadata` text,
	CONSTRAINT `team_memberships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `team_roles` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`permissions` json NOT NULL,
	`metadata` text,
	`is_editable` boolean NOT NULL DEFAULT true,
	CONSTRAINT `team_roles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` text,
	`avatar_url` varchar(600),
	`settings` text,
	`billing_email` varchar(255),
	`plan_id` varchar(100),
	`plan_expires_at` datetime,
	`credit_balance` int NOT NULL DEFAULT 0,
	`current_plan_id` varchar(100),
	`default_track_id` varchar(255),
	`default_scaling_group_id` varchar(255),
	`is_personal_team` boolean NOT NULL DEFAULT false,
	`personal_team_owner_id` varchar(255),
	`type` varchar(50) NOT NULL DEFAULT 'gym',
	`parent_organization_id` varchar(255),
	`competition_metadata` text,
	`stripe_connected_account_id` varchar(255),
	`stripe_account_status` varchar(20),
	`stripe_account_type` varchar(20),
	`stripe_onboarding_completed_at` datetime,
	`organizer_fee_percentage` int,
	`organizer_fee_fixed` int,
	CONSTRAINT `teams_id` PRIMARY KEY(`id`),
	CONSTRAINT `teams_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `passkey_credentials` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`credential_id` varchar(255) NOT NULL,
	`credential_public_key` varchar(255) NOT NULL,
	`counter` int NOT NULL,
	`transports` varchar(255),
	`aaguid` varchar(255),
	`user_agent` varchar(255),
	`ip_address` varchar(128),
	CONSTRAINT `passkey_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `passkey_credentials_credentialId_unique` UNIQUE(`credential_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`first_name` varchar(255),
	`last_name` varchar(255),
	`email` varchar(255),
	`password_hash` varchar(255),
	`role` varchar(50) NOT NULL DEFAULT 'user',
	`email_verified` datetime,
	`sign_up_ip_address` varchar(128),
	`google_account_id` varchar(255),
	`avatar` varchar(600),
	`current_credits` int NOT NULL DEFAULT 0,
	`last_credit_refresh_at` datetime,
	`gender` varchar(50),
	`date_of_birth` datetime,
	`affiliate_name` varchar(255),
	`athlete_profile` text,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `video_submissions` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`registration_id` varchar(255) NOT NULL,
	`track_workout_id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`video_url` varchar(2000) NOT NULL,
	`notes` text,
	`submitted_at` datetime NOT NULL,
	CONSTRAINT `video_submissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `video_submissions_reg_event_idx` UNIQUE(`registration_id`,`track_workout_id`)
);
--> statement-breakpoint
CREATE TABLE `competition_judge_rotations` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`competition_id` varchar(255) NOT NULL,
	`track_workout_id` varchar(255) NOT NULL,
	`membership_id` varchar(255) NOT NULL,
	`starting_heat` int NOT NULL,
	`starting_lane` int NOT NULL,
	`heats_count` int NOT NULL,
	`lane_shift_pattern` varchar(20) NOT NULL DEFAULT 'stay',
	`notes` text,
	CONSTRAINT `competition_judge_rotations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `judge_assignment_versions` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`track_workout_id` varchar(255) NOT NULL,
	`version` int NOT NULL,
	`published_at` datetime NOT NULL,
	`published_by` varchar(255),
	`notes` text,
	`is_active` boolean NOT NULL DEFAULT false,
	CONSTRAINT `judge_assignment_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `judge_assignment_versions_unique_idx` UNIQUE(`track_workout_id`,`version`)
);
--> statement-breakpoint
CREATE TABLE `judge_heat_assignments` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`heat_id` varchar(255) NOT NULL,
	`membership_id` varchar(255) NOT NULL,
	`rotation_id` varchar(255),
	`version_id` varchar(255),
	`lane_number` int,
	`position` varchar(50),
	`instructions` text,
	`is_manual_override` boolean NOT NULL DEFAULT false,
	CONSTRAINT `judge_heat_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `judge_heat_assignments_unique_idx` UNIQUE(`heat_id`,`membership_id`,`version_id`)
);
--> statement-breakpoint
CREATE TABLE `volunteer_shift_assignments` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`shift_id` varchar(255) NOT NULL,
	`membership_id` varchar(255) NOT NULL,
	`notes` text,
	CONSTRAINT `volunteer_shift_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `volunteer_shift_assignments_unique_idx` UNIQUE(`shift_id`,`membership_id`)
);
--> statement-breakpoint
CREATE TABLE `volunteer_shifts` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`competition_id` varchar(255) NOT NULL,
	`name` varchar(200) NOT NULL,
	`role_type` varchar(50) NOT NULL,
	`start_time` datetime NOT NULL,
	`end_time` datetime NOT NULL,
	`location` varchar(200),
	`capacity` int NOT NULL DEFAULT 1,
	`notes` text,
	CONSTRAINT `volunteer_shifts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `waiver_signatures` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`waiver_id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`registration_id` varchar(255),
	`signed_at` datetime NOT NULL,
	`ip_address` varchar(45),
	CONSTRAINT `waiver_signatures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `waivers` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`competition_id` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`required` boolean NOT NULL DEFAULT true,
	`position` int NOT NULL DEFAULT 0,
	CONSTRAINT `waivers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `movements` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` varchar(255) NOT NULL,
	CONSTRAINT `movements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `results` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`date` datetime NOT NULL,
	`workout_id` varchar(255),
	`type` varchar(255) NOT NULL,
	`notes` text,
	`programming_track_id` varchar(255),
	`scheduled_workout_instance_id` varchar(255),
	`scale` varchar(255),
	`scaling_level_id` varchar(255),
	`as_rx` boolean NOT NULL DEFAULT false,
	`wod_score` varchar(255),
	`set_count` int,
	`distance` int,
	`time` int,
	`competition_event_id` varchar(255),
	`competition_registration_id` varchar(255),
	`score_status` varchar(255),
	`tie_break_score` varchar(255),
	`secondary_score` varchar(255),
	`entered_by` varchar(255),
	CONSTRAINT `results_id` PRIMARY KEY(`id`),
	CONSTRAINT `results_competition_unique_idx` UNIQUE(`competition_event_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `sets` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`result_id` varchar(255) NOT NULL,
	`set_number` int NOT NULL,
	`notes` text,
	`reps` int,
	`weight` int,
	`status` varchar(255),
	`distance` int,
	`time` int,
	`score` int,
	CONSTRAINT `sets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `spicy_tags` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	CONSTRAINT `spicy_tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `spicy_tags_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `workout_movements` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`workout_id` varchar(255),
	`movement_id` varchar(255),
	CONSTRAINT `workout_movements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workout_tags` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`workout_id` varchar(255) NOT NULL,
	`tag_id` varchar(255) NOT NULL,
	CONSTRAINT `workout_tags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workouts` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`scope` varchar(255) NOT NULL DEFAULT 'private',
	`scheme` varchar(255) NOT NULL,
	`score_type` varchar(255),
	`reps_per_round` int,
	`rounds_to_score` int DEFAULT 1,
	`team_id` varchar(255),
	`sugar_id` varchar(255),
	`tiebreak_scheme` varchar(255),
	`time_cap` int,
	`source_track_id` varchar(255),
	`source_workout_id` varchar(255),
	`scaling_group_id` varchar(255),
	CONSTRAINT `workouts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `affiliates_name_idx` ON `affiliates` (`name`);--> statement-breakpoint
CREATE INDEX `affiliates_owner_team_idx` ON `affiliates` (`owner_team_id`);--> statement-breakpoint
CREATE INDEX `credit_transaction_user_id_idx` ON `credit_transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `credit_transaction_type_idx` ON `credit_transactions` (`type`);--> statement-breakpoint
CREATE INDEX `credit_transaction_created_at_idx` ON `credit_transactions` (`created_at`);--> statement-breakpoint
CREATE INDEX `credit_transaction_expiration_date_idx` ON `credit_transactions` (`expiration_date`);--> statement-breakpoint
CREATE INDEX `credit_transaction_payment_intent_id_idx` ON `credit_transactions` (`payment_intent_id`);--> statement-breakpoint
CREATE INDEX `purchased_item_user_id_idx` ON `purchased_items` (`user_id`);--> statement-breakpoint
CREATE INDEX `purchased_item_type_idx` ON `purchased_items` (`item_type`);--> statement-breakpoint
CREATE INDEX `purchased_item_user_item_idx` ON `purchased_items` (`user_id`,`item_type`,`item_id`);--> statement-breakpoint
CREATE INDEX `commerce_purchase_user_idx` ON `commerce_purchases` (`user_id`);--> statement-breakpoint
CREATE INDEX `commerce_purchase_product_idx` ON `commerce_purchases` (`product_id`);--> statement-breakpoint
CREATE INDEX `commerce_purchase_status_idx` ON `commerce_purchases` (`status`);--> statement-breakpoint
CREATE INDEX `commerce_purchase_stripe_session_idx` ON `commerce_purchases` (`stripe_checkout_session_id`);--> statement-breakpoint
CREATE INDEX `commerce_purchase_competition_idx` ON `commerce_purchases` (`competition_id`);--> statement-breakpoint
CREATE INDEX `competition_divisions_competition_idx` ON `competition_divisions` (`competition_id`);--> statement-breakpoint
CREATE INDEX `purchase_transfers_purchase_idx` ON `purchase_transfers` (`purchase_id`);--> statement-breakpoint
CREATE INDEX `purchase_transfers_source_idx` ON `purchase_transfers` (`source_user_id`);--> statement-breakpoint
CREATE INDEX `purchase_transfers_target_email_idx` ON `purchase_transfers` (`target_email`);--> statement-breakpoint
CREATE INDEX `purchase_transfers_state_idx` ON `purchase_transfers` (`transfer_state`);--> statement-breakpoint
CREATE INDEX `competition_events_competition_idx` ON `competition_events` (`competition_id`);--> statement-breakpoint
CREATE INDEX `competition_events_workout_idx` ON `competition_events` (`track_workout_id`);--> statement-breakpoint
CREATE INDEX `competition_heat_assignments_heat_idx` ON `competition_heat_assignments` (`heat_id`);--> statement-breakpoint
CREATE INDEX `competition_heats_competition_idx` ON `competition_heats` (`competition_id`);--> statement-breakpoint
CREATE INDEX `competition_heats_workout_idx` ON `competition_heats` (`track_workout_id`);--> statement-breakpoint
CREATE INDEX `competition_heats_time_idx` ON `competition_heats` (`scheduled_time`);--> statement-breakpoint
CREATE INDEX `comp_reg_answers_question_idx` ON `competition_registration_answers` (`question_id`);--> statement-breakpoint
CREATE INDEX `comp_reg_answers_registration_idx` ON `competition_registration_answers` (`registration_id`);--> statement-breakpoint
CREATE INDEX `comp_reg_answers_user_idx` ON `competition_registration_answers` (`user_id`);--> statement-breakpoint
CREATE INDEX `comp_reg_questions_competition_idx` ON `competition_registration_questions` (`competition_id`);--> statement-breakpoint
CREATE INDEX `comp_reg_questions_sort_idx` ON `competition_registration_questions` (`competition_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `comp_reg_questions_group_idx` ON `competition_registration_questions` (`group_id`);--> statement-breakpoint
CREATE INDEX `comp_reg_questions_target_idx` ON `competition_registration_questions` (`question_target`);--> statement-breakpoint
CREATE INDEX `competition_registrations_user_idx` ON `competition_registrations` (`user_id`);--> statement-breakpoint
CREATE INDEX `competition_registrations_event_idx` ON `competition_registrations` (`event_id`);--> statement-breakpoint
CREATE INDEX `competition_registrations_division_idx` ON `competition_registrations` (`division_id`);--> statement-breakpoint
CREATE INDEX `competition_registrations_captain_idx` ON `competition_registrations` (`captain_user_id`);--> statement-breakpoint
CREATE INDEX `competition_registrations_athlete_team_idx` ON `competition_registrations` (`athlete_team_id`);--> statement-breakpoint
CREATE INDEX `competition_registrations_purchase_idx` ON `competition_registrations` (`commerce_purchase_id`);--> statement-breakpoint
CREATE INDEX `competition_registrations_status_idx` ON `competition_registrations` (`event_id`,`status`);--> statement-breakpoint
CREATE INDEX `competition_venues_competition_idx` ON `competition_venues` (`competition_id`);--> statement-breakpoint
CREATE INDEX `competition_venues_sort_idx` ON `competition_venues` (`competition_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `competitions_organizing_team_idx` ON `competitions` (`organizing_team_id`);--> statement-breakpoint
CREATE INDEX `competitions_competition_team_idx` ON `competitions` (`competition_team_id`);--> statement-breakpoint
CREATE INDEX `competitions_group_idx` ON `competitions` (`group_id`);--> statement-breakpoint
CREATE INDEX `competitions_start_date_idx` ON `competitions` (`start_date`);--> statement-breakpoint
CREATE INDEX `vol_reg_answers_question_idx` ON `volunteer_registration_answers` (`question_id`);--> statement-breakpoint
CREATE INDEX `vol_reg_answers_invitation_idx` ON `volunteer_registration_answers` (`invitation_id`);--> statement-breakpoint
CREATE INDEX `entitlement_user_id_idx` ON `entitlements` (`user_id`);--> statement-breakpoint
CREATE INDEX `entitlement_team_id_idx` ON `entitlements` (`team_id`);--> statement-breakpoint
CREATE INDEX `entitlement_type_idx` ON `entitlements` (`entitlement_type_id`);--> statement-breakpoint
CREATE INDEX `entitlement_source_idx` ON `entitlements` (`source_type`,`source_id`);--> statement-breakpoint
CREATE INDEX `entitlement_deleted_at_idx` ON `entitlements` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `plan_feature_plan_id_idx` ON `plan_features` (`plan_id`);--> statement-breakpoint
CREATE INDEX `plan_feature_feature_id_idx` ON `plan_features` (`feature_id`);--> statement-breakpoint
CREATE INDEX `plan_feature_unique_idx` ON `plan_features` (`plan_id`,`feature_id`);--> statement-breakpoint
CREATE INDEX `plan_limit_plan_id_idx` ON `plan_limits` (`plan_id`);--> statement-breakpoint
CREATE INDEX `plan_limit_limit_id_idx` ON `plan_limits` (`limit_id`);--> statement-breakpoint
CREATE INDEX `plan_limit_unique_idx` ON `plan_limits` (`plan_id`,`limit_id`);--> statement-breakpoint
CREATE INDEX `team_addon_team_id_idx` ON `team_addons` (`team_id`);--> statement-breakpoint
CREATE INDEX `team_addon_status_idx` ON `team_addons` (`status`);--> statement-breakpoint
CREATE INDEX `team_entitlement_override_team_id_idx` ON `team_entitlement_overrides` (`team_id`);--> statement-breakpoint
CREATE INDEX `team_entitlement_override_type_idx` ON `team_entitlement_overrides` (`type`);--> statement-breakpoint
CREATE INDEX `team_feature_entitlement_team_id_idx` ON `team_feature_entitlements` (`team_id`);--> statement-breakpoint
CREATE INDEX `team_feature_entitlement_feature_id_idx` ON `team_feature_entitlements` (`feature_id`);--> statement-breakpoint
CREATE INDEX `team_limit_entitlement_team_id_idx` ON `team_limit_entitlements` (`team_id`);--> statement-breakpoint
CREATE INDEX `team_limit_entitlement_limit_id_idx` ON `team_limit_entitlements` (`limit_id`);--> statement-breakpoint
CREATE INDEX `team_subscription_team_id_idx` ON `team_subscriptions` (`team_id`);--> statement-breakpoint
CREATE INDEX `team_subscription_status_idx` ON `team_subscriptions` (`status`);--> statement-breakpoint
CREATE INDEX `team_usage_team_id_idx` ON `team_usages` (`team_id`);--> statement-breakpoint
CREATE INDEX `team_usage_limit_key_idx` ON `team_usages` (`limit_key`);--> statement-breakpoint
CREATE INDEX `team_usage_unique_idx` ON `team_usages` (`team_id`,`limit_key`,`period_start`);--> statement-breakpoint
CREATE INDEX `event_resources_event_idx` ON `event_resources` (`event_id`);--> statement-breakpoint
CREATE INDEX `event_resources_event_order_idx` ON `event_resources` (`event_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `event_judging_sheets_competition_idx` ON `event_judging_sheets` (`competition_id`);--> statement-breakpoint
CREATE INDEX `event_judging_sheets_event_idx` ON `event_judging_sheets` (`track_workout_id`);--> statement-breakpoint
CREATE INDEX `event_judging_sheets_uploaded_by_idx` ON `event_judging_sheets` (`uploaded_by`);--> statement-breakpoint
CREATE INDEX `event_judging_sheets_sort_idx` ON `event_judging_sheets` (`track_workout_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `submission_window_notif_competition_idx` ON `submission_window_notifications` (`competition_id`);--> statement-breakpoint
CREATE INDEX `submission_window_notif_event_idx` ON `submission_window_notifications` (`competition_event_id`);--> statement-breakpoint
CREATE INDEX `submission_window_notif_user_idx` ON `submission_window_notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `organizer_request_team_idx` ON `organizer_requests` (`team_id`);--> statement-breakpoint
CREATE INDEX `organizer_request_user_idx` ON `organizer_requests` (`user_id`);--> statement-breakpoint
CREATE INDEX `organizer_request_status_idx` ON `organizer_requests` (`status`);--> statement-breakpoint
CREATE INDEX `programming_track_type_idx` ON `programming_tracks` (`type`);--> statement-breakpoint
CREATE INDEX `programming_track_owner_idx` ON `programming_tracks` (`owner_team_id`);--> statement-breakpoint
CREATE INDEX `programming_track_scaling_idx` ON `programming_tracks` (`scaling_group_id`);--> statement-breakpoint
CREATE INDEX `programming_track_competition_idx` ON `programming_tracks` (`competition_id`);--> statement-breakpoint
CREATE INDEX `scheduled_workout_instance_team_idx` ON `scheduled_workout_instances` (`team_id`);--> statement-breakpoint
CREATE INDEX `scheduled_workout_instance_date_idx` ON `scheduled_workout_instances` (`scheduled_date`);--> statement-breakpoint
CREATE INDEX `scheduled_workout_instance_workout_idx` ON `scheduled_workout_instances` (`workout_id`);--> statement-breakpoint
CREATE INDEX `team_programming_track_active_idx` ON `team_programming_tracks` (`is_active`);--> statement-breakpoint
CREATE INDEX `team_programming_track_team_idx` ON `team_programming_tracks` (`team_id`);--> statement-breakpoint
CREATE INDEX `track_workout_track_idx` ON `track_workouts` (`track_id`);--> statement-breakpoint
CREATE INDEX `track_workout_order_idx` ON `track_workouts` (`track_order`);--> statement-breakpoint
CREATE INDEX `track_workout_workoutid_idx` ON `track_workouts` (`workout_id`);--> statement-breakpoint
CREATE INDEX `track_workout_unique_idx` ON `track_workouts` (`track_id`,`workout_id`,`track_order`);--> statement-breakpoint
CREATE INDEX `track_workout_sponsor_idx` ON `track_workouts` (`sponsor_id`);--> statement-breakpoint
CREATE INDEX `scaling_groups_team_idx` ON `scaling_groups` (`team_id`);--> statement-breakpoint
CREATE INDEX `scaling_groups_default_idx` ON `scaling_groups` (`is_default`);--> statement-breakpoint
CREATE INDEX `scaling_groups_system_idx` ON `scaling_groups` (`is_system`);--> statement-breakpoint
CREATE INDEX `scaling_levels_group_idx` ON `scaling_levels` (`scaling_group_id`);--> statement-breakpoint
CREATE INDEX `scaling_levels_position_idx` ON `scaling_levels` (`scaling_group_id`,`position`);--> statement-breakpoint
CREATE INDEX `workout_scaling_desc_workout_idx` ON `workout_scaling_descriptions` (`workout_id`);--> statement-breakpoint
CREATE INDEX `coach_user_team_unique_idx` ON `coaches` (`user_id`,`team_id`);--> statement-breakpoint
CREATE INDEX `idx_score_rounds_score` ON `score_rounds` (`score_id`,`round_number`);--> statement-breakpoint
CREATE INDEX `idx_scores_user` ON `scores` (`user_id`,`recorded_at`);--> statement-breakpoint
CREATE INDEX `idx_scores_workout` ON `scores` (`workout_id`,`team_id`,`status_order`,`sort_key`);--> statement-breakpoint
CREATE INDEX `idx_scores_competition` ON `scores` (`competition_event_id`,`status_order`,`sort_key`);--> statement-breakpoint
CREATE INDEX `idx_scores_scheduled` ON `scores` (`scheduled_workout_instance_id`);--> statement-breakpoint
CREATE INDEX `sponsor_groups_competition_idx` ON `sponsor_groups` (`competition_id`);--> statement-breakpoint
CREATE INDEX `sponsor_groups_order_idx` ON `sponsor_groups` (`competition_id`,`display_order`);--> statement-breakpoint
CREATE INDEX `sponsors_competition_idx` ON `sponsors` (`competition_id`);--> statement-breakpoint
CREATE INDEX `sponsors_user_idx` ON `sponsors` (`user_id`);--> statement-breakpoint
CREATE INDEX `sponsors_group_idx` ON `sponsors` (`group_id`);--> statement-breakpoint
CREATE INDEX `sponsors_competition_order_idx` ON `sponsors` (`competition_id`,`group_id`,`display_order`);--> statement-breakpoint
CREATE INDEX `sponsors_user_order_idx` ON `sponsors` (`user_id`,`display_order`);--> statement-breakpoint
CREATE INDEX `team_invitation_team_id_idx` ON `team_invitations` (`team_id`);--> statement-breakpoint
CREATE INDEX `team_invitation_email_idx` ON `team_invitations` (`email`);--> statement-breakpoint
CREATE INDEX `team_invitation_token_idx` ON `team_invitations` (`token`);--> statement-breakpoint
CREATE INDEX `team_membership_team_id_idx` ON `team_memberships` (`team_id`);--> statement-breakpoint
CREATE INDEX `team_membership_user_id_idx` ON `team_memberships` (`user_id`);--> statement-breakpoint
CREATE INDEX `team_membership_unique_idx` ON `team_memberships` (`team_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `team_role_team_id_idx` ON `team_roles` (`team_id`);--> statement-breakpoint
CREATE INDEX `team_role_name_unique_idx` ON `team_roles` (`team_id`,`name`);--> statement-breakpoint
CREATE INDEX `team_slug_idx` ON `teams` (`slug`);--> statement-breakpoint
CREATE INDEX `team_personal_owner_idx` ON `teams` (`personal_team_owner_id`);--> statement-breakpoint
CREATE INDEX `team_default_scaling_idx` ON `teams` (`default_scaling_group_id`);--> statement-breakpoint
CREATE INDEX `team_type_idx` ON `teams` (`type`);--> statement-breakpoint
CREATE INDEX `team_parent_org_idx` ON `teams` (`parent_organization_id`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `passkey_credentials` (`user_id`);--> statement-breakpoint
CREATE INDEX `credential_id_idx` ON `passkey_credentials` (`credential_id`);--> statement-breakpoint
CREATE INDEX `email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `google_account_id_idx` ON `users` (`google_account_id`);--> statement-breakpoint
CREATE INDEX `role_idx` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `user_gender_idx` ON `users` (`gender`);--> statement-breakpoint
CREATE INDEX `user_dob_idx` ON `users` (`date_of_birth`);--> statement-breakpoint
CREATE INDEX `video_submissions_user_idx` ON `video_submissions` (`user_id`);--> statement-breakpoint
CREATE INDEX `video_submissions_event_idx` ON `video_submissions` (`track_workout_id`);--> statement-breakpoint
CREATE INDEX `video_submissions_registration_idx` ON `video_submissions` (`registration_id`);--> statement-breakpoint
CREATE INDEX `competition_judge_rotations_competition_idx` ON `competition_judge_rotations` (`competition_id`);--> statement-breakpoint
CREATE INDEX `competition_judge_rotations_workout_idx` ON `competition_judge_rotations` (`track_workout_id`);--> statement-breakpoint
CREATE INDEX `competition_judge_rotations_membership_idx` ON `competition_judge_rotations` (`membership_id`);--> statement-breakpoint
CREATE INDEX `competition_judge_rotations_event_heat_idx` ON `competition_judge_rotations` (`track_workout_id`,`starting_heat`);--> statement-breakpoint
CREATE INDEX `judge_assignment_versions_workout_idx` ON `judge_assignment_versions` (`track_workout_id`);--> statement-breakpoint
CREATE INDEX `judge_assignment_versions_active_idx` ON `judge_assignment_versions` (`track_workout_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `judge_heat_assignments_heat_idx` ON `judge_heat_assignments` (`heat_id`);--> statement-breakpoint
CREATE INDEX `judge_heat_assignments_membership_idx` ON `judge_heat_assignments` (`membership_id`);--> statement-breakpoint
CREATE INDEX `judge_heat_assignments_version_idx` ON `judge_heat_assignments` (`version_id`);--> statement-breakpoint
CREATE INDEX `volunteer_shift_assignments_shift_idx` ON `volunteer_shift_assignments` (`shift_id`);--> statement-breakpoint
CREATE INDEX `volunteer_shift_assignments_membership_idx` ON `volunteer_shift_assignments` (`membership_id`);--> statement-breakpoint
CREATE INDEX `volunteer_shifts_competition_idx` ON `volunteer_shifts` (`competition_id`);--> statement-breakpoint
CREATE INDEX `volunteer_shifts_start_time_idx` ON `volunteer_shifts` (`start_time`);--> statement-breakpoint
CREATE INDEX `waiver_signatures_waiver_idx` ON `waiver_signatures` (`waiver_id`);--> statement-breakpoint
CREATE INDEX `waiver_signatures_user_idx` ON `waiver_signatures` (`user_id`);--> statement-breakpoint
CREATE INDEX `waiver_signatures_registration_idx` ON `waiver_signatures` (`registration_id`);--> statement-breakpoint
CREATE INDEX `waiver_signatures_waiver_user_idx` ON `waiver_signatures` (`waiver_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `waivers_competition_idx` ON `waivers` (`competition_id`);--> statement-breakpoint
CREATE INDEX `waivers_position_idx` ON `waivers` (`competition_id`,`position`);--> statement-breakpoint
CREATE INDEX `results_scaling_level_idx` ON `results` (`scaling_level_id`);--> statement-breakpoint
CREATE INDEX `results_workout_scaling_idx` ON `results` (`workout_id`,`scaling_level_id`);--> statement-breakpoint
CREATE INDEX `results_leaderboard_idx` ON `results` (`workout_id`,`scaling_level_id`,`wod_score`);--> statement-breakpoint
CREATE INDEX `results_user_idx` ON `results` (`user_id`);--> statement-breakpoint
CREATE INDEX `results_date_idx` ON `results` (`date`);--> statement-breakpoint
CREATE INDEX `results_workout_idx` ON `results` (`workout_id`);--> statement-breakpoint
CREATE INDEX `results_competition_event_idx` ON `results` (`competition_event_id`,`scaling_level_id`);--> statement-breakpoint
CREATE INDEX `workouts_scaling_group_idx` ON `workouts` (`scaling_group_id`);--> statement-breakpoint
CREATE INDEX `workouts_team_idx` ON `workouts` (`team_id`);--> statement-breakpoint
CREATE INDEX `workouts_source_track_idx` ON `workouts` (`source_track_id`);--> statement-breakpoint
CREATE INDEX `workouts_source_workout_idx` ON `workouts` (`source_workout_id`);