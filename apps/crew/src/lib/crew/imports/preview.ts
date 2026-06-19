// @lat: [[crew#Import CSV Preview#Parser Warnings]]
import { defaultStaffingRoleAssumptions } from "../../crew-staffing-calculator"
import {
  getImportFields,
  inferColumnMapping,
  normalizeHeader,
  sanitizeColumnMapping,
} from "./column-mapping"
import { parseCsv } from "./csv"
import { addDuplicateEmailWarnings } from "./dedupe"
import { normalizeHeatScheduleRow } from "./normalize-heat-row"
import { normalizeVolunteerRow } from "./normalize-volunteer-row"
import {
  CREW_IMPORT_PARSER_VERSION,
  type ColumnMapping,
  type CrewImportKind,
  type CrewImportPreview,
  type CrewImportPreviewContext,
  type ImportIssue,
  type PreviewImportRow,
} from "./types"

const MAX_PREVIEW_ROWS = 500

export const defaultCrewImportRoleLabels = [
  ...defaultStaffingRoleAssumptions.map((role) => role.label),
  "Judge",
  "Head judge",
  "Volunteer",
  "Scoring",
  "Check-in",
]

export function buildCrewImportPreview({
  csvText,
  kind,
  columnMapping,
  context,
}: {
  csvText: string
  kind: CrewImportKind
  columnMapping?: ColumnMapping
  context: CrewImportPreviewContext
}): CrewImportPreview {
  const parsed = parseCsv(csvText, { maxRows: MAX_PREVIEW_ROWS })
  const inferredMapping = inferColumnMapping(parsed.headers, kind)
  const mapping = sanitizeColumnMapping(
    { ...inferredMapping, ...columnMapping },
    parsed.headers,
    kind,
  )
  const fileIssues = [
    ...parsed.fileIssues,
    ...validateRequiredMapping(kind, mapping),
  ]
  const rows =
    kind === "volunteers"
      ? buildVolunteerRows(parsed.rows, mapping, context)
      : buildHeatScheduleRows(parsed.rows, mapping, context)
  const warningCount =
    fileIssues.filter((issue) => issue.severity === "warning").length +
    rows.reduce((total, row) => total + row.warnings.length, 0)
  const errorCount =
    fileIssues.filter((issue) => issue.severity === "error").length +
    rows.reduce((total, row) => total + row.errors.length, 0)

  return {
    kind,
    parserVersion: CREW_IMPORT_PARSER_VERSION,
    headers: parsed.headers,
    columnMapping: mapping,
    rows,
    fileIssues,
    rowCount: rows.length,
    skippedRowCount: parsed.skippedRowCount,
    warningCount,
    errorCount,
  }
}

function buildVolunteerRows(
  records: ReturnType<typeof parseCsv>["rows"],
  mapping: ColumnMapping,
  context: CrewImportPreviewContext,
) {
  const knownRoles = new Set(
    context.roleLabels.map((role) => normalizeLookupValue(role)),
  )
  const knownDivisions = new Set(
    context.divisions.map((division) => normalizeLookupValue(division.label)),
  )
  const rows: PreviewImportRow[] = records.map((record) => {
    const normalized = normalizeVolunteerRow(record, mapping)
    const warnings = [
      ...record.issues.filter((issue) => issue.severity === "warning"),
      ...normalized.issues.filter((issue) => issue.severity === "warning"),
    ]
    const errors = [
      ...record.issues.filter((issue) => issue.severity === "error"),
      ...normalized.issues.filter((issue) => issue.severity === "error"),
    ]

    if (
      normalized.normalized.role &&
      knownRoles.size > 0 &&
      !knownRoles.has(normalizeLookupValue(normalized.normalized.role))
    ) {
      warnings.push({
        code: "unknown_role",
        severity: "warning",
        rowNumber: record.rowNumber,
        field: "role",
        value: normalized.normalized.role,
        message: "Role does not match the current Crew assumptions.",
      })
    }

    if (
      normalized.normalized.division &&
      knownDivisions.size > 0 &&
      !knownDivisions.has(normalizeLookupValue(normalized.normalized.division))
    ) {
      warnings.push({
        code: "unknown_division",
        severity: "warning",
        rowNumber: record.rowNumber,
        field: "division",
        value: normalized.normalized.division,
        message: "Division does not match the current event divisions.",
      })
    }

    return {
      rowNumber: record.rowNumber,
      rawRow: record.values,
      normalizedRow: normalized.normalized,
      targetType: "team_invitation",
      action: errors.length > 0 ? "error" : "create",
      warnings,
      errors,
    }
  })

  addDuplicateEmailWarnings(rows)

  return rows
}

function buildHeatScheduleRows(
  records: ReturnType<typeof parseCsv>["rows"],
  mapping: ColumnMapping,
  context: CrewImportPreviewContext,
): PreviewImportRow[] {
  const knownDivisions = new Set(
    context.divisions.map((division) => normalizeLookupValue(division.label)),
  )
  const workoutByLabel = new Map(
    context.workouts.flatMap((workout) => [
      [normalizeLookupValue(workout.label), workout],
      [normalizeLookupValue(String(workout.trackOrder)), workout],
      [normalizeLookupValue(`event ${workout.trackOrder}`), workout],
      [normalizeLookupValue(`workout ${workout.trackOrder}`), workout],
    ]),
  )
  const knownHeatsByWorkout = new Map<string, Set<number>>()
  for (const heat of context.heats) {
    const heatNumbers =
      knownHeatsByWorkout.get(heat.trackWorkoutId) ?? new Set()
    heatNumbers.add(heat.heatNumber)
    knownHeatsByWorkout.set(heat.trackWorkoutId, heatNumbers)
  }

  return records.map((record) => {
    const normalized = normalizeHeatScheduleRow(record, mapping)
    const warnings = [
      ...record.issues.filter((issue) => issue.severity === "warning"),
      ...normalized.issues.filter((issue) => issue.severity === "warning"),
    ]
    const errors = [
      ...record.issues.filter((issue) => issue.severity === "error"),
      ...normalized.issues.filter((issue) => issue.severity === "error"),
    ]
    const workout = normalized.normalized.workout
      ? workoutByLabel.get(normalizeLookupValue(normalized.normalized.workout))
      : null

    if (
      normalized.normalized.workout &&
      context.workouts.length > 0 &&
      !workout
    ) {
      warnings.push({
        code: "unknown_workout",
        severity: "warning",
        rowNumber: record.rowNumber,
        field: "workout",
        value: normalized.normalized.workout,
        message: "Workout does not match the current event workouts.",
      })
    }

    if (
      normalized.normalized.division &&
      knownDivisions.size > 0 &&
      !knownDivisions.has(normalizeLookupValue(normalized.normalized.division))
    ) {
      warnings.push({
        code: "unknown_division",
        severity: "warning",
        rowNumber: record.rowNumber,
        field: "division",
        value: normalized.normalized.division,
        message: "Division does not match the current event divisions.",
      })
    }

    if (workout && normalized.normalized.heatNumber !== null) {
      const knownHeats = knownHeatsByWorkout.get(workout.id)
      if (knownHeats && !knownHeats.has(normalized.normalized.heatNumber)) {
        warnings.push({
          code: "unknown_heat",
          severity: "warning",
          rowNumber: record.rowNumber,
          field: "heat",
          value: String(normalized.normalized.heatNumber),
          message: "Heat number does not match the current event heats.",
        })
      }
    }

    return {
      rowNumber: record.rowNumber,
      rawRow: record.values,
      normalizedRow: normalized.normalized,
      targetType: "competition_heat",
      action: errors.length > 0 ? "error" : "create",
      warnings,
      errors,
    }
  })
}

function validateRequiredMapping(
  kind: CrewImportKind,
  mapping: ColumnMapping,
): ImportIssue[] {
  return getImportFields(kind)
    .filter((field) => field.required && !mapping[field.key])
    .map((field) => ({
      code: "missing_required_mapping",
      severity: "error",
      field: field.key,
      message: `${field.label} must be mapped before preview.`,
    }))
}

function normalizeLookupValue(value: string) {
  return normalizeHeader(value)
}
