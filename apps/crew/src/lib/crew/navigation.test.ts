import { describe, expect, it } from "vitest"
import { getCrewEventNavItems } from "./navigation"

describe("getCrewEventNavItems", () => {
  it("keeps the organizer workflow available from top to bottom", () => {
    const navItems = getCrewEventNavItems({ viewerRole: "organizer_admin" })

    expect(navItems.map((item) => item.key)).toEqual([
      "home",
      "setup",
      "imports",
      "staffing",
      "volunteers",
      "assignments",
      "confirmations",
      "event-day",
      "print-packet",
    ])
  })

  it("centers organizer assignment navigation on the consolidated route", () => {
    const navItems = getCrewEventNavItems({ viewerRole: "organizer_admin" })
    const assignments = navItems.find((item) => item.key === "assignments")

    expect(assignments?.label).toBe("Assignments")
    expect(assignments?.to).toBe("/events/$eventId/assignments")
  })
})
