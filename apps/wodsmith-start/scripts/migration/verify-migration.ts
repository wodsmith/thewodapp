#!/usr/bin/env tsx
/**
 * Verify data integrity after D1 → PlanetScale migration
 *
 * Connects to both the local D1 SQLite file and the remote PlanetScale
 * database, then for every table:
 *   1. Compares row counts
 *   2. Spot-checks 5 random records by primary key
 *
 * Usage:
 *   DATABASE_URL=mysql://... pnpm tsx scripts/migration/verify-migration.ts <d1-sqlite-path>
 *
 * The D1 path is typically:
 *   .alchemy/local/.wrangler/state/v3/d1/<uuid>/<name>.sqlite
 *
 * Exit codes:
 *   0 - All checks passed
 *   1 - One or more mismatches detected
 */

import Database from "better-sqlite3"
import { Client } from "@planetscale/database"

const SPOT_CHECK_COUNT = 5

// ---------------------------------------------------------------------------
// D1 helpers (better-sqlite3)
// ---------------------------------------------------------------------------

function getD1Tables(db: Database.Database): string[] {
	const rows = db
		.prepare(
			"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_%' AND name NOT LIKE 'd1_%' AND name != '__drizzle_migrations'",
		)
		.all() as { name: string }[]

	return rows.map((r) => r.name)
}

function getD1Count(db: Database.Database, table: string): number {
	try {
		const row = db
			.prepare(`SELECT COUNT(*) as count FROM "${table}"`)
			.get() as { count: number }
		return row.count
	} catch {
		return -1 // table does not exist
	}
}

function getD1RandomIds(
	db: Database.Database,
	table: string,
	limit: number,
): string[] {
	try {
		const rows = db
			.prepare(
				`SELECT id FROM "${table}" WHERE id IS NOT NULL ORDER BY RANDOM() LIMIT ?`,
			)
			.all(limit) as { id: string }[]
		return rows.map((r) => r.id)
	} catch {
		return []
	}
}

function getD1Row(
	db: Database.Database,
	table: string,
	id: string,
): Record<string, unknown> | null {
	try {
		return db
			.prepare(`SELECT * FROM "${table}" WHERE id = ?`)
			.get(id) as Record<string, unknown> | null
	} catch {
		return null
	}
}

// ---------------------------------------------------------------------------
// PlanetScale helpers (@planetscale/database)
// ---------------------------------------------------------------------------

async function getPSTables(client: Client): Promise<string[]> {
	const result = await client.execute("SHOW TABLES")
	return result.rows.map(
		(row) => Object.values(row as Record<string, string>)[0],
	)
}

async function getPSCount(client: Client, table: string): Promise<number> {
	try {
		const result = await client.execute(
			`SELECT COUNT(*) as count FROM \`${table}\``,
		)
		const row = result.rows[0] as { count: number } | undefined
		return row ? Number(row.count) : -1
	} catch {
		return -1
	}
}

async function getPSRow(
	client: Client,
	table: string,
	id: string,
): Promise<Record<string, unknown> | null> {
	try {
		const result = await client.execute(
			`SELECT * FROM \`${table}\` WHERE id = ?`,
			[id],
		)
		return (result.rows[0] as Record<string, unknown>) ?? null
	} catch {
		return null
	}
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

/**
 * Normalize a value for comparison purposes.
 *
 * D1 stores booleans as 0/1 integers and timestamps as epoch integers.
 * After transformation these become actual booleans and ISO datetime strings
 * in PlanetScale. We normalize both sides to strings for comparison.
 */
function normalize(value: unknown): string {
	if (value === null || value === undefined) return "<null>"
	if (typeof value === "boolean") return value ? "1" : "0"
	if (typeof value === "number") return String(value)
	if (value instanceof Date) return value.toISOString()
	return String(value)
}

interface SpotCheckResult {
	id: string
	match: boolean
	mismatched: string[] // column names that differ
}

function compareRows(
	d1Row: Record<string, unknown>,
	psRow: Record<string, unknown>,
): SpotCheckResult {
	const id = String(d1Row.id ?? psRow.id ?? "?")
	const mismatched: string[] = []

	// Compare all columns present in either row
	const allCols = new Set([...Object.keys(d1Row), ...Object.keys(psRow)])
	for (const col of allCols) {
		// Skip update_counter / updateCounter as it may legitimately differ
		if (col === "update_counter" || col === "updateCounter") continue

		const d1Val = normalize(d1Row[col])
		const psVal = normalize(psRow[col])
		if (d1Val !== psVal) {
			mismatched.push(col)
		}
	}

	return { id, match: mismatched.length === 0, mismatched }
}

// ---------------------------------------------------------------------------
// Main verification
// ---------------------------------------------------------------------------

interface TableResult {
	table: string
	d1Count: number
	psCount: number
	countMatch: boolean
	spotChecks: SpotCheckResult[]
	spotCheckPassed: boolean
}

async function verifyTable(
	d1: Database.Database,
	psClient: Client,
	table: string,
): Promise<TableResult> {
	const d1Count = getD1Count(d1, table)
	const psCount = await getPSCount(psClient, table)
	const countMatch = d1Count === psCount

	// Spot-check random records
	const spotChecks: SpotCheckResult[] = []
	const randomIds = getD1RandomIds(d1, table, SPOT_CHECK_COUNT)

	for (const id of randomIds) {
		const d1Row = getD1Row(d1, table, id)
		const psRow = await getPSRow(psClient, table, id)

		if (!d1Row && !psRow) {
			spotChecks.push({ id, match: true, mismatched: [] })
			continue
		}

		if (!d1Row || !psRow) {
			spotChecks.push({
				id,
				match: false,
				mismatched: ["<row missing in one database>"],
			})
			continue
		}

		spotChecks.push(compareRows(d1Row, psRow))
	}

	const spotCheckPassed = spotChecks.every((sc) => sc.match)

	return { table, d1Count, psCount, countMatch, spotChecks, spotCheckPassed }
}

async function main() {
	const d1Path = process.argv[2]
	const psUrl = process.env.DATABASE_URL

	if (!d1Path || !psUrl) {
		console.error(
			"Usage: DATABASE_URL=mysql://... pnpm tsx scripts/migration/verify-migration.ts <d1-sqlite-path>",
		)
		process.exit(1)
	}

	console.log(`D1 path: ${d1Path}`)
	console.log("Connecting to PlanetScale...\n")

	const d1 = new Database(d1Path, { readonly: true })
	const psClient = new Client({ url: psUrl })

	// Get table lists from both sides
	const d1Tables = getD1Tables(d1)
	const psTables = await getPSTables(psClient)
	const allTables = [...new Set([...d1Tables, ...psTables])].sort()

	console.log(
		`Found ${d1Tables.length} D1 tables, ${psTables.length} PlanetScale tables\n`,
	)

	// Verify each table
	const results: TableResult[] = []
	for (const table of allTables) {
		process.stdout.write(`Verifying ${table}...`)
		const result = await verifyTable(d1, psClient, table)
		results.push(result)
		console.log(
			result.countMatch && result.spotCheckPassed ? " OK" : " ISSUES FOUND",
		)
	}

	d1.close()

	// Print summary
	console.log("\n=== Migration Verification Report ===\n")
	console.log(
		"Table".padEnd(45) +
			"D1".padEnd(10) +
			"PS".padEnd(10) +
			"Count".padEnd(10) +
			"Spot-check",
	)
	console.log("-".repeat(85))

	let hasErrors = false

	for (const r of results) {
		const countStatus = r.d1Count === -1 || r.psCount === -1
			? "N/A"
			: r.countMatch
				? "OK"
				: "MISMATCH"
		const spotStatus =
			r.spotChecks.length === 0
				? "N/A"
				: r.spotCheckPassed
					? `OK (${r.spotChecks.length})`
					: "FAIL"

		if (countStatus === "MISMATCH" || spotStatus === "FAIL") {
			hasErrors = true
		}

		console.log(
			r.table.padEnd(45) +
				String(r.d1Count === -1 ? "-" : r.d1Count).padEnd(10) +
				String(r.psCount === -1 ? "-" : r.psCount).padEnd(10) +
				countStatus.padEnd(10) +
				spotStatus,
		)
	}

	// Print details for failures
	const failures = results.filter((r) => !r.countMatch || !r.spotCheckPassed)
	if (failures.length > 0) {
		console.log("\n=== Failure Details ===\n")
		for (const r of failures) {
			if (!r.countMatch) {
				console.log(
					`[COUNT MISMATCH] ${r.table}: D1=${r.d1Count}, PlanetScale=${r.psCount} (delta: ${r.psCount - r.d1Count})`,
				)
			}
			for (const sc of r.spotChecks) {
				if (!sc.match) {
					console.log(
						`[SPOT-CHECK FAIL] ${r.table} id=${sc.id}: mismatched columns: ${sc.mismatched.join(", ")}`,
					)
				}
			}
		}
	}

	console.log(
		`\n${hasErrors ? "VERIFICATION FAILED - mismatches detected" : "ALL CHECKS PASSED"}`,
	)
	process.exit(hasErrors ? 1 : 0)
}

main().catch((err) => {
	console.error("Fatal error:", err)
	process.exit(1)
})
