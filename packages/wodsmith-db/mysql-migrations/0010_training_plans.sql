CREATE TABLE `training_plan_drafts` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(64) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`revision` int NOT NULL DEFAULT 1,
	`status` varchar(16) NOT NULL DEFAULT 'draft',
	`document` json NOT NULL,
	CONSTRAINT `training_plan_drafts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `training_plan_receipts` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(64) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`operation` varchar(32) NOT NULL,
	`key_hash` varchar(64) NOT NULL,
	`payload_hash` varchar(64) NOT NULL,
	`receipt` json NOT NULL,
	CONSTRAINT `training_plan_receipts_id` PRIMARY KEY(`id`),
	CONSTRAINT `training_plan_receipt_key_uq` UNIQUE(`user_id`,`operation`,`key_hash`)
);
--> statement-breakpoint
CREATE INDEX `training_plan_owner_idx` ON `training_plan_drafts` (`user_id`,`updated_at`);