import { describe, expect, it } from "vitest"
import {
  buildCascadedLocalTimes,
  buildSpacedHeats,
  DEFAULT_HEAT_DURATION_MINUTES,
  DEFAULT_TRANSITION_MINUTES,
} from "./heat-scheduling"

// @lat: [[crew#Bulk Heat Scheduling]]
describe("buildSpacedHeats", () => {
  it("spaces heats by duration + transition from the start time", () => {
    const start = new Date("2026-06-24T09:00:00Z")
    const heats = buildSpacedHeats({
      count: 3,
      startTime: start,
      durationMinutes: 8,
      transitionMinutes: 2,
    })

    expect(heats).toHaveLength(3)
    // slot = 8 + 2 = 10 minutes
    expect(heats[0]?.scheduledTime?.toISOString()).toBe(
      "2026-06-24T09:00:00.000Z",
    )
    expect(heats[1]?.scheduledTime?.toISOString()).toBe(
      "2026-06-24T09:10:00.000Z",
    )
    expect(heats[2]?.scheduledTime?.toISOString()).toBe(
      "2026-06-24T09:20:00.000Z",
    )
  })

  it("applies the chosen duration to every heat", () => {
    const heats = buildSpacedHeats({
      count: 2,
      startTime: new Date("2026-06-24T09:00:00Z"),
      durationMinutes: 12,
      transitionMinutes: 3,
    })

    expect(heats.every((h) => h.durationMinutes === 12)).toBe(true)
  })

  it("carries the venue id onto every heat", () => {
    const heats = buildSpacedHeats({
      count: 2,
      startTime: new Date("2026-06-24T09:00:00Z"),
      durationMinutes: 8,
      transitionMinutes: 2,
      venueId: "venue-1",
    })

    expect(heats.map((h) => h.venueId)).toEqual(["venue-1", "venue-1"])
  })

  it("creates heats without scheduled times when no start time is given", () => {
    const heats = buildSpacedHeats({
      count: 4,
      startTime: null,
      durationMinutes: 8,
      transitionMinutes: 2,
    })

    expect(heats).toHaveLength(4)
    expect(heats.every((h) => h.scheduledTime === null)).toBe(true)
  })

  it("defaults durationMinutes to null when duration is zero", () => {
    const heats = buildSpacedHeats({
      count: 1,
      startTime: new Date("2026-06-24T09:00:00Z"),
      durationMinutes: 0,
      transitionMinutes: 0,
    })

    expect(heats[0]?.durationMinutes).toBeNull()
  })

  it("returns an empty array for non-positive or non-integer counts", () => {
    const common = {
      startTime: new Date("2026-06-24T09:00:00Z"),
      durationMinutes: 8,
      transitionMinutes: 2,
    }
    expect(buildSpacedHeats({ count: 0, ...common })).toEqual([])
    expect(buildSpacedHeats({ count: -1, ...common })).toEqual([])
    expect(buildSpacedHeats({ count: 2.5, ...common })).toEqual([])
  })

  it("uses sensible defaults of 8m duration and 2m transition", () => {
    const heats = buildSpacedHeats({
      count: 2,
      startTime: new Date("2026-06-24T09:00:00Z"),
      durationMinutes: DEFAULT_HEAT_DURATION_MINUTES,
      transitionMinutes: DEFAULT_TRANSITION_MINUTES,
    })

    // 8 + 2 = 10 minutes apart
    expect(heats[1]?.scheduledTime?.toISOString()).toBe(
      "2026-06-24T09:10:00.000Z",
    )
  })
})

// @lat: [[crew#Bulk Heat Scheduling]]
describe("buildCascadedLocalTimes", () => {
  it("cascades wall-clock heat times by length + gap, preserving the wall clock", () => {
    const rows = buildCascadedLocalTimes({
      count: 3,
      startLocalValue: "2026-06-24T09:00",
      lengthMinutes: 8,
      gapMinutes: 2,
    })

    // slot = 8 + 2 = 10 minutes; values stay as naive wall-clock strings
    expect(rows).toEqual([
      { heatNumber: 1, localValue: "2026-06-24T09:00" },
      { heatNumber: 2, localValue: "2026-06-24T09:10" },
      { heatNumber: 3, localValue: "2026-06-24T09:20" },
    ])
  })

  it("numbers rows from the provided startHeatNumber", () => {
    const rows = buildCascadedLocalTimes({
      count: 2,
      startLocalValue: "2026-06-24T09:00",
      lengthMinutes: 10,
      gapMinutes: 5,
      startHeatNumber: 7,
    })

    expect(rows.map((r) => r.heatNumber)).toEqual([7, 8])
    expect(rows[1]?.localValue).toBe("2026-06-24T09:15")
  })

  it("rolls over the hour/day boundary correctly", () => {
    const rows = buildCascadedLocalTimes({
      count: 2,
      startLocalValue: "2026-06-24T23:55",
      lengthMinutes: 8,
      gapMinutes: 2,
    })

    // 23:55 + 10m → next day 00:05
    expect(rows[1]?.localValue).toBe("2026-06-25T00:05")
  })

  it("returns empty local values when no start time is given", () => {
    const rows = buildCascadedLocalTimes({
      count: 3,
      startLocalValue: "",
      lengthMinutes: 8,
      gapMinutes: 2,
    })

    expect(rows).toEqual([
      { heatNumber: 1, localValue: "" },
      { heatNumber: 2, localValue: "" },
      { heatNumber: 3, localValue: "" },
    ])
  })

  it("returns an empty array for non-positive or non-integer counts", () => {
    const common = {
      startLocalValue: "2026-06-24T09:00",
      lengthMinutes: 8,
      gapMinutes: 2,
    }
    expect(buildCascadedLocalTimes({ count: 0, ...common })).toEqual([])
    expect(buildCascadedLocalTimes({ count: -2, ...common })).toEqual([])
    expect(buildCascadedLocalTimes({ count: 1.5, ...common })).toEqual([])
  })
})
