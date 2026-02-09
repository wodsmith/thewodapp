import { parseValues } from "../../scripts/migrate-d1-to-ps-lib"

describe("parseValues", () => {
	it("parses simple quoted strings", () => {
		const result = parseValues("('hello','world')")
		expect(result).toHaveLength(1)
		expect(result[0]).toEqual([
			{ value: "hello", wasQuoted: true },
			{ value: "world", wasQuoted: true },
		])
	})

	it("parses numeric values", () => {
		const result = parseValues("(123, 45.6)")
		expect(result).toHaveLength(1)
		expect(result[0]).toEqual([
			{ value: "123", wasQuoted: false },
			{ value: "45.6", wasQuoted: false },
		])
	})

	it("parses NULL", () => {
		const result = parseValues("(NULL)")
		expect(result).toHaveLength(1)
		expect(result[0]).toEqual([{ value: "NULL", wasQuoted: false }])
	})

	it("parses escaped quotes (doubled single quotes)", () => {
		const result = parseValues("('it''s')")
		expect(result).toHaveLength(1)
		expect(result[0]).toEqual([{ value: "it's", wasQuoted: true }])
	})

	it("preserves leading zeros in quoted strings (critical bug fix)", () => {
		const result = parseValues("('0891787218132140032')")
		expect(result).toHaveLength(1)
		expect(result[0]).toEqual([
			{ value: "0891787218132140032", wasQuoted: true },
		])
	})

	it("parses replace function with newline substitution", () => {
		const result = parseValues("(replace('hello\\nworld','\\n',char(10)))")
		expect(result).toHaveLength(1)
		expect(result[0]).toHaveLength(1)
		expect(result[0][0].wasQuoted).toBe(true)
		expect(result[0][0].value).toBe("hello\nworld")
	})

	it("parses hex literals", () => {
		const result = parseValues("(X'deadbeef')")
		expect(result).toHaveLength(1)
		expect(result[0]).toEqual([
			{ value: "X'deadbeef'", wasQuoted: false },
		])
	})

	it("parses mixed types in a single row", () => {
		const result = parseValues("('abc',123,NULL,'def')")
		expect(result).toHaveLength(1)
		expect(result[0]).toEqual([
			{ value: "abc", wasQuoted: true },
			{ value: "123", wasQuoted: false },
			{ value: "NULL", wasQuoted: false },
			{ value: "def", wasQuoted: true },
		])
	})

	it("parses multiple rows", () => {
		const result = parseValues("('a',1),('b',2)")
		expect(result).toHaveLength(2)
		expect(result[0]).toEqual([
			{ value: "a", wasQuoted: true },
			{ value: "1", wasQuoted: false },
		])
		expect(result[1]).toEqual([
			{ value: "b", wasQuoted: true },
			{ value: "2", wasQuoted: false },
		])
	})

	it("parses empty string", () => {
		const result = parseValues("('')")
		expect(result).toHaveLength(1)
		expect(result[0]).toEqual([{ value: "", wasQuoted: true }])
	})

	it("marks all-digit quoted string as wasQuoted=true", () => {
		const result = parseValues("('12345')")
		expect(result).toHaveLength(1)
		expect(result[0]).toEqual([{ value: "12345", wasQuoted: true }])
	})

	it("differentiates quoted vs unquoted numbers", () => {
		const result = parseValues("('12345',12345)")
		expect(result).toHaveLength(1)
		expect(result[0][0]).toEqual({ value: "12345", wasQuoted: true })
		expect(result[0][1]).toEqual({ value: "12345", wasQuoted: false })
	})

	it("handles negative numbers", () => {
		const result = parseValues("(-42)")
		expect(result).toHaveLength(1)
		expect(result[0]).toEqual([{ value: "-42", wasQuoted: false }])
	})

	it("returns empty array for empty input", () => {
		const result = parseValues("")
		expect(result).toEqual([])
	})
})
