CREATE TABLE `crew_billing_events` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`competition_id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`event_type` varchar(50) NOT NULL,
	`billing_state` varchar(30) NOT NULL,
	`billing_source` varchar(40) NOT NULL,
	`plan_id` varchar(255),
	`amount_cents` int NOT NULL DEFAULT 0,
	`currency` varchar(3) NOT NULL DEFAULT 'usd',
	`credit_cents` int NOT NULL DEFAULT 0,
	`refunded_cents` int NOT NULL DEFAULT 0,
	`stripe_payment_link_id` varchar(255),
	`stripe_checkout_session_id` varchar(255),
	`stripe_payment_intent_id` varchar(255),
	`idempotency_key` varchar(255),
	`actor_user_id` varchar(255),
	`actor_label` varchar(255),
	`public_note` text,
	`private_metadata` json,
	CONSTRAINT `crew_billing_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `crew_billing_events_idempotency_unique_idx` UNIQUE(`competition_id`,`event_type`,`idempotency_key`)
);
--> statement-breakpoint
ALTER TABLE `crew_event_settings` ADD `crew_billing_state` varchar(30) DEFAULT 'unpaid' NOT NULL;--> statement-breakpoint
ALTER TABLE `crew_event_settings` ADD `crew_billing_source` varchar(40);--> statement-breakpoint
ALTER TABLE `crew_event_settings` ADD `crew_billing_plan_id` varchar(255);--> statement-breakpoint
ALTER TABLE `crew_event_settings` ADD `crew_billing_amount_cents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `crew_event_settings` ADD `crew_billing_currency` varchar(3) DEFAULT 'usd' NOT NULL;--> statement-breakpoint
ALTER TABLE `crew_event_settings` ADD `crew_stripe_payment_link_id` varchar(255);--> statement-breakpoint
ALTER TABLE `crew_event_settings` ADD `crew_stripe_checkout_session_id` varchar(255);--> statement-breakpoint
ALTER TABLE `crew_event_settings` ADD `crew_stripe_payment_intent_id` varchar(255);--> statement-breakpoint
ALTER TABLE `crew_event_settings` ADD `crew_founder_override` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `crew_event_settings` ADD `crew_credit_cents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `crew_event_settings` ADD `crew_refunded_cents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `crew_billing_events_competition_idx` ON `crew_billing_events` (`competition_id`);--> statement-breakpoint
CREATE INDEX `crew_billing_events_team_idx` ON `crew_billing_events` (`team_id`);--> statement-breakpoint
CREATE INDEX `crew_billing_events_type_idx` ON `crew_billing_events` (`event_type`);--> statement-breakpoint
CREATE INDEX `crew_billing_events_state_idx` ON `crew_billing_events` (`billing_state`);--> statement-breakpoint
CREATE INDEX `crew_billing_events_source_idx` ON `crew_billing_events` (`billing_source`);--> statement-breakpoint
CREATE INDEX `crew_billing_events_plan_idx` ON `crew_billing_events` (`plan_id`);--> statement-breakpoint
CREATE INDEX `crew_billing_events_payment_link_idx` ON `crew_billing_events` (`stripe_payment_link_id`);--> statement-breakpoint
CREATE INDEX `crew_billing_events_checkout_session_idx` ON `crew_billing_events` (`stripe_checkout_session_id`);--> statement-breakpoint
CREATE INDEX `crew_billing_events_payment_intent_idx` ON `crew_billing_events` (`stripe_payment_intent_id`);--> statement-breakpoint
CREATE INDEX `crew_billing_events_actor_idx` ON `crew_billing_events` (`actor_user_id`);--> statement-breakpoint
CREATE INDEX `crew_event_settings_billing_state_idx` ON `crew_event_settings` (`crew_billing_state`);--> statement-breakpoint
CREATE INDEX `crew_event_settings_billing_source_idx` ON `crew_event_settings` (`crew_billing_source`);--> statement-breakpoint
CREATE INDEX `crew_event_settings_billing_plan_idx` ON `crew_event_settings` (`crew_billing_plan_id`);--> statement-breakpoint
CREATE INDEX `crew_event_settings_payment_link_idx` ON `crew_event_settings` (`crew_stripe_payment_link_id`);--> statement-breakpoint
CREATE INDEX `crew_event_settings_checkout_session_idx` ON `crew_event_settings` (`crew_stripe_checkout_session_id`);--> statement-breakpoint
CREATE INDEX `crew_event_settings_payment_intent_idx` ON `crew_event_settings` (`crew_stripe_payment_intent_id`);