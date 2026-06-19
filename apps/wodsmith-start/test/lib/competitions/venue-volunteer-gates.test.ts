import { describe, expect, it } from "vitest"
import {
  canDisplayPhysicalVenue,
  canUseVolunteerScheduling,
  getVolunteerEffectiveTab,
} from "@/lib/competitions/venue-volunteer-gates"

describe("venue and volunteer capability gates", () => {
  // @lat: [[competition-type-capabilities#Venue and Volunteer Gates Test#Physical Venue Display]]
  it("preserves physical venue display for current competition types", () => {
    expect(canDisplayPhysicalVenue("in-person")).toBe(true)
    expect(canDisplayPhysicalVenue("online")).toBe(false)
  })

  // @lat: [[competition-type-capabilities#Venue and Volunteer Gates Test#Volunteer Scheduling Availability]]
  it("preserves volunteer scheduling for current competition types", () => {
    expect(canUseVolunteerScheduling("in-person")).toBe(true)
    expect(canUseVolunteerScheduling("online")).toBe(false)
  })

  // @lat: [[competition-type-capabilities#Venue and Volunteer Gates Test#Volunteer Schedule Tab Fallback]]
  it("falls schedule tabs back to roster when volunteer scheduling is unavailable", () => {
    expect(getVolunteerEffectiveTab("in-person", "schedule")).toBe("schedule")
    expect(getVolunteerEffectiveTab("online", "schedule")).toBe("roster")
    expect(getVolunteerEffectiveTab("online", "shifts")).toBe("shifts")
  })

  // @lat: [[competition-type-capabilities#Venue and Volunteer Gates Test#Unknown Type Venue Volunteer Fallback]]
  it("fails closed for unknown competition types", () => {
    expect(canDisplayPhysicalVenue("benchmark")).toBe(false)
    expect(canUseVolunteerScheduling("benchmark")).toBe(false)
    expect(getVolunteerEffectiveTab("benchmark", "schedule")).toBe("roster")
  })
})
