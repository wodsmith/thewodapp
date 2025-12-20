/**
 * Seed script for volunteer entitlement types
 * Run with: pnpm tsx scripts/seed-volunteer-entitlements.ts
 */

import { drizzle } from "drizzle-orm/d1";
import { entitlementTypeTable } from "../src/db/schema";

// Helper to get D1 database
async function getD1Database() {
	// For local development
	if (process.env.NODE_ENV !== "production") {
		const { unstable_dev } = await import("wrangler");
		const worker = await unstable_dev("src/index.ts", {
			experimental: { disableExperimentalWarning: true },
		});
		// @ts-expect-error - accessing internal API
		return worker.db;
	}

	throw new Error(
		"Production seeding not implemented yet. Use wrangler d1 execute instead.",
	);
}

async function seedVolunteerEntitlements(db: ReturnType<typeof drizzle>) {
	console.log("Seeding volunteer entitlement types...");

	const volunteerEntitlementTypes = [
		{
			id: "volunteer_score_access",
			name: "Volunteer Score Access",
			description:
				"Allows volunteer to input and edit scores for a competition",
		},
	];

	for (const type of volunteerEntitlementTypes) {
		try {
			await db
				.insert(entitlementTypeTable)
				.values(type)
				.onConflictDoNothing();
			console.log(`✓ Created entitlement type: ${type.name}`);
		} catch (error) {
			console.log(
				`✗ Entitlement type ${type.name} already exists or error:`,
				error,
			);
		}
	}
}

async function main() {
	console.log("Starting volunteer entitlements seed script...\n");

	try {
		const db = await getD1Database();
		await seedVolunteerEntitlements(db);
		console.log("\n✓ Volunteer entitlement seeding completed successfully!");
	} catch (error) {
		console.error("\n✗ Seeding failed:", error);
		process.exit(1);
	}
}

// Run the script
main();
