CREATE TABLE `volunteer_signup_intents` (
	`id` varchar(255) NOT NULL,
	`code_hash` varchar(64) NOT NULL,
	`purpose` varchar(32) NOT NULL,
	`email` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`existing_account` boolean NOT NULL,
	`application` text NOT NULL,
	`return_path` varchar(600) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`consumed_at` datetime(3),
	CONSTRAINT `volunteer_signup_intents_id` PRIMARY KEY(`id`),
	CONSTRAINT `volunteer_signup_intents_codeHash_unique` UNIQUE(`code_hash`)
);
--> statement-breakpoint
CREATE INDEX `volunteer_signup_intents_expiry_idx` ON `volunteer_signup_intents` (`expires_at`);