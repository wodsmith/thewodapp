#!/usr/bin/env tsx
/**
 * ETL Transform: Convert extracted D1 (SQLite) data for PlanetScale (MySQL).
 *
 * Transformations:
 * - Booleans: SQLite 0/1 integers → true/false
 * - Timestamps: Epoch integer seconds → 'YYYY-MM-DD HH:MM:SS' UTC ISO 8601
 * - JSON fields: Validate parseable, keep as strings
 * - NULLs: Preserved as-is
 *
 * Usage:
 *   pnpm tsx apps/wodsmith-start/scripts/migration/transform-data.ts
 *
 * Input:  scripts/migration/extracted-data/<table>.json + manifest.json
 * Output: scripts/migration/transformed-data/<table>.json + manifest.json
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const extractedDir = path.join(__dirname, "extracted-data")
const transformedDir = path.join(__dirname, "transformed-data")

// ─────────────────────────────────────────────────────────────────────
// Column definitions derived from schema files in src/db/schemas/
//
// Boolean columns: defined with boolean() in Drizzle schema
// Datetime columns: defined with datetime() in Drizzle schema
// JSON columns: defined with json() or varchar used to store JSON
//
// Column names are in snake_case (SQLite column names from D1).
// ─────────────────────────────────────────────────────────────────────

/**
 * Per-table boolean column definitions.
 * These columns are stored as 0/1 integers in SQLite
 * and need to be converted to true/false for MySQL.
 */
const BOOLEAN_COLUMNS_BY_TABLE: Record<string, string[]> = {
	// teams.ts
	team: ["is_personal_team"],
	team_membership: ["is_system_role", "is_active"],
	team_role: ["is_editable"],
	team_invitation: ["is_system_role"],

	// scaling.ts
	scaling_groups: ["is_default", "is_system"],

	// competitions.ts
	competitions: ["pass_stripe_fees_to_customer", "pass_platform_fees_to_customer"],
	competition_registration_questions: ["required", "for_teammates"],

	// workouts.ts
	results: ["as_rx"],

	// scores.ts
	scores: ["as_rx"],

	// scheduling.ts
	coaches: ["is_active"],

	// waivers.ts
	waivers: ["required"],

	// volunteers.ts
	judge_assignment_versions: ["is_active"],
	judge_heat_assignments: ["is_manual_override"],
}

/**
 * Per-table datetime column definitions.
 * These columns are stored as epoch integer seconds in SQLite (from the old
 * integer({ mode: 'timestamp' }) definition) and need to be converted to
 * 'YYYY-MM-DD HH:MM:SS' format for MySQL datetime columns.
 *
 * NOTE: commonColumns (created_at, updated_at) apply to almost all tables
 * and are included via the COMMON_DATETIME_COLUMNS set below.
 */
const COMMON_DATETIME_COLUMNS = ["created_at", "updated_at"]

const EXTRA_DATETIME_COLUMNS_BY_TABLE: Record<string, string[]> = {
	// users.ts
	user: ["email_verified", "last_credit_refresh_at", "date_of_birth"],

	// teams.ts
	team: ["plan_expires_at", "stripe_onboarding_completed_at"],
	team_membership: ["invited_at", "joined_at", "expires_at"],
	team_invitation: ["expires_at", "accepted_at"],

	// competitions.ts
	competition_registrations: ["registered_at", "paid_at"],
	competition_heats: ["scheduled_time", "schedule_published_at"],

	// programming.ts
	team_programming_track: ["subscribed_at"],
	scheduled_workout_instance: ["scheduled_date"],

	// workouts.ts
	results: ["date"],

	// billing.ts
	credit_transaction: ["expiration_date", "expiration_date_processed_at"],
	purchased_item: ["purchased_at"],

	// commerce.ts
	commerce_purchase: ["completed_at"],

	// entitlements.ts
	entitlement: ["expires_at", "deleted_at"],
	team_subscription: [
		"current_period_start",
		"current_period_end",
		"trial_start",
		"trial_end",
	],
	team_addon: ["expires_at"],
	team_entitlement_override: ["expires_at"],
	team_usage: ["period_start", "period_end"],
	team_feature_entitlement: ["expires_at"],
	team_limit_entitlement: ["expires_at"],

	// scheduling.ts
	coach_blackout_dates: ["start_date", "end_date"],
	generated_schedules: ["week_start_date"],
	scheduled_classes: ["start_time", "end_time"],

	// organizer-requests.ts
	organizer_request: ["reviewed_at"],

	// waivers.ts
	waiver_signatures: ["signed_at"],

	// scores.ts
	scores: ["recorded_at"],
	score_rounds: ["created_at"],

	// video-submissions.ts
	video_submissions: ["submitted_at"],

	// volunteers.ts
	judge_assignment_versions: ["published_at"],
}

/**
 * Per-table JSON columns that should be validated.
 * These are stored as varchar in SQLite and should contain valid JSON.
 */
const JSON_COLUMNS_BY_TABLE: Record<string, string[]> = {
	team: ["settings", "competition_metadata"],
	team_role: ["permissions"],
	team_membership: ["metadata"],
	team_invitation: ["metadata"],
	user: ["athlete_profile"],
	competitions: ["settings"],
	competition_registrations: ["pending_teammates", "metadata"],
	competition_registration_questions: ["options"],
	plan: ["entitlements"],
	entitlement: ["metadata"],
	commerce_purchase: ["metadata"],
	scheduled_workout_instance: ["class_times"],
}

// ─────────────────────────────────────────────────────────────────────
// Transform functions
// ─────────────────────────────────────────────────────────────────────

/**
 * Convert an epoch timestamp (seconds or milliseconds) to MySQL datetime string.
 * Returns null if the value is null/undefined or cannot be converted.
 * If the value is already an ISO string, convert it to MySQL format.
 */
function transformTimestamp(value: unknown): string | null {
	if (value === null || value === undefined) return null

	if (typeof value === "number") {
		if (value === 0) return null
		// Heuristic: if value > 1e12, it's in milliseconds; otherwise seconds
		const ms = value > 1e12 ? value : value * 1000
		const date = new Date(ms)
		if (Number.isNaN(date.getTime())) return null
		// MySQL datetime format: 'YYYY-MM-DD HH:MM:SS'
		return date.toISOString().slice(0, 19).replace("T", " ")
	}

	if (typeof value === "string") {
		// Already a string - might be ISO 8601 or MySQL format
		// Try to parse and normalize to MySQL format
		const date = new Date(value)
		if (!Number.isNaN(date.getTime())) {
			return date.toISOString().slice(0, 19).replace("T", " ")
		}
		// If it's already in MySQL format 'YYYY-MM-DD HH:MM:SS', keep it
		if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(value)) {
			return value.slice(0, 19)
		}
		return null
	}

	return null
}

/**
 * Convert SQLite integer boolean (0/1) to actual boolean (false/true).
 * Handles null gracefully.
 */
function transformBoolean(value: unknown): boolean | null {
	if (value === null || value === undefined) return null
	return value === 1 || value === true
}

/**
 * Validate a JSON column value.
 * Returns the value as-is (string) if valid JSON, or flags it.
 */
function validateJson(
	value: unknown,
	tableName: string,
	column: string,
	rowIndex: number,
	stats: TransformStats,
): unknown {
	if (value === null || value === undefined) return null
	if (typeof value !== "string") return value

	try {
		JSON.parse(value)
		stats.jsonValidated++
		return value
	} catch {
		stats.jsonInvalid++
		console.warn(
			`  [WARN] Invalid JSON in ${tableName}.${column} row ${rowIndex}: ${value.slice(0, 80)}...`,
		)
		return value
	}
}

// ─────────────────────────────────────────────────────────────────────
// Stats tracking
// ─────────────────────────────────────────────────────────────────────

interface TransformStats {
	rowsProcessed: number
	timestampsConverted: number
	timestampsNull: number
	booleansConverted: number
	booleansNull: number
	jsonValidated: number
	jsonInvalid: number
}

function createStats(): TransformStats {
	return {
		rowsProcessed: 0,
		timestampsConverted: 0,
		timestampsNull: 0,
		booleansConverted: 0,
		booleansNull: 0,
		jsonValidated: 0,
		jsonInvalid: 0,
	}
}

// ─────────────────────────────────────────────────────────────────────
// Core transform logic
// ─────────────────────────────────────────────────────────────────────

/**
 * Build the set of datetime columns for a given table, including common columns.
 */
function getDatetimeColumns(tableName: string): Set<string> {
	const cols = new Set(COMMON_DATETIME_COLUMNS)

	// Tables without commonColumns (junction tables, etc.)
	const tablesWithoutCommonColumns = [
		"class_catalog_to_skills",
		"coach_to_skills",
		"schedule_template_class_required_skills",
	]
	if (tablesWithoutCommonColumns.includes(tableName)) {
		cols.clear()
	}

	// score_rounds has its own created_at but no updated_at from commonColumns
	// Actually score_rounds doesn't spread commonColumns fully - it has its own createdAt
	// But the extract will have whatever columns are in the DB

	const extra = EXTRA_DATETIME_COLUMNS_BY_TABLE[tableName]
	if (extra) {
		for (const col of extra) {
			cols.add(col)
		}
	}
	return cols
}

/**
 * Get the set of boolean columns for a given table.
 */
function getBooleanColumns(tableName: string): Set<string> {
	const cols = BOOLEAN_COLUMNS_BY_TABLE[tableName]
	return new Set(cols || [])
}

/**
 * Get the set of JSON columns for a given table.
 */
function getJsonColumns(tableName: string): Set<string> {
	const cols = JSON_COLUMNS_BY_TABLE[tableName]
	return new Set(cols || [])
}

/**
 * Transform a single row of data for a specific table.
 */
function transformRow(
	row: Record<string, unknown>,
	tableName: string,
	rowIndex: number,
	datetimeCols: Set<string>,
	booleanCols: Set<string>,
	jsonCols: Set<string>,
	stats: TransformStats,
): Record<string, unknown> {
	const transformed: Record<string, unknown> = {}

	for (const [key, value] of Object.entries(row)) {
		if (datetimeCols.has(key)) {
			const result = transformTimestamp(value)
			if (value !== null && value !== undefined && result !== null) {
				stats.timestampsConverted++
			} else if (value !== null && value !== undefined) {
				stats.timestampsNull++
			}
			transformed[key] = result
		} else if (booleanCols.has(key)) {
			const result = transformBoolean(value)
			if (result !== null) {
				stats.booleansConverted++
			} else {
				stats.booleansNull++
			}
			transformed[key] = result
		} else if (jsonCols.has(key)) {
			transformed[key] = validateJson(value, tableName, key, rowIndex, stats)
		} else {
			transformed[key] = value
		}
	}

	return transformed
}

/**
 * Transform a single table's data file.
 */
function transformTable(tableName: string): TransformStats {
	const stats = createStats()
	const inputPath = path.join(extractedDir, `${tableName}.json`)

	if (!fs.existsSync(inputPath)) {
		console.log(`  [SKIP] ${tableName}: no extracted data file`)
		return stats
	}

	const data: Record<string, unknown>[] = JSON.parse(
		fs.readFileSync(inputPath, "utf-8"),
	)

	const datetimeCols = getDatetimeColumns(tableName)
	const booleanCols = getBooleanColumns(tableName)
	const jsonCols = getJsonColumns(tableName)

	const transformedData = data.map((row, index) => {
		stats.rowsProcessed++
		return transformRow(row, tableName, index, datetimeCols, booleanCols, jsonCols, stats)
	})

	const outputPath = path.join(transformedDir, `${tableName}.json`)
	fs.writeFileSync(outputPath, JSON.stringify(transformedData, null, 2))

	// Log summary for this table
	const parts: string[] = [`${stats.rowsProcessed} rows`]
	if (stats.timestampsConverted > 0) parts.push(`${stats.timestampsConverted} timestamps`)
	if (stats.booleansConverted > 0) parts.push(`${stats.booleansConverted} booleans`)
	if (stats.jsonValidated > 0) parts.push(`${stats.jsonValidated} JSON fields validated`)
	if (stats.jsonInvalid > 0) parts.push(`${stats.jsonInvalid} invalid JSON`)

	console.log(`  [OK] ${tableName}: ${parts.join(", ")}`)

	return stats
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────

function main() {
	console.log("ETL Transform: D1 (SQLite) → PlanetScale (MySQL)")
	console.log("─".repeat(60))

	// Validate input directory
	const manifestPath = path.join(extractedDir, "manifest.json")
	if (!fs.existsSync(manifestPath)) {
		console.error(
			"Error: manifest.json not found in extracted-data/.\n" +
				"Run the extract script first:\n" +
				"  pnpm tsx apps/wodsmith-start/scripts/migration/extract-d1.ts",
		)
		process.exit(1)
	}

	const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
		tables: string[]
		rowCounts: Record<string, number>
		extractedAt: string
	}

	console.log(`Source: ${extractedDir}`)
	console.log(`Tables to transform: ${manifest.tables.length}`)
	console.log(`Extracted at: ${manifest.extractedAt}`)
	console.log("")

	// Create output directory
	fs.mkdirSync(transformedDir, { recursive: true })

	// Transform each table
	const totalStats = createStats()
	const tableResults: Array<{ table: string; stats: TransformStats }> = []

	for (const tableName of manifest.tables) {
		const stats = transformTable(tableName)
		tableResults.push({ table: tableName, stats })

		totalStats.rowsProcessed += stats.rowsProcessed
		totalStats.timestampsConverted += stats.timestampsConverted
		totalStats.timestampsNull += stats.timestampsNull
		totalStats.booleansConverted += stats.booleansConverted
		totalStats.booleansNull += stats.booleansNull
		totalStats.jsonValidated += stats.jsonValidated
		totalStats.jsonInvalid += stats.jsonInvalid
	}

	// Copy manifest with transform metadata
	const transformManifest = {
		...manifest,
		transformedAt: new Date().toISOString(),
		transformStats: {
			totalRows: totalStats.rowsProcessed,
			timestampsConverted: totalStats.timestampsConverted,
			booleansConverted: totalStats.booleansConverted,
			jsonFieldsValidated: totalStats.jsonValidated,
			jsonFieldsInvalid: totalStats.jsonInvalid,
		},
	}

	fs.writeFileSync(
		path.join(transformedDir, "manifest.json"),
		JSON.stringify(transformManifest, null, 2),
	)

	// Summary
	console.log("")
	console.log("─".repeat(60))
	console.log("Transform Summary:")
	console.log(`  Tables processed:     ${manifest.tables.length}`)
	console.log(`  Total rows:           ${totalStats.rowsProcessed}`)
	console.log(`  Timestamps converted: ${totalStats.timestampsConverted}`)
	console.log(`  Booleans converted:   ${totalStats.booleansConverted}`)
	console.log(`  JSON fields valid:    ${totalStats.jsonValidated}`)
	if (totalStats.jsonInvalid > 0) {
		console.log(`  JSON fields INVALID:  ${totalStats.jsonInvalid} ⚠`)
	}
	console.log(`  Output: ${transformedDir}`)
}

main()
