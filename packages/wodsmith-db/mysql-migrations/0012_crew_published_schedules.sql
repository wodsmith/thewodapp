CREATE TABLE `crew_published_schedules` (
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`update_counter` int DEFAULT 0,
	`competition_id` varchar(255) NOT NULL,
	`snapshot` json NOT NULL,
	`published_at` datetime NOT NULL,
	CONSTRAINT `crew_published_schedules_competition_id` PRIMARY KEY(`competition_id`)
);
