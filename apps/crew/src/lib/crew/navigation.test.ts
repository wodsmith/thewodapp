import { describe, expect, it } from "vitest"
import { getCrewEventNavItems } from "./navigation"

describe("getCrewEventNavItems", () => {
  it("keeps the organizer workflow available from top to bottom", () => {
    const navItems = getCrewEventNavItems({ viewerRole: "organizer_admin" })

    expect(navItems.map((item) => item.key)).toEqual([
      "home",
      "setup",
      "heats",
      "staffing",
      "volunteers",
      "shifts",
      "judges",
      "confirmations",
      "event-day",
      "print-packet",
    ])
  })

  it("navigates shifts and judges via their own dedicated pages", () => {
    const navItems = getCrewEventNavItems({ viewerRole: "organizer_admin" })
    const shifts = navItems.find((item) => item.key === "shifts")
    const judges = navItems.find((item) => item.key === "judges")

    expect(shifts?.to).toBe("/events/$eventId/shifts")
    expect(judges?.to).toBe("/events/$eventId/judges")
  })
})
