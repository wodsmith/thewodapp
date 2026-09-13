CREATE TABLE `gameday_devices` (
	`id` varchar(64) NOT NULL,
	`token` varchar(512) NOT NULL,
	`environment` varchar(16) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`session_id` varchar(255) NOT NULL,
	`subscription_id` varchar(36) NOT NULL,
	`registered_at` datetime(3) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	CONSTRAINT `gameday_devices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gameday_push_deliveries` (
	`id` varchar(36) NOT NULL,
	`broadcast_id` varchar(255) NOT NULL,
	`device_id` varchar(64) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`subscription_id` varchar(36) NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'pending',
	`attempts` int NOT NULL DEFAULT 0,
	`available_at` datetime(3) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`lease_id` varchar(36),
	`last_reason` varchar(64),
	CONSTRAINT `gameday_push_deliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `gameday_push_broadcast_device_idx` UNIQUE(`broadcast_id`,`device_id`)
);
--> statement-breakpoint
CREATE INDEX `gameday_devices_user_idx` ON `gameday_devices` (`user_id`);--> statement-breakpoint
CREATE INDEX `gameday_push_pending_idx` ON `gameday_push_deliveries` (`status`,`available_at`);