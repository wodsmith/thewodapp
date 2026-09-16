// @lat: [[crew#Roster Shifts Assignments]]
import { describe, expect, it } from "vitest"
import { getCrewRosterStatus } from "./roster-shifts"

const now = new Date("2026-10-10T12:00:00Z")
const invitation = {
  source: "team_invitation" as const,
  acceptedAt: null,
  expiresAt: new Date("2026-10-01T12:00:00Z"),
  status: "pending",
}

describe("Crew organizer roster lifetime", () => {
  it.each([
    { crewImportId: "cimp_competition_corner" },
    { crewSignupSource: "manual_operator" },
  ])(
    "keeps organizer-created accountless volunteers schedulable",
    (metadata) => {
      expect(
        getCrewRosterStatus(
          { ...invitation, metadata: JSON.stringify(metadata) },
          now,
        ),
      ).toBe("pending")
    },
  )

  it.each([
    null,
    "{bad-json",
    JSON.stringify({ crewImportId: " " }),
    JSON.stringify({ inviteSource: "volunteer_signup" }),
  ])("still expires ordinary invitations", (metadata) => {
    expect(getCrewRosterStatus({ ...invitation, metadata }, now)).toBe(
      "expired",
    )
  })

  it("keeps cancellation authoritative even for previously accepted imports", () => {
    expect(
      getCrewRosterStatus(
        {
          ...invitation,
          status: "cancelled",
          acceptedAt: new Date("2026-09-05T12:00:00Z"),
          metadata: JSON.stringify({ crewImportId: "cimp_competition_corner" }),
        },
        now,
      ),
    ).toBe("inactive")
  })
})
