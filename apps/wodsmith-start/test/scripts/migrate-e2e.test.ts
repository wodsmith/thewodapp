import { describe, expect, it } from "vitest"
import {
	parseValues,
	buildInsert,
	epochToDatetime,
	toSnakeCase,
	quoteCol,
	escapeMysqlString,
	parseCreateTable,
	processSqlDump,
	BOOLEAN_COLUMNS,
	TIMESTAMP_COLUMNS,
	DATE_STRING_COLUMNS,
	TABLE_NAME_MAP,
	SKIP_TABLES,
	type ParsedValue,
} from "../../scripts/migrate-d1-to-ps-lib"

// ---------------------------------------------------------------------------
// Helper: build a minimal D1 SQL dump fixture
// ---------------------------------------------------------------------------
function makeDump(parts: {
	creates?: string[]
	inserts?: string[]
}): string {
	return [...(parts.creates ?? []), ...(parts.inserts ?? [])].join("\n")
}

// ===========================================================================
// E2E: Full pipeline tests
// ===========================================================================

describe("migrate-d1-to-ps E2E", () => {
	describe("full pipeline: processSqlDump", () => {
		it("migrates a simple user table with epoch timestamps", () => {
			const dump = makeDump({
				creates: [
					`CREATE TABLE "user" ("id" text NOT NULL, "name" text, "createdAt" integer, "isActive" integer, PRIMARY KEY ("id"));`,
				],
				inserts: [
					`INSERT INTO "user" VALUES ('usr_1','Alice',1700000000,1);`,
				],
			})

			const result = processSqlDump(dump)

			// Should parse the CREATE TABLE
			expect(result.tableColumns["user"]).toEqual([
				"id",
				"name",
				"createdAt",
				"isActive",
			])

			// Should parse the INSERT row
			expect(result.tableRows["user"]).toHaveLength(1)

			// Should produce an INSERT IGNORE for "users" (mapped name)
			expect(result.statements).toHaveLength(1)
			expect(result.statements[0].psTable).toBe("users")
			expect(result.statements[0].d1Table).toBe("user")

			const sql = result.statements[0].sql[0]
			// Column names should be snake_case and backtick-quoted
			expect(sql).toContain("`id`")
			expect(sql).toContain("`name`")
			expect(sql).toContain("`created_at`")
			expect(sql).toContain("`is_active`")

			// Epoch 1700000000 → '2023-11-14 22:13:20'
			expect(sql).toContain("'2023-11-14 22:13:20'")

			// Boolean: 1 stays as 1
			expect(sql).toMatch(/,1\)/)

			// Uses INSERT IGNORE
			expect(sql).toMatch(/^INSERT IGNORE INTO/)
		})

		it("sort key '0891787218132140032' padded to 38 chars with leading zeros", () => {
			const dump = makeDump({
				creates: [
					`CREATE TABLE "scores" ("id" text NOT NULL, "sortKey" text, PRIMARY KEY ("id"));`,
				],
				inserts: [
					`INSERT INTO "scores" VALUES ('sc_1','0891787218132140032');`,
				],
			})

			const result = processSqlDump(dump)
			const sql = result.statements[0].sql[0]

			// The sort key should be padded to 38 characters
			const expected = "0".repeat(38 - 19) + "0891787218132140032"
			expect(expected).toHaveLength(38)
			expect(expected).toBe("00000000000000000000891787218132140032")
			expect(sql).toContain(`'${expected}'`)
		})

		it("preserves NULL values", () => {
			const dump = makeDump({
				creates: [
					`CREATE TABLE "user" ("id" text NOT NULL, "name" text, "createdAt" integer, PRIMARY KEY ("id"));`,
				],
				inserts: [
					`INSERT INTO "user" VALUES ('usr_2',NULL,NULL);`,
				],
			})

			const result = processSqlDump(dump)
			const sql = result.statements[0].sql[0]

			// NULL should remain NULL (not quoted)
			expect(sql).toContain("NULL")
			// Should not contain 'NULL' as a string
			expect(sql).not.toContain("'NULL'")
		})

		it("converts boolean string values", () => {
			const dump = makeDump({
				creates: [
					`CREATE TABLE "team" ("id" text NOT NULL, "isPersonalTeam" integer, PRIMARY KEY ("id"));`,
				],
				inserts: [
					`INSERT INTO "team" VALUES ('t_1',1),('t_2',0);`,
				],
			})

			const result = processSqlDump(dump)
			const sql = result.statements[0].sql[0]

			// Boolean 1 and 0 should pass through
			expect(sql).toContain("('t_1',1)")
			expect(sql).toContain("('t_2',0)")
		})

		it("skips tables in SKIP_TABLES", () => {
			const dump = makeDump({
				creates: [
					`CREATE TABLE "d1_migrations" ("id" integer PRIMARY KEY, "name" text);`,
					`CREATE TABLE "user" ("id" text NOT NULL, PRIMARY KEY ("id"));`,
				],
				inserts: [
					`INSERT INTO "d1_migrations" VALUES (1,'init');`,
					`INSERT INTO "user" VALUES ('usr_1');`,
				],
			})

			const result = processSqlDump(dump)

			// d1_migrations should be skipped
			expect(result.tableRows["d1_migrations"]).toBeUndefined()
			// user should be present
			expect(result.tableRows["user"]).toHaveLength(1)
		})

		it("maps table names from D1 singular to PS plural", () => {
			const dump = makeDump({
				creates: [
					`CREATE TABLE "team_membership" ("id" text NOT NULL, "teamId" text, PRIMARY KEY ("id"));`,
				],
				inserts: [
					`INSERT INTO "team_membership" VALUES ('tm_1','t_1');`,
				],
			})

			const result = processSqlDump(dump)
			expect(result.statements[0].psTable).toBe("team_memberships")
			expect(result.statements[0].sql[0]).toContain(
				"INSERT IGNORE INTO `team_memberships`",
			)
		})

		it("warns about unmapped tables", () => {
			const dump = makeDump({
				creates: [
					`CREATE TABLE "unknown_table" ("id" text NOT NULL, PRIMARY KEY ("id"));`,
				],
				inserts: [
					`INSERT INTO "unknown_table" VALUES ('x_1');`,
				],
			})

			const result = processSqlDump(dump)
			expect(result.warnings).toContainEqual(
				expect.stringContaining("No mapping"),
			)
		})

		it("handles date_string columns without epoch conversion", () => {
			// start_date is in both TIMESTAMP_COLUMNS and DATE_STRING_COLUMNS.
			// DATE_STRING_COLUMNS should take priority — pass through as-is.
			const dump = makeDump({
				creates: [
					`CREATE TABLE "competitions" ("id" text NOT NULL, "startDate" text, PRIMARY KEY ("id"));`,
				],
				inserts: [
					`INSERT INTO "competitions" VALUES ('c_1','2024-06-15');`,
				],
			})

			const result = processSqlDump(dump)
			const sql = result.statements[0].sql[0]

			// Should pass through as a quoted string, not convert as epoch
			expect(sql).toContain("'2024-06-15'")
		})

		it("handles multiple rows across batches", () => {
			// Create 60 rows to test batching (BATCH_SIZE = 50)
			const rows = Array.from(
				{ length: 60 },
				(_, i) => `('usr_${i}','User ${i}')`,
			).join(",")

			const dump = makeDump({
				creates: [
					`CREATE TABLE "user" ("id" text NOT NULL, "name" text, PRIMARY KEY ("id"));`,
				],
				inserts: [`INSERT INTO "user" VALUES ${rows};`],
			})

			const result = processSqlDump(dump)
			// Should split into 2 batches
			expect(result.statements[0].sql).toHaveLength(2)
		})

		it("handles replace() function in SQLite dump", () => {
			const dump = makeDump({
				creates: [
					`CREATE TABLE "workouts" ("id" text NOT NULL, "description" text, PRIMARY KEY ("id"));`,
				],
				inserts: [
					`INSERT INTO "workouts" VALUES ('w_1',replace('Line one\\nLine two','\\n',char(10)));`,
				],
			})

			const result = processSqlDump(dump)
			const sql = result.statements[0].sql[0]

			// The replace() should be resolved: literal \n → actual newline, then escaped for MySQL
			expect(sql).toContain("Line one\\nLine two")
		})

		it("handles hex literals X'...'", () => {
			const dump = makeDump({
				creates: [
					`CREATE TABLE "user" ("id" text NOT NULL, "data" blob, PRIMARY KEY ("id"));`,
				],
				inserts: [
					`INSERT INTO "user" VALUES ('usr_1',X'DEADBEEF');`,
				],
			})

			const result = processSqlDump(dump)
			const sql = result.statements[0].sql[0]
			expect(sql).toContain("X'DEADBEEF'")
		})

		it("handles escaped single quotes in strings", () => {
			const dump = makeDump({
				creates: [
					`CREATE TABLE "user" ("id" text NOT NULL, "name" text, PRIMARY KEY ("id"));`,
				],
				inserts: [
					`INSERT INTO "user" VALUES ('usr_1','O''Brien');`,
				],
			})

			const result = processSqlDump(dump)
			const sql = result.statements[0].sql[0]
			// The escaped quote should become MySQL escaped: O\'Brien
			expect(sql).toContain("O\\'Brien")
		})

		it("handles multi-line INSERT statements", () => {
			const dump = [
				`CREATE TABLE "user" ("id" text NOT NULL, "name" text, PRIMARY KEY ("id"));`,
				`INSERT INTO "user" VALUES ('usr_1','Alice'),`,
				`('usr_2','Bob');`,
			].join("\n")

			const result = processSqlDump(dump)
			expect(result.tableRows["user"]).toHaveLength(2)
		})
	})

	// ===========================================================================
	// Unit-level: parseValues
	// ===========================================================================

	describe("parseValues", () => {
		it("parses simple quoted and unquoted values", () => {
			const result = parseValues("('hello',42,NULL)")
			expect(result).toEqual([
				[
					{ value: "hello", wasQuoted: true },
					{ value: "42", wasQuoted: false },
					{ value: "NULL", wasQuoted: false },
				],
			])
		})

		it("parses multiple rows", () => {
			const result = parseValues("('a',1),('b',2)")
			expect(result).toHaveLength(2)
			expect(result[0][0].value).toBe("a")
			expect(result[1][0].value).toBe("b")
		})

		it("handles escaped quotes in SQLite", () => {
			const result = parseValues("('it''s')")
			expect(result[0][0].value).toBe("it's")
			expect(result[0][0].wasQuoted).toBe(true)
		})

		it("handles replace() function", () => {
			const result = parseValues(
				"(replace('hello\\nworld','\\n',char(10)))",
			)
			expect(result[0][0].value).toBe("hello\nworld")
			expect(result[0][0].wasQuoted).toBe(true)
		})

		it("handles X'...' hex literals", () => {
			const result = parseValues("(X'CAFE')")
			expect(result[0][0].value).toBe("X'CAFE'")
			expect(result[0][0].wasQuoted).toBe(false)
		})
	})

	// ===========================================================================
	// Unit-level: buildInsert
	// ===========================================================================

	describe("buildInsert", () => {
		it("builds INSERT IGNORE with backtick-quoted columns", () => {
			const rows: ParsedValue[][] = [
				[
					{ value: "id1", wasQuoted: true },
					{ value: "Alice", wasQuoted: true },
				],
			]
			const result = buildInsert("users", ["id", "name"], rows, "user")
			expect(result).toHaveLength(1)
			expect(result[0]).toBe(
				"INSERT IGNORE INTO `users` (`id`,`name`) VALUES ('id1','Alice');",
			)
		})

		it("converts camelCase columns to snake_case", () => {
			const rows: ParsedValue[][] = [
				[
					{ value: "id1", wasQuoted: true },
					{ value: "1700000000", wasQuoted: false },
				],
			]
			const result = buildInsert(
				"users",
				["id", "createdAt"],
				rows,
				"user",
			)
			expect(result[0]).toContain("`created_at`")
		})

		it("converts epoch timestamps to datetime", () => {
			const rows: ParsedValue[][] = [
				[
					{ value: "id1", wasQuoted: true },
					{ value: "1700000000", wasQuoted: false },
				],
			]
			const result = buildInsert(
				"users",
				["id", "createdAt"],
				rows,
				"user",
			)
			expect(result[0]).toContain("'2023-11-14 22:13:20'")
		})

		it("pads sort_key to 38 chars", () => {
			const rows: ParsedValue[][] = [
				[
					{ value: "sc1", wasQuoted: true },
					{ value: "0891787218132140032", wasQuoted: true },
				],
			]
			const result = buildInsert(
				"scores",
				["id", "sortKey"],
				rows,
				"scores",
			)
			expect(result[0]).toContain(
				"'00000000000000000000891787218132140032'",
			)
		})

		it("handles boolean columns", () => {
			const rows: ParsedValue[][] = [
				[
					{ value: "t1", wasQuoted: true },
					{ value: "1", wasQuoted: false },
				],
				[
					{ value: "t2", wasQuoted: true },
					{ value: "0", wasQuoted: false },
				],
			]
			const result = buildInsert(
				"teams",
				["id", "isPersonalTeam"],
				rows,
				"team",
			)
			expect(result[0]).toContain("('t1',1)")
			expect(result[0]).toContain("('t2',0)")
		})

		it("preserves NULL", () => {
			const rows: ParsedValue[][] = [
				[
					{ value: "id1", wasQuoted: true },
					{ value: "NULL", wasQuoted: false },
				],
			]
			const result = buildInsert("users", ["id", "name"], rows, "user")
			expect(result[0]).toContain("NULL")
			expect(result[0]).not.toContain("'NULL'")
		})
	})

	// ===========================================================================
	// Unit-level: helper functions
	// ===========================================================================

	describe("epochToDatetime", () => {
		it("converts epoch seconds to datetime string", () => {
			expect(epochToDatetime(1700000000)).toBe("2023-11-14 22:13:20")
		})

		it("converts epoch milliseconds to datetime string", () => {
			expect(epochToDatetime(1700000000000)).toBe("2023-11-14 22:13:20")
		})

		it("handles epoch 0", () => {
			expect(epochToDatetime(0)).toBe("1970-01-01 00:00:00")
		})
	})

	describe("toSnakeCase", () => {
		it("converts camelCase to snake_case", () => {
			expect(toSnakeCase("createdAt")).toBe("created_at")
			expect(toSnakeCase("isPersonalTeam")).toBe("is_personal_team")
		})

		it("leaves snake_case unchanged", () => {
			expect(toSnakeCase("created_at")).toBe("created_at")
		})

		it("handles consecutive uppercase (acronyms)", () => {
			expect(toSnakeCase("sortKey")).toBe("sort_key")
		})

		it("leaves all lowercase unchanged", () => {
			expect(toSnakeCase("name")).toBe("name")
		})
	})

	describe("quoteCol", () => {
		it("wraps column name in backticks", () => {
			expect(quoteCol("name")).toBe("`name`")
			expect(quoteCol("created_at")).toBe("`created_at`")
		})
	})

	describe("escapeMysqlString", () => {
		it("escapes backslashes", () => {
			expect(escapeMysqlString("a\\b")).toBe("a\\\\b")
		})

		it("escapes single quotes", () => {
			expect(escapeMysqlString("it's")).toBe("it\\'s")
		})

		it("escapes newlines and tabs", () => {
			expect(escapeMysqlString("a\nb\tc")).toBe("a\\nb\\tc")
		})

		it("escapes null bytes", () => {
			expect(escapeMysqlString("a\0b")).toBe("a\\0b")
		})

		it("handles clean strings unchanged", () => {
			expect(escapeMysqlString("hello")).toBe("hello")
		})
	})

	describe("parseCreateTable", () => {
		it("extracts table name and column names", () => {
			const result = parseCreateTable(
				`CREATE TABLE "user" ("id" text NOT NULL, "name" text, PRIMARY KEY ("id"));`,
			)
			expect(result).toEqual({
				tableName: "user",
				columns: ["id", "name"],
			})
		})

		it("handles IF NOT EXISTS", () => {
			const result = parseCreateTable(
				`CREATE TABLE IF NOT EXISTS "team" ("id" text NOT NULL, "slug" text, PRIMARY KEY ("id"));`,
			)
			expect(result?.tableName).toBe("team")
			expect(result?.columns).toEqual(["id", "slug"])
		})

		it("skips FOREIGN KEY, UNIQUE, CHECK constraints", () => {
			const result = parseCreateTable(
				`CREATE TABLE "scores" ("id" text, "userId" text, FOREIGN KEY ("userId") REFERENCES "user"("id"), UNIQUE ("id"));`,
			)
			expect(result?.columns).toEqual(["id", "userId"])
		})

		it("returns null for non-CREATE TABLE", () => {
			expect(parseCreateTable("SELECT * FROM user")).toBeNull()
		})
	})

	// ===========================================================================
	// Constants validation
	// ===========================================================================

	describe("constants", () => {
		it("TABLE_NAME_MAP maps user -> users", () => {
			expect(TABLE_NAME_MAP["user"]).toBe("users")
		})

		it("TABLE_NAME_MAP maps team -> teams", () => {
			expect(TABLE_NAME_MAP["team"]).toBe("teams")
		})

		it("SKIP_TABLES includes d1_migrations", () => {
			expect(SKIP_TABLES.has("d1_migrations")).toBe(true)
		})

		it("BOOLEAN_COLUMNS includes is_personal_team", () => {
			expect(BOOLEAN_COLUMNS.has("is_personal_team")).toBe(true)
		})

		it("TIMESTAMP_COLUMNS includes created_at", () => {
			expect(TIMESTAMP_COLUMNS.has("created_at")).toBe(true)
		})

		it("DATE_STRING_COLUMNS includes start_date", () => {
			expect(DATE_STRING_COLUMNS.has("start_date")).toBe(true)
		})
	})
})
