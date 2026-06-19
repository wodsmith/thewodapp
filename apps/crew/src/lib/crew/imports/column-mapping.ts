import type {
  ColumnMapping,
  CrewImportKind,
  ImportFieldDefinition,
} from "./types"

export const volunteerImportFields: ImportFieldDefinition[] = [
  {
    key: "email",
    label: "Email",
    required: true,
    aliases: ["email", "email address", "volunteer email", "e-mail"],
  },
  {
    key: "firstName",
    label: "First name",
    aliases: ["first name", "firstname", "given name"],
  },
  {
    key: "lastName",
    label: "Last name",
    aliases: ["last name", "lastname", "surname", "family name"],
  },
  {
    key: "name",
    label: "Name",
    aliases: ["name", "full name", "volunteer", "volunteer name"],
  },
  {
    key: "phone",
    label: "Phone",
    aliases: ["phone", "phone number", "mobile", "cell"],
  },
  {
    key: "role",
    label: "Role",
    aliases: ["role", "crew role", "job", "position", "assignment"],
  },
  {
    key: "division",
    label: "Division",
    aliases: ["division", "division name", "category", "level"],
  },
  {
    key: "availability",
    label: "Availability",
    aliases: ["availability", "available", "shift", "shifts"],
  },
  {
    key: "notes",
    label: "Notes",
    aliases: ["notes", "note", "comments", "comment"],
  },
]

export const heatScheduleImportFields: ImportFieldDefinition[] = [
  {
    key: "workout",
    label: "Workout",
    required: true,
    aliases: ["workout", "event", "workout name", "event name"],
  },
  {
    key: "heat",
    label: "Heat",
    required: true,
    aliases: ["heat", "heat number", "heat #", "heat no", "heat name"],
  },
  {
    key: "division",
    label: "Division",
    aliases: ["division", "division name", "category", "level"],
  },
  {
    key: "scheduledTime",
    label: "Scheduled time",
    aliases: ["scheduled time", "start time", "time", "heat time"],
  },
  {
    key: "durationMinutes",
    label: "Duration minutes",
    aliases: ["duration", "duration minutes", "minutes", "time cap"],
  },
  {
    key: "venue",
    label: "Venue",
    aliases: ["venue", "floor", "area", "location"],
  },
  {
    key: "laneCount",
    label: "Lane count",
    aliases: ["lanes", "lane count", "lane_count"],
  },
  {
    key: "notes",
    label: "Notes",
    aliases: ["notes", "note", "comments", "comment"],
  },
]

export function getImportFields(kind: CrewImportKind) {
  return kind === "volunteers"
    ? volunteerImportFields
    : heatScheduleImportFields
}

export function inferColumnMapping(
  headers: string[],
  kind: CrewImportKind,
): ColumnMapping {
  const normalizedHeaders = new Map(
    headers.map((header) => [normalizeHeader(header), header]),
  )
  const mapping: ColumnMapping = {}

  for (const field of getImportFields(kind)) {
    for (const alias of field.aliases) {
      const header = normalizedHeaders.get(normalizeHeader(alias))
      if (header) {
        mapping[field.key] = header
        break
      }
    }
  }

  return mapping
}

export function sanitizeColumnMapping(
  mapping: ColumnMapping,
  headers: string[],
  kind: CrewImportKind,
): ColumnMapping {
  const allowedFields = new Set(getImportFields(kind).map((field) => field.key))
  const allowedHeaders = new Set(headers)
  const sanitized: ColumnMapping = {}

  for (const [field, header] of Object.entries(mapping)) {
    if (allowedFields.has(field) && allowedHeaders.has(header)) {
      sanitized[field] = header
    }
  }

  return sanitized
}

export function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ")
}
