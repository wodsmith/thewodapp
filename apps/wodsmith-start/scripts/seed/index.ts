#!/usr/bin/env tsx
/**
 * Modular seed script for PlanetScale (MySQL).
 *
 * Usage:
 *   DATABASE_URL=mysql://... pnpm tsx scripts/seed/index.ts [--skip-cleanup] [--only <seeder>]
 *
 * Options:
 *   --skip-cleanup    Skip deleting existing data before seeding
 *   --only <name>     Run only a specific seeder (e.g. "03-users")
 */

import { createClient, closeClient } from "./db"
import { cleanup } from "./cleanup"

// Import all seeders in order
import { seed as seedGlobalDefaults } from "./seeders/01-global-defaults"
import { seed as seedBilling } from "./seeders/02-billing"
import { seed as seedUsers } from "./seeders/03-users"
import { seed as seedTeams } from "./seeders/04-teams"
import { seed as seedTeamMemberships } from "./seeders/05-team-memberships"
import { seed as seedTeamEntitlements } from "./seeders/06-team-entitlements"
import { seed as seedScheduling } from "./seeders/07-scheduling"
import { seed as seedMovementsTags } from "./seeders/08-movements-tags"
import { seed as seedWorkouts } from "./seeders/09-workouts"
import { seed as seedProgramming } from "./seeders/10-programming"
import { seed as seedCompetition } from "./seeders/11-competition"
import { seed as seedResults } from "./seeders/12-results"
import { seed as seedOrganizer } from "./seeders/13-organizer"

const seeders = [
	{ name: "01-global-defaults", fn: seedGlobalDefaults },
	{ name: "02-billing", fn: seedBilling },
	{ name: "03-users", fn: seedUsers },
	{ name: "04-teams", fn: seedTeams },
	{ name: "05-team-memberships", fn: seedTeamMemberships },
	{ name: "06-team-entitlements", fn: seedTeamEntitlements },
	{ name: "07-scheduling", fn: seedScheduling },
	{ name: "08-movements-tags", fn: seedMovementsTags },
	{ name: "09-workouts", fn: seedWorkouts },
	{ name: "10-programming", fn: seedProgramming },
	{ name: "11-competition", fn: seedCompetition },
	{ name: "12-results", fn: seedResults },
	{ name: "13-organizer", fn: seedOrganizer },
]

async function main() {
	const args = process.argv.slice(2)
	const skipCleanup = args.includes("--skip-cleanup")
	const onlyIdx = args.indexOf("--only")
	const onlyName = onlyIdx !== -1 ? args[onlyIdx + 1] : null

	if (onlyName) {
		const found = seeders.find((s) => s.name === onlyName)
		if (!found) {
			console.error(
				`Seeder "${onlyName}" not found. Available: ${seeders.map((s) => s.name).join(", ")}`,
			)
			process.exit(1)
		}
	}

	const client = await createClient()
	console.log("Connected to PlanetScale\n")

	if (!skipCleanup) {
		await cleanup(client)
	}

	const seedersToRun = onlyName
		? seeders.filter((s) => s.name === onlyName)
		: seeders

	const startTime = Date.now()

	for (const seeder of seedersToRun) {
		await seeder.fn(client)
	}

	const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
	console.log(`\nAll seeders completed in ${elapsed}s`)
	await closeClient()
}

main().catch((err) => {
	console.error("Fatal error:", err)
	process.exit(1)
})
