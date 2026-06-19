// @lat: [[crew#Import CSV Preview#Parser Warnings]]
import type { CsvParseResult, CsvRecord, ImportIssue } from "./types"

interface ParseCsvOptions {
  maxRows?: number
}

export function parseCsv(
  input: string,
  options: ParseCsvOptions = {},
): CsvParseResult {
  const fileIssues: ImportIssue[] = []
  const records = parseCsvRecords(stripBom(input), fileIssues)
  const headers = records[0]?.map((header) => header.trim()) ?? []

  if (headers.length === 0 || headers.every((header) => header.length === 0)) {
    return {
      headers: [],
      rows: [],
      fileIssues: [
        ...fileIssues,
        {
          code: "missing_headers",
          severity: "error",
          message: "CSV must include a header row.",
        },
      ],
      skippedRowCount: 0,
    }
  }

  const duplicateHeaderGroups = findDuplicateHeaderGroups(headers)
  if (duplicateHeaderGroups.length > 0) {
    return {
      headers,
      rows: [],
      fileIssues: [
        ...fileIssues,
        {
          code: "duplicate_headers",
          severity: "error",
          message: `CSV headers must be unique. Duplicate header group${duplicateHeaderGroups.length === 1 ? "" : "s"}: ${duplicateHeaderGroups.join("; ")}.`,
        },
      ],
      skippedRowCount: 0,
    }
  }

  const rows: CsvRecord[] = []
  let skippedRowCount = 0
  const dataRecords = records.slice(1)
  const maxRows = options.maxRows ?? Number.POSITIVE_INFINITY

  dataRecords.forEach((record, index) => {
    const rowNumber = index + 2

    if (record.every((value) => value.trim().length === 0)) return

    if (rows.length >= maxRows) {
      skippedRowCount++
      return
    }

    const issues: ImportIssue[] = []
    if (record.length !== headers.length) {
      issues.push({
        code: "malformed_row",
        severity: "error",
        rowNumber,
        message: `Expected ${headers.length} columns but found ${record.length}.`,
      })
    }

    rows.push({
      rowNumber,
      rawValues: record,
      values: mapRecordToHeaders(headers, record),
      issues,
    })
  })

  if (skippedRowCount > 0) {
    fileIssues.push({
      code: "preview_row_limit",
      severity: "warning",
      message: `${skippedRowCount} row${skippedRowCount === 1 ? "" : "s"} were skipped after the preview limit.`,
    })
  }

  return { headers, rows, fileIssues, skippedRowCount }
}

function parseCsvRecords(input: string, issues: ImportIssue[]) {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentValue = ""
  let inQuotes = false
  let justClosedQuote = false

  for (let index = 0; index < input.length; index++) {
    const char = input[index]
    const nextChar = input[index + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentValue += '"'
        index++
      } else if (char === '"') {
        inQuotes = false
        justClosedQuote = true
      } else {
        currentValue += char
      }
      continue
    }

    if (char === '"') {
      if (currentValue.length === 0 || justClosedQuote) {
        inQuotes = true
        justClosedQuote = false
      } else {
        currentValue += char
      }
      continue
    }

    if (char === ",") {
      currentRow.push(currentValue)
      currentValue = ""
      justClosedQuote = false
      continue
    }

    if (char === "\n") {
      currentRow.push(currentValue)
      rows.push(currentRow)
      currentRow = []
      currentValue = ""
      justClosedQuote = false
      continue
    }

    if (char === "\r") {
      if (nextChar === "\n") continue
      currentRow.push(currentValue)
      rows.push(currentRow)
      currentRow = []
      currentValue = ""
      justClosedQuote = false
      continue
    }

    currentValue += char
    if (char.trim().length > 0) {
      justClosedQuote = false
    }
  }

  if (inQuotes) {
    issues.push({
      code: "unterminated_quote",
      severity: "error",
      message: "CSV has an unterminated quoted field.",
    })
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue)
    rows.push(currentRow)
  }

  return rows
}

function findDuplicateHeaderGroups(headers: string[]) {
  const headersByNormalizedLabel = new Map<
    string,
    Array<{ columnNumber: number; label: string }>
  >()

  headers.forEach((header, index) => {
    const label = header.trim()
    if (!label) return

    const key = label.toLowerCase().replace(/\s+/g, " ")
    const group = headersByNormalizedLabel.get(key) ?? []
    group.push({ columnNumber: index + 1, label })
    headersByNormalizedLabel.set(key, group)
  })

  return [...headersByNormalizedLabel.values()]
    .filter((group) => group.length > 1)
    .map((group) =>
      group
        .map((header) => `${header.label} (column ${header.columnNumber})`)
        .join(" / "),
    )
}

function mapRecordToHeaders(headers: string[], record: string[]) {
  const values: Record<string, string> = {}

  headers.forEach((header, index) => {
    values[header] = record[index]?.trim() ?? ""
  })

  if (record.length > headers.length) {
    record.slice(headers.length).forEach((value, index) => {
      values[`__extra_${index + 1}`] = value.trim()
    })
  }

  return values
}

function stripBom(value: string) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value
}
