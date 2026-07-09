// @lat: [[crew#Remember Import Mappings#Built-in Presets]]
import { normalizeHeader } from "./column-mapping"
import {
  adaptImportMappingToHeaders,
  type CrewImportMappingSuggestion,
  computeImportHeaderFingerprint,
  normalizeImportMappingSourcePlatform,
} from "./mapping-memory"
import { buildNewQuestionMappingKey } from "./question-mapping"
import type { ColumnMapping, CrewImportKind } from "./types"
import { CREW_IMPORT_PARSER_VERSION } from "./types"

// Code-defined mapping presets shipped with Crew. Unlike team presets they
// never live in crew_import_mapping_presets: they are matched purely from the
// uploaded header set and surfaced as explicit "use this mapping" suggestions.
export interface BuiltInImportPreset {
  // Stable, non-DB id (prefixed so it can never collide with a preset row id).
  id: string
  kind: CrewImportKind
  // Operator-facing display name, e.g. "Competition Corner".
  name: string
  // Source label pre-filled when the operator applies the preset.
  sourcePlatform: string
  // The export's expected headers, used for tolerant coverage matching.
  headers: string[]
  columnMapping: ColumnMapping
}

// A built-in preset matches when at least this fraction of its expected
// headers appear in the upload. 0.8 tolerates a couple of renamed/removed
// columns (16 of Competition Corner's 20) while rejecting unrelated files.
export const BUILT_IN_IMPORT_PRESET_MIN_COVERAGE = 0.8

// Competition Corner volunteer export. First-class fields cover identity,
// contact, shirt size, notes, source id/date, availability, and role
// preferences; the remaining columns become new volunteer questions so no
// exported data is silently dropped.
export const competitionCornerVolunteerPreset: BuiltInImportPreset = {
  id: "builtin:competition-corner-volunteers",
  kind: "volunteers",
  name: "Competition Corner",
  sourcePlatform: "Competition Corner",
  headers: [
    "Id",
    "First Name",
    "Last Name",
    "Email",
    "Area Code/Country Code",
    "Phone",
    "Age",
    "Birth Date",
    "Gender",
    "Shirt Size",
    "Shorts Size",
    "Shoe Size",
    "Note",
    "Instagram",
    "WhatsApp",
    "Create Date",
    "Shifts",
    "Preference 1",
    "Preference 2",
    "Preference 3",
  ],
  columnMapping: {
    sourceExternalId: "Id",
    firstName: "First Name",
    lastName: "Last Name",
    email: "Email",
    phoneCountryCode: "Area Code/Country Code",
    phone: "Phone",
    shirtSize: "Shirt Size",
    notes: "Note",
    sourceCreatedAt: "Create Date",
    availability: "Shifts",
    rolePreference1: "Preference 1",
    rolePreference2: "Preference 2",
    rolePreference3: "Preference 3",
    [buildNewQuestionMappingKey("Age")]: "Age",
    [buildNewQuestionMappingKey("Birth Date")]: "Birth Date",
    [buildNewQuestionMappingKey("Gender")]: "Gender",
    [buildNewQuestionMappingKey("Shorts Size")]: "Shorts Size",
    [buildNewQuestionMappingKey("Shoe Size")]: "Shoe Size",
    [buildNewQuestionMappingKey("Instagram")]: "Instagram",
    [buildNewQuestionMappingKey("WhatsApp")]: "WhatsApp",
  },
}

export const builtInImportPresets: BuiltInImportPreset[] = [
  competitionCornerVolunteerPreset,
]

// Pick the best-matching built-in preset for an upload, or null. Matching is
// order-insensitive and tolerant: a preset qualifies when its header coverage
// clears BUILT_IN_IMPORT_PRESET_MIN_COVERAGE, so extra upload columns never
// hurt and a few missing columns are allowed. The returned mapping is adapted
// to the upload's actual header casing and sanitized, so columns absent from
// the upload drop out cleanly. isBuiltIn marks it so callers can label it and
// keep team-saved presets ahead of it.
export function selectBuiltInImportMappingSuggestion({
  kind,
  headers,
  presets = builtInImportPresets,
}: {
  kind: CrewImportKind
  headers: string[]
  presets?: BuiltInImportPreset[]
}): CrewImportMappingSuggestion | null {
  const normalizedUpload = new Set(
    headers.map((header) => normalizeHeader(header)),
  )
  let best: {
    coverage: number
    suggestion: CrewImportMappingSuggestion
  } | null = null

  for (const preset of presets) {
    if (preset.kind !== kind) continue
    if (preset.headers.length === 0) continue

    const matchedHeaderCount = preset.headers.filter((header) =>
      normalizedUpload.has(normalizeHeader(header)),
    ).length
    const coverage = matchedHeaderCount / preset.headers.length
    if (coverage < BUILT_IN_IMPORT_PRESET_MIN_COVERAGE) continue

    const columnMapping = adaptImportMappingToHeaders({
      columnMapping: preset.columnMapping,
      headers,
      kind,
    })
    if (Object.keys(columnMapping).length === 0) continue

    if (best && coverage <= best.coverage) continue

    best = {
      coverage,
      suggestion: {
        presetId: preset.id,
        name: preset.name,
        sourcePlatform: normalizeImportMappingSourcePlatform(
          preset.sourcePlatform,
        ),
        kind,
        headerFingerprint: computeImportHeaderFingerprint(headers),
        headers,
        columnMapping,
        matchedFieldCount: Object.keys(columnMapping).length,
        parserVersion: CREW_IMPORT_PARSER_VERSION,
        lastUsedAt: null,
        updatedAt: null,
        isBuiltIn: true,
      },
    }
  }

  return best?.suggestion ?? null
}
