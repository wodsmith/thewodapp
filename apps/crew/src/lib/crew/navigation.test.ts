import { describe, expect, it } from "vitest"
import { getCrewEventNavItems } from "./navigation"

describe("getCrewEventNavItems", () => {
  it("centers organizer assignment navigation on the consolidated route", () => {
    const navItems = getCrewEventNavItems({ viewerRole: "organizer_admin" })
    const assignments = navItems.find((item) => item.key === "assignments")

    expect(assignments?.label).toBe("Assignments")
    expect(assignments?.to).toBe("/events/$eventId/assignments")
  })
})
