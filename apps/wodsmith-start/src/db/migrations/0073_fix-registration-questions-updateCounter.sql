-- Fix: Add missing updateCounter column to registration questions tables
ALTER TABLE competition_registration_questions ADD COLUMN updateCounter integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE competition_registration_answers ADD COLUMN updateCounter integer DEFAULT 0;
