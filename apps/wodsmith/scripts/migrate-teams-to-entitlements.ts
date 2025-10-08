/**
 * Migration script to assign all existing teams to the Free plan
 * and create team_subscription records
 *
 * Run with: pnpm tsx scripts/migrate-teams-to-entitlements.ts
 */

import { eq } from "drizzle-orm";
import { getDd } from "../src/utils/get-db";
import { teamSubscriptionTable, teamTable } from "../src/db/schema";

async function migrateTeamsToEntitlements() {
  console.log("Starting migration of teams to entitlements system...\n");

  const db = getDd();

  // 1. Get all teams
  const teams = await db.query.teamTable.findMany();

  console.log(`Found ${teams.length} teams to migrate\n`);

  let updatedTeams = 0;
  let createdSubscriptions = 0;
  let skippedTeams = 0;

  for (const team of teams) {
    console.log(`Processing team: ${team.name} (${team.id})`);

    try {
      // Check if team already has a plan
      if (team.currentPlanId) {
        console.log(`  ✓ Already has plan: ${team.currentPlanId}`);
        skippedTeams++;

        // Check if subscription exists
        const existingSubscription =
          await db.query.teamSubscriptionTable.findFirst({
            where: eq(teamSubscriptionTable.teamId, team.id),
          });

        if (!existingSubscription) {
          // Create subscription record
          const now = new Date();
          const oneMonthFromNow = new Date(now);
          oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

          await db.insert(teamSubscriptionTable).values({
            teamId: team.id,
            planId: team.currentPlanId,
            status: "active",
            currentPeriodStart: now,
            currentPeriodEnd: oneMonthFromNow,
            cancelAtPeriodEnd: 0,
          });

          console.log(`  ✓ Created subscription record`);
          createdSubscriptions++;
        }

        continue;
      }

      // Update team to free plan
      await db
        .update(teamTable)
        .set({ currentPlanId: "free" })
        .where(eq(teamTable.id, team.id));

      console.log(`  ✓ Updated to free plan`);
      updatedTeams++;

      // Create subscription record
      const now = new Date();
      const oneMonthFromNow = new Date(now);
      oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

      await db.insert(teamSubscriptionTable).values({
        teamId: team.id,
        planId: "free",
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: oneMonthFromNow,
        cancelAtPeriodEnd: 0,
      });

      console.log(`  ✓ Created subscription record`);
      createdSubscriptions++;
    } catch (error) {
      console.error(`  ✗ Error migrating team ${team.id}:`, error);
    }

    console.log(""); // blank line
  }

  console.log("=".repeat(60));
  console.log("Migration Summary:");
  console.log(`  Total teams: ${teams.length}`);
  console.log(`  Updated to free plan: ${updatedTeams}`);
  console.log(`  Subscriptions created: ${createdSubscriptions}`);
  console.log(`  Skipped (already migrated): ${skippedTeams}`);
  console.log("=".repeat(60));
  console.log("\n✓ Migration completed successfully!");
}

// Run the migration
migrateTeamsToEntitlements().catch((error) => {
  console.error("\n✗ Migration failed:", error);
  process.exit(1);
});
