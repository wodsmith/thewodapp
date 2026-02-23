#!/usr/bin/env tsx
/**
 * E2E Database Setup Script
 *
 * Sets up the MySQL database for E2E tests:
 * 1. Pushes schema via drizzle-kit
 * 2. Seeds base data
 * 3. Seeds E2E test data
 */

import { execSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const APP_DIR = join(__dirname, "..")

function runCommand(command: string, description: string): void {
	console.log(`\n${description}...`)
	try {
		execSync(command, {
			cwd: APP_DIR,
			stdio: "inherit",
			env: { ...process.env },
		})
		console.log(`${description} completed`)
	} catch (error) {
		console.error(`${description} failed`)
		throw error
	}
}

async function main(): Promise<void> {
	if (!process.env.DATABASE_URL) {
		console.error("DATABASE_URL environment variable is required")
		process.exit(1)
	}

	console.log("Setting up E2E test database...")
	console.log("=".repeat(50))

	// Step 1: Push schema
	runCommand("pnpm db:push", "Pushing database schema")

	// Step 2: Run base seed
	runCommand("pnpm db:seed", "Seeding base data")

	// Step 3: Run E2E seed
	runCommand("pnpm tsx scripts/seed-e2e.ts", "Seeding E2E test data")

	console.log("\n" + "=".repeat(50))
	console.log("E2E database setup complete!")
	console.log("\nTest credentials:")
	console.log("  Email:    test@wodsmith.com")
	console.log("  Password: TestPassword123!")
}

main().catch((error) => {
	console.error("\nE2E database setup failed:", error.message)
	process.exit(1)
})
