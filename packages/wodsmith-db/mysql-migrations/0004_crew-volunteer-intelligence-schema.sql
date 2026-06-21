CREATE TABLE `crew_competition_group_settings` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`competition_group_id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`memory_mode` varchar(30) NOT NULL DEFAULT 'disabled',
	`returning_volunteer_consent_required` boolean NOT NULL DEFAULT true,
	`history_visibility_scope` varchar(30) NOT NULL DEFAULT 'same_organizer',
	`created_by_user_id` varchar(255),
	`updated_by_user_id` varchar(255),
	CONSTRAINT `crew_competition_group_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `crew_competition_group_settings_group_unique_idx` UNIQUE(`competition_group_id`)
);
--> statement-breakpoint
CREATE TABLE `crew_event_conversions` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`competition_id` varchar(255) NOT NULL,
	`crew_event_settings_id` varchar(255),
	`competition_group_id` varchar(255),
	`status` varchar(30) NOT NULL DEFAULT 'requested',
	`requested_by_user_id` varchar(255),
	`reviewed_by_user_id` varchar(255),
	`completed_by_user_id` varchar(255),
	`requested_at` datetime NOT NULL,
	`privacy_reviewed_at` datetime,
	`completed_at` datetime,
	`cancelled_at` datetime,
	CONSTRAINT `crew_event_conversions_id` PRIMARY KEY(`id`),
	CONSTRAINT `crew_event_conversions_competition_unique_idx` UNIQUE(`competition_id`)
);
--> statement-breakpoint
CREATE TABLE `crew_volunteer_consents` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`identity_id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`scope` varchar(50) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'granted',
	`consent_text` text NOT NULL,
	`consent_text_version` varchar(100) NOT NULL,
	`consent_text_hash` varchar(255) NOT NULL,
	`source` varchar(40) NOT NULL,
	`source_surface` varchar(100) NOT NULL,
	`source_competition_id` varchar(255),
	`actor_user_id` varchar(255),
	`recorded_by_user_id` varchar(255),
	`granted_at` datetime NOT NULL,
	`revoked_at` datetime,
	`revoked_by_user_id` varchar(255),
	`revocation_source` varchar(100),
	`superseded_by_consent_id` varchar(255),
	CONSTRAINT `crew_volunteer_consents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crew_volunteer_credentials` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`identity_id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`competition_id` varchar(255),
	`credential_type` varchar(40) NOT NULL,
	`credential_key` varchar(100),
	`credential_label` varchar(255) NOT NULL,
	`issuer` varchar(255),
	`status` varchar(20) NOT NULL DEFAULT 'self_reported',
	`visibility_scope` varchar(30) NOT NULL DEFAULT 'same_organizer',
	`verified_at` datetime,
	`expires_at` datetime,
	`revoked_at` datetime,
	`verified_by_user_id` varchar(255),
	`source_type` varchar(50),
	`source_id` varchar(255),
	`consent_id` varchar(255),
	CONSTRAINT `crew_volunteer_credentials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crew_volunteer_history_events` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`identity_id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`competition_id` varchar(255),
	`group_id` varchar(255),
	`event_type` varchar(50) NOT NULL,
	`visibility_scope` varchar(30) NOT NULL DEFAULT 'same_organizer',
	`assignment_type` varchar(40),
	`assignment_id` varchar(255),
	`role_type` varchar(50),
	`occurred_at` datetime NOT NULL,
	`source_type` varchar(50) NOT NULL,
	`source_id` varchar(255),
	`source_user_id` varchar(255),
	`consent_id` varchar(255),
	`correction_of_event_id` varchar(255),
	CONSTRAINT `crew_volunteer_history_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crew_volunteer_identities` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`user_id` varchar(255),
	`email_hash` varchar(255),
	`phone_hash` varchar(255),
	`contact_hash_version` varchar(50) NOT NULL DEFAULT 'v1',
	`source_competition_id` varchar(255),
	`source_membership_id` varchar(255),
	`source_invitation_id` varchar(255),
	`identity_source` varchar(40) NOT NULL DEFAULT 'manual',
	`discovery_age_status` varchar(30) NOT NULL DEFAULT 'unknown',
	`status` varchar(20) NOT NULL DEFAULT 'active',
	CONSTRAINT `crew_volunteer_identities_id` PRIMARY KEY(`id`),
	CONSTRAINT `crew_volunteer_identities_team_user_unique_idx` UNIQUE(`team_id`,`user_id`),
	CONSTRAINT `crew_volunteer_identities_team_email_hash_unique_idx` UNIQUE(`team_id`,`contact_hash_version`,`email_hash`),
	CONSTRAINT `crew_volunteer_identities_team_phone_hash_unique_idx` UNIQUE(`team_id`,`contact_hash_version`,`phone_hash`)
);
--> statement-breakpoint
CREATE TABLE `crew_volunteer_intro_requests` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`requesting_team_id` varchar(255) NOT NULL,
	`requesting_competition_id` varchar(255) NOT NULL,
	`volunteer_identity_id` varchar(255) NOT NULL,
	`discovery_consent_id` varchar(255) NOT NULL,
	`requested_role_type` varchar(50),
	`starts_at` datetime,
	`ends_at` datetime,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`requested_by_user_id` varchar(255),
	`requested_at` datetime NOT NULL,
	`responded_by_user_id` varchar(255),
	`responded_at` datetime,
	`expires_at` datetime,
	`result_invitation_id` varchar(255),
	`result_membership_id` varchar(255),
	CONSTRAINT `crew_volunteer_intro_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `crew_competition_group_settings_team_idx` ON `crew_competition_group_settings` (`team_id`);--> statement-breakpoint
CREATE INDEX `crew_competition_group_settings_mode_idx` ON `crew_competition_group_settings` (`memory_mode`);--> statement-breakpoint
CREATE INDEX `crew_competition_group_settings_created_by_idx` ON `crew_competition_group_settings` (`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `crew_competition_group_settings_updated_by_idx` ON `crew_competition_group_settings` (`updated_by_user_id`);--> statement-breakpoint
CREATE INDEX `crew_event_conversions_team_idx` ON `crew_event_conversions` (`team_id`);--> statement-breakpoint
CREATE INDEX `crew_event_conversions_settings_idx` ON `crew_event_conversions` (`crew_event_settings_id`);--> statement-breakpoint
CREATE INDEX `crew_event_conversions_group_idx` ON `crew_event_conversions` (`competition_group_id`);--> statement-breakpoint
CREATE INDEX `crew_event_conversions_status_idx` ON `crew_event_conversions` (`status`);--> statement-breakpoint
CREATE INDEX `crew_event_conversions_requested_by_idx` ON `crew_event_conversions` (`requested_by_user_id`);--> statement-breakpoint
CREATE INDEX `crew_event_conversions_reviewed_by_idx` ON `crew_event_conversions` (`reviewed_by_user_id`);--> statement-breakpoint
CREATE INDEX `crew_event_conversions_completed_by_idx` ON `crew_event_conversions` (`completed_by_user_id`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_consents_identity_idx` ON `crew_volunteer_consents` (`identity_id`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_consents_team_idx` ON `crew_volunteer_consents` (`team_id`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_consents_scope_status_idx` ON `crew_volunteer_consents` (`scope`,`status`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_consents_identity_scope_status_idx` ON `crew_volunteer_consents` (`identity_id`,`scope`,`status`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_consents_source_competition_idx` ON `crew_volunteer_consents` (`source_competition_id`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_consents_actor_idx` ON `crew_volunteer_consents` (`actor_user_id`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_consents_recorded_by_idx` ON `crew_volunteer_consents` (`recorded_by_user_id`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_consents_revoked_at_idx` ON `crew_volunteer_consents` (`revoked_at`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_credentials_identity_idx` ON `crew_volunteer_credentials` (`identity_id`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_credentials_team_idx` ON `crew_volunteer_credentials` (`team_id`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_credentials_competition_idx` ON `crew_volunteer_credentials` (`competition_id`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_credentials_type_idx` ON `crew_volunteer_credentials` (`credential_type`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_credentials_key_idx` ON `crew_volunteer_credentials` (`credential_key`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_credentials_status_idx` ON `crew_volunteer_credentials` (`status`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_credentials_visibility_idx` ON `crew_volunteer_credentials` (`visibility_scope`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_credentials_expires_idx` ON `crew_volunteer_credentials` (`expires_at`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_credentials_verified_by_idx` ON `crew_volunteer_credentials` (`verified_by_user_id`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_credentials_consent_idx` ON `crew_volunteer_credentials` (`consent_id`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_history_events_identity_idx` ON `crew_volunteer_history_events` (`identity_id`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_history_events_team_idx` ON `crew_volunteer_history_events` (`team_id`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_history_events_competition_idx` ON `crew_volunteer_history_events` (`competition_id`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_history_events_group_idx` ON `crew_volunteer_history_events` (`group_id`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_history_events_type_idx` ON `crew_volunteer_history_events` (`event_type`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_history_events_visibility_idx` ON `crew_volunteer_history_events` (`visibility_scope`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_history_events_occurred_idx` ON `crew_volunteer_history_events` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_history_events_identity_occurred_idx` ON `crew_volunteer_history_events` (`identity_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_history_events_assignment_idx` ON `crew_volunteer_history_events` (`assignment_type`,`assignment_id`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_history_events_role_idx` ON `crew_volunteer_history_events` (`role_type`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_history_events_source_idx` ON `crew_volunteer_history_events` (`source_type`,`source_id`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_history_events_consent_idx` ON `crew_volunteer_history_events` (`consent_id`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_history_events_correction_idx` ON `crew_volunteer_history_events` (`correction_of_event_id`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_identities_team_idx` ON `crew_volunteer_identities` (`team_id`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_identities_user_idx` ON `crew_volunteer_identities` (`user_id`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_identities_source_competition_idx` ON `crew_volunteer_identities` (`source_competition_id`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_identities_status_idx` ON `crew_volunteer_identities` (`status`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_identities_age_status_idx` ON `crew_volunteer_identities` (`discovery_age_status`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_intro_requests_requester_idx` ON `crew_volunteer_intro_requests` (`requesting_team_id`,`requesting_competition_id`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_intro_requests_identity_idx` ON `crew_volunteer_intro_requests` (`volunteer_identity_id`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_intro_requests_consent_idx` ON `crew_volunteer_intro_requests` (`discovery_consent_id`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_intro_requests_role_idx` ON `crew_volunteer_intro_requests` (`requested_role_type`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_intro_requests_status_idx` ON `crew_volunteer_intro_requests` (`status`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_intro_requests_requested_by_idx` ON `crew_volunteer_intro_requests` (`requested_by_user_id`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_intro_requests_responded_by_idx` ON `crew_volunteer_intro_requests` (`responded_by_user_id`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_intro_requests_window_idx` ON `crew_volunteer_intro_requests` (`starts_at`,`ends_at`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_intro_requests_expires_idx` ON `crew_volunteer_intro_requests` (`expires_at`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_intro_requests_result_invitation_idx` ON `crew_volunteer_intro_requests` (`result_invitation_id`);--> statement-breakpoint
CREATE INDEX `crew_volunteer_intro_requests_result_membership_idx` ON `crew_volunteer_intro_requests` (`result_membership_id`);