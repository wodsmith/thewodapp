#!/usr/bin/env tsx
/**
 * ETL Extract: Export all data from D1 (SQLite) database to JSON files.
 *
 * Usage:
 *   pnpm tsx apps/wodsmith-start/scripts/migration/extract-d1.ts [optional-db-path]
 *
 * If no db path is provided, the script will search for the local D1 SQLite
 * database in `.alchemy/local/.wrangler/state/v3/d1/` and `.wrangler/state/v3/d1/`.
 *
 * Output: scripts/migration/extracted-data/<table_name>.json + manifest.json
 */

import Database from "better-sqlite3"
import fs from "node:fs"
import path from "node:path"

const BATCH_SIZE = 500

/**
 * Tables in dependency order (parents before children).
 * Derived from the schema files in src/db/schemas/ and the migration plan
 * appendix in docs/tasks/d1-to-planetscale-migration.md.
 *
 * Level 0: No foreign key dependencies
 * Level 1: Depend only on Level 0
 * Level 2: Depend on Level 0-1
 * ... and so on
 */
const TABLES_IN_ORDER: string[] = [
	// ── Level 0: No dependencies ──
	"user",
	"spicy_tags",
	"movements",
	"entitlement_type",
	"feature",
	"limit",
	"plan",
	"addresses",

	// ── Level 1: Depend on Level 0 ──
	"team",
	"passkey_credential",
	"plan_feature",
	"plan_limit",
	"affiliates",
	"entitlement",

	// ── Level 2: Depend on Level 0-1 ──
	"team_membership",
	"team_role",
	"team_invitation",
	"team_subscription",
	"team_addon",
	"team_entitlement_override",
	"team_usage",
	"team_feature_entitlement",
	"team_limit_entitlement",
	"competition_groups",
	"programming_track",
	"scaling_groups",
	"locations",
	"skills",
	"class_catalog",
	"waivers",
	"sponsor_groups",
	"coaches",

	// ── Level 3: Depend on Level 0-2 ──
	"competitions",
	"team_programming_track",
	"track_workout",
	"scaling_levels",
	"schedule_templates",
	"sponsors",
	"organizer_request",
	"workouts",
	"class_catalog_to_skills",
	"coach_to_skills",
	"coach_blackout_dates",
	"coach_recurring_unavailability",

	// ── Level 4: Depend on Level 0-3 ──
	"competition_divisions",
	"competition_venues",
	"competition_events",
	"competition_registration_questions",
	"event_resources",
	"commerce_product",
	"scheduled_workout_instance",
	"workout_scaling_descriptions",
	"workout_tags",
	"workout_movements",
	"event_judging_sheets",
	"schedule_template_classes",

	// ── Level 5: Depend on Level 0-4 ──
	"competition_registrations",
	"competition_heats",
	"results",
	"scores",
	"credit_transaction",
	"purchased_item",
	"commerce_purchase",
	"schedule_template_class_required_skills",
	"generated_schedules",

	// ── Level 6: Depend on Level 0-5 ──
	"competition_heat_assignments",
	"competition_registration_answers",
	"judge_assignment_versions",
	"competition_judge_rotations",
	"judge_heat_assignments",
	"video_submissions",
	"score_rounds",
	"sets",
	"waiver_signatures",
	"submission_window_notifications",
	"scheduled_classes",
]

interface ExtractionResult {
	table: string
	rowCount: number
	skipped: boolean
}

/**
 * Extract a single table in batches of BATCH_SIZE rows.
 * Writes output directly to a JSON file using streaming to avoid
 * holding the full dataset in memory.
 */
function extractTable(
	db: Database.Database,
	tableName: string,
	outputDir: string,
): ExtractionResult {
	// Check if the table exists in the database
	const tableExists = db
		.prepare(
			"SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
		)
		.get(tableName) as { name: string } | undefined

	if (!tableExists) {
		console.log(`  [SKIP] Table "${tableName}" does not exist in database`)
		return { table: tableName, rowCount: 0, skipped: true }
	}

	const outputPath = path.join(outputDir, `${tableName}.json`)
	const writeStream = fs.createWriteStream(outputPath)
	writeStream.write("[\n")

	let offset = 0
	let totalRows = 0
	let firstRow = true

	while (true) {
		const rows = db
			.prepare(`SELECT * FROM "${tableName}" LIMIT ? OFFSET ?`)
			.all(BATCH_SIZE, offset) as Record<string, unknown>[]

		if (rows.length === 0) break

		for (const row of rows) {
			if (!firstRow) {
				writeStream.write(",\n")
			}
			writeStream.write(JSON.stringify(row))
			firstRow = false
		}

		totalRows += rows.length
		offset += BATCH_SIZE

		// Log progress for large tables
		if (totalRows % 5000 === 0 && totalRows > 0) {
			console.log(`  ... ${tableName}: ${totalRows} rows extracted so far`)
		}
	}

	writeStream.write("\n]\n")
	writeStream.end()

	if (totalRows === 0) {
		// Remove empty file
		fs.unlinkSync(outputPath)
		console.log(`  [EMPTY] ${tableName}: 0 rows`)
	} else {
		console.log(`  [OK] ${tableName}: ${totalRows} rows`)
	}

	return { table: tableName, rowCount: totalRows, skipped: false }
}

/**
 * Search for the local D1 SQLite database file.
 * Checks common Wrangler/Alchemy local dev paths.
 */
function findD1Database(): string | null {
	const basePaths = [
		path.resolve(".alchemy/local/.wrangler/state/v3/d1"),
		path.resolve(".wrangler/state/v3/d1"),
	]

	for (const basePath of basePaths) {
		try {
			const entries = fs.readdirSync(basePath, { withFileTypes: true })
			for (const entry of entries) {
				if (entry.isDirectory()) {
					const subPath = path.join(basePath, entry.name)
					const files = fs.readdirSync(subPath)
					const dbFile = files.find((f) => f.endsWith(".sqlite"))
					if (dbFile) {
						return path.join(subPath, dbFile)
					}
				}
			}
		} catch {
			// Directory doesn't exist, try next
		}
	}

	return null
}

function main() {
	// Accept optional CLI argument for the database path
	const cliDbPath = process.argv[2]
	const dbPath = cliDbPath || findD1Database()

	if (!dbPath) {
		console.error(
			"Error: D1 database not found.\n" +
				"Either provide the path as an argument:\n" +
				"  pnpm tsx scripts/migration/extract-d1.ts /path/to/db.sqlite\n" +
				"Or run 'pnpm alchemy:dev' first to create the local database.",
		)
		process.exit(1)
	}

	if (!fs.existsSync(dbPath)) {
		console.error(`Error: Database file not found at: ${dbPath}`)
		process.exit(1)
	}

	console.log(`D1 Database: ${dbPath}`)
	console.log(`Batch size: ${BATCH_SIZE}`)
	console.log("")

	const db = new Database(dbPath, { readonly: true })

	// List all tables actually present in the database
	const existingTables = db
		.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
		.all() as { name: string }[]
	const existingTableNames = new Set(existingTables.map((t) => t.name))

	console.log(
		`Database has ${existingTableNames.size} tables: ${[...existingTableNames].join(", ")}`,
	)
	console.log("")

	// Warn about tables in the schema but not in the database
	const missingFromDb = TABLES_IN_ORDER.filter(
		(t) => !existingTableNames.has(t),
	)
	if (missingFromDb.length > 0) {
		console.log(
			`Warning: ${missingFromDb.length} expected tables not found in database: ${missingFromDb.join(", ")}`,
		)
		console.log("")
	}

	// Warn about tables in the database but not in our extraction list
	const unexpectedTables = [...existingTableNames].filter(
		(t) =>
			!TABLES_IN_ORDER.includes(t) &&
			!t.startsWith("sqlite_") &&
			!t.startsWith("_") &&
			!t.startsWith("d1_") &&
			t !== "__drizzle_migrations",
	)
	if (unexpectedTables.length > 0) {
		console.log(
			`Warning: ${unexpectedTables.length} tables in database not in extraction list: ${unexpectedTables.join(", ")}`,
		)
		console.log("")
	}

	const outputDir = path.join(__dirname, "extracted-data")
	fs.mkdirSync(outputDir, { recursive: true })

	console.log(`Extracting to: ${outputDir}`)
	console.log("─".repeat(60))

	const results: ExtractionResult[] = []

	for (const tableName of TABLES_IN_ORDER) {
		const result = extractTable(db, tableName, outputDir)
		results.push(result)
	}

	// Also extract any unexpected tables (tables in DB but not in our ordered list)
	if (unexpectedTables.length > 0) {
		console.log("")
		console.log("Extracting unexpected tables:")
		for (const tableName of unexpectedTables) {
			const result = extractTable(db, tableName, outputDir)
			results.push(result)
		}
	}

	db.close()

	// Write manifest
	const manifest = {
		extractedAt: new Date().toISOString(),
		sourceDatabase: dbPath,
		batchSize: BATCH_SIZE,
		tables: results
			.filter((r) => !r.skipped && r.rowCount > 0)
			.map((r) => r.table),
		rowCounts: Object.fromEntries(
			results
				.filter((r) => !r.skipped && r.rowCount > 0)
				.map((r) => [r.table, r.rowCount]),
		),
		skippedTables: results.filter((r) => r.skipped).map((r) => r.table),
		emptyTables: results
			.filter((r) => !r.skipped && r.rowCount === 0)
			.map((r) => r.table),
	}

	fs.writeFileSync(
		path.join(outputDir, "manifest.json"),
		JSON.stringify(manifest, null, 2),
	)

	// Summary
	console.log("")
	console.log("─".repeat(60))
	console.log("Extraction Summary:")
	console.log(
		`  Tables with data: ${manifest.tables.length}`,
	)
	console.log(`  Empty tables: ${manifest.emptyTables.length}`)
	console.log(`  Skipped (not in DB): ${manifest.skippedTables.length}`)
	console.log(
		`  Total rows: ${Object.values(manifest.rowCounts).reduce((a, b) => a + b, 0)}`,
	)
	console.log(`  Output: ${outputDir}`)
	console.log(`  Manifest: ${path.join(outputDir, "manifest.json")}`)
}

main()
