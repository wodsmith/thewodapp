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

export interface ImportFieldDefinition {
  key: string
  label: string
  required?: boolean
  aliases: string[]
}

export type ColumnMapping = Record<string, string>

export interface VolunteerQuestionAnswer {
  // Existing question id, or null when the answer will create a new question.
  questionId: string | null
  label: string
  answer: string
}

export interface VolunteerImportRow {
  firstName: string
  lastName: string
  name: string
  email: string
  phone: string
  phoneCountryCode: string
  role: string
  rolePreference1: string
  rolePreference2: string
  rolePreference3: string
  division: string
  availability: string
  shirtSize: string
  sourceExternalId: string
  sourceCreatedAt: string
  notes: string
  questionAnswers: VolunteerQuestionAnswer[]
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
  // Existing volunteer registration questions the operator can map columns to.
  volunteerQuestions?: Array<{ id: string; label: string }>
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

export interface VolunteerQuestionPreviewSummary {
  columns: Array<{
    columnKey: string
    header: string
    label: string
    willCreate: boolean
    answerCount: number
  }>
  questionsToCreate: string[]
  totalAnswerCount: number
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
  // Volunteer-only: planned question creation + answer counts for the UI.
  volunteerQuestionPlan?: VolunteerQuestionPreviewSummary
}
