CREATE TABLE `document_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_entries_document_id_unique` ON `document_entries` (`document_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_entries_entry_id_document_id_unique` ON `document_entries` (`entry_id`,`document_id`);
