import { describe, expect, it } from "vitest"
import {
	boundTableForModel,
	parseCsv,
	parseImportFile,
	parseTsv,
	parseXlsx,
} from "@/lib/organizer-file-import/parse"

function bytesOf(text: string): ArrayBuffer {
	return new TextEncoder().encode(text).buffer as ArrayBuffer
}

describe("parseCsv", () => {
	it("detects headers and maps rows by column", () => {
		const table = parseCsv("Name,Email\nAda,ada@example.com\nGrace,grace@example.com")
		expect(table.headers).toEqual(["Name", "Email"])
		expect(table.rows).toEqual([
			{ Name: "Ada", Email: "ada@example.com" },
			{ Name: "Grace", Email: "grace@example.com" },
		])
	})

	it("skips empty lines and trims headers and cells", () => {
		const table = parseCsv(" Name , Email \nAda , ada@example.com \n\n\n")
		expect(table.headers).toEqual(["Name", "Email"])
		expect(table.rows).toEqual([{ Name: "Ada", Email: "ada@example.com" }])
	})
})

describe("parseTsv", () => {
	it("splits on tabs", () => {
		const table = parseTsv("Name\tRole\nAda\tHead Judge")
		expect(table.headers).toEqual(["Name", "Role"])
		expect(table.rows).toEqual([{ Name: "Ada", Role: "Head Judge" }])
	})
})

describe("parseXlsx", () => {
	it("keeps headers when the sheet has no data rows", async () => {
		const XLSX = await import("xlsx")
		const ws = XLSX.utils.aoa_to_sheet([["Name", "Email", "Role"]])
		const wb = XLSX.utils.book_new()
		XLSX.utils.book_append_sheet(wb, ws, "Roster")
		const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" })

		const table = await parseXlsx(bytes)

		expect(table.headers).toEqual(["Name", "Email", "Role"])
		expect(table.rows).toEqual([])
	})
})

describe("parseImportFile", () => {
	it("parses a CSV by mime type into a multi-column table", async () => {
		const table = await parseImportFile({
			bytes: bytesOf("Name,Email\nAda,ada@example.com"),
			mimeType: "text/csv",
			filename: "roster.csv",
		})
		expect(table.headers).toEqual(["Name", "Email"])
		expect(table.rows).toHaveLength(1)
	})

	it("falls back to one row per line for non-tabular plain text", async () => {
		const table = await parseImportFile({
			bytes: bytesOf("Ada Lovelace\nGrace Hopper\n"),
			mimeType: "text/plain",
			filename: "names.txt",
		})
		expect(table.headers).toEqual(["line"])
		expect(table.rows).toEqual([
			{ line: "Ada Lovelace" },
			{ line: "Grace Hopper" },
		])
		expect(table.warnings.length).toBeGreaterThan(0)
	})

	it("routes by extension when the mime type is generic", async () => {
		const table = await parseImportFile({
			bytes: bytesOf("Name\tEmail\nAda\tada@example.com"),
			mimeType: "application/octet-stream",
			filename: "roster.tsv",
		})
		expect(table.headers).toEqual(["Name", "Email"])
	})
})

describe("boundTableForModel", () => {
	it("returns the table untouched when under the cap", () => {
		const table = { headers: ["a"], rows: [{ a: "1" }], warnings: [] }
		const { table: out, truncated } = boundTableForModel(table, 200)
		expect(truncated).toBe(false)
		expect(out.rows).toHaveLength(1)
	})

	it("caps rows and flags truncation", () => {
		const rows = Array.from({ length: 250 }, (_, i) => ({ a: String(i) }))
		const { table: out, truncated } = boundTableForModel(
			{ headers: ["a"], rows, warnings: [] },
			200,
		)
		expect(truncated).toBe(true)
		expect(out.rows).toHaveLength(200)
	})
})
