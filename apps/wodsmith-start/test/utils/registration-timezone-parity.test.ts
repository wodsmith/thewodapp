import { afterEach, expect, it, vi } from "vitest"
import { getRegistrationWindowStatus } from "@/utils/registration-window"
import {
  hasDateStartedInTimezone,
  isDeadlinePassedInTimezone,
} from "@/utils/timezone-utils"

afterEach(() => vi.useRealTimers())
// @lat: [[checkout-safety-tests#Checkout Safety Tests#Competition timezone boundaries]]
it.each([
  ["America/Los_Angeles", "2026-03-08T07:59:59Z", false],
  ["America/Los_Angeles", "2026-03-08T08:00:00Z", true],
  ["America/Los_Angeles", "2026-03-09T06:59:59Z", true],
  ["America/Los_Angeles", "2026-03-09T07:00:00Z", false],
  ["Pacific/Auckland", "2026-03-07T10:59:59Z", false],
  ["Pacific/Auckland", "2026-03-07T11:00:00Z", true],
  ["Pacific/Auckland", "2026-03-08T10:59:59Z", true],
  ["Pacific/Auckland", "2026-03-08T11:00:00Z", false],
])("agrees with submission guards in %s at %s", (timezone, now, expected) => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(now as string))
  const day = "2026-03-08"
  const visible = getRegistrationWindowStatus({
    opensAt: day,
    closesAt: day,
    timezone: timezone as string,
  }).registrationOpen
  const accepted =
    hasDateStartedInTimezone(day, timezone as string) &&
    !isDeadlinePassedInTimezone(day, timezone as string)
  expect(visible).toBe(expected)
  expect(accepted).toBe(expected)
})

// @lat: [[checkout-safety-tests#Checkout Safety Tests#Auckland daylight-saving boundary]]
it.each<[string, boolean]>([
  ["2026-09-26T11:59:59Z", false],
  ["2026-09-26T12:00:00Z", true],
  ["2026-09-27T10:59:59Z", true],
  ["2026-09-27T11:00:00Z", false],
])(
  "agrees across Auckland's 23-hour registration day at %s",
  (now, expected) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(now))
    const day = "2026-09-27"
    const timezone = "Pacific/Auckland"
    expect(
      getRegistrationWindowStatus({ opensAt: day, closesAt: day, timezone })
        .registrationOpen,
    ).toBe(expected)
    expect(
      hasDateStartedInTimezone(day, timezone) &&
        !isDeadlinePassedInTimezone(day, timezone),
    ).toBe(expected)
  },
)
