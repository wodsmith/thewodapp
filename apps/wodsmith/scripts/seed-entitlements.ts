/**
 * Seed script for entitlement types and plans
 * Run with: pnpm tsx scripts/seed-entitlements.ts
 */

import { drizzle } from "drizzle-orm/d1"
import {
	ENTITLEMENT_TYPES,
	PLANS,
	entitlementTypeTable,
	planTable,
} from "../src/db/schema"

// Helper to get D1 database (you'll need to adjust this based on your setup)
async function getD1Database() {
	// For local development
	if (process.env.NODE_ENV !== "production") {
		// This assumes you're using wrangler dev or similar
		// You might need to adjust this based on your setup
		const { unstable_dev } = await import("wrangler")
		const worker = await unstable_dev("src/index.ts", {
			experimental: { disableExperimentalWarning: true },
		})
		// @ts-expect-error - accessing internal API
		return worker.db
	}

	throw new Error(
		"Production seeding not implemented yet. Use wrangler d1 execute instead.",
	)
}

async function seedEntitlementTypes(db: ReturnType<typeof drizzle>) {
	console.log("Seeding entitlement types...")

	const entitlementTypesToSeed = [
		{
			name: ENTITLEMENT_TYPES.PROGRAMMING_TRACK_ACCESS,
			description: "Access to individual programming tracks via purchase",
		},
		{
			name: ENTITLEMENT_TYPES.AI_MESSAGE_CREDITS,
			description: "AI message credits for workout generation and suggestions",
		},
		{
			name: ENTITLEMENT_TYPES.FEATURE_TRIAL,
			description: "Time-limited trial access to premium features",
		},
		{
			name: ENTITLEMENT_TYPES.MANUAL_FEATURE_GRANT,
			description: "Manual feature grants by administrators",
		},
		{
			name: ENTITLEMENT_TYPES.SUBSCRIPTION_SEAT,
			description: "Subscription seat tracking for team plans",
		},
		{
			name: ENTITLEMENT_TYPES.ADDON_ACCESS,
			description: "Access via purchased add-ons",
		},
	]

	for (const type of entitlementTypesToSeed) {
		try {
			await db.insert(entitlementTypeTable).values(type)
			console.log(`✓ Created entitlement type: ${type.name}`)
		} catch (error) {
			console.log(`✗ Entitlement type ${type.name} already exists or error:`, error)
		}
	}
}

async function seedPlans(db: ReturnType<typeof drizzle>) {
	console.log("\nSeeding plans...")

	const plansToSeed = Object.values(PLANS).map((plan) => ({
		id: plan.id,
		name: plan.name,
		description: plan.description,
		price: plan.price,
		interval: plan.interval,
		isActive: plan.isActive ? 1 : 0,
		isPublic: plan.isPublic ? 1 : 0,
		sortOrder: plan.sortOrder,
		entitlements: JSON.stringify(plan.entitlements),
		stripePriceId: plan.stripePriceId,
		stripeProductId: plan.stripeProductId,
	}))

	for (const plan of plansToSeed) {
		try {
			await db.insert(planTable).values(plan)
			console.log(`✓ Created plan: ${plan.name} (${plan.id})`)
		} catch (error) {
			console.log(`✗ Plan ${plan.name} already exists or error:`, error)
		}
	}
}

async function main() {
	console.log("Starting entitlements seed script...\n")

	try {
		const db = await getD1Database()

		await seedEntitlementTypes(db)
		await seedPlans(db)

		console.log("\n✓ Seeding completed successfully!")
	} catch (error) {
		console.error("\n✗ Seeding failed:", error)
		process.exit(1)
	}
}

// Run the script
main()
