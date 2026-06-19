// @lat: [[crew#Import CSV Preview#Parser Warnings]]
import type {
  ColumnMapping,
  CsvRecord,
  HeatScheduleImportRow,
  ImportIssue,
} from "./types"

// Keep sign and decimal boundaries symmetrical so signed labels never parse.
const positiveIntegerTokenPattern =
  /(?:^|[^A-Za-z0-9+\-.])([1-9]\d*)(?=$|[^A-Za-z0-9+\-.])/

export function normalizeHeatScheduleRow(
  record: CsvRecord,
  mapping: ColumnMapping,
) {
  const heatLabel = getMappedValue(record, mapping, "heat")
  const normalized: HeatScheduleImportRow = {
    workout: getMappedValue(record, mapping, "workout"),
    heatNumber: parsePositiveInteger(heatLabel),
    heatLabel,
    division: getMappedValue(record, mapping, "division"),
    scheduledTime: getMappedValue(record, mapping, "scheduledTime"),
    durationMinutes: parseOptionalPositiveInteger(
      getMappedValue(record, mapping, "durationMinutes"),
    ),
    venue: getMappedValue(record, mapping, "venue"),
    laneCount: parseOptionalPositiveInteger(
      getMappedValue(record, mapping, "laneCount"),
    ),
    notes: getMappedValue(record, mapping, "notes"),
  }
  const issues: ImportIssue[] = []

  if (!normalized.workout) {
    issues.push({
      code: "missing_required_field",
      severity: "error",
      rowNumber: record.rowNumber,
      field: "workout",
      message: "Workout is required.",
    })
  }

  if (!heatLabel) {
    issues.push({
      code: "missing_required_field",
      severity: "error",
      rowNumber: record.rowNumber,
      field: "heat",
      message: "Heat is required.",
    })
  } else if (normalized.heatNumber === null) {
    issues.push({
      code: "invalid_heat_number",
      severity: "error",
      rowNumber: record.rowNumber,
      field: "heat",
      value: heatLabel,
      message: "Heat must contain a positive number.",
    })
  }

  if (!normalized.scheduledTime) {
    issues.push({
      code: "missing_scheduled_time",
      severity: "warning",
      rowNumber: record.rowNumber,
      field: "scheduledTime",
      message: "Scheduled time is not mapped for this heat.",
    })
  }

  return { normalized, issues }
}

function getMappedValue(
  record: CsvRecord,
  mapping: ColumnMapping,
  field: string,
) {
  const header = mapping[field]
  return header ? (record.values[header] ?? "").trim() : ""
}

function parsePositiveInteger(value: string) {
  const match = value.trim().match(positiveIntegerTokenPattern)
  if (!match) return null

  const parsed = Number(match[1])
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function parseOptionalPositiveInteger(value: string) {
  if (!value.trim()) return null

  return parsePositiveInteger(value)
}
