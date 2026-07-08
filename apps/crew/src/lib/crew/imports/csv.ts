// @lat: [[crew#Import CSV Preview#Parser Warnings]]
import { buildTabularParseResult } from "./tabular"
import type { CsvParseResult, ImportIssue } from "./types"

interface ParseCsvOptions {
  maxRows?: number
}

export function parseCsv(
  input: string,
  options: ParseCsvOptions = {},
): CsvParseResult {
  const fileIssues: ImportIssue[] = []
  const records = parseCsvRecords(stripBom(input), fileIssues)
  return buildTabularParseResult({
    headers: records[0] ?? [],
    dataRows: records.slice(1).map((record, index) => ({
      rowNumber: index + 2,
      values: record,
    })),
    fileIssues,
    maxRows: options.maxRows,
    sourceLabel: "CSV",
  })
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

function stripBom(value: string) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value
}
