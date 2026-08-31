import { render, screen } from "@testing-library/react"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { OrganizerCompetitionsList } from "@/components/organizer-competitions-list"
import type { CompetitionWithRelations } from "@/server-fns/competition-fns"

const originalTimeZone = process.env.TZ

describe("OrganizerCompetitionsList dates", () => {
  beforeAll(() => {
    process.env.TZ = "America/Boise"
  })

  afterAll(() => {
    if (originalTimeZone) {
      process.env.TZ = originalTimeZone
    } else {
      delete process.env.TZ
    }
  })

  // @lat: [[architecture#Tech Stack#Organizer Date Hydration]]
  it("renders competition calendar dates in UTC", () => {
    const competition = {
      id: "comp_test",
      name: "UTC Boundary Competition",
      slug: "utc-boundary-competition",
      groupId: null,
      createdAt: "2026-08-31T12:00:00.000Z",
      startDate: "2026-09-01T00:00:00.000Z",
      endDate: "2026-09-01T00:00:00.000Z",
      organizingTeam: null,
      competitionTeam: null,
      group: null,
    } as unknown as CompetitionWithRelations

    render(
      <OrganizerCompetitionsList
        competitions={[competition]}
        groups={[]}
        teamId="team_test"
      />,
    )

    expect(screen.getByText("September 1, 2026")).toBeInTheDocument()
    expect(screen.queryByText("August 31, 2026")).toBeNull()
  })
})
