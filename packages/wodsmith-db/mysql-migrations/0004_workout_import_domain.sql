-- Catalog only: deliberately no plan or team grants. Safe to rerun.
INSERT INTO features (id, `key`, name, description, category, is_active, created_at, updated_at, update_counter)
VALUES ('feat_ai_workout_import', 'ai_workout_import', 'AI Workout Import', 'Import a workout from text or an image for review', 'ai', 1, NOW(), NOW(), 0)
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), category = VALUES(category);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `workout_import_receipts` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`import_id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`revision` int NOT NULL,
	`idempotency_key` varchar(255) NOT NULL,
	`content_hash` varchar(64) NOT NULL,
	`workout_id` varchar(255) NOT NULL,
	`track_workout_id` varchar(255),
	CONSTRAINT `workout_import_receipts_import_id` PRIMARY KEY(`import_id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `workout_import_sessions` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`team_id` varchar(255) NOT NULL,
	`track_id` varchar(255),
	`revision` int NOT NULL DEFAULT 0,
	`proposal` json,
	`expires_at` datetime NOT NULL,
	`saved_workout_id` varchar(255),
	CONSTRAINT `workout_import_sessions_id` PRIMARY KEY(`id`)
);
