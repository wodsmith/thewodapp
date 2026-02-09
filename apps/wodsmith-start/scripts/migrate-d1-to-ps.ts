#!/usr/bin/env bun
/**
 * D1 → PlanetScale Data Migration Script
 *
 * Reads a D1 SQLite export (.sql dump) and loads data into PlanetScale MySQL.
 *
 * Usage:
 *   bun run scripts/migrate-d1-to-ps.ts --url <DATABASE_URL>
 *   bun run scripts/migrate-d1-to-ps.ts --url <DATABASE_URL> --dry-run
 *   DATABASE_URL=<url> bun run scripts/migrate-d1-to-ps.ts
 *
 * Expects the D1 export at: /Users/ianjones/wodsmith/d1-prod-export.sql
 */

import { Client } from "@planetscale/database"
import { readFileSync } from "node:fs"
import {
	TABLE_NAME_MAP,
	TABLE_ORDER,
	SKIP_TABLES,
	parseValues,
	parseCreateTable,
	buildInsert,
	type ParsedValue,
} from "./migrate-d1-to-ps-lib"

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")
const urlFlagIdx = args.indexOf("--url")
const DATABASE_URL =
	urlFlagIdx !== -1 ? args[urlFlagIdx + 1] : process.env.DATABASE_URL

if (!DATABASE_URL && !dryRun) {
	console.error("ERROR: Provide --url <DATABASE_URL> or set DATABASE_URL env")
	process.exit(1)
}

const SQL_FILE = "/Users/ianjones/wodsmith/d1-prod-export.sql"

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
	console.log("=== D1 → PlanetScale Migration ===")
	console.log(`Dry run: ${dryRun}`)
	console.log(`SQL file: ${SQL_FILE}`)
	if (!dryRun) console.log(`Database: ${DATABASE_URL?.substring(0, 40)}...`)
	console.log()

	// Read and parse the SQL file
	const sql = readFileSync(SQL_FILE, "utf-8")
	const lines = sql.split("\n")

	// First pass: collect CREATE TABLE definitions to get column names
	const tableColumns: Record<string, string[]> = {}
	let createBuffer = ""
	let inCreate = false

	for (const line of lines) {
		if (line.match(/^CREATE TABLE/i)) {
			inCreate = true
			createBuffer = line
		} else if (inCreate) {
			createBuffer += "\n" + line
		}

		if (inCreate && line.includes(");")) {
			const parsed = parseCreateTable(createBuffer)
			if (parsed) {
				tableColumns[parsed.tableName] = parsed.columns
			}
			inCreate = false
			createBuffer = ""
		}
	}

	console.log(
		`Parsed ${Object.keys(tableColumns).length} CREATE TABLE definitions`,
	)

	// Second pass: collect INSERT statements
	const tableRows: Record<string, ParsedValue[][]> = {}

	// Handle multi-line INSERT statements
	let insertBuffer = ""
	let inInsert = false

	for (const line of lines) {
		if (line.startsWith("INSERT INTO")) {
			inInsert = true
			insertBuffer = line
		} else if (inInsert) {
			insertBuffer += "\n" + line
		}

		if (inInsert && line.endsWith(";")) {
			// Parse the complete INSERT statement
			const tableMatch = insertBuffer.match(
				/INSERT INTO\s+["'`](\w+)["'`]\s+VALUES\s*/i,
			)
			if (tableMatch) {
				const tableName = tableMatch[1]
				if (!SKIP_TABLES.has(tableName)) {
					const valuesStart = insertBuffer.indexOf("VALUES")
					if (valuesStart !== -1) {
						const valuesPart = insertBuffer.substring(
							valuesStart + 6,
							insertBuffer.length - 1,
						) // strip trailing ;
						const rows = parseValues(valuesPart)
						if (rows.length > 0) {
							if (!tableRows[tableName]) tableRows[tableName] = []
							tableRows[tableName].push(...rows)
						}
					}
				}
			}
			inInsert = false
			insertBuffer = ""
		}
	}

	console.log(
		`Found data for ${Object.keys(tableRows).length} tables to migrate`,
	)
	console.log()

	// Summary
	for (const [d1Table, rows] of Object.entries(tableRows)) {
		const psTable = TABLE_NAME_MAP[d1Table]
		if (!psTable) {
			console.log(`  WARN: No mapping for D1 table "${d1Table}", skipping`)
			continue
		}
		console.log(`  ${d1Table} → ${psTable}: ${rows.length} rows`)
	}
	console.log()

	// Build and execute INSERT statements in dependency order
	const client = !dryRun ? new Client({ url: DATABASE_URL! }) : null

	let totalInserted = 0
	let totalTables = 0

	for (const psTable of TABLE_ORDER) {
		// Find the D1 table name that maps to this PS table
		const d1Table = Object.entries(TABLE_NAME_MAP).find(
			([, v]) => v === psTable,
		)?.[0]
		if (!d1Table) continue

		const rows = tableRows[d1Table]
		if (!rows || rows.length === 0) continue

		const columns = tableColumns[d1Table]
		if (!columns) {
			console.log(
				`  WARN: No CREATE TABLE found for "${d1Table}", skipping`,
			)
			continue
		}

		console.log(
			`Migrating: ${d1Table} → ${psTable} (${rows.length} rows, ${columns.length} columns)`,
		)

		const statements = buildInsert(psTable, columns, rows, d1Table)

		for (let i = 0; i < statements.length; i++) {
			if (dryRun) {
				// In dry run, print first statement fully, rest just summary
				if (i === 0) {
					console.log(`  SQL: ${statements[i].substring(0, 200)}...`)
				}
			} else {
				try {
					await client!.execute(statements[i])
				} catch (err: any) {
					console.error(
						`  ERROR batch ${i + 1}/${statements.length}: ${err.message}`,
					)
					// Log the first 300 chars of the failing statement for debugging
					console.error(
						`  Statement: ${statements[i].substring(0, 300)}...`,
					)
					// Continue with next batch
				}
			}
		}

		const batchCount = statements.length
		console.log(
			`  Done: ${rows.length} rows in ${batchCount} batch(es)`,
		)
		totalInserted += rows.length
		totalTables++
	}

	// Check for any tables that weren't in the order list
	for (const d1Table of Object.keys(tableRows)) {
		const psTable = TABLE_NAME_MAP[d1Table]
		if (!psTable) continue
		if (!TABLE_ORDER.includes(psTable)) {
			console.log(
				`  WARN: Table "${psTable}" not in TABLE_ORDER, was not migrated!`,
			)
		}
	}

	console.log()
	console.log(
		`=== Migration complete: ${totalInserted} total rows across ${totalTables} tables ===`,
	)
}

main().catch((err) => {
	console.error("Fatal error:", err)
	process.exit(1)
})
