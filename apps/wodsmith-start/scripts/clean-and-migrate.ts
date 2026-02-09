#!/usr/bin/env bun
/**
 * Clean PlanetScale dev branch and re-run migration.
 *
 * Usage:
 *   bun run scripts/clean-and-migrate.ts
 */

import { Client } from "@planetscale/database"
import { TABLE_ORDER } from "./migrate-d1-to-ps-lib"

// Use PlanetScale service token to create a temporary password
const PSCALE_TOKEN_ID = process.env.PLANETSCALE_SERVICE_TOKEN_ID
const PSCALE_TOKEN = process.env.PLANETSCALE_SERVICE_TOKEN
const PSCALE_ORG = process.env.PLANETSCALE_ORGANIZATION || "zac-wodsmith"
const DB_NAME = "wodsmith-db"
const BRANCH = "dev"

if (!PSCALE_TOKEN_ID || !PSCALE_TOKEN) {
	console.error("ERROR: Set PLANETSCALE_SERVICE_TOKEN_ID and PLANETSCALE_SERVICE_TOKEN in .env")
	process.exit(1)
}

const API_BASE = `https://api.planetscale.com/v1/organizations/${PSCALE_ORG}/databases/${DB_NAME}`

async function psApi(path: string, method = "GET", body?: any) {
	const res = await fetch(`${API_BASE}${path}`, {
		method,
		headers: {
			Authorization: `${PSCALE_TOKEN_ID}:${PSCALE_TOKEN}`,
			"Content-Type": "application/json",
		},
		body: body ? JSON.stringify(body) : undefined,
	})
	if (!res.ok) {
		const text = await res.text()
		throw new Error(`PlanetScale API error ${res.status}: ${text}`)
	}
	return res.json()
}

async function main() {
	console.log("=== Clean & Re-migrate PlanetScale dev branch ===\n")

	// Step 1: Create a temporary password for the dev branch
	console.log("Creating temporary password...")
	const pw = await psApi(`/branches/${BRANCH}/passwords`, "POST", {
		role: "admin",
		name: `temp-migration-${Date.now()}`,
	})

	const host = pw.access_host_url || pw.hostname || pw.database_branch?.access_host_url
	console.log(`  Password response keys: ${Object.keys(pw).join(", ")}`)
	const dbUrl = `mysql://${pw.username}:${pw.plain_text}@${host}/${DB_NAME}?ssl={"rejectUnauthorized":true}`
	console.log(`  Password created: ${pw.name}, host: ${host}`)

	const client = new Client({ url: dbUrl })

	// Step 2: Delete all data from tables in reverse dependency order
	console.log("\nDeleting all data from tables (reverse dependency order)...")
	const reverseTables = [...TABLE_ORDER].reverse()

	// Also get any tables not in TABLE_ORDER
	const showTablesResult = await client.execute("SHOW TABLES")
	const allTables = showTablesResult.rows.map((r: any) => Object.values(r)[0] as string)
	const extraTables = allTables.filter((t) => !TABLE_ORDER.includes(t))

	// Delete extra tables first, then reverse order
	const deleteOrder = [...extraTables, ...reverseTables]

	for (const table of deleteOrder) {
		try {
			const result = await client.execute(`DELETE FROM \`${table}\``)
			const count = result.rowsAffected ?? 0
			if (count > 0) {
				console.log(`  ${table}: deleted ${count} rows`)
			}
		} catch (err: any) {
			console.error(`  ${table}: ERROR - ${err.message}`)
		}
	}

	console.log("\nAll tables cleaned.")

	// Step 3: Run the migration
	console.log("\n=== Running migration ===\n")

	// Import and spawn the migration script as a subprocess
	const proc = Bun.spawn(
		["bun", "run", "scripts/migrate-d1-to-ps.ts", "--url", dbUrl],
		{
			cwd: "/Users/ianjones/wodsmith/apps/wodsmith-start",
			stdout: "inherit",
			stderr: "inherit",
		},
	)
	const exitCode = await proc.exited
	if (exitCode !== 0) {
		console.error(`\nMigration failed with exit code ${exitCode}`)
		process.exit(1)
	}

	// Step 4: Verify sort keys
	console.log("\n=== Verifying sort key migration ===")
	const sortKeyCheck = await client.execute(
		"SELECT sort_key FROM scores WHERE sort_key IS NOT NULL LIMIT 5",
	)
	for (const row of sortKeyCheck.rows as any[]) {
		const sk = row.sort_key as string
		const len = sk.length
		const hasLeadingZeros = sk.startsWith("0")
		console.log(`  sort_key: ${sk} (length=${len}, leading_zeros=${hasLeadingZeros})`)
	}

	// Step 5: Clean up temporary password
	console.log("\nCleaning up temporary password...")
	try {
		await psApi(`/branches/${BRANCH}/passwords/${pw.id}`, "DELETE")
		console.log("  Password deleted.")
	} catch {
		console.log("  Could not delete password (may need manual cleanup)")
	}

	console.log("\n=== Done! ===")
}

main().catch((err) => {
	console.error("Fatal error:", err)
	process.exit(1)
})
