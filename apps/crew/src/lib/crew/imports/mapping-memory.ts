// @lat: [[crew#Remember Import Mappings]]
import { normalizeHeader, sanitizeColumnMapping } from "./column-mapping"
import { CREW_IMPORT_PARSER_VERSION } from "./types"
import type { ColumnMapping, CrewImportKind } from "./types"

export interface CrewImportMappingPresetCandidate {
  id: string
  teamId: string
  kind: CrewImportKind
  sourcePlatform: string | null
  name: string | null
  headerFingerprint: string
  headers: string[]
  columnMapping: ColumnMapping
  parserVersion: string | null
  lastUsedAt: Date | string | null
  createdAt: Date | string | null
  updatedAt: Date | string | null
}

export interface CrewImportMappingSuggestion {
  presetId: string
  name: string | null
  sourcePlatform: string
  kind: CrewImportKind
  headerFingerprint: string
  headers: string[]
  columnMapping: ColumnMapping
  matchedFieldCount: number
  parserVersion: string | null
  lastUsedAt: Date | string | null
  updatedAt: Date | string | null
}

export interface CrewImportMappingPresetWrite {
  teamId: string
  competitionId: string
  kind: CrewImportKind
  sourcePlatform: string
  name: string
  headerFingerprint: string
  headers: string[]
  columnMapping: ColumnMapping
  parserVersion: string
  metadata: {
    schemaVersion: 1
    fieldCount: number
    headerCount: number
  }
}

export function computeImportHeaderFingerprint(headers: string[]) {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header))
  const payload = JSON.stringify(normalizedHeaders)
  return `v1_${fnv1aHex(payload)}_${normalizedHeaders.length}`
}

export function normalizeImportMappingSourcePlatform(
  sourcePlatform?: string | null,
) {
  const normalized = normalizeHeader(sourcePlatform ?? "")
  return normalized ? normalized.slice(0, 100) : "csv"
}

export function adaptImportMappingToHeaders({
  columnMapping,
  headers,
  kind,
}: {
  columnMapping: ColumnMapping
  headers: string[]
  kind: CrewImportKind
}) {
  const headerByNormalized = new Map(
    headers.map((header) => [normalizeHeader(header), header]),
  )
  const adapted: ColumnMapping = {}

  for (const [field, header] of Object.entries(columnMapping)) {
    const currentHeader = headerByNormalized.get(normalizeHeader(header))
    if (currentHeader) {
      adapted[field] = currentHeader
    }
  }

  return sanitizeColumnMapping(adapted, headers, kind)
}

export function selectCrewImportMappingSuggestion({
  teamId,
  sourcePlatform,
  kind,
  headers,
  candidates,
}: {
  teamId: string
  sourcePlatform?: string | null
  kind: CrewImportKind
  headers: string[]
  candidates: CrewImportMappingPresetCandidate[]
}): CrewImportMappingSuggestion | null {
  const normalizedSourcePlatform =
    normalizeImportMappingSourcePlatform(sourcePlatform)
  const headerFingerprint = computeImportHeaderFingerprint(headers)
  const suggestions = candidates
    .filter(
      (candidate) =>
        candidate.teamId === teamId &&
        candidate.kind === kind &&
        normalizeImportMappingSourcePlatform(candidate.sourcePlatform) ===
          normalizedSourcePlatform &&
        candidate.headerFingerprint === headerFingerprint,
    )
    .map((candidate) => {
      const columnMapping = adaptImportMappingToHeaders({
        columnMapping: candidate.columnMapping,
        headers,
        kind,
      })
      return {
        presetId: candidate.id,
        name: candidate.name,
        sourcePlatform: normalizedSourcePlatform,
        kind,
        headerFingerprint,
        headers,
        columnMapping,
        matchedFieldCount: Object.keys(columnMapping).length,
        parserVersion: candidate.parserVersion,
        lastUsedAt: candidate.lastUsedAt,
        updatedAt: candidate.updatedAt,
      } satisfies CrewImportMappingSuggestion
    })
    .filter((suggestion) => suggestion.matchedFieldCount > 0)

  suggestions.sort((left, right) => compareSuggestionDates(right, left))
  return suggestions[0] ?? null
}

export function buildCrewImportMappingPresetWrite({
  teamId,
  competitionId,
  sourcePlatform,
  kind,
  headers,
  columnMapping,
}: {
  teamId: string
  competitionId: string
  sourcePlatform?: string | null
  kind: CrewImportKind
  headers: string[]
  columnMapping: ColumnMapping
}): CrewImportMappingPresetWrite | null {
  const sanitizedMapping = adaptImportMappingToHeaders({
    columnMapping,
    headers,
    kind,
  })
  const fieldCount = Object.keys(sanitizedMapping).length
  if (fieldCount === 0 || headers.length === 0) return null

  const normalizedSourcePlatform =
    normalizeImportMappingSourcePlatform(sourcePlatform)

  return {
    teamId,
    competitionId,
    kind,
    sourcePlatform: normalizedSourcePlatform,
    name: `${formatImportKind(kind)} mapping`,
    headerFingerprint: computeImportHeaderFingerprint(headers),
    headers: headers.map((header) => header.trim()),
    columnMapping: sanitizedMapping,
    parserVersion: CREW_IMPORT_PARSER_VERSION,
    metadata: {
      schemaVersion: 1,
      fieldCount,
      headerCount: headers.length,
    },
  }
}

function compareSuggestionDates(
  left: CrewImportMappingSuggestion,
  right: CrewImportMappingSuggestion,
) {
  return (
    toDateTime(left.lastUsedAt) - toDateTime(right.lastUsedAt) ||
    toDateTime(left.updatedAt) - toDateTime(right.updatedAt)
  )
}

function toDateTime(value: Date | string | null) {
  if (!value) return 0
  const date = value instanceof Date ? value : new Date(value)
  const time = date.getTime()
  return Number.isFinite(time) ? time : 0
}

function formatImportKind(kind: CrewImportKind) {
  switch (kind) {
    case "heat_schedule":
      return "Heat schedule"
    case "volunteers":
      return "Volunteer"
    default:
      return assertNever(kind)
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported Crew import kind: ${value}`)
}

function fnv1aHex(value: string) {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, "0")
}
