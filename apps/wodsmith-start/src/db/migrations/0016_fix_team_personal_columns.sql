-- Fix: Add missing personal team columns that weren't applied from migration 0013
-- This migration adds the isPersonalTeam and personalTeamOwnerId columns to the team table

ALTER TABLE `team` ADD COLUMN `isPersonalTeam` INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE `team` ADD COLUMN `personalTeamOwnerId` TEXT REFERENCES `user`(`id`);

-- Add index for personal team owner lookup
CREATE INDEX `team_personal_owner_idx` ON `team` (`personalTeamOwnerId`);