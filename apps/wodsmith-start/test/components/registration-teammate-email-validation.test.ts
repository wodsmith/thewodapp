import { describe, expect, it } from "vitest"
import type { ScalingLevel } from "@/db/schema"
import {
  buildTeammateEmailErrors,
  OWN_TEAMMATE_EMAIL_ERROR,
  type TeamEntry,
} from "@/components/registration/use-registration-form"

function makeTeamDivision(overrides: Partial<ScalingLevel> = {}) {
  return {
    id: "division-team",
    label: "Team RX",
    scalingGroupId: "scaling-group-1",
    teamSize: 2,
    position: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    updateCounter: 0,
    ...overrides,
  } as ScalingLevel
}

function makeTeamEntry(email: string): TeamEntry {
  return {
    divisionId: "division-team",
    teamName: "Test Team",
    teammates: [
      {
        email,
        firstName: "",
        lastName: "",
        affiliateName: "",
      },
    ],
  }
}

describe("buildTeammateEmailErrors", () => {
  it("flags teammate email when it matches the logged-in user email", () => {
    const errors = buildTeammateEmailErrors({
      userEmail: "athlete@test.com",
      selectedTeamDivisions: [makeTeamDivision()],
      teamEntries: new Map([["division-team", makeTeamEntry("athlete@test.com")]]),
    })

    expect(errors.get("division-team")?.get(0)).toBe(
      OWN_TEAMMATE_EMAIL_ERROR,
    )
  })

  it("normalizes whitespace and casing before comparing emails", () => {
    const errors = buildTeammateEmailErrors({
      userEmail: "Athlete@Test.com",
      selectedTeamDivisions: [makeTeamDivision()],
      teamEntries: new Map([
        ["division-team", makeTeamEntry("  athlete@test.COM  ")],
      ]),
    })

    expect(errors.get("division-team")?.get(0)).toBe(
      OWN_TEAMMATE_EMAIL_ERROR,
    )
  })

  it("allows different teammate emails", () => {
    const errors = buildTeammateEmailErrors({
      userEmail: "athlete@test.com",
      selectedTeamDivisions: [makeTeamDivision()],
      teamEntries: new Map([
        ["division-team", makeTeamEntry("teammate@test.com")],
      ]),
    })

    expect(errors.size).toBe(0)
  })
})
