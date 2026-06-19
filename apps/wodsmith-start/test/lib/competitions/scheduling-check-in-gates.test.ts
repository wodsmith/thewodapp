import { describe, expect, it } from "vitest"
import {
  canRunDayOfCheckIn,
  canUseDayOfCheckIn,
  canUseHeatScheduling,
  getPublicScheduleMode,
} from "@/lib/competitions/scheduling-check-in-gates"

describe("scheduling and check-in capability gates", () => {
  // @lat: [[competition-type-capabilities#Scheduling and Check-In Gates Test#Public Schedule Mode]]
  it("routes public schedule data by capability for current competition types", () => {
    expect(getPublicScheduleMode("in-person")).toBe("heats")
    expect(getPublicScheduleMode("online")).toBe("submissionWindows")
  })

  // @lat: [[competition-type-capabilities#Scheduling and Check-In Gates Test#Heat Scheduling Gate]]
  it("gates heat scheduling to in-person competitions", () => {
    expect(canUseHeatScheduling("in-person")).toBe(true)
    expect(canUseHeatScheduling("online")).toBe(false)
  })

  // @lat: [[competition-type-capabilities#Scheduling and Check-In Gates Test#Day-Of Check-In Gate]]
  it("gates day-of check-in to in-person competitions", () => {
    expect(canUseDayOfCheckIn("in-person")).toBe(true)
    expect(canUseDayOfCheckIn("online")).toBe(false)
  })

  // @lat: [[competition-type-capabilities#Scheduling and Check-In Gates Test#Check-In Permission Gate]]
  it("also requires organizer or volunteer access before surfacing check-in", () => {
    expect(canRunDayOfCheckIn("in-person", true)).toBe(true)
    expect(canRunDayOfCheckIn("in-person", false)).toBe(false)
    expect(canRunDayOfCheckIn("online", true)).toBe(false)
  })

  // @lat: [[competition-type-capabilities#Scheduling and Check-In Gates Test#Unknown Type Scheduling Fallback]]
  it("falls back closed for unknown competition types", () => {
    expect(getPublicScheduleMode("benchmark")).toBe("unavailable")
    expect(canUseHeatScheduling("benchmark")).toBe(false)
    expect(canUseDayOfCheckIn("benchmark")).toBe(false)
    expect(canRunDayOfCheckIn("benchmark", true)).toBe(false)
  })
})
