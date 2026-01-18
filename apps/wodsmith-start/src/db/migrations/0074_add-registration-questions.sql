-- Custom registration questions for competitions
CREATE TABLE IF NOT EXISTS `competition_registration_questions` (
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`competitionId` text NOT NULL,
	`type` text(20) NOT NULL,
	`label` text(500) NOT NULL,
	`helpText` text(1000),
	`options` text(5000),
	`required` integer DEFAULT true NOT NULL,
	`forTeammates` integer DEFAULT false NOT NULL,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`competitionId`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `comp_reg_questions_competition_idx` ON `competition_registration_questions` (`competitionId`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `comp_reg_questions_sort_idx` ON `competition_registration_questions` (`competitionId`,`sortOrder`);
--> statement-breakpoint
-- Athlete answers to registration questions
CREATE TABLE IF NOT EXISTS `competition_registration_answers` (
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`questionId` text NOT NULL,
	`registrationId` text NOT NULL,
	`userId` text NOT NULL,
	`answer` text(5000) NOT NULL,
	FOREIGN KEY (`questionId`) REFERENCES `competition_registration_questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`registrationId`) REFERENCES `competition_registrations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `comp_reg_answers_question_idx` ON `competition_registration_answers` (`questionId`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `comp_reg_answers_registration_idx` ON `competition_registration_answers` (`registrationId`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `comp_reg_answers_user_idx` ON `competition_registration_answers` (`userId`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `comp_reg_answers_unique_idx` ON `competition_registration_answers` (`questionId`,`registrationId`,`userId`);
