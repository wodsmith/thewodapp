#!/usr/bin/env tsx
/**
 * Load transformed data into PlanetScale
 *
 * Reads JSON files produced by transform-data.ts and bulk-inserts them
 * into PlanetScale using batch INSERT ... ON DUPLICATE KEY UPDATE for
 * idempotent re-runs.
 *
 * Usage:
 *   DATABASE_URL=mysql://... pnpm tsx scripts/migration/load-planetscale.ts
 *
 * Options:
 *   --table <name>    Load only a specific table
 *   --dry-run         Print what would be done without executing
 */

import { Client } from "@planetscale/database"
import fs from "node:fs"
import path from "node:path"

const transformedDir = path.join(__dirname, "transformed-data")
const BATCH_SIZE = 1000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escape a MySQL identifier */
function esc(name: string): string {
	return `\`${name}\``
}

/**
 * Build a batch INSERT ... ON DUPLICATE KEY UPDATE statement.
 *
 * PlanetScale (Vitess) supports this syntax for idempotent upserts.
 * On conflict the row is updated with the incoming values so re-runs
 * converge to the same state.
 */
function buildBatchInsert(
	tableName: string,
	columns: string[],
	rowCount: number,
): string {
	const colList = columns.map(esc).join(", ")
	const singleRow = `(${columns.map(() => "?").join(", ")})`
	const allRows = Array.from({ length: rowCount }, () => singleRow).join(", ")

	// ON DUPLICATE KEY UPDATE: update every non-PK column with the incoming
	// value. We include all columns so the statement is truly idempotent.
	const updateClauses = columns
		.map((c) => `${esc(c)} = VALUES(${esc(c)})`)
		.join(", ")

	return `INSERT INTO ${esc(tableName)} (${colList}) VALUES ${allRows} ON DUPLICATE KEY UPDATE ${updateClauses}`
}

/**
 * Flatten a batch of rows into a single parameter array matching the
 * positional placeholders produced by buildBatchInsert.
 */
function flattenParams(
	rows: Record<string, unknown>[],
	columns: string[],
): unknown[] {
	const params: unknown[] = []
	for (const row of rows) {
		for (const col of columns) {
			const val = row[col]
			// Convert JS booleans to 0/1 for MySQL driver compatibility
			if (typeof val === "boolean") {
				params.push(val ? 1 : 0)
			} else if (val === undefined) {
				params.push(null)
			} else {
				params.push(val)
			}
		}
	}
	return params
}

// ---------------------------------------------------------------------------
// Core loader
// ---------------------------------------------------------------------------

interface LoadResult {
	table: string
	total: number
	inserted: number
	errors: number
	skipped: boolean
}

async function loadTable(
	client: Client,
	tableName: string,
	dryRun: boolean,
): Promise<LoadResult> {
	const dataPath = path.join(transformedDir, `${tableName}.json`)
	if (!fs.existsSync(dataPath)) {
		console.log(`  [skip] No data file for ${tableName}`)
		return { table: tableName, total: 0, inserted: 0, errors: 0, skipped: true }
	}

	const data = JSON.parse(
		fs.readFileSync(dataPath, "utf-8"),
	) as Record<string, unknown>[]

	if (data.length === 0) {
		console.log(`  [skip] ${tableName}: 0 rows`)
		return { table: tableName, total: 0, inserted: 0, errors: 0, skipped: true }
	}

	const columns = Object.keys(data[0])
	let inserted = 0
	let errors = 0

	for (let offset = 0; offset < data.length; offset += BATCH_SIZE) {
		const batch = data.slice(offset, offset + BATCH_SIZE)

		if (dryRun) {
			inserted += batch.length
			console.log(
				`  [dry-run] ${tableName}: batch ${Math.floor(offset / BATCH_SIZE) + 1} (${batch.length} rows)`,
			)
			continue
		}

		const sql = buildBatchInsert(tableName, columns, batch.length)
		const params = flattenParams(batch, columns)

		try {
			await client.execute(sql, params)
			inserted += batch.length
		} catch (error) {
			// If the batch fails, fall back to row-by-row insertion so a
			// single bad row doesn't block the rest of the batch.
			console.error(
				`  [warn] Batch insert failed for ${tableName} (offset ${offset}), falling back to row-by-row:`,
				error instanceof Error ? error.message : error,
			)

			const singleSql = buildBatchInsert(tableName, columns, 1)
			for (const row of batch) {
				try {
					const singleParams = flattenParams([row], columns)
					await client.execute(singleSql, singleParams)
					inserted++
				} catch (rowError) {
					errors++
					console.error(
						`  [error] Failed row in ${tableName}:`,
						rowError instanceof Error ? rowError.message : rowError,
					)
					console.error(`          Row id: ${row.id ?? "(no id)"}`)
				}
			}
		}

		const progress = Math.min(offset + BATCH_SIZE, data.length)
		console.log(`  ${tableName}: ${progress}/${data.length} rows processed`)
	}

	return { table: tableName, total: data.length, inserted, errors, skipped: false }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	const connectionUrl = process.env.DATABASE_URL
	if (!connectionUrl) {
		console.error("DATABASE_URL environment variable is required")
		process.exit(1)
	}

	const manifestPath = path.join(transformedDir, "manifest.json")
	if (!fs.existsSync(manifestPath)) {
		console.error(
			"manifest.json not found in transformed-data/. Run transform-data.ts first.",
		)
		process.exit(1)
	}

	const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
		tables: string[]
		extractedAt: string
		rowCounts: Record<string, number>
	}

	// Parse CLI flags
	const args = process.argv.slice(2)
	const dryRun = args.includes("--dry-run")
	const tableIdx = args.indexOf("--table")
	const onlyTable = tableIdx !== -1 ? args[tableIdx + 1] : null

	if (onlyTable && !manifest.tables.includes(onlyTable)) {
		console.error(
			`Table "${onlyTable}" not found in manifest. Available: ${manifest.tables.join(", ")}`,
		)
		process.exit(1)
	}

	const tablesToLoad = onlyTable
		? [onlyTable]
		: manifest.tables

	const client = new Client({ url: connectionUrl })
	console.log("Connected to PlanetScale")
	console.log(
		`Loading ${tablesToLoad.length} table(s)${dryRun ? " (DRY RUN)" : ""}...\n`,
	)

	const results: LoadResult[] = []

	for (const table of tablesToLoad) {
		console.log(`Loading ${table}...`)
		const result = await loadTable(client, table, dryRun)
		results.push(result)
	}

	// Summary
	console.log("\n=== Load Summary ===")
	console.log(
		"Table".padEnd(45) +
			"Total".padEnd(10) +
			"Loaded".padEnd(10) +
			"Errors".padEnd(10) +
			"Status",
	)
	console.log("-".repeat(85))

	let totalErrors = 0
	for (const r of results) {
		if (r.skipped) continue
		totalErrors += r.errors
		const status =
			r.errors > 0 ? "PARTIAL" : r.inserted === r.total ? "OK" : "SKIPPED"
		console.log(
			r.table.padEnd(45) +
				String(r.total).padEnd(10) +
				String(r.inserted).padEnd(10) +
				String(r.errors).padEnd(10) +
				status,
		)
	}

	if (totalErrors > 0) {
		console.log(`\nCompleted with ${totalErrors} error(s).`)
		process.exit(1)
	}

	console.log("\nAll tables loaded successfully.")
}

main().catch((err) => {
	console.error("Fatal error:", err)
	process.exit(1)
})
