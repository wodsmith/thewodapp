import { describe, expect, it } from "vitest"
import { getCohostResultsRouteMode } from "@/routes/compete/cohost/$competitionId/results"
import { getOrganizerResultsRouteMode } from "@/routes/compete/organizer/$competitionId/results"

describe("results route capability branching", () => {
  // @lat: [[competition-type-capabilities#Results Entry and Sidebar Gates Test#Organizer Results Route Mode]]
  it("routes organizer results pages by organizer-entered-results capability", () => {
    expect(getOrganizerResultsRouteMode("in-person")).toBe("organizer-entered")
    expect(getOrganizerResultsRouteMode("online")).toBe("athlete-submitted")
  })

  // @lat: [[competition-type-capabilities#Results Entry and Sidebar Gates Test#Cohost Results Route Mode]]
  it("routes cohost results pages by organizer-entered-results capability", () => {
    expect(getCohostResultsRouteMode("in-person")).toBe("organizer-entered")
    expect(getCohostResultsRouteMode("online")).toBe("athlete-submitted")
  })
})
