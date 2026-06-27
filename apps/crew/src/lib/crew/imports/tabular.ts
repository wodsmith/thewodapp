// @lat: [[crew#Import CSV Preview#Parser Warnings]]
import type { CsvParseResult, CsvRecord, ImportIssue } from "./types"

interface TabularDataRow {
  rowNumber: number
  values: string[]
}

interface BuildTabularParseResultOptions {
  headers: string[]
  dataRows: TabularDataRow[]
  fileIssues?: ImportIssue[]
  maxRows?: number
  sourceLabel: string
}

export function buildTabularParseResult({
  headers,
  dataRows,
  fileIssues = [],
  maxRows = Number.POSITIVE_INFINITY,
  sourceLabel,
}: BuildTabularParseResultOptions): CsvParseResult {
  const normalizedHeaders = headers.map((header) => header.trim())

  if (
    normalizedHeaders.length === 0 ||
    normalizedHeaders.every((header) => header.length === 0)
  ) {
    return {
      headers: [],
      rows: [],
      fileIssues: [
        ...fileIssues,
        {
          code: "missing_headers",
          severity: "error",
          message: `${sourceLabel} must include a header row.`,
        },
      ],
      skippedRowCount: 0,
    }
  }

  const duplicateHeaderGroups = findDuplicateHeaderGroups(normalizedHeaders)
  if (duplicateHeaderGroups.length > 0) {
    return {
      headers: normalizedHeaders,
      rows: [],
      fileIssues: [
        ...fileIssues,
        {
          code: "duplicate_headers",
          severity: "error",
          message: `${sourceLabel} headers must be unique. Duplicate header group${duplicateHeaderGroups.length === 1 ? "" : "s"}: ${duplicateHeaderGroups.join("; ")}.`,
        },
      ],
      skippedRowCount: 0,
    }
  }

  const rows: CsvRecord[] = []
  let skippedRowCount = 0

  for (const dataRow of dataRows) {
    if (dataRow.values.every((value) => value.trim().length === 0)) continue

    if (rows.length >= maxRows) {
      skippedRowCount++
      continue
    }

    const issues: ImportIssue[] = []
    if (dataRow.values.length !== normalizedHeaders.length) {
      issues.push({
        code: "malformed_row",
        severity: "error",
        rowNumber: dataRow.rowNumber,
        message: `Expected ${normalizedHeaders.length} columns but found ${dataRow.values.length}.`,
      })
    }

    rows.push({
      rowNumber: dataRow.rowNumber,
      rawValues: dataRow.values,
      values: mapRecordToHeaders(normalizedHeaders, dataRow.values),
      issues,
    })
  }

  if (skippedRowCount > 0) {
    fileIssues.push({
      code: "preview_row_limit",
      severity: "warning",
      message: `${skippedRowCount} row${skippedRowCount === 1 ? "" : "s"} were skipped after the preview limit.`,
    })
  }

  return {
    headers: normalizedHeaders,
    rows,
    fileIssues,
    skippedRowCount,
  }
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
