// @lat: [[crew#Import CSV Preview#Parser Warnings]]
export const CREW_IMPORT_PARSER_VERSION = "crew-tabular-preview-v2"

export type CrewImportKind = "volunteers" | "heat_schedule"

export type ImportIssueSeverity = "warning" | "error"

export interface ImportIssue {
  code: string
  severity: ImportIssueSeverity
  message: string
  field?: string
  rowNumber?: number
  value?: string
}

export interface CsvRecord {
  rowNumber: number
  rawValues: string[]
  values: Record<string, string>
  issues: ImportIssue[]
}

export interface CsvParseResult {
  headers: string[]
  rows: CsvRecord[]
  fileIssues: ImportIssue[]
  skippedRowCount: number
}

export type ImportFileRecord = CsvRecord
export type ImportFileParseResult = CsvParseResult

export interface ImportFieldDefinition {
  key: string
  label: string
  required?: boolean
  aliases: string[]
}

export type ColumnMapping = Record<string, string>

export interface VolunteerImportRow {
  firstName: string
  lastName: string
  name: string
  email: string
  phone: string
  role: string
  division: string
  availability: string
  notes: string
}

export interface HeatScheduleImportRow {
  workout: string
  heatNumber: number | null
  heatLabel: string
  division: string
  scheduledTime: string
  durationMinutes: number | null
  venue: string
  laneCount: number | null
  notes: string
}

export interface CrewImportPreviewContext {
  roleLabels: string[]
  divisions: Array<{ id: string; label: string }>
  workouts: Array<{ id: string; label: string; trackOrder: number }>
  heats: Array<{
    trackWorkoutId: string
    heatNumber: number
    divisionId: string | null
  }>
}

export interface PreviewImportRow {
  rowNumber: number
  rawRow: Record<string, string>
  normalizedRow: VolunteerImportRow | HeatScheduleImportRow
  action: "create" | "skip" | "error"
  targetType: "team_invitation" | "competition_heat"
  warnings: ImportIssue[]
  errors: ImportIssue[]
}

export interface CrewImportPreview {
  kind: CrewImportKind
  parserVersion: string
  headers: string[]
  columnMapping: ColumnMapping
  rows: PreviewImportRow[]
  fileIssues: ImportIssue[]
  rowCount: number
  skippedRowCount: number
  warningCount: number
  errorCount: number
}
