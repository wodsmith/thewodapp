CREATE TABLE `agent_oauth_grants` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`client_id` varchar(2048) NOT NULL,
	`client_name` varchar(255) NOT NULL,
	`resource` varchar(2048) NOT NULL,
	`scopes` json NOT NULL,
	`allowed_team_ids` json NOT NULL,
	`auth_generation` int NOT NULL,
	`credential_digest` varchar(64) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`revoked_at` datetime(3),
	`last_used_at` datetime(3),
	CONSTRAINT `agent_oauth_grants_id` PRIMARY KEY(`id`)
);

--> statement-breakpoint
CREATE TABLE `agent_oauth_requests` (
	`id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`session_digest` varchar(64) NOT NULL,
	`auth_generation` int NOT NULL,
	`credential_digest` varchar(64) NOT NULL,
	`authorization_url` varchar(8192) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`consumed_at` datetime(3),
	CONSTRAINT `agent_oauth_requests_id` PRIMARY KEY(`id`)
);

--> statement-breakpoint
CREATE INDEX `agent_oauth_grants_user_idx` ON `agent_oauth_grants` (`user_id`);
