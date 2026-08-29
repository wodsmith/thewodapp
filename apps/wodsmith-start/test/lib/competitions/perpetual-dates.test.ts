import { describe, expect, it } from "vitest"
import {
  isOpenEnded,
  perpetualSubmissionsClosed,
} from "@/lib/competitions/perpetual-dates"

describe("perpetual-dates", () => {
  // @lat: [[competition-type-capabilities#Perpetual End Date Tests#Open-Ended Sentinel Test]]
  it("treats endDate === startDate as open-ended for benchmark only", () => {
    expect(
      isOpenEnded({
        competitionType: "benchmark",
        startDate: "2026-01-01",
        endDate: "2026-01-01",
      }),
    ).toBe(true)

    expect(
      isOpenEnded({
        competitionType: "benchmark",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
      }),
    ).toBe(false)

    // Non-perpetual types are never open-ended, even single-day
    expect(
      isOpenEnded({
        competitionType: "in-person",
        startDate: "2026-01-01",
        endDate: "2026-01-01",
      }),
    ).toBe(false)
  })

  // @lat: [[competition-type-capabilities#Perpetual End Date Tests#Ended Benchmark Closes Submissions Test]]
  it("closes submissions only when a benchmark end date is set and has passed", () => {
    // Open-ended: never closes
    expect(
      perpetualSubmissionsClosed({
        competitionType: "benchmark",
        startDate: "2020-01-01",
        endDate: "2020-01-01",
      }),
    ).toBe(false)

    // End date in the past: closed
    expect(
      perpetualSubmissionsClosed({
        competitionType: "benchmark",
        startDate: "2020-01-01",
        endDate: "2020-12-31",
      }),
    ).toBe(true)

    // End date in the future: still open
    expect(
      perpetualSubmissionsClosed({
        competitionType: "benchmark",
        startDate: "2020-01-01",
        endDate: "2099-12-31",
      }),
    ).toBe(false)

    // Non-perpetual types never use this gate
    expect(
      perpetualSubmissionsClosed({
        competitionType: "online",
        startDate: "2020-01-01",
        endDate: "2020-12-31",
      }),
    ).toBe(false)
  })
})
