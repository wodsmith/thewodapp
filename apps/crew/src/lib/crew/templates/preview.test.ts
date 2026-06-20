// @lat: [[crew#Role And Shift Templates]]
import { describe, expect, it } from "vitest"
import { VOLUNTEER_ROLE_TYPES } from "../../../db/schemas/volunteers"
import { buildCrewTemplateApplyPlan, buildCrewTemplatePreview } from "./preview"
import type { CrewRoleShiftTemplate } from "./types"

describe("Crew role and shift template preview", () => {
  it("resolves relative template shifts from the event start date", () => {
    const preview = buildCrewTemplatePreview(template, {
      eventId: "comp_test",
      startDate: "2026-08-14",
      endDate: "2026-08-15",
      timezone: "America/Denver",
      existingAssumptions: "",
      existingShifts: [],
    })

    expect(preview.shifts.map((shift) => [shift.name, shift.date])).toEqual([
      ["Day 1 judges", "2026-08-14"],
      ["Day 2 judges", "2026-08-15"],
    ])
    expect(preview.summary).toMatchObject({
      roles: 1,
      shifts: 2,
      newShifts: 2,
      duplicateShifts: 0,
      canFillAssumptions: true,
    })
  })

  it("marks exact existing shifts as duplicates instead of reapplying them", () => {
    const preview = buildCrewTemplatePreview(template, {
      eventId: "comp_test",
      startDate: "2026-08-14",
      endDate: "2026-08-15",
      timezone: "America/Denver",
      existingAssumptions: "Already set.",
      existingShifts: [
        {
          id: "vshf_existing",
          name: "Day 1 judges",
          roleType: VOLUNTEER_ROLE_TYPES.JUDGE,
          startTime: "2026-08-14T14:00:00.000Z",
          endTime: "2026-08-14T18:00:00.000Z",
          location: "Competition floor",
          capacity: 8,
        },
      ],
    })

    expect(preview.shifts[0]).toMatchObject({
      status: "already_exists",
      existingShiftId: "vshf_existing",
    })
    expect(preview.summary).toMatchObject({
      newShifts: 1,
      duplicateShifts: 1,
      canFillAssumptions: false,
    })
  })

  it("builds an append-only apply plan from new shifts and empty assumptions", () => {
    const preview = buildCrewTemplatePreview(template, {
      eventId: "comp_test",
      startDate: "2026-08-14",
      endDate: "2026-08-14",
      timezone: "America/Denver",
      existingAssumptions: "",
      existingShifts: [],
    })
    const plan = buildCrewTemplateApplyPlan(preview, {
      fillEmptyAssumptions: true,
    })

    expect(plan.mode).toBe("append_missing")
    expect(plan.shiftsToCreate).toHaveLength(1)
    expect(plan.assumptionsToWrite).toBe(template.staffingAssumptions)
    expect(preview.summary.warnings).toContain(
      "Some template shifts fall outside the event date range.",
    )
  })

  it("excludes shifts that resolve before the event start date from apply plans", () => {
    const preview = buildCrewTemplatePreview(
      {
        ...template,
        shifts: [
          {
            key: "pre-event-judges",
            name: "Pre-event judges",
            roleType: VOLUNTEER_ROLE_TYPES.JUDGE,
            dayOffset: -1,
            startTime: "08:00",
            endTime: "12:00",
            capacity: 8,
            location: "Competition floor",
          },
        ],
      },
      {
        eventId: "comp_test",
        startDate: "2026-08-14",
        endDate: "2026-08-15",
        timezone: "America/Denver",
        existingAssumptions: "",
        existingShifts: [],
      },
    )
    const plan = buildCrewTemplateApplyPlan(preview, {
      fillEmptyAssumptions: false,
    })

    expect(preview.shifts[0]).toMatchObject({
      date: "2026-08-13",
      status: "outside_event_dates",
    })
    expect(plan.shiftsToCreate).toHaveLength(0)
  })
})

const template: CrewRoleShiftTemplate = {
  id: "test-template",
  name: "Test template",
  description: "Test",
  source: "built_in",
  roles: [
    {
      roleType: VOLUNTEER_ROLE_TYPES.JUDGE,
      targetCount: 8,
      notes: "Lane-sized judge crew.",
    },
  ],
  shifts: [
    {
      key: "day-1-judges",
      name: "Day 1 judges",
      roleType: VOLUNTEER_ROLE_TYPES.JUDGE,
      dayOffset: 0,
      startTime: "08:00",
      endTime: "12:00",
      capacity: 8,
      location: "Competition floor",
    },
    {
      key: "day-2-judges",
      name: "Day 2 judges",
      roleType: VOLUNTEER_ROLE_TYPES.JUDGE,
      dayOffset: 1,
      startTime: "08:00",
      endTime: "12:00",
      capacity: 8,
      location: "Competition floor",
    },
  ],
  staffingAssumptions: "Use one judge per lane.",
}
