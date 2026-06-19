import { describe, expect, it } from "vitest"
import {
	toSnakeCase,
	epochToDatetime,
	escapeMysqlString,
	parseCreateTable,
	processSqlDump,
} from "../../scripts/migrate-d1-to-ps-lib"

// ===========================================================================
// Helper function unit tests
// ===========================================================================

describe("toSnakeCase", () => {
	it("leaves already snake_case unchanged", () => {
		expect(toSnakeCase("team_id")).toBe("team_id")
	})

	it("converts simple camelCase", () => {
		expect(toSnakeCase("teamId")).toBe("team_id")
	})

	it("converts multi-word camelCase", () => {
		expect(toSnakeCase("sortKeyValue")).toBe("sort_key_value")
	})

	it("converts camelCase with common prefix", () => {
		expect(toSnakeCase("userId")).toBe("user_id")
	})

	it("handles consecutive uppercase (acronyms)", () => {
		// isHTTPSEnabled: first regex inserts _ between s and H,
		// second regex splits between S and E (uppercase followed by uppercase+lowercase)
		const result = toSnakeCase("isHTTPSEnabled")
		// Verify it produces a reasonable snake_case output
		expect(result).toBe(result.toLowerCase())
		expect(result).toContain("is_")
		expect(result).toContain("enabled")
	})

	it("leaves all-lowercase unchanged", () => {
		expect(toSnakeCase("name")).toBe("name")
	})
})

describe("epochToDatetime", () => {
	it("converts epoch seconds to datetime", () => {
		expect(epochToDatetime(1700000000)).toBe("2023-11-14 22:13:20")
	})

	it("converts epoch milliseconds to same datetime", () => {
		expect(epochToDatetime(1700000000000)).toBe("2023-11-14 22:13:20")
	})

	it("boundary: 9999999999 is treated as seconds", () => {
		const result = epochToDatetime(9999999999)
		// 9999999999 seconds = Nov 20, 2286 — should produce a valid date far in the future
		const d = new Date(9999999999 * 1000)
		const expected = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")}`
		expect(result).toBe(expected)
	})

	it("boundary: 10000000000 is treated as milliseconds", () => {
		const result = epochToDatetime(10000000000)
		// 10000000000 ms = Jan 26, 1970 — treated as milliseconds
		const d = new Date(10000000000)
		const expected = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")}`
		expect(result).toBe(expected)
	})
})

describe("escapeMysqlString", () => {
	it("escapes backslashes", () => {
		expect(escapeMysqlString("a\\b")).toBe("a\\\\b")
	})

	it("escapes single quotes", () => {
		expect(escapeMysqlString("it's")).toBe("it\\'s")
	})

	it("escapes newlines", () => {
		expect(escapeMysqlString("line1\nline2")).toBe("line1\\nline2")
	})

	it("escapes combined special characters", () => {
		const input = "it's a\\path\nwith\ttabs\0end"
		const result = escapeMysqlString(input)
		expect(result).toBe("it\\'s a\\\\path\\nwith\\ttabs\\0end")
	})

	it("leaves clean strings unchanged", () => {
		expect(escapeMysqlString("hello world")).toBe("hello world")
	})
})

describe("parseCreateTable", () => {
	it("parses simple CREATE TABLE", () => {
		const sql = `CREATE TABLE "user" (\n"id" text PRIMARY KEY,\n"name" text NOT NULL\n);`
		const result = parseCreateTable(sql)
		expect(result).toEqual({
			tableName: "user",
			columns: ["id", "name"],
		})
	})

	it("handles IF NOT EXISTS", () => {
		const sql = `CREATE TABLE IF NOT EXISTS "team" ("id" text NOT NULL, "slug" text, PRIMARY KEY ("id"));`
		const result = parseCreateTable(sql)
		expect(result?.tableName).toBe("team")
		expect(result?.columns).toEqual(["id", "slug"])
	})

	it("skips FOREIGN KEY and trailing PRIMARY KEY constraints", () => {
		const sql = `CREATE TABLE "scores" ("id" text, "userId" text, FOREIGN KEY ("userId") REFERENCES "user"("id"), PRIMARY KEY ("id"));`
		const result = parseCreateTable(sql)
		expect(result?.columns).toEqual(["id", "userId"])
	})

	it("handles nested parens in CHECK constraints", () => {
		const sql = `CREATE TABLE "items" ("id" text, "qty" integer, CHECK (qty > 0 AND qty < 1000), PRIMARY KEY ("id"));`
		const result = parseCreateTable(sql)
		expect(result?.columns).toEqual(["id", "qty"])
	})

	it("returns null for non-CREATE TABLE", () => {
		expect(parseCreateTable("SELECT * FROM user")).toBeNull()
	})
})

// ===========================================================================
// E2E pipeline test: processSqlDump
// ===========================================================================

describe("processSqlDump E2E pipeline", () => {
	const sqlDump = [
		`CREATE TABLE "scores" (`,
		`"id" text PRIMARY KEY,`,
		`"sortKey" text,`,
		`"value" integer,`,
		`"created_at" integer,`,
		`"is_active" integer DEFAULT 0`,
		`);`,
		`INSERT INTO "scores" VALUES('abc123','0891787218132140032',42,1700000000,1);`,
	].join("\n")

	it("parses table columns correctly", () => {
		const result = processSqlDump(sqlDump)
		expect(result.tableColumns).toHaveProperty("scores")
		expect(result.tableColumns["scores"]).toEqual([
			"id",
			"sortKey",
			"value",
			"created_at",
			"is_active",
		])
	})

	it("parses table rows as ParsedValue arrays", () => {
		const result = processSqlDump(sqlDump)
		expect(result.tableRows).toHaveProperty("scores")
		expect(result.tableRows["scores"]).toHaveLength(1)

		const row = result.tableRows["scores"][0]
		expect(row[0]).toEqual({ value: "abc123", wasQuoted: true })
		expect(row[1]).toEqual({ value: "0891787218132140032", wasQuoted: true })
		expect(row[2]).toEqual({ value: "42", wasQuoted: false })
		expect(row[3]).toEqual({ value: "1700000000", wasQuoted: false })
		expect(row[4]).toEqual({ value: "1", wasQuoted: false })
	})

	it("generates correct INSERT IGNORE statement", () => {
		const result = processSqlDump(sqlDump)
		expect(result.statements).toHaveLength(1)
		expect(result.statements[0].psTable).toBe("scores")
		expect(result.statements[0].d1Table).toBe("scores")

		const sql = result.statements[0].sql[0]

		// Uses INSERT IGNORE
		expect(sql).toMatch(/^INSERT IGNORE INTO/)

		// sort_key padded to 38 chars
		expect(sql).toContain("'00000000000000000000891787218132140032'")

		// created_at converted from epoch to datetime
		expect(sql).toContain("'2023-11-14 22:13:20'")

		// is_active as boolean 1
		expect(sql).toContain(",1)")

		// id as quoted string
		expect(sql).toContain("'abc123'")
	})

	it("has no warnings for known tables", () => {
		const result = processSqlDump(sqlDump)
		expect(result.warnings).toHaveLength(0)
	})
})
