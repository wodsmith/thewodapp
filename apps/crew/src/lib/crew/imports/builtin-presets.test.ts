// @lat: [[crew#Remember Import Mappings#Built-in Presets]]
import { describe, expect, it } from "vitest"
import {
  builtInImportPresets,
  competitionCornerVolunteerPreset,
  selectBuiltInImportMappingSuggestion,
} from "./builtin-presets"
import {
  computeImportHeaderFingerprint,
  selectCrewImportMappingSuggestion,
} from "./mapping-memory"
import {
  buildNewQuestionMappingKey,
  isQuestionMappingKey,
} from "./question-mapping"

const COMPETITION_CORNER_HEADERS = [
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
]

describe("Built-in import presets", () => {
  it("maps all 20 Competition Corner columns, including newQuestion keys", () => {
    const suggestion = selectBuiltInImportMappingSuggestion({
      kind: "volunteers",
      headers: COMPETITION_CORNER_HEADERS,
    })

    expect(suggestion).not.toBeNull()
    expect(suggestion?.isBuiltIn).toBe(true)
    expect(suggestion?.name).toBe("Competition Corner")
    expect(suggestion?.matchedFieldCount).toBe(20)
    expect(suggestion?.columnMapping).toMatchObject({
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
    })
  })

  it("keeps question-namespaced keys valid after sanitization", () => {
    const suggestion = selectBuiltInImportMappingSuggestion({
      kind: "volunteers",
      headers: COMPETITION_CORNER_HEADERS,
    })
    const questionKeys = Object.keys(suggestion?.columnMapping ?? {}).filter(
      (key) => isQuestionMappingKey(key),
    )

    expect(questionKeys).toHaveLength(7)
    expect(questionKeys).toContain(buildNewQuestionMappingKey("Age"))
  })

  it("matches despite extra upload columns and adapts to their casing", () => {
    const headers = [
      "id",
      "FIRST NAME",
      "Last Name",
      "email",
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
      "Registered By", // extra, unmapped column
    ]
    const suggestion = selectBuiltInImportMappingSuggestion({
      kind: "volunteers",
      headers,
    })

    expect(suggestion?.matchedFieldCount).toBe(20)
    // Adapts to the upload's actual header casing.
    expect(suggestion?.columnMapping.sourceExternalId).toBe("id")
    expect(suggestion?.columnMapping.firstName).toBe("FIRST NAME")
    expect(suggestion?.columnMapping.email).toBe("email")
  })

  it("still matches when a few columns are missing, dropping their mappings", () => {
    // Drop 3 of 20 columns → 85% coverage, above the 0.8 threshold.
    const headers = COMPETITION_CORNER_HEADERS.filter(
      (header) =>
        header !== "Instagram" &&
        header !== "WhatsApp" &&
        header !== "Shoe Size",
    )
    const suggestion = selectBuiltInImportMappingSuggestion({
      kind: "volunteers",
      headers,
    })

    expect(suggestion).not.toBeNull()
    expect(suggestion?.matchedFieldCount).toBe(17)
    expect(
      suggestion?.columnMapping[buildNewQuestionMappingKey("Instagram")],
    ).toBeUndefined()
    expect(suggestion?.columnMapping.email).toBe("Email")
  })

  it("does not match when too many columns are missing", () => {
    // Only 6 of 20 headers present → 30% coverage, below threshold.
    const headers = [
      "Id",
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Shifts",
    ]
    expect(
      selectBuiltInImportMappingSuggestion({ kind: "volunteers", headers }),
    ).toBeNull()
  })

  it("does not match an unrelated file", () => {
    expect(
      selectBuiltInImportMappingSuggestion({
        kind: "volunteers",
        headers: ["Workout", "Heat", "Division", "Start Time", "Lanes"],
      }),
    ).toBeNull()
  })

  it("does not offer the volunteer preset for a heat schedule import", () => {
    expect(
      selectBuiltInImportMappingSuggestion({
        kind: "heat_schedule",
        headers: COMPETITION_CORNER_HEADERS,
      }),
    ).toBeNull()
  })

  it("coexists with a team preset so the operator can pick either (team takes precedence)", () => {
    // The server returns team `suggestion` and `builtInSuggestion` side by
    // side; the UI renders the team preset first. Both resolve for the same
    // upload here, and a saved team tweak (Note → notes dropped) stays distinct
    // from the built-in mapping.
    const teamSuggestion = selectCrewImportMappingSuggestion({
      teamId: "team_1",
      sourcePlatform: "Competition Corner",
      kind: "volunteers",
      headers: COMPETITION_CORNER_HEADERS,
      candidates: [
        {
          id: "cimap_team",
          teamId: "team_1",
          kind: "volunteers",
          sourcePlatform: "competition corner",
          name: "Our Competition Corner tweak",
          headerFingerprint: computeImportHeaderFingerprint(
            COMPETITION_CORNER_HEADERS,
          ),
          headers: COMPETITION_CORNER_HEADERS,
          columnMapping: { email: "Email", firstName: "First Name" },
          parserVersion: "crew-tabular-preview-v2",
          lastUsedAt: "2026-06-20T12:00:00.000Z",
          createdAt: "2026-06-20T10:00:00.000Z",
          updatedAt: "2026-06-20T10:00:00.000Z",
        },
      ],
    })
    const builtInSuggestion = selectBuiltInImportMappingSuggestion({
      kind: "volunteers",
      headers: COMPETITION_CORNER_HEADERS,
    })

    expect(teamSuggestion?.presetId).toBe("cimap_team")
    expect(teamSuggestion?.isBuiltIn).toBeUndefined()
    expect(teamSuggestion?.matchedFieldCount).toBe(2)
    expect(builtInSuggestion?.presetId).toBe(
      "builtin:competition-corner-volunteers",
    )
    expect(builtInSuggestion?.isBuiltIn).toBe(true)
    expect(builtInSuggestion?.matchedFieldCount).toBe(20)
  })

  it("exposes the Competition Corner preset in the built-in registry", () => {
    expect(builtInImportPresets).toContain(competitionCornerVolunteerPreset)
    expect(competitionCornerVolunteerPreset.headers).toHaveLength(20)
    expect(
      Object.keys(competitionCornerVolunteerPreset.columnMapping),
    ).toHaveLength(20)
  })
})
