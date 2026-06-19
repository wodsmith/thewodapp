import type {
  ColumnMapping,
  CsvRecord,
  ImportIssue,
  VolunteerImportRow,
} from "./types"

export function normalizeVolunteerRow(
  record: CsvRecord,
  mapping: ColumnMapping,
) {
  const firstName = getMappedValue(record, mapping, "firstName")
  const lastName = getMappedValue(record, mapping, "lastName")
  const name = getMappedValue(record, mapping, "name")
  const splitName = splitFullName(name)
  const normalized: VolunteerImportRow = {
    firstName: firstName || splitName.firstName,
    lastName: lastName || splitName.lastName,
    name,
    email: normalizeEmail(getMappedValue(record, mapping, "email")),
    phone: getMappedValue(record, mapping, "phone"),
    role: getMappedValue(record, mapping, "role"),
    division: getMappedValue(record, mapping, "division"),
    availability: getMappedValue(record, mapping, "availability"),
    notes: getMappedValue(record, mapping, "notes"),
  }
  const issues: ImportIssue[] = []

  if (!normalized.email) {
    issues.push({
      code: "missing_required_field",
      severity: "error",
      rowNumber: record.rowNumber,
      field: "email",
      message: "Email is required.",
    })
  } else if (!isLikelyEmail(normalized.email)) {
    issues.push({
      code: "invalid_email",
      severity: "error",
      rowNumber: record.rowNumber,
      field: "email",
      value: normalized.email,
      message: "Email does not look valid.",
    })
  }

  if (!normalized.firstName && !normalized.lastName && !normalized.name) {
    issues.push({
      code: "missing_required_field",
      severity: "error",
      rowNumber: record.rowNumber,
      field: "name",
      message: "A name, first name, or last name is required.",
    })
  }

  if (!normalized.role) {
    issues.push({
      code: "missing_role",
      severity: "warning",
      rowNumber: record.rowNumber,
      field: "role",
      message: "Role is not mapped for this volunteer.",
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

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function isLikelyEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function splitFullName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)

  if (parts.length <= 1) {
    return {
      firstName: parts[0] ?? "",
      lastName: "",
    }
  }

  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  }
}
