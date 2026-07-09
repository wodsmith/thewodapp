import type { ImportIssue } from "./types"

export const MAX_CREW_IMPORT_BYTES = 1_000_000

export interface CrewImportFileLike {
  name: string
  size: number
  type?: string | null
}

export function getCrewImportFileIssue(
  file: CrewImportFileLike,
): ImportIssue | null {
  if (file.size > MAX_CREW_IMPORT_BYTES) {
    return {
      code: "payload_too_large",
      severity: "error",
      message: "Choose a CSV smaller than 1 MB.",
    }
  }

  if (!isCrewImportCsvUpload(file.name, file.type)) {
    return {
      code: "invalid_file_type",
      severity: "error",
      message: "Choose a CSV file to continue.",
    }
  }

  return null
}

export function isCrewImportCsvUpload(
  filename: string,
  mimeType?: string | null,
) {
  return isCsvFilename(filename) || isCsvMimeType(mimeType)
}

function isCsvMimeType(mimeType?: string | null) {
  if (!mimeType) return false

  const normalizedMimeType = mimeType.split(";")[0]?.trim().toLowerCase()
  return (
    normalizedMimeType === "text/csv" ||
    normalizedMimeType === "application/csv" ||
    normalizedMimeType === "application/vnd.ms-excel"
  )
}

function isCsvFilename(filename: string) {
  return filename.toLowerCase().endsWith(".csv")
}
