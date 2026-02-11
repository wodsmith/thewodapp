import { describe, expect, it } from "vitest"
import { buildInsert, type ParsedValue } from "../../scripts/migrate-d1-to-ps-lib"

describe("buildInsert", () => {
	it("pads sortKey values to 38 characters with leading zeros", () => {
		const rows: ParsedValue[][] = [
			[
				{ value: "some-id", wasQuoted: true },
				{ value: "0891787218132140032", wasQuoted: true },
			],
		]
		const result = buildInsert("scores", ["id", "sortKey"], rows, "scores")
		expect(result).toHaveLength(1)
		expect(result[0]).toContain("'00000000000000000000891787218132140032'")
	})

	it("keeps quoted strings quoted for non-sort-key columns", () => {
		const rows: ParsedValue[][] = [
			[{ value: "0891787218132140032", wasQuoted: true }],
		]
		const result = buildInsert("scores", ["id"], rows, "scores")
		expect(result).toHaveLength(1)
		expect(result[0]).toContain("'0891787218132140032'")
		// Should NOT contain the zero-padded version
		expect(result[0]).not.toContain("'00000000000000000000891787218132140032'")
	})

	it("does not treat quoted all-digit strings as numbers", () => {
		const rows: ParsedValue[][] = [[{ value: "12345", wasQuoted: true }]]
		const result = buildInsert("users", ["id"], rows, "user")
		expect(result).toHaveLength(1)
		// Should be quoted: '12345', not bare 12345
		expect(result[0]).toContain("'12345'")
	})

	it("outputs unquoted numbers as bare values", () => {
		const rows: ParsedValue[][] = [[{ value: "123", wasQuoted: false }]]
		const result = buildInsert("scores", ["points"], rows, "scores")
		expect(result).toHaveLength(1)
		expect(result[0]).toContain("(123)")
	})

	it("outputs NULL for unquoted NULL values", () => {
		const rows: ParsedValue[][] = [[{ value: "NULL", wasQuoted: false }]]
		const result = buildInsert("users", ["name"], rows, "user")
		expect(result).toHaveLength(1)
		expect(result[0]).toContain("(NULL)")
	})

	it("passes through hex literals unchanged", () => {
		const rows: ParsedValue[][] = [
			[{ value: "X'deadbeef'", wasQuoted: false }],
		]
		const result = buildInsert("users", ["avatar"], rows, "user")
		expect(result).toHaveLength(1)
		expect(result[0]).toContain("X'deadbeef'")
	})

	it("converts epoch timestamps to datetime strings", () => {
		const rows: ParsedValue[][] = [
			[{ value: "1700000000", wasQuoted: false }],
		]
		const result = buildInsert("users", ["created_at"], rows, "user")
		expect(result).toHaveLength(1)
		expect(result[0]).toContain("'2023-11-14 22:13:20'")
	})

	it("converts boolean string values to 0/1", () => {
		const rows: ParsedValue[][] = [
			[{ value: "true", wasQuoted: false }],
			[{ value: "false", wasQuoted: false }],
		]
		const result = buildInsert("teams", ["is_active"], rows, "team")
		expect(result).toHaveLength(1)
		// First row should have 1, second row should have 0
		expect(result[0]).toContain("(1)")
		expect(result[0]).toContain("(0)")
	})

	it("maps camelCase d1 columns to snake_case in output", () => {
		const rows: ParsedValue[][] = [
			[{ value: "abc", wasQuoted: true }],
		]
		const result = buildInsert("teams", ["teamId"], rows, "team")
		expect(result).toHaveLength(1)
		expect(result[0]).toContain("`team_id`")
		expect(result[0]).not.toContain("`teamId`")
	})

	it("batches rows into multiple statements when exceeding BATCH_SIZE", () => {
		const rows: ParsedValue[][] = Array.from({ length: 60 }, () => [
			{ value: "val", wasQuoted: true },
		])
		const result = buildInsert("users", ["name"], rows, "user")
		expect(result).toHaveLength(2)
		// First statement should have 50 value groups
		const firstCount = (result[0].match(/\(/g) || []).length
		// Each value group is (val), plus one for the column list
		// Column list: (`name`) = 1 open paren, values: 50 open parens
		expect(firstCount).toBe(51) // 1 for columns + 50 for values
		const secondCount = (result[1].match(/\(/g) || []).length
		expect(secondCount).toBe(11) // 1 for columns + 10 for values
	})

	it("does not epoch-convert date string columns like start_date", () => {
		const rows: ParsedValue[][] = [
			[{ value: "2024-01-15", wasQuoted: true }],
		]
		const result = buildInsert(
			"competitions",
			["start_date"],
			rows,
			"competitions",
		)
		expect(result).toHaveLength(1)
		expect(result[0]).toContain("'2024-01-15'")
		// Should NOT be converted to an epoch-based datetime
		expect(result[0]).not.toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)
	})

	it("generates INSERT IGNORE INTO with backtick-quoted table and columns", () => {
		const rows: ParsedValue[][] = [
			[
				{ value: "id1", wasQuoted: true },
				{ value: "hello", wasQuoted: true },
			],
		]
		const result = buildInsert("users", ["id", "name"], rows, "user")
		expect(result).toHaveLength(1)
		expect(result[0]).toMatch(
			/^INSERT IGNORE INTO `users` \(`id`,`name`\) VALUES /,
		)
		expect(result[0].endsWith(";")).toBe(true)
	})

	it("escapes single quotes in string values", () => {
		const rows: ParsedValue[][] = [
			[{ value: "it's a test", wasQuoted: true }],
		]
		const result = buildInsert("users", ["name"], rows, "user")
		expect(result).toHaveLength(1)
		expect(result[0]).toContain("'it\\'s a test'")
	})

	it("handles epoch milliseconds (13-digit) for timestamp columns", () => {
		const rows: ParsedValue[][] = [
			[{ value: "1700000000000", wasQuoted: false }],
		]
		const result = buildInsert("users", ["created_at"], rows, "user")
		expect(result).toHaveLength(1)
		expect(result[0]).toContain("'2023-11-14 22:13:20'")
	})

	it("handles timestamp columns that already have date string values", () => {
		const rows: ParsedValue[][] = [
			[{ value: "2024-01-15 10:30:00", wasQuoted: true }],
		]
		const result = buildInsert("users", ["created_at"], rows, "user")
		expect(result).toHaveLength(1)
		expect(result[0]).toContain("'2024-01-15 10:30:00'")
	})
})
