/**
 * D1 → PlanetScale Data Migration Library
 *
 * Pure functions and constants extracted from the migration script
 * for testability and reuse.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BATCH_SIZE = 50

export const TABLE_NAME_MAP: Record<string, string> = {
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

export const SKIP_TABLES = new Set([
	"d1_migrations",
	"revalidations",
	"tags",
	"purchased_item", // purchased_items - likely empty seed data only
])

export const RESERVED_WORDS = new Set([
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

export const TIMESTAMP_COLUMNS = new Set([
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

export const DATE_STRING_COLUMNS = new Set([
	"start_date",
	"end_date",
	"registration_opens_at",
	"registration_closes_at",
	"submission_opens_at",
	"submission_closes_at",
])

export const BOOLEAN_COLUMNS = new Set([
	"is_personal_team",
	"is_active",
	"is_system_role",
	"is_default",
	"is_system",
	"is_editable",
	"is_public",
	"as_rx",
	"is_manual_override",
	"cancel_at_period_end",
	"required",
	"for_teammates",
	"pass_stripe_fees_to_customer",
	"pass_platform_fees_to_customer",
])

export const TABLE_ORDER: string[] = [
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
// Types
// ---------------------------------------------------------------------------

export interface ParsedValue {
	value: string
	wasQuoted: boolean
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * camelCase → snake_case conversion
 */
export function toSnakeCase(str: string): string {
	// Already snake_case
	if (!str.match(/[A-Z]/)) return str
	return str
		.replace(/([a-z0-9])([A-Z])/g, "$1_$2")
		.replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
		.toLowerCase()
}

/**
 * Quote a column name for MySQL
 */
export function quoteCol(col: string): string {
	return `\`${col}\``
}

/**
 * Convert epoch integer to MySQL datetime string.
 * D1 stores timestamps as epoch seconds (10-digit) or epoch milliseconds (13-digit).
 */
export function epochToDatetime(value: number): string {
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

/**
 * Escape a string value for MySQL
 */
export function escapeMysqlString(str: string): string {
	return str
		.replace(/\\/g, "\\\\")
		.replace(/'/g, "\\'")
		.replace(/\n/g, "\\n")
		.replace(/\r/g, "\\r")
		.replace(/\t/g, "\\t")
		.replace(/\0/g, "\\0")
}

/**
 * Parse a SQLite VALUES list, handling nested parentheses, quoted strings,
 * escaped quotes, and the replace(...) function
 */
export function parseValues(valuesStr: string): ParsedValue[][] {
	const rows: ParsedValue[][] = []
	let i = 0
	const len = valuesStr.length

	while (i < len) {
		// Find the start of a row: '('
		while (i < len && valuesStr[i] !== "(") i++
		if (i >= len) break
		i++ // skip '('

		const row: ParsedValue[] = []
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
				row.push({ value: val, wasQuoted: true })
			} else if (
				valuesStr[i] === "N" &&
				valuesStr.substring(i, i + 4) === "NULL"
			) {
				row.push({ value: "NULL", wasQuoted: false })
				i += 4
			} else if (
				valuesStr[i] === "r" &&
				valuesStr.substring(i, i + 7) === "replace"
			) {
				// Handle replace('...', '\n', char(10)) function
				// Find the matching closing paren for replace(
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
				row.push({ value: arg1.replace(/\\n/g, "\n"), wasQuoted: true })
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
				row.push({ value: `X'${hex}'`, wasQuoted: false })
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
				row.push({ value: val.trim(), wasQuoted: false })
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

/**
 * Parse CREATE TABLE to extract column names in order
 */
export function parseCreateTable(sql: string): {
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

/**
 * Build INSERT IGNORE statements for MySQL
 */
export function buildInsert(
	mysqlTable: string,
	d1Columns: string[],
	rows: ParsedValue[][],
	_d1TableName: string,
): string[] {
	// Map D1 column names to PlanetScale snake_case column names
	const psColumns = d1Columns.map((col) => toSnakeCase(col))

	const statements: string[] = []

	for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
		const batch = rows.slice(batchStart, batchStart + BATCH_SIZE)

		const valueParts: string[] = []
		for (const row of batch) {
			const vals: string[] = []
			for (let j = 0; j < psColumns.length && j < row.length; j++) {
				const colName = psColumns[j]
				const parsed = row[j]
				const val = parsed.value

				if (val === "NULL" && !parsed.wasQuoted) {
					vals.push("NULL")
				} else if (val.startsWith("X'") && !parsed.wasQuoted) {
					vals.push(val)
				} else if (
					TIMESTAMP_COLUMNS.has(colName) &&
					!DATE_STRING_COLUMNS.has(colName) &&
					!(val === "NULL" && !parsed.wasQuoted)
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
				} else if (BOOLEAN_COLUMNS.has(colName)) {
					// Boolean conversion: SQLite uses 0/1, "true"/"false"
					if (val === "true" || val === "1") {
						vals.push("1")
					} else if (val === "false" || val === "0") {
						vals.push("0")
					} else {
						vals.push(val)
					}
				} else if (colName === "sort_key" && parsed.wasQuoted) {
					// Sort keys: pad to 38 chars (new format) from D1's 19-char format
					const padded = val.padStart(38, "0")
					vals.push(`'${escapeMysqlString(padded)}'`)
				} else if (parsed.wasQuoted) {
					// Value was quoted in original SQL — always output as a quoted string
					// This preserves leading zeros in sort keys and other string values
					vals.push(`'${escapeMysqlString(val)}'`)
				} else {
					// Unquoted value — numeric or literal
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

/**
 * Parse a full SQL dump and return structured data for migration.
 * This drives the main migration pipeline:
 *   1. Parse CREATE TABLE statements to get column names
 *   2. Parse INSERT statements to get row data
 *   3. Map D1 table names to PlanetScale names
 *   4. Build INSERT IGNORE statements in dependency order
 */
export function processSqlDump(sql: string): {
	tableColumns: Record<string, string[]>
	tableRows: Record<string, ParsedValue[][]>
	statements: { psTable: string; d1Table: string; sql: string[] }[]
	warnings: string[]
} {
	const lines = sql.split("\n")
	const warnings: string[] = []

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

	// Second pass: collect INSERT statements
	const tableRows: Record<string, ParsedValue[][]> = {}
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

	// Build INSERT statements in dependency order
	const statementsResult: { psTable: string; d1Table: string; sql: string[] }[] = []

	for (const psTable of TABLE_ORDER) {
		const d1Table = Object.entries(TABLE_NAME_MAP).find(
			([, v]) => v === psTable,
		)?.[0]
		if (!d1Table) continue

		const rows = tableRows[d1Table]
		if (!rows || rows.length === 0) continue

		const columns = tableColumns[d1Table]
		if (!columns) {
			warnings.push(`No CREATE TABLE found for "${d1Table}", skipping`)
			continue
		}

		const sqlStatements = buildInsert(psTable, columns, rows, d1Table)
		statementsResult.push({ psTable, d1Table, sql: sqlStatements })
	}

	// Check for tables not in order
	for (const d1Table of Object.keys(tableRows)) {
		const psTable = TABLE_NAME_MAP[d1Table]
		if (!psTable) {
			warnings.push(`No mapping for D1 table "${d1Table}", skipping`)
			continue
		}
		if (!TABLE_ORDER.includes(psTable)) {
			warnings.push(`Table "${psTable}" not in TABLE_ORDER, was not migrated!`)
		}
	}

	return { tableColumns, tableRows, statements: statementsResult, warnings }
}
