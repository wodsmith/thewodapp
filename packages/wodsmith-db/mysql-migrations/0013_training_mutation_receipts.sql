CREATE TABLE `training_mutation_receipts` (
  `id` varchar(64) NOT NULL,
  `user_id` varchar(255) NOT NULL,
  `team_id` varchar(255) NOT NULL,
  `operation` varchar(80) NOT NULL,
  `payload_hash` varchar(64) NOT NULL,
  `result` json NOT NULL,
  `created_at` datetime(3) NOT NULL,
  CONSTRAINT `training_mutation_receipts_id` PRIMARY KEY (`id`)
);
--> statement-breakpoint
CREATE INDEX `training_mutation_receipt_user_idx` ON `training_mutation_receipts` (`user_id`);

--> statement-breakpoint
ALTER TABLE `workouts` ADD `archived_at` datetime(3) NULL;
