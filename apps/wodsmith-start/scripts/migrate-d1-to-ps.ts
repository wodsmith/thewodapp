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
const BATCH_SIZE = 50

// ---------------------------------------------------------------------------
// D1 table → PlanetScale table name mapping
// Built by reading mysqlTable("tableName", ...) calls in Drizzle schema files
// ---------------------------------------------------------------------------
const TABLE_NAME_MAP: Record<string, string> = {
	// D1 singular → PS plural (from Drizzle schema)
	user: "users",
	team: "teams",
	team_membership: "team_memberships",
	team_role: "team_roles",
	team_invitation: "team_invitations",
	passkey_credential: "passkey_credentials",
	credit_transaction: "credit_transactions",
	purchased_item: "purchased_items",
	programming_track: "programming_tracks",
	team_programming_track: "team_programming_tracks",
	track_workout: "track_workouts",
	scheduled_workout_instance: "scheduled_workout_instances",
	entitlement_type: "entitlement_types",
	entitlement: "entitlements",
	feature: "features",
	limit: "limits",
	plan: "plans",
	plan_feature: "plan_features",
	plan_limit: "plan_limits",
	team_subscription: "team_subscriptions",
	team_addon: "team_addons",
	team_entitlement_override: "team_entitlement_overrides",
	team_usage: "team_usages",
	team_feature_entitlement: "team_feature_entitlements",
	team_limit_entitlement: "team_limit_entitlements",
	commerce_product: "commerce_products",
	commerce_purchase: "commerce_purchases",
	competition_divisions: "competition_divisions",
	organizer_request: "organizer_requests",
	// Tables that already match (plural in D1 = plural in PS)
	movements: "movements",
	spicy_tags: "spicy_tags",
	workouts: "workouts",
	workout_tags: "workout_tags",
	workout_movements: "workout_movements",
	results: "results",
	sets: "sets",
	scaling_groups: "scaling_groups",
	scaling_levels: "scaling_levels",
	workout_scaling_descriptions: "workout_scaling_descriptions",
	coaches: "coaches",
	locations: "locations",
	class_catalog: "class_catalogs",
	class_catalog_to_skills: "class_catalog_to_skills",
	skills: "skills",
	coach_to_skills: "coach_to_skills",
	coach_blackout_dates: "coach_blackout_dates",
	coach_recurring_unavailability: "coach_recurring_unavailability",
	schedule_templates: "schedule_templates",
	schedule_template_classes: "schedule_template_classes",
	schedule_template_class_required_skills:
		"schedule_template_class_required_skills",
	generated_schedules: "generated_schedules",
	scheduled_classes: "scheduled_classes",
	competition_groups: "competition_groups",
	competitions: "competitions",
	competition_registrations: "competition_registrations",
	competition_venues: "competition_venues",
	competition_heats: "competition_heats",
	competition_heat_assignments: "competition_heat_assignments",
	competition_registration_questions: "competition_registration_questions",
	competition_registration_answers: "competition_registration_answers",
	competition_events: "competition_events",
	sponsor_groups: "sponsor_groups",
	sponsors: "sponsors",
	affiliates: "affiliates",
	scores: "scores",
	score_rounds: "score_rounds",
	waivers: "waivers",
	waiver_signatures: "waiver_signatures",
	judge_assignment_versions: "judge_assignment_versions",
	judge_heat_assignments: "judge_heat_assignments",
	competition_judge_rotations: "competition_judge_rotations",
	submission_window_notifications: "submission_window_notifications",
	event_resources: "event_resources",
	event_judging_sheets: "event_judging_sheets",
	video_submissions: "video_submissions",
	addresses: "addresses",
}

// Tables to skip during migration
const SKIP_TABLES = new Set([
	"d1_migrations",
	"revalidations",
	"tags",
	"purchased_item", // purchased_items - likely empty seed data only
])

// MySQL reserved words that must be backtick-quoted
const RESERVED_WORDS = new Set([
	"key",
	"limit",
	"interval",
	"type",
	"status",
	"value",
	"position",
	"time",
	"date",
	"description",
	"name",
	"source",
	"label",
	"options",
	"required",
	"notes",
])

// ---------------------------------------------------------------------------
// Timestamp columns that need epoch → datetime conversion
// These are integer columns in D1 (epoch seconds) that become datetime in MySQL
// ---------------------------------------------------------------------------
const TIMESTAMP_COLUMNS = new Set([
	"created_at",
	"updated_at",
	"email_verified",
	"last_credit_refresh_at",
	"date_of_birth",
	"plan_expires_at",
	"stripe_onboarding_completed_at",
	"invited_at",
	"joined_at",
	"expires_at",
	"accepted_at",
	"expiration_date",
	"expiration_date_processed_at",
	"purchased_at",
	"subscribed_at",
	"current_period_start",
	"current_period_end",
	"trial_start",
	"trial_end",
	"deleted_at",
	"registered_at",
	"scheduled_time",
	"schedule_published_at",
	"completed_at",
	"paid_at",
	"reviewed_at",
	"published_at",
	"signed_at",
	"week_start_date",
	"start_time",
	"end_time",
	"start_date",
	"end_date",
	"date",
	"scheduled_date",
	"submitted_at",
	"recorded_at",
])

// Date-only columns that are already YYYY-MM-DD strings in D1 - do NOT convert
const DATE_STRING_COLUMNS = new Set([
	"start_date",
	"end_date",
	"registration_opens_at",
	"registration_closes_at",
	"submission_opens_at",
	"submission_closes_at",
])

// ---------------------------------------------------------------------------
// camelCase → snake_case conversion
// ---------------------------------------------------------------------------
function toSnakeCase(str: string): string {
	// Already snake_case
	if (!str.match(/[A-Z]/)) return str
	return str
		.replace(/([a-z0-9])([A-Z])/g, "$1_$2")
		.replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
		.toLowerCase()
}

// ---------------------------------------------------------------------------
// Quote a column name for MySQL
// ---------------------------------------------------------------------------
function quoteCol(col: string): string {
	return `\`${col}\``
}

// ---------------------------------------------------------------------------
// Convert epoch integer to MySQL datetime string
// D1 stores timestamps as epoch seconds (10-digit) or epoch milliseconds (13-digit)
// ---------------------------------------------------------------------------
function epochToDatetime(value: number): string {
	// Detect if milliseconds (13 digits) or seconds (10 digits)
	const ms = value > 9_999_999_999 ? value : value * 1000
	const d = new Date(ms)
	const yyyy = d.getUTCFullYear()
	const mm = String(d.getUTCMonth() + 1).padStart(2, "0")
	const dd = String(d.getUTCDate()).padStart(2, "0")
	const hh = String(d.getUTCHours()).padStart(2, "0")
	const mi = String(d.getUTCMinutes()).padStart(2, "0")
	const ss = String(d.getUTCSeconds()).padStart(2, "0")
	return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}

// ---------------------------------------------------------------------------
// Parse a SQLite VALUES list, handling nested parentheses, quoted strings,
// escaped quotes, and the replace(...) function
// ---------------------------------------------------------------------------
function parseValues(valuesStr: string): string[][] {
	const rows: string[][] = []
	let i = 0
	const len = valuesStr.length

	while (i < len) {
		// Find the start of a row: '('
		while (i < len && valuesStr[i] !== "(") i++
		if (i >= len) break
		i++ // skip '('

		const row: string[] = []
		while (i < len && valuesStr[i] !== ")") {
			// Skip whitespace
			while (i < len && valuesStr[i] === " ") i++

			if (valuesStr[i] === "'") {
				// Quoted string value
				i++ // skip opening quote
				let val = ""
				while (i < len) {
					if (valuesStr[i] === "'") {
						// Check for escaped quote ''
						if (i + 1 < len && valuesStr[i + 1] === "'") {
							val += "'"
							i += 2
						} else {
							i++ // skip closing quote
							break
						}
					} else {
						val += valuesStr[i]
						i++
					}
				}
				row.push(val)
			} else if (
				valuesStr[i] === "N" &&
				valuesStr.substring(i, i + 4) === "NULL"
			) {
				row.push("NULL")
				i += 4
			} else if (
				valuesStr[i] === "r" &&
				valuesStr.substring(i, i + 7) === "replace"
			) {
				// Handle replace('...', '\n', char(10)) function
				// Find the matching closing paren for replace(
				const replaceStart = i
				i += 8 // skip 'replace('

				// Parse first arg (the string to replace in)
				let arg1 = ""
				if (valuesStr[i] === "'") {
					i++ // skip opening quote
					while (i < len) {
						if (valuesStr[i] === "'") {
							if (i + 1 < len && valuesStr[i + 1] === "'") {
								arg1 += "'"
								i += 2
							} else {
								i++
								break
							}
						} else {
							arg1 += valuesStr[i]
							i++
						}
					}
				}
				// Skip to next arg: ,'\n',char(10))
				// Find the closing paren
				let depth = 1
				while (i < len && depth > 0) {
					if (valuesStr[i] === "(") depth++
					if (valuesStr[i] === ")") depth--
					i++
				}
				// The result of replace('str','\n',char(10)) is the string with literal \n replaced by actual newlines
				row.push(arg1.replace(/\\n/g, "\n"))
			} else if (
				valuesStr[i] === "X" &&
				i + 1 < len &&
				valuesStr[i + 1] === "'"
			) {
				// Hex literal X'...' - skip
				i += 2
				let hex = ""
				while (i < len && valuesStr[i] !== "'") {
					hex += valuesStr[i]
					i++
				}
				if (i < len) i++ // skip closing quote
				row.push(`X'${hex}'`)
			} else {
				// Numeric or unquoted value
				let val = ""
				while (
					i < len &&
					valuesStr[i] !== "," &&
					valuesStr[i] !== ")"
				) {
					val += valuesStr[i]
					i++
				}
				row.push(val.trim())
			}

			// Skip comma separator
			while (i < len && valuesStr[i] === " ") i++
			if (i < len && valuesStr[i] === ",") i++
		}
		if (i < len) i++ // skip ')'

		if (row.length > 0) rows.push(row)

		// Skip comma between rows
		while (i < len && (valuesStr[i] === "," || valuesStr[i] === " ")) i++
	}

	return rows
}

// ---------------------------------------------------------------------------
// Parse CREATE TABLE to extract column names in order
// ---------------------------------------------------------------------------
function parseCreateTable(sql: string): {
	tableName: string
	columns: string[]
} | null {
	// Match: CREATE TABLE [IF NOT EXISTS] "tablename" or `tablename`
	const tableMatch = sql.match(
		/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["'`]?(\w+)["'`]?\s*\(/i,
	)
	if (!tableMatch) return null

	const tableName = tableMatch[1]

	// Extract everything between the outer parens
	const bodyStart = sql.indexOf("(", sql.indexOf(tableName)) + 1
	let depth = 1
	let bodyEnd = bodyStart
	for (let i = bodyStart; i < sql.length; i++) {
		if (sql[i] === "(") depth++
		if (sql[i] === ")") {
			depth--
			if (depth === 0) {
				bodyEnd = i
				break
			}
		}
	}
	const body = sql.substring(bodyStart, bodyEnd)

	const columns: string[] = []
	// Split by commas at depth 0 (not inside parens)
	let current = ""
	let d = 0
	for (const ch of body) {
		if (ch === "(") d++
		if (ch === ")") d--
		if (ch === "," && d === 0) {
			const trimmed = current.trim()
			if (trimmed) {
				// Check if it's a column definition (starts with ` or " and a name)
				const colMatch = trimmed.match(/^["'`]?(\w+)["'`]?\s+/i)
				if (
					colMatch &&
					!trimmed.startsWith("FOREIGN") &&
					!trimmed.startsWith("PRIMARY") &&
					!trimmed.startsWith("UNIQUE") &&
					!trimmed.startsWith("CHECK") &&
					!trimmed.startsWith("CONSTRAINT")
				) {
					columns.push(colMatch[1])
				}
			}
			current = ""
		} else {
			current += ch
		}
	}
	// Last entry
	const trimmed = current.trim()
	if (trimmed) {
		const colMatch = trimmed.match(/^["'`]?(\w+)["'`]?\s+/i)
		if (
			colMatch &&
			!trimmed.startsWith("FOREIGN") &&
			!trimmed.startsWith("PRIMARY") &&
			!trimmed.startsWith("UNIQUE") &&
			!trimmed.startsWith("CHECK") &&
			!trimmed.startsWith("CONSTRAINT")
		) {
			columns.push(colMatch[1])
		}
	}

	return { tableName, columns }
}

// ---------------------------------------------------------------------------
// Build INSERT IGNORE statements for MySQL
// ---------------------------------------------------------------------------
function buildInsert(
	mysqlTable: string,
	d1Columns: string[],
	rows: string[][],
	d1TableName: string,
): string[] {
	// Map D1 column names to PlanetScale snake_case column names
	const psColumns = d1Columns.map((col) => toSnakeCase(col))

	// Filter out columns that don't exist in the target (e.g., if D1 has extra cols)
	const statements: string[] = []

	for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
		const batch = rows.slice(batchStart, batchStart + BATCH_SIZE)

		const valueParts: string[] = []
		for (const row of batch) {
			const vals: string[] = []
			for (let j = 0; j < psColumns.length && j < row.length; j++) {
				const colName = psColumns[j]
				let val = row[j]

				if (val === "NULL") {
					vals.push("NULL")
				} else if (val.startsWith("X'")) {
					vals.push(val)
				} else if (
					TIMESTAMP_COLUMNS.has(colName) &&
					!DATE_STRING_COLUMNS.has(colName) &&
					val !== "NULL"
				) {
					// Convert epoch to datetime
					const num = Number(val)
					if (!Number.isNaN(num) && num > 0) {
						vals.push(`'${epochToDatetime(num)}'`)
					} else if (val.match(/^\d{4}-\d{2}-\d{2}/)) {
						// Already a date string, pass through
						vals.push(`'${escapeMysqlString(val)}'`)
					} else {
						vals.push("NULL")
					}
				} else if (colName === "is_personal_team" || colName === "is_active" || colName === "is_system_role" || colName === "is_default" || colName === "is_system" || colName === "is_editable" || colName === "is_public" || colName === "is_active" || colName === "as_rx" || colName === "is_manual_override" || colName === "cancel_at_period_end" || colName === "required" || colName === "for_teammates" || colName === "pass_stripe_fees_to_customer" || colName === "pass_platform_fees_to_customer") {
					// Boolean conversion: SQLite uses 0/1, "true"/"false"
					if (val === "true" || val === "1") {
						vals.push("1")
					} else if (val === "false" || val === "0") {
						vals.push("0")
					} else {
						vals.push(val)
					}
				} else {
					// Check if it's a numeric value
					if (val.match(/^-?\d+(\.\d+)?$/)) {
						vals.push(val)
					} else {
						vals.push(`'${escapeMysqlString(val)}'`)
					}
				}
			}
			valueParts.push(`(${vals.join(",")})`)
		}

		const quotedCols = psColumns.map(quoteCol).join(",")
		statements.push(
			`INSERT IGNORE INTO \`${mysqlTable}\` (${quotedCols}) VALUES ${valueParts.join(",")};`,
		)
	}

	return statements
}

// ---------------------------------------------------------------------------
// Escape a string value for MySQL
// ---------------------------------------------------------------------------
function escapeMysqlString(str: string): string {
	return str
		.replace(/\\/g, "\\\\")
		.replace(/'/g, "\\'")
		.replace(/\n/g, "\\n")
		.replace(/\r/g, "\\r")
		.replace(/\t/g, "\\t")
		.replace(/\0/g, "\\0")
}

// ---------------------------------------------------------------------------
// Dependency ordering: parent tables before children
// ---------------------------------------------------------------------------
const TABLE_ORDER: string[] = [
	// Tier 0: No dependencies
	"users",
	"addresses",
	"movements",
	"spicy_tags",
	"entitlement_types",
	"features",
	"limits",
	"plans",

	// Tier 1: Depends on users
	"passkey_credentials",
	"credit_transactions",
	"purchased_items",
	"affiliates",

	// Tier 2: Depends on users
	"teams",

	// Tier 3: Depends on teams + users
	"team_memberships",
	"team_roles",
	"team_invitations",
	"team_subscriptions",
	"team_addons",
	"team_entitlement_overrides",
	"team_usages",
	"team_feature_entitlements",
	"team_limit_entitlements",
	"plan_features",
	"plan_limits",
	"entitlements",
	"organizer_requests",

	// Tier 4: Depends on teams
	"scaling_groups",
	"scaling_levels",
	"workouts",
	"workout_scaling_descriptions",
	"workout_tags",
	"workout_movements",

	// Tier 5: Scheduling/gym
	"coaches",
	"locations",
	"class_catalogs",
	"skills",
	"coach_to_skills",
	"class_catalog_to_skills",
	"coach_blackout_dates",
	"coach_recurring_unavailability",
	"schedule_templates",
	"schedule_template_classes",
	"schedule_template_class_required_skills",
	"generated_schedules",
	"scheduled_classes",

	// Tier 6: Programming
	"competition_groups",
	"competitions",
	"programming_tracks",
	"team_programming_tracks",
	"track_workouts",
	"scheduled_workout_instances",

	// Tier 7: Competition data
	"competition_registrations",
	"competition_registration_questions",
	"competition_registration_answers",
	"competition_divisions",
	"competition_venues",
	"competition_heats",
	"competition_heat_assignments",
	"competition_events",
	"commerce_products",
	"commerce_purchases",
	"sponsor_groups",
	"sponsors",
	"results",
	"sets",
	"scores",
	"score_rounds",
	"waivers",
	"waiver_signatures",
	"judge_assignment_versions",
	"judge_heat_assignments",
	"competition_judge_rotations",
	"submission_window_notifications",
	"event_resources",
	"event_judging_sheets",
	"video_submissions",
]

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
	const tableRows: Record<string, string[][]> = {}

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
