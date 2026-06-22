import { afterEach, describe, expect, it, vi } from "vitest"
import { getRegistrationWindowStatus } from "@/utils/registration-window"

describe("getRegistrationWindowStatus", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("opens registration after the open date without requiring a close date", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-21T18:00:00Z"))

    expect(
      getRegistrationWindowStatus({
        opensAt: "2026-01-01",
        closesAt: null,
        timezone: "America/Denver",
      }),
    ).toEqual({
      registrationOpen: true,
      registrationClosed: false,
      registrationNotYetOpen: false,
    })
  })

  it("keeps future opens-only registration not yet open", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-12-31T18:00:00Z"))

    expect(
      getRegistrationWindowStatus({
        opensAt: "2026-01-01",
        closesAt: null,
        timezone: "America/Denver",
      }),
    ).toEqual({
      registrationOpen: false,
      registrationClosed: false,
      registrationNotYetOpen: true,
    })
  })
})
