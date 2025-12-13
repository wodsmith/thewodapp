-- Add transitionMinutes column to competition_venues
ALTER TABLE competition_venues ADD COLUMN transitionMinutes INTEGER NOT NULL DEFAULT 3;
