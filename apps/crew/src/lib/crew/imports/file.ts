// @lat: [[crew#Import CSV Preview#Parser Warnings]]
import { parseCsv } from "./csv"
import type { CsvParseResult } from "./types"
import { parseXlsx } from "./xlsx"

export const CREW_IMPORT_ACCEPTED_FILE_TYPES = [
  ".csv",
  "text/csv",
  ".xlsx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xlsm",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
].join(",")

interface ParseCrewImportFileOptions {
  maxRows?: number
}

export function parseCrewImportFile(
  file: {
    filename: string
    mimeType?: string | null
    data: string | Uint8Array | ArrayBuffer
  },
  options: ParseCrewImportFileOptions = {},
): CsvParseResult {
  if (isExcelWorkbookUpload(file.filename, file.mimeType)) {
    return parseXlsx(toBytes(file.data), options)
  }

  if (isCsvUpload(file.filename, file.mimeType)) {
    return parseCsv(toText(file.data), options)
  }

  return {
    headers: [],
    rows: [],
    fileIssues: [
      {
        code: "unsupported_file_type",
        severity: "error",
        message:
          "Crew import accepts CSV files and Excel workbooks saved as .xlsx or .xlsm.",
      },
    ],
    skippedRowCount: 0,
  }
}

export function isSupportedCrewImportFile(
  filename: string,
  mimeType?: string | null,
) {
  return (
    isCsvUpload(filename, mimeType) || isExcelWorkbookUpload(filename, mimeType)
  )
}

export function isCsvUpload(filename: string, mimeType?: string | null) {
  return (
    isCsvFilename(filename) ||
    (!hasExcelFileExtension(filename) && isCsvMimeType(mimeType))
  )
}

export function isExcelWorkbookUpload(
  filename: string,
  mimeType?: string | null,
) {
  return isExcelWorkbookFilename(filename) || isExcelWorkbookMimeType(mimeType)
}

function toBytes(data: string | Uint8Array | ArrayBuffer) {
  if (data instanceof Uint8Array) return data
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  return new TextEncoder().encode(data)
}

function toText(data: string | Uint8Array | ArrayBuffer) {
  if (typeof data === "string") return data
  return new TextDecoder().decode(toBytes(data))
}

function isCsvMimeType(mimeType?: string | null) {
  if (!mimeType) return false

  const normalizedMimeType = normalizeMimeType(mimeType)
  return (
    normalizedMimeType === "text/csv" ||
    normalizedMimeType === "application/csv" ||
    normalizedMimeType === "application/vnd.ms-excel"
  )
}

function isCsvFilename(filename: string) {
  return filename.toLowerCase().endsWith(".csv")
}

function isExcelWorkbookMimeType(mimeType?: string | null) {
  if (!mimeType) return false

  const normalizedMimeType = normalizeMimeType(mimeType)
  return (
    normalizedMimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    normalizedMimeType === "application/vnd.ms-excel.sheet.macroenabled.12"
  )
}

function isExcelWorkbookFilename(filename: string) {
  const normalizedFilename = filename.toLowerCase()
  return (
    normalizedFilename.endsWith(".xlsx") || normalizedFilename.endsWith(".xlsm")
  )
}

function hasExcelFileExtension(filename: string) {
  const normalizedFilename = filename.toLowerCase()
  return (
    normalizedFilename.endsWith(".xls") ||
    normalizedFilename.endsWith(".xlsx") ||
    normalizedFilename.endsWith(".xlsm")
  )
}

function normalizeMimeType(mimeType: string) {
  return mimeType.split(";")[0]?.trim().toLowerCase()
}
