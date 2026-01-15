-- Manual migration script for 0072_competition-dates-to-text
-- This must be run manually because D1 migrations through Alchemy don't preserve PRAGMA state
--
-- Run with:
--   Production: npx wrangler d1 execute wodsmith-db-prod --file=scripts/manual-migration-0072.sql --remote
--   Demo:       npx wrangler d1 execute wodsmith-db-demo --file=scripts/manual-migration-0072.sql --remote
--
-- IMPORTANT: This should be run in a single transaction to ensure PRAGMA foreign_keys=OFF applies

BEGIN TRANSACTION;

PRAGMA foreign_keys=OFF;

-- Create new table with TEXT date columns
CREATE TABLE "competitions_new" (
    "id" text PRIMARY KEY NOT NULL,
    "createdAt" integer DEFAULT (unixepoch()) NOT NULL,
    "updatedAt" integer DEFAULT (unixepoch()) NOT NULL,
    "updateCounter" integer DEFAULT 0,
    "organizingTeamId" text NOT NULL REFERENCES "team"("id") ON DELETE CASCADE,
    "competitionTeamId" text NOT NULL REFERENCES "team"("id") ON DELETE CASCADE,
    "groupId" text REFERENCES "competition_groups"("id") ON DELETE SET NULL,
    "slug" text(255) NOT NULL UNIQUE,
    "name" text(255) NOT NULL,
    "description" text(2000),
    "startDate" text NOT NULL,
    "endDate" text NOT NULL,
    "registrationOpensAt" text,
    "registrationClosesAt" text,
    "settings" text(10000),
    "defaultRegistrationFeeCents" integer DEFAULT 0,
    "platformFeePercentage" integer,
    "platformFeeFixed" integer,
    "passStripeFeesToCustomer" integer DEFAULT false,
    "passPlatformFeesToCustomer" integer DEFAULT true,
    "visibility" text(10) DEFAULT 'public' NOT NULL,
    "status" text(20) DEFAULT 'draft' NOT NULL,
    "profileImageUrl" text(600),
    "bannerImageUrl" text(600),
    "defaultHeatsPerRotation" integer DEFAULT 4,
    "defaultLaneShiftPattern" text(20) DEFAULT 'stay'
);

-- Copy data with timestamp conversion
INSERT INTO "competitions_new" SELECT
    "id", "createdAt", "updatedAt", "updateCounter",
    "organizingTeamId", "competitionTeamId", "groupId",
    "slug", "name", "description",
    CASE
        WHEN typeof("startDate") = 'integer' THEN strftime('%Y-%m-%d', "startDate", 'unixepoch')
        ELSE "startDate"
    END,
    CASE
        WHEN typeof("endDate") = 'integer' THEN strftime('%Y-%m-%d', "endDate", 'unixepoch')
        ELSE "endDate"
    END,
    CASE
        WHEN "registrationOpensAt" IS NULL THEN NULL
        WHEN typeof("registrationOpensAt") = 'integer' THEN strftime('%Y-%m-%d', "registrationOpensAt", 'unixepoch')
        ELSE "registrationOpensAt"
    END,
    CASE
        WHEN "registrationClosesAt" IS NULL THEN NULL
        WHEN typeof("registrationClosesAt") = 'integer' THEN strftime('%Y-%m-%d', "registrationClosesAt", 'unixepoch')
        ELSE "registrationClosesAt"
    END,
    "settings", "defaultRegistrationFeeCents", "platformFeePercentage", "platformFeeFixed",
    "passStripeFeesToCustomer", "passPlatformFeesToCustomer",
    "visibility", "status", "profileImageUrl", "bannerImageUrl",
    "defaultHeatsPerRotation", "defaultLaneShiftPattern"
FROM "competitions";

-- Drop old table and rename
DROP TABLE "competitions";
ALTER TABLE "competitions_new" RENAME TO "competitions";

-- Recreate indexes
CREATE INDEX "competitions_organizing_team_idx" ON "competitions" ("organizingTeamId");
CREATE INDEX "competitions_group_idx" ON "competitions" ("groupId");
CREATE INDEX "competitions_status_idx" ON "competitions" ("status");
CREATE INDEX "competitions_start_date_idx" ON "competitions" ("startDate");

-- Mark migration as applied in d1_migrations table
INSERT INTO "d1_migrations" ("id", "name", "applied_at")
VALUES (72, '0072_competition-dates-to-text', CURRENT_TIMESTAMP);

PRAGMA foreign_keys=ON;

COMMIT;
