import { describe, expect, it } from "vitest"
import { crewDemoEventDateRange } from "../../scripts/seed/crew-demo-event"

describe("Crew demo event dates", () => {
  // @lat: [[crew#Crew Accessibility Regressions#Demo Event Dates Use Event Timezone#Uses Event Local Date At UTC Boundary]]
  it("derives the event window from the event timezone at the UTC date boundary", () => {
    const capturedAt = new Date("2026-07-11T01:15:00.000Z")

    expect(crewDemoEventDateRange(capturedAt, "America/Denver")).toEqual({
      startDate: "2026-07-10",
      endDate: "2026-07-11",
    })
  })

  // @lat: [[crew#Crew Accessibility Regressions#Demo Event Dates Use Event Timezone#Advances One Local Calendar Day Across Fall Back]]
  it("advances to the next local calendar date across daylight-saving fall-back", () => {
    const beforeFallBack = new Date("2026-11-01T06:30:00.000Z")

    expect(crewDemoEventDateRange(beforeFallBack, "America/Denver")).toEqual({
      startDate: "2026-11-01",
      endDate: "2026-11-02",
    })
  })
})
