/**
 * Migration script to snapshot entitlements for all existing teams
 *
 * This script migrates teams from the old plan-based system to the new
 * snapshot-based system. It creates team-specific entitlement records
 * based on each team's current plan.
 *
 * Run with: pnpm tsx scripts/migrate-snapshot-team-entitlements.ts
 */

import { snapshotAllTeams } from "../src/server/entitlements"

async function main() {
  console.log("Starting team entitlements snapshot migration...\n")

  try {
    console.log("Snapshotting entitlements for all teams...")

    const result = await snapshotAllTeams()

    console.log("\n" + "=".repeat(60))
    console.log(`Migration complete!`)
    console.log(`  Successful: ${result.success}`)
    console.log(`  Failed: ${result.failed}`)
    console.log("=".repeat(60))

    if (result.errors.length > 0) {
      console.warn("\n⚠️  Some teams failed to migrate:")
      for (const error of result.errors) {
        console.error(`  - Team ${error.teamId}: ${error.error}`)
      }
      process.exit(1)
    }

    console.log("\n✅ All teams successfully migrated to snapshot system!")
  } catch (error) {
    console.error("\n✗ Migration failed:", error)
    process.exit(1)
  }
}

// Run the script
main()
