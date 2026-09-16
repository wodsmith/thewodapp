// @lat: [[crew#Import Apply]]
import { describe, expect, it } from "vitest"
import { getCrewImportInvitationExpiry } from "./invitation-expiry"

describe("Crew import invitation lifetime", () => {
  it("covers the final event day when importing more than 30 days ahead", () => {
    expect(
      getCrewImportInvitationExpiry({
        now: new Date("2026-09-01T12:00:00Z"),
        endDate: "2026-10-11",
        timezone: "America/Boise",
      }).toISOString(),
    ).toBe("2026-10-12T06:00:00.000Z")
  })

  it("uses the event timezone across the end of daylight saving time", () => {
    expect(
      getCrewImportInvitationExpiry({
        now: new Date("2026-09-01T12:00:00Z"),
        endDate: "2026-11-01",
        timezone: "America/Boise",
      }).toISOString(),
    ).toBe("2026-11-02T07:00:00.000Z")
  })

  it("preserves the minimum invitation window for late imports and reimports", () => {
    expect(
      getCrewImportInvitationExpiry({
        now: new Date("2026-10-10T12:00:00Z"),
        endDate: "2026-10-11",
        timezone: "America/Boise",
      }).toISOString(),
    ).toBe("2026-11-09T12:00:00.000Z")
  })

  it("rejects invalid event dates instead of silently restoring the 30-day cutoff", () => {
    expect(() =>
      getCrewImportInvitationExpiry({
        now: new Date("2026-09-01T12:00:00Z"),
        endDate: "2026-02-30",
        timezone: "America/Boise",
      }),
    ).toThrow("valid event end date")
  })
})
