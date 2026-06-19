CREATE TABLE `crew_event_settings` (
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `update_counter` int DEFAULT 0,
  `id` varchar(255) NOT NULL,
  `competition_id` varchar(255) NOT NULL,
  `crew_only` boolean NOT NULL DEFAULT true,
  `source_platform` varchar(100),
  `source_event_url` varchar(2048),
  `external_registration_url` varchar(2048),
  `lifecycle` varchar(20) NOT NULL DEFAULT 'draft',
  `concierge_status` varchar(20) NOT NULL DEFAULT 'not_started',
  `crew_plan` varchar(20) NOT NULL DEFAULT 'self_serve',
  `full_platform_credit_cents` int NOT NULL DEFAULT 0,
  `acquisition_source` varchar(255),
  `settings` text,
  CONSTRAINT `crew_event_settings_id` PRIMARY KEY (`id`)
);

CREATE UNIQUE INDEX `crew_event_settings_competition_unique_idx`
  ON `crew_event_settings` (`competition_id`);

CREATE INDEX `crew_event_settings_lifecycle_idx`
  ON `crew_event_settings` (`lifecycle`);

CREATE INDEX `crew_event_settings_plan_idx`
  ON `crew_event_settings` (`crew_plan`);
