import { describe, expect, it } from "vitest"
import {
  canDisplayPhysicalVenue,
  canUseVolunteerScheduling,
  getVolunteerEffectiveTab,
} from "@/lib/competitions/venue-volunteer-gates"

describe("venue and volunteer capability gates", () => {
  it("preserves physical venue display for current competition types", () => {
    expect(canDisplayPhysicalVenue("in-person")).toBe(true)
    expect(canDisplayPhysicalVenue("online")).toBe(false)
  })

  it("preserves volunteer scheduling for current competition types", () => {
    expect(canUseVolunteerScheduling("in-person")).toBe(true)
    expect(canUseVolunteerScheduling("online")).toBe(false)
  })

  it("falls schedule tabs back to roster when volunteer scheduling is unavailable", () => {
    expect(getVolunteerEffectiveTab("in-person", "schedule")).toBe("schedule")
    expect(getVolunteerEffectiveTab("online", "schedule")).toBe("roster")
    expect(getVolunteerEffectiveTab("online", "shifts")).toBe("shifts")
  })

  it("fails closed for unknown competition types", () => {
    expect(canDisplayPhysicalVenue("benchmark")).toBe(false)
    expect(canUseVolunteerScheduling("benchmark")).toBe(false)
    expect(getVolunteerEffectiveTab("benchmark", "schedule")).toBe("roster")
  })
})
