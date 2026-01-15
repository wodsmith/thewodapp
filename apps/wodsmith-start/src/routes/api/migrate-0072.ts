import { createAPIFileRoute } from '@tanstack/react-start/api'
import { db } from '@/db'
import { sql } from 'drizzle-orm'
import { env } from 'cloudflare:workers'

/**
 * ONE-TIME MIGRATION ENDPOINT for 0072_competition-dates-to-text
 *
 * This endpoint runs the migration using D1's batch() API to execute
 * all statements in a single transaction, avoiding FK constraint issues.
 *
 * DELETE THIS FILE after running the migration!
 *
 * To run:
 * Production: curl -X POST https://wodsmith.com/api/migrate-0072?secret=YOUR_SECRET
 * Demo: curl -X POST https://demo.wodsmith.com/api/migrate-0072?secret=YOUR_SECRET
 */
export const APIRoute = createAPIFileRoute('/api/migrate-0072')({
  POST: async ({ request }) => {
    // Basic security - require a secret parameter
    const url = new URL(request.url)
    const secret = url.searchParams.get('secret')

    // Set a secret in your environment or use a one-time secret
    const expectedSecret = env.MIGRATION_SECRET || 'change-me-in-env'

    if (secret !== expectedSecret) {
      return new Response('Unauthorized', { status: 401 })
    }

    try {
      // Check if migration already applied
      const existing = await db.all(
        sql`SELECT * FROM d1_migrations WHERE id = 72`
      )

      if (existing.length > 0) {
        return new Response(
          JSON.stringify({
            status: 'already_applied',
            message: 'Migration 0072 has already been applied'
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }

      // Execute migration using batch API for transaction support
      await db.batch([
        // Disable foreign keys
        sql`PRAGMA foreign_keys = OFF`,

        // Create new table WITHOUT foreign key constraints
        sql`CREATE TABLE "competitions_new" (
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
        )`,

        // Copy data with timestamp conversion
        sql`INSERT INTO "competitions_new" SELECT
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
        FROM "competitions"`,

        // Drop old table and rename
        sql`DROP TABLE "competitions"`,
        sql`ALTER TABLE "competitions_new" RENAME TO "competitions"`,

        // Recreate indexes
        sql`CREATE INDEX "competitions_organizing_team_idx" ON "competitions" ("organizingTeamId")`,
        sql`CREATE INDEX "competitions_group_idx" ON "competitions" ("groupId")`,
        sql`CREATE INDEX "competitions_status_idx" ON "competitions" ("status")`,
        sql`CREATE INDEX "competitions_start_date_idx" ON "competitions" ("startDate")`,

        // Mark migration as applied
        sql`INSERT INTO "d1_migrations" ("id", "name", "applied_at")
          VALUES (72, '0072_competition-dates-to-text', CURRENT_TIMESTAMP)`,

        // Re-enable foreign keys
        sql`PRAGMA foreign_keys = ON`,
      ])

      return new Response(
        JSON.stringify({
          status: 'success',
          message: 'Migration 0072 applied successfully'
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    } catch (error) {
      console.error('Migration failed:', error)
      return new Response(
        JSON.stringify({
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
  },
})
