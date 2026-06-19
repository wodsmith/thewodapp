import { describe, expect, it } from "vitest"
import { getCohostSidebarNavigation } from "@/components/cohost-sidebar"
import { getCompetitionSidebarNavigation } from "@/components/competition-sidebar"
import type { CohostMembershipMetadata } from "@/db/schemas/cohost"

function labelsFor(nav: ReturnType<typeof getCompetitionSidebarNavigation>) {
  return nav.groups.flatMap((group) => group.items.map((item) => item.label))
}

const FULL_PERMISSIONS = {
  divisions: true,
  editEvents: true,
  locations: true,
  scoringConfig: true,
  viewRegistrations: true,
  waivers: true,
  schedule: true,
  volunteers: true,
  results: true,
  leaderboardPreview: true,
  pricing: true,
  revenue: true,
  coupons: true,
  sponsors: true,
} as CohostMembershipMetadata

describe("competition sidebar capability gates", () => {
  // @lat: [[competition-type-capabilities#Results Entry and Sidebar Gates Test]]
  it("labels and gates organizer navigation by competition capabilities", () => {
    const inPersonLabels = labelsFor(
      getCompetitionSidebarNavigation("/compete/organizer/comp_1", "in-person"),
    )
    const onlineLabels = labelsFor(
      getCompetitionSidebarNavigation("/compete/organizer/comp_1", "online"),
    )

    expect(inPersonLabels).toContain("Results")
    expect(inPersonLabels).toEqual(
      expect.arrayContaining([
        "Locations",
        "Schedule",
        "Check-in",
        "Volunteers",
      ]),
    )
    expect(inPersonLabels).not.toContain("Submission windows")
    expect(inPersonLabels).not.toContain("Submissions")

    expect(onlineLabels).toContain("Submissions")
    expect(onlineLabels).toContain("Submission windows")
    expect(onlineLabels).not.toEqual(expect.arrayContaining(["Locations"]))
    expect(onlineLabels).not.toEqual(expect.arrayContaining(["Schedule"]))
    expect(onlineLabels).not.toEqual(expect.arrayContaining(["Check-in"]))
    expect(onlineLabels).toContain("Volunteers")
    expect(onlineLabels).not.toContain("Results")
  })

  it("labels and gates cohost navigation by both permissions and capabilities", () => {
    const inPersonLabels = labelsFor(
      getCohostSidebarNavigation(
        "/compete/cohost/comp_1",
        "in-person",
        FULL_PERMISSIONS,
      ),
    )
    const onlineLabels = labelsFor(
      getCohostSidebarNavigation(
        "/compete/cohost/comp_1",
        "online",
        FULL_PERMISSIONS,
      ),
    )

    expect(inPersonLabels).toContain("Results")
    expect(inPersonLabels).toEqual(
      expect.arrayContaining(["Locations", "Schedule", "Volunteers"]),
    )
    expect(inPersonLabels).not.toContain("Submission windows")

    expect(onlineLabels).toContain("Submissions")
    expect(onlineLabels).toContain("Submission windows")
    expect(onlineLabels).not.toEqual(expect.arrayContaining(["Locations"]))
    expect(onlineLabels).not.toEqual(expect.arrayContaining(["Schedule"]))
    expect(onlineLabels).toContain("Volunteers")
    expect(onlineLabels).not.toContain("Results")
  })

  it("keeps cohost volunteers hidden when the cohost lacks volunteers permission", () => {
    const labels = labelsFor(
      getCohostSidebarNavigation("/compete/cohost/comp_1", "online", {
        ...FULL_PERMISSIONS,
        volunteers: false,
      }),
    )

    expect(labels).not.toContain("Volunteers")
  })

  it("keeps cohost results hidden when the cohost lacks results permission", () => {
    const labels = labelsFor(
      getCohostSidebarNavigation("/compete/cohost/comp_1", "online", {
        ...FULL_PERMISSIONS,
        results: false,
      }),
    )

    expect(labels).not.toContain("Submissions")
    expect(labels).not.toContain("Results")
  })
})
