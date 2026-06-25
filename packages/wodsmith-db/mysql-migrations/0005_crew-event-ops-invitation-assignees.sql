ALTER TABLE `competition_judge_rotations` MODIFY COLUMN `membership_id` varchar(255);--> statement-breakpoint
ALTER TABLE `judge_heat_assignments` MODIFY COLUMN `membership_id` varchar(255);--> statement-breakpoint
ALTER TABLE `volunteer_shift_assignments` MODIFY COLUMN `membership_id` varchar(255);--> statement-breakpoint
ALTER TABLE `competition_judge_rotations` ADD `invitation_id` varchar(255);--> statement-breakpoint
ALTER TABLE `judge_heat_assignments` ADD `invitation_id` varchar(255);--> statement-breakpoint
ALTER TABLE `volunteer_shift_assignments` ADD `invitation_id` varchar(255);--> statement-breakpoint
ALTER TABLE `judge_heat_assignments` ADD CONSTRAINT `judge_heat_assignments_invitation_unique_idx` UNIQUE(`heat_id`,`invitation_id`,`version_id`);--> statement-breakpoint
ALTER TABLE `volunteer_shift_assignments` ADD CONSTRAINT `volunteer_shift_assignments_invitation_unique_idx` UNIQUE(`shift_id`,`invitation_id`);--> statement-breakpoint
CREATE INDEX `competition_judge_rotations_invitation_idx` ON `competition_judge_rotations` (`invitation_id`);--> statement-breakpoint
CREATE INDEX `judge_heat_assignments_invitation_idx` ON `judge_heat_assignments` (`invitation_id`);--> statement-breakpoint
CREATE INDEX `volunteer_shift_assignments_invitation_idx` ON `volunteer_shift_assignments` (`invitation_id`);