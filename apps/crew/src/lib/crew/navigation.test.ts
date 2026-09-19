import { describe, expect, it } from "vitest"
import { getCrewOrganizerEventSidebarNavigation } from "@/components/crew-event-sidebar"
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
      "billing",
      "exports",
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

  it("places paid exports between event access and schedule", () => {
    const navItems = getCrewEventNavItems({ viewerRole: "organizer_admin" })
    const paidNavigation = navItems.slice(-3)

    expect(
      paidNavigation.map(({ key, label, to }) => ({ key, label, to })),
    ).toEqual([
      {
        key: "billing",
        label: "Event Access",
        to: "/events/$eventId/billing",
      },
      {
        key: "exports",
        label: "Exports",
        to: "/events/$eventId/exports",
      },
      {
        key: "print-packet",
        label: "Schedule",
        to: "/events/$eventId/schedule",
      },
    ])

    const sidebar = getCrewOrganizerEventSidebarNavigation({
      eventId: "event-1",
      navItems,
    })

    expect(
      sidebar.groups
        .at(-1)
        ?.items.slice(-3)
        .map((item) => item.key),
    ).toEqual(["billing", "exports", "print-packet"])
  })
})
