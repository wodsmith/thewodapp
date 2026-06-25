/**
 * Deterministic file parsing for the file-drop import agent. Bytes are parsed
 * to rows/text on the server BEFORE the model sees anything — cheaper, safer,
 * and bounded. The model normalizes/maps columns; it never parses raw bytes.
 *
 * CSV/TSV/plain-text use papaparse (pure JS, Workers-safe). XLSX uses SheetJS
 * via a dynamic import so it never bloats cold start when only CSVs are dropped.
 */

import Papa from "papaparse"

export interface ParsedTable {
	headers: string[]
	rows: Record<string, string>[]
	warnings: string[]
}

const MAX_WARNINGS = 20

/** Normalize a sheet/CSV cell to a trimmed string regardless of source type. */
function toCellString(value: unknown): string {
	if (value === null || value === undefined) return ""
	if (typeof value === "string") return value.trim()
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value)
	}
	return String(value).trim()
}

export function parseDelimited(text: string, delimiter?: string): ParsedTable {
	const out = Papa.parse<Record<string, unknown>>(text, {
		header: true,
		skipEmptyLines: "greedy",
		...(delimiter ? { delimiter } : {}),
	})
	const warnings = out.errors
		.slice(0, MAX_WARNINGS)
		.map((e) => `row ${e.row ?? "?"}: ${e.message}`)
	const headers = (out.meta.fields ?? []).map((h) => h.trim())
	const rows = (out.data ?? []).map((row) => {
		const normalized: Record<string, string> = {}
		for (const key of Object.keys(row)) {
			normalized[key.trim()] = toCellString(row[key])
		}
		return normalized
	})
	return { headers, rows, warnings }
}

export function parseCsv(text: string): ParsedTable {
	return parseDelimited(text)
}

export function parseTsv(text: string): ParsedTable {
	return parseDelimited(text, "\t")
}

export async function parseXlsx(bytes: ArrayBuffer): Promise<ParsedTable> {
	// Dynamic import keeps the (large) SheetJS module out of the cold-start path.
	const XLSX = await import("xlsx")
	const wb = XLSX.read(bytes, { type: "array" })
	const sheetName = wb.SheetNames[0]
	if (!sheetName) return { headers: [], rows: [], warnings: ["Empty workbook"] }
	const sheet = wb.Sheets[sheetName]
	const headerRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
		header: 1,
		blankrows: false,
		defval: "",
	})
	const headers = (headerRows[0] ?? []).map(toCellString).filter(Boolean)
	const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
		blankrows: false,
		defval: "",
	})
	const rows = raw.map((row) => {
		const normalized: Record<string, string> = {}
		for (const key of Object.keys(row)) {
			const header = key.trim()
			if (header) normalized[header] = toCellString(row[key])
		}
		return normalized
	})
	const warnings =
		wb.SheetNames.length > 1
			? [
					`Workbook has ${wb.SheetNames.length} sheets; only "${sheetName}" was read.`,
				]
			: []
	return { headers, rows, warnings }
}

/**
 * Parse an uploaded file by mime type / filename into a table. Plain text and
 * markdown that aren't tabular come back as a single-column table so the model
 * still receives the content.
 */
export async function parseImportFile(input: {
	bytes: ArrayBuffer
	mimeType: string | null
	filename: string | null
}): Promise<ParsedTable> {
	const { bytes, mimeType, filename } = input
	const name = (filename ?? "").toLowerCase()
	const type = (mimeType ?? "").toLowerCase()

	const isXlsx =
		type.includes("spreadsheetml") ||
		type === "application/vnd.ms-excel" ||
		name.endsWith(".xlsx") ||
		name.endsWith(".xls")
	if (isXlsx) return parseXlsx(bytes)

	const text = new TextDecoder().decode(bytes)
	const isTsv =
		type.includes("tab-separated") || name.endsWith(".tsv")
	if (isTsv) return parseTsv(text)

	const isCsv = type.includes("csv") || name.endsWith(".csv")
	if (isCsv) return parseCsv(text)

	// Plain text / markdown — try CSV parsing; if it yields a single column,
	// fall back to treating each non-empty line as a row.
	const table = parseCsv(text)
	if (table.headers.length > 1) return table
	const lines = text
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean)
	return {
		headers: ["line"],
		rows: lines.map((line) => ({ line })),
		warnings: ["Treated as free text — one row per non-empty line."],
	}
}

/** Cap what we send to the model: first N rows (header summary is separate). */
export function boundTableForModel(table: ParsedTable, maxRows = 200): {
	table: ParsedTable
	truncated: boolean
} {
	if (table.rows.length <= maxRows) {
		return { table, truncated: false }
	}
	return {
		table: { ...table, rows: table.rows.slice(0, maxRows) },
		truncated: true,
	}
}
