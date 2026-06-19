import { describe, expect, it } from "vitest"
import {
  estimateCrewStaffing,
  formatStaffingDuration,
  type StaffingCalculatorInputs,
} from "@/lib/crew-staffing-calculator"

function baseInputs(
  overrides: Partial<StaffingCalculatorInputs> = {},
): StaffingCalculatorInputs {
  return {
    lanes: 8,
    floors: 1,
    heats: 20,
    heatDurationMinutes: 12,
    shiftLengthHours: 4,
    roleAssumptions: [
      {
        id: "lane-judges",
        label: "Lane judges",
        group: "judge",
        basis: "lanePerFloor",
        peoplePerUnit: 1,
      },
      {
        id: "floor-leads",
        label: "Floor leads",
        group: "judge",
        basis: "floor",
        peoplePerUnit: 1,
      },
      {
        id: "athlete-control",
        label: "Athlete control",
        group: "volunteer",
        basis: "event",
        peoplePerUnit: 2,
      },
    ],
    ...overrides,
  }
}

describe("estimateCrewStaffing", () => {
  it("scales lane judge assumptions by floors and lanes", () => {
    const estimate = estimateCrewStaffing(
      baseInputs({ lanes: 10, floors: 2 }),
    )

    const laneJudges = estimate.roleEstimates.find(
      (role) => role.id === "lane-judges",
    )

    expect(laneJudges?.concurrentPeople).toBe(20)
    expect(estimate.judgeConcurrentPeople).toBe(22)
  })

  it("converts heat time into shift slots for coverage", () => {
    const estimate = estimateCrewStaffing(
      baseInputs({ heats: 40, heatDurationMinutes: 12, shiftLengthHours: 4 }),
    )

    const laneJudges = estimate.roleEstimates.find(
      (role) => role.id === "lane-judges",
    )

    expect(estimate.eventMinutes).toBe(480)
    expect(laneJudges?.personMinutes).toBe(3840)
    expect(laneJudges?.shiftSlots).toBe(16)
  })

  it("keeps judge and volunteer estimates separated", () => {
    const estimate = estimateCrewStaffing(baseInputs())

    expect(estimate.judgeConcurrentPeople).toBe(9)
    expect(estimate.volunteerConcurrentPeople).toBe(2)
    expect(estimate.totalConcurrentPeople).toBe(11)
    expect(estimate.totalShiftSlots).toBe(
      estimate.judgeShiftSlots + estimate.volunteerShiftSlots,
    )
  })

  it("normalizes invalid minimums without producing zero coverage", () => {
    const estimate = estimateCrewStaffing(
      baseInputs({
        lanes: 0,
        floors: Number.NaN,
        heats: -4,
        heatDurationMinutes: 0,
        shiftLengthHours: 0,
      }),
    )

    expect(estimate.eventMinutes).toBe(1)
    expect(estimate.shiftLengthMinutes).toBe(15)
    expect(estimate.totalConcurrentPeople).toBeGreaterThan(0)
  })
})

describe("formatStaffingDuration", () => {
  it("formats full hours and mixed durations", () => {
    expect(formatStaffingDuration(45)).toBe("45m")
    expect(formatStaffingDuration(120)).toBe("2h")
    expect(formatStaffingDuration(135)).toBe("2h 15m")
  })
})
