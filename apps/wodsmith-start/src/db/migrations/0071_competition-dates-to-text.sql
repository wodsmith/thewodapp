-- Migration: Convert competition date fields from INTEGER timestamps to TEXT (YYYY-MM-DD)
-- This eliminates timezone bugs where UTC midnight timestamps display incorrectly in local time

-- SQLite doesn't support ALTER COLUMN, so we need to:
-- 1. Create a new table with the correct schema
-- 2. Copy data with conversion
-- 3. Drop old table
-- 4. Rename new table

-- Create new table with TEXT date columns
CREATE TABLE "competitions_new" (
    "id" text PRIMARY KEY NOT NULL,
    "created_at" integer DEFAULT (unixepoch()) NOT NULL,
    "updated_at" integer DEFAULT (unixepoch()) NOT NULL,
    "organizing_team_id" text NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
    "competition_team_id" text NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
    "group_id" text REFERENCES "competition_groups"("id") ON DELETE SET NULL,
    "slug" text(255) NOT NULL UNIQUE,
    "name" text(255) NOT NULL,
    "description" text(2000),
    "start_date" text NOT NULL,
    "end_date" text NOT NULL,
    "registration_opens_at" text,
    "registration_closes_at" text,
    "settings" text(10000),
    "default_registration_fee_cents" integer DEFAULT 0,
    "platform_fee_percentage" integer,
    "platform_fee_fixed" integer,
    "pass_stripe_fees_to_customer" integer DEFAULT false,
    "pass_platform_fees_to_customer" integer DEFAULT true,
    "visibility" text(10) DEFAULT 'public' NOT NULL,
    "status" text(20) DEFAULT 'draft' NOT NULL,
    "banner_image_url" text(500),
    "logo_image_url" text(500),
    "track_id" text REFERENCES "programming_tracks"("id") ON DELETE SET NULL
);

-- Copy data, converting timestamps to YYYY-MM-DD strings
INSERT INTO "competitions_new" (
    "id", "created_at", "updated_at", "organizing_team_id", "competition_team_id",
    "group_id", "slug", "name", "description", "start_date", "end_date",
    "registration_opens_at", "registration_closes_at", "settings",
    "default_registration_fee_cents", "platform_fee_percentage", "platform_fee_fixed",
    "pass_stripe_fees_to_customer", "pass_platform_fees_to_customer",
    "visibility", "status", "banner_image_url", "logo_image_url", "track_id"
)
SELECT
    "id", "created_at", "updated_at", "organizing_team_id", "competition_team_id",
    "group_id", "slug", "name", "description",
    strftime('%Y-%m-%d', "start_date", 'unixepoch') as "start_date",
    strftime('%Y-%m-%d', "end_date", 'unixepoch') as "end_date",
    CASE WHEN "registration_opens_at" IS NOT NULL
         THEN strftime('%Y-%m-%d', "registration_opens_at", 'unixepoch')
         ELSE NULL END as "registration_opens_at",
    CASE WHEN "registration_closes_at" IS NOT NULL
         THEN strftime('%Y-%m-%d', "registration_closes_at", 'unixepoch')
         ELSE NULL END as "registration_closes_at",
    "settings", "default_registration_fee_cents", "platform_fee_percentage",
    "platform_fee_fixed", "pass_stripe_fees_to_customer", "pass_platform_fees_to_customer",
    "visibility", "status", "banner_image_url", "logo_image_url", "track_id"
FROM "competitions";

-- Drop old table and rename new one
DROP TABLE "competitions";
ALTER TABLE "competitions_new" RENAME TO "competitions";

-- Recreate indexes
CREATE INDEX "competitions_organizing_team_idx" ON "competitions" ("organizing_team_id");
CREATE INDEX "competitions_group_idx" ON "competitions" ("group_id");
CREATE INDEX "competitions_status_idx" ON "competitions" ("status");
