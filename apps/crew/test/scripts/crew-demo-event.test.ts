import { describe, expect, it } from "vitest"
import { crewDemoEventDateRange } from "../../scripts/seed/crew-demo-event"

describe("Crew demo event dates", () => {
  // @lat: [[crew#Crew Accessibility Regressions#Demo Event Dates Use Event Timezone]]
  it("derives the event window from the event timezone at the UTC date boundary", () => {
    const capturedAt = new Date("2026-07-11T01:15:00.000Z")

    expect(crewDemoEventDateRange(capturedAt, "America/Denver")).toEqual({
      startDate: "2026-07-10",
      endDate: "2026-07-11",
    })
    expect(crewDemoEventDateRange(capturedAt, "America/Denver")).toEqual(
      crewDemoEventDateRange(capturedAt, "America/Denver"),
    )
  })
})
