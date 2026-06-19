// @lat: [[crew#Import Apply#Confirmed Mutation]]
import { describe, expect, it } from "vitest"
import {
  buildHeatScheduleApplyPlan,
  buildVolunteerApplyPlan,
  parseImportedScheduledTime,
} from "./apply"
import type { PreviewImportRow } from "./types"

function volunteerRow(
  rowNumber: number,
  email: string,
  action: PreviewImportRow["action"] = "create",
): PreviewImportRow {
  return {
    rowNumber,
    rawRow: {},
    targetType: "team_invitation",
    action,
    normalizedRow: {
      firstName: "Test",
      lastName: "Volunteer",
      name: "Test Volunteer",
      email,
      phone: "",
      role: "Judge",
      division: "RX",
      availability: "all day",
      notes: "Bring clipboard",
    },
    warnings:
      action === "skip"
        ? [
            {
              code: "duplicate_email",
              severity: "warning",
              rowNumber,
              field: "email",
              message: "Email appears more than once in this file.",
            },
          ]
        : [],
    errors: [],
  }
}

function heatRow(
  rowNumber: number,
  heatNumber: number,
  scheduledTime: string,
): PreviewImportRow {
  return {
    rowNumber,
    rawRow: {},
    targetType: "competition_heat",
    action: "create",
    normalizedRow: {
      workout: "Event 1",
      heatNumber,
      heatLabel: `Heat ${heatNumber}`,
      division: "RX",
      scheduledTime,
      durationMinutes: 12,
      venue: "Main floor",
      laneCount: 8,
      notes: "Imported",
    },
    warnings: [],
    errors: [],
  }
}

describe("buildVolunteerApplyPlan", () => {
  it("skips duplicate preview rows and does not create either duplicate email", () => {
    const plan = buildVolunteerApplyPlan(
      [
        volunteerRow(2, "ian@example.com", "skip"),
        volunteerRow(3, "IAN@example.com", "skip"),
      ],
      {
        importId: "cimp_test",
        existingInvitations: [],
        existingMemberships: [],
      },
    )

    expect(plan.summary.createdCount).toBe(0)
    expect(plan.summary.skippedCount).toBe(2)
    expect(plan.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "skip", operation: "skip" }),
      ]),
    )
  })

  it("updates existing volunteer memberships before considering invitations", () => {
    const plan = buildVolunteerApplyPlan([volunteerRow(2, "ian@example.com")], {
      importId: "cimp_test",
      existingInvitations: [
        {
          id: "tinv_1",
          email: "ian@example.com",
          acceptedAt: null,
          status: "pending",
        },
      ],
      existingMemberships: [
        { id: "tmem_1", email: "IAN@example.com", isActive: true },
      ],
    })

    expect(plan.summary.updatedCount).toBe(1)
    expect(plan.rows[0]).toMatchObject({
      action: "update",
      targetType: "team_membership",
      targetId: "tmem_1",
      operation: "update_membership",
    })
    expect(plan.rows[0]?.metadata).toContain('"volunteerRoleTypes":["judge"]')
  })

  it("updates an existing pending invitation instead of creating a duplicate", () => {
    const plan = buildVolunteerApplyPlan([volunteerRow(2, "ian@example.com")], {
      importId: "cimp_test",
      existingInvitations: [
        {
          id: "tinv_1",
          email: "IAN@example.com",
          acceptedAt: null,
          status: "pending",
        },
      ],
      existingMemberships: [],
    })

    expect(plan.summary.updatedCount).toBe(1)
    expect(plan.rows[0]).toMatchObject({
      action: "update",
      targetType: "team_invitation",
      targetId: "tinv_1",
      operation: "update_invitation",
    })
  })
})

describe("buildHeatScheduleApplyPlan", () => {
  const context = {
    competitionStartDate: "2026-06-20",
    timezone: "America/Denver",
    trackWorkouts: [{ id: "trwk_1", label: "Event 1", trackOrder: 1 }],
    divisions: [{ id: "div_rx", label: "RX" }],
    venues: [{ id: "cvenue_1", name: "Main Floor" }],
    existingHeats: [{ id: "cheat_1", trackWorkoutId: "trwk_1", heatNumber: 1 }],
  }

  it("updates existing heats and skips duplicate rows in the same apply run", () => {
    const plan = buildHeatScheduleApplyPlan(
      [heatRow(2, 1, "9:00 AM"), heatRow(3, 1, "9:12 AM")],
      context,
    )

    expect(plan.summary.updatedCount).toBe(1)
    expect(plan.summary.skippedCount).toBe(1)
    expect(plan.rows[0]).toMatchObject({
      action: "update",
      targetId: "cheat_1",
      scheduledTime: new Date("2026-06-20T15:00:00.000Z"),
    })
    expect(plan.rows[1]?.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "duplicate_heat_apply" }),
      ]),
    )
  })

  it("parses imported wall-clock heat times in the competition timezone", () => {
    expect(
      parseImportedScheduledTime(
        "2026-06-21 10:30 AM",
        "2026-06-20",
        "America/Denver",
      )?.toISOString(),
    ).toBe("2026-06-21T16:30:00.000Z")
  })
})
