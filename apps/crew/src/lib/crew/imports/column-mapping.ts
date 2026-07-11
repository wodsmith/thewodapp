// @lat: [[crew#Import CSV Preview#Parser Warnings]]
import {
  isQuestionMappingKey,
  parseQuestionMappingKey,
} from "./question-mapping"
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
    key: "phoneCountryCode",
    label: "Phone country code",
    aliases: [
      "area code/country code",
      "country code",
      "area code",
      "phone country code",
      "dial code",
    ],
  },
  {
    key: "role",
    label: "Role",
    aliases: ["role", "crew role", "job", "position", "assignment"],
  },
  {
    key: "rolePreference1",
    label: "Role preference 1",
    aliases: [
      "preference 1",
      "role preference 1",
      "preference1",
      "first preference",
    ],
  },
  {
    key: "rolePreference2",
    label: "Role preference 2",
    aliases: [
      "preference 2",
      "role preference 2",
      "preference2",
      "second preference",
    ],
  },
  {
    key: "rolePreference3",
    label: "Role preference 3",
    aliases: [
      "preference 3",
      "role preference 3",
      "preference3",
      "third preference",
    ],
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
    key: "shirtSize",
    label: "Shirt size",
    aliases: ["shirt size", "t-shirt size", "tshirt size", "tee size"],
  },
  {
    key: "sourceExternalId",
    label: "External ID",
    aliases: ["id", "external id", "volunteer id"],
  },
  {
    key: "sourceCreatedAt",
    label: "Created date",
    aliases: ["create date", "created date", "created at", "signup date"],
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
    if (!allowedHeaders.has(header)) continue

    if (allowedFields.has(field)) {
      sanitized[field] = header
    } else if (
      kind === "volunteers" &&
      isQuestionMappingKey(field) &&
      parseQuestionMappingKey(field)
    ) {
      // Question-namespaced keys ("question:<id>" / "newQuestion:<label>") are
      // volunteer-only and round-trip through preview records and presets.
      sanitized[field] = header
    }
  }

  return sanitized
}

export function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ")
}
