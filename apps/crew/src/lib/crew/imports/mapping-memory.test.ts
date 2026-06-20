// @lat: [[crew#Remember Import Mappings]]
import { describe, expect, it } from "vitest"
import {
  buildCrewImportMappingPresetWrite,
  computeImportHeaderFingerprint,
  normalizeImportMappingSourcePlatform,
  selectCrewImportMappingSuggestion,
  type CrewImportMappingPresetCandidate,
} from "./mapping-memory"

describe("Crew import mapping memory", () => {
  it("fingerprints headers deterministically after case and spacing normalization", () => {
    expect(
      computeImportHeaderFingerprint([" Email ", "First_Name", "Crew-Role"]),
    ).toBe(computeImportHeaderFingerprint(["email", "first name", "crew role"]))
    expect(computeImportHeaderFingerprint(["Email", "Role"])).not.toBe(
      computeImportHeaderFingerprint(["Role", "Email"]),
    )
  })

  it("normalizes blank source platforms to csv", () => {
    expect(normalizeImportMappingSourcePlatform(" Competition Corner ")).toBe(
      "competition corner",
    )
    expect(normalizeImportMappingSourcePlatform("")).toBe("csv")
    expect(normalizeImportMappingSourcePlatform(null)).toBe("csv")
  })

  it("selects only matching team, source, kind, and header fingerprint suggestions", () => {
    const headers = ["Email", "Full Name", "Crew Role"]
    const fingerprint = computeImportHeaderFingerprint(headers)
    const suggestion = selectCrewImportMappingSuggestion({
      teamId: "team_1",
      sourcePlatform: "Competition Corner",
      kind: "volunteers",
      headers,
      candidates: [
        candidate({
          id: "cimap_wrong_team",
          teamId: "team_2",
          sourcePlatform: "competition corner",
          kind: "volunteers",
          headerFingerprint: fingerprint,
        }),
        candidate({
          id: "cimap_wrong_source",
          sourcePlatform: "csv",
          kind: "volunteers",
          headerFingerprint: fingerprint,
        }),
        candidate({
          id: "cimap_wrong_kind",
          sourcePlatform: "competition corner",
          kind: "heat_schedule",
          headerFingerprint: fingerprint,
        }),
        candidate({
          id: "cimap_match",
          sourcePlatform: "competition corner",
          kind: "volunteers",
          headerFingerprint: fingerprint,
          lastUsedAt: "2026-06-20T12:00:00.000Z",
        }),
      ],
    })

    expect(suggestion).toMatchObject({
      presetId: "cimap_match",
      sourcePlatform: "competition corner",
      kind: "volunteers",
      matchedFieldCount: 3,
      columnMapping: {
        email: "Email",
        name: "Full Name",
        role: "Crew Role",
      },
    })
  })

  it("adapts a remembered mapping to current header casing before suggesting it", () => {
    const headers = ["email address", "full name", "ROLE"]
    const suggestion = selectCrewImportMappingSuggestion({
      teamId: "team_1",
      sourcePlatform: "csv",
      kind: "volunteers",
      headers,
      candidates: [
        candidate({
          headerFingerprint: computeImportHeaderFingerprint(headers),
          columnMapping: {
            email: "Email Address",
            name: "Full Name",
            role: "Role",
          },
        }),
      ],
    })

    expect(suggestion?.columnMapping).toEqual({
      email: "email address",
      name: "full name",
      role: "ROLE",
    })
  })

  it("builds a sanitized upsert payload for explicit operator saves", () => {
    const write = buildCrewImportMappingPresetWrite({
      teamId: "team_1",
      competitionId: "comp_1",
      sourcePlatform: "Csv Export",
      kind: "heat_schedule",
      headers: ["Workout", "Heat", "Start Time", "Ignored"],
      columnMapping: {
        workout: "Workout",
        heat: "Heat",
        scheduledTime: "Start Time",
        role: "Ignored",
      },
    })

    expect(write).toMatchObject({
      teamId: "team_1",
      competitionId: "comp_1",
      sourcePlatform: "csv export",
      kind: "heat_schedule",
      name: "Heat schedule mapping",
      columnMapping: {
        workout: "Workout",
        heat: "Heat",
        scheduledTime: "Start Time",
      },
      metadata: {
        schemaVersion: 1,
        fieldCount: 3,
        headerCount: 4,
      },
    })
  })

  it("refuses to build a save payload when no valid columns are mapped", () => {
    expect(
      buildCrewImportMappingPresetWrite({
        teamId: "team_1",
        competitionId: "comp_1",
        kind: "volunteers",
        headers: ["Email"],
        columnMapping: { heat: "Email" },
      }),
    ).toBeNull()
  })
})

function candidate(
  overrides: Partial<CrewImportMappingPresetCandidate> = {},
): CrewImportMappingPresetCandidate {
  const headers = ["Email", "Full Name", "Crew Role"]
  return {
    id: "cimap_1",
    teamId: "team_1",
    kind: "volunteers",
    sourcePlatform: "csv",
    name: "Volunteer mapping",
    headerFingerprint: computeImportHeaderFingerprint(headers),
    headers,
    columnMapping: {
      email: "Email",
      name: "Full Name",
      role: "Crew Role",
    },
    parserVersion: "crew-csv-preview-v1",
    lastUsedAt: null,
    createdAt: "2026-06-20T10:00:00.000Z",
    updatedAt: "2026-06-20T10:00:00.000Z",
    ...overrides,
  }
}
