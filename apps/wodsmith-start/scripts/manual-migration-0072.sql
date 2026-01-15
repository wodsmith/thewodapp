-- Manual migration script for 0072_competition-dates-to-text
--
-- STRATEGY: Since D1 doesn't preserve PRAGMA across statements, we:
-- 1. Create new table WITHOUT foreign keys
-- 2. Copy data
-- 3. Drop old table (no FK issues since new table has no FKs yet)
-- 4. Rename table
-- 5. Recreate indexes
-- 6. Record migration
--
-- Run with:
--   Production: npx wrangler d1 execute wodsmith-db-prod --file=scripts/manual-migration-0072.sql --remote
--   Demo:       npx wrangler d1 execute wodsmith-db-demo --file=scripts/manual-migration-0072.sql --remote

-- Create new table WITHOUT foreign key constraints (avoids FK issues during drop)
CREATE TABLE "competitions_new" (
    "id" text PRIMARY KEY NOT NULL,
    "createdAt" integer DEFAULT (unixepoch()) NOT NULL,
    "updatedAt" integer DEFAULT (unixepoch()) NOT NULL,
    "updateCounter" integer DEFAULT 0,
    "organizingTeamId" text NOT NULL,
    "competitionTeamId" text NOT NULL,
    "groupId" text,
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
);-->statement-breakpoint

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
