/**
 * Deterministic file parsing for the organizer file-drop import agent.
 *
 * Files are parsed to rows/text on the server BEFORE the model is involved —
 * cheaper, safer, and bounded. The model normalizes/maps columns and matches
 * against existing data; it never parses raw bytes.
 *
 * MVP supports CSV/TSV (rosters, event lists) and plain text / markdown (event
 * packets pasted as text). XLSX and PDF/DOCX are a follow-up spike (see plan.md
 * Phase 9) — keep `SUPPORTED_IMPORT_MIME_TYPES` and the upload route's allow-list
 * in sync when they land.
 */

import Papa from "papaparse"

export const SUPPORTED_IMPORT_MIME_TYPES = [
  "text/csv",
  "text/tab-separated-values",
  "text/plain",
  "text/markdown",
] as const

export type ParsedTable = {
  kind: "table"
  headers: string[]
  rows: Record<string, string>[]
  rowCount: number
  warnings: string[]
}

export type ParsedText = {
  kind: "text"
  text: string
  warnings: string[]
}

export type ParsedFile = ParsedTable | ParsedText

export interface ParseInput {
  bytes: ArrayBuffer
  mimeType: string
  filename: string
}

/** Maximum rows handed to the model in one run (bounds token cost). */
export const MAX_MODEL_ROWS = 200

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".")
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase()
}

function decodeUtf8(bytes: ArrayBuffer): string {
  return new TextDecoder("utf-8").decode(bytes)
}

/** Parse delimited text (CSV/TSV) into header-keyed rows. */
export function parseDelimited(text: string, delimiter?: string): ParsedTable {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
    ...(delimiter ? { delimiter } : {}),
  })
  const warnings = result.errors
    .slice(0, 20)
    .map((e) => (e.row != null ? `Row ${e.row + 1}: ${e.message}` : e.message))
  const headers = (result.meta.fields ?? []).filter((h) => h.length > 0)
  const rows = result.data.filter((row) =>
    Object.values(row).some((v) => typeof v === "string" && v.trim() !== ""),
  )
  return { kind: "table", headers, rows, rowCount: rows.length, warnings }
}

/**
 * Parse an uploaded file by MIME type / extension. Throws for unsupported
 * types so the caller can surface a friendly error.
 */
export function parseImportFile(input: ParseInput): ParsedFile {
  const ext = extensionOf(input.filename)
  const mime = input.mimeType

  if (mime === "text/csv" || ext === "csv") {
    return parseDelimited(decodeUtf8(input.bytes))
  }
  if (mime === "text/tab-separated-values" || ext === "tsv") {
    return parseDelimited(decodeUtf8(input.bytes), "\t")
  }
  if (
    mime === "text/plain" ||
    mime === "text/markdown" ||
    ext === "txt" ||
    ext === "md"
  ) {
    return { kind: "text", text: decodeUtf8(input.bytes), warnings: [] }
  }

  throw new Error(
    `Unsupported file type "${mime || ext || "unknown"}". Supported: CSV, TSV, TXT, Markdown.`,
  )
}

/** Cap a table to the rows + headers the model should see. */
export function boundTableForModel(
  table: ParsedTable,
  maxRows = MAX_MODEL_ROWS,
): ParsedTable {
  if (table.rows.length <= maxRows) return table
  return {
    ...table,
    rows: table.rows.slice(0, maxRows),
    warnings: [
      ...table.warnings,
      `Only the first ${maxRows} of ${table.rowCount} rows were sent to the assistant.`,
    ],
  }
}

/** Compact, token-frugal rendering of a parsed file for the model prompt. */
export function renderParsedForModel(parsed: ParsedFile): string {
  if (parsed.kind === "text") {
    return parsed.text.slice(0, 12_000)
  }
  const bounded = boundTableForModel(parsed)
  const headerLine = bounded.headers.join(" | ")
  const body = bounded.rows
    .map((row, i) =>
      [`#${i + 1}`, ...bounded.headers.map((h) => row[h] ?? "")].join(" | "),
    )
    .join("\n")
  return `Columns: ${headerLine}\n${body}`
}
