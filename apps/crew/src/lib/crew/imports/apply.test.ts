// @lat: [[crew#Import Apply#Confirmed Mutation]]
import { describe, expect, it } from "vitest"
import {
  buildHeatScheduleApplyPlan,
  buildVolunteerApplyPlan,
  getAppliedHeatSupportTargets,
  getMutationAffectedRows,
  isImportedHeatUpdateAlreadyApplied,
  markHeatUpdateSkippedForPublicationConflict,
  mergeImportedJsonMetadata,
  parseImportedScheduledTime,
  selectCrewImportProgrammingTrack,
  summarizeApplyRows,
} from "./apply"
import type {
  HeatScheduleImportRow,
  PreviewImportRow,
  VolunteerImportRow,
} from "./types"

function volunteerRow(
  rowNumber: number,
  email: string,
  action: PreviewImportRow["action"] = "create",
  overrides: Partial<VolunteerImportRow> = {},
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
      phoneCountryCode: "",
      role: "Judge",
      rolePreference1: "",
      rolePreference2: "",
      rolePreference3: "",
      division: "RX",
      availability: "all day",
      shirtSize: "",
      sourceExternalId: "",
      sourceCreatedAt: "",
      notes: "Bring clipboard",
      questionAnswers: [],
      ...overrides,
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
  overrides: Partial<HeatScheduleImportRow> = {},
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
      ...overrides,
    },
    warnings: [],
    errors: [],
  }
}

describe("buildVolunteerApplyPlan", () => {
  it("skips duplicate emails within the apply run", () => {
    const plan = buildVolunteerApplyPlan(
      [volunteerRow(2, "ian@example.com"), volunteerRow(3, "IAN@example.com")],
      {
        importId: "cimp_test",
        existingInvitations: [],
        existingMemberships: [],
      },
    )

    expect(plan.summary.createdCount).toBe(1)
    expect(plan.summary.skippedCount).toBe(1)
    expect(plan.rows[1]).toMatchObject({
      action: "skip",
      operation: "skip",
      warnings: expect.arrayContaining([
        expect.objectContaining({ code: "duplicate_email_apply" }),
      ]),
    })
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

  it("preserves approved status when merging imported metadata for existing memberships", () => {
    const plan = buildVolunteerApplyPlan([volunteerRow(2, "ian@example.com")], {
      importId: "cimp_test",
      existingInvitations: [],
      existingMemberships: [
        { id: "tmem_1", email: "ian@example.com", isActive: true },
      ],
    })

    const merged = mergeImportedJsonMetadata(
      JSON.stringify({
        status: "approved",
        volunteerRoleTypes: ["general"],
      }),
      plan.rows[0]?.metadata ?? null,
      { preserveExistingApprovedStatus: true },
    )

    expect(JSON.parse(merged ?? "{}")).toMatchObject({
      status: "approved",
      volunteerRoleTypes: ["judge"],
      crewImportId: "cimp_test",
    })
  })

  it("composes ranked role preferences into deduped ordered role types with raw notes", () => {
    const plan = buildVolunteerApplyPlan(
      [
        volunteerRow(2, "ranked@example.com", "create", {
          role: "",
          rolePreference1: "Head Judge",
          rolePreference2: "Media",
          rolePreference3: "Head judge",
          notes: "",
          division: "",
        }),
      ],
      {
        importId: "cimp_test",
        existingInvitations: [],
        existingMemberships: [],
      },
    )

    const metadata = JSON.parse(plan.rows[0]?.metadata ?? "{}")
    expect(metadata.volunteerRoleTypes).toEqual(["head_judge", "media"])
    expect(metadata.internalNotes).toBe(
      "Imported role preferences: Head Judge, Media, Head judge",
    )
  })

  it("falls back to GENERAL when no role or preference matches the taxonomy", () => {
    const plan = buildVolunteerApplyPlan(
      [
        volunteerRow(2, "custom@example.com", "create", {
          role: "",
          rolePreference1: "Bouncy Castle Wrangler",
        }),
      ],
      {
        importId: "cimp_test",
        existingInvitations: [],
        existingMemberships: [],
      },
    )

    const metadata = JSON.parse(plan.rows[0]?.metadata ?? "{}")
    expect(metadata.volunteerRoleTypes).toEqual(["general"])
    expect(metadata.internalNotes).toContain(
      "Imported role preferences: Bouncy Castle Wrangler",
    )
  })

  it("composes phone country code, shirt size, and provenance keys into metadata", () => {
    const plan = buildVolunteerApplyPlan(
      [
        volunteerRow(2, "phone@example.com", "create", {
          phone: "5551234567",
          phoneCountryCode: "1",
          shirtSize: "L",
          sourceExternalId: "cc-9001",
          sourceCreatedAt: "2026-06-01",
        }),
      ],
      {
        importId: "cimp_test",
        existingInvitations: [],
        existingMemberships: [],
      },
    )

    const metadata = JSON.parse(plan.rows[0]?.metadata ?? "{}")
    expect(metadata.signupPhone).toBe("+1 5551234567")
    expect(metadata.shirtSize).toBe("L")
    expect(metadata.crewImportExternalId).toBe("cc-9001")
    expect(metadata.crewImportSourceCreatedAt).toBe("2026-06-01")
  })

  it("does not double-prefix a phone that already carries a country code", () => {
    const withPlus = buildVolunteerApplyPlan(
      [
        volunteerRow(2, "plus@example.com", "create", {
          phone: "+1 5551234567",
          phoneCountryCode: "1",
        }),
      ],
      {
        importId: "cimp_test",
        existingInvitations: [],
        existingMemberships: [],
      },
    )
    expect(JSON.parse(withPlus.rows[0]?.metadata ?? "{}").signupPhone).toBe(
      "+1 5551234567",
    )

    const noCode = buildVolunteerApplyPlan(
      [
        volunteerRow(3, "nocode@example.com", "create", {
          phone: "5551234567",
          phoneCountryCode: "",
        }),
      ],
      {
        importId: "cimp_test",
        existingInvitations: [],
        existingMemberships: [],
      },
    )
    expect(JSON.parse(noCode.rows[0]?.metadata ?? "{}").signupPhone).toBe(
      "5551234567",
    )
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

  it("errors instead of guessing when workout lookup keys are ambiguous", () => {
    const plan = buildHeatScheduleApplyPlan(
      [heatRow(2, 1, "9:00 AM", { workout: "Event 2" })],
      {
        ...context,
        trackWorkouts: [
          { id: "trwk_label", label: "Event 2", trackOrder: 1 },
          { id: "trwk_order", label: "Clean", trackOrder: 2 },
        ],
        existingHeats: [],
      },
    )

    expect(plan.summary.errorRowCount).toBe(1)
    expect(plan.rows[0]).toMatchObject({
      action: "error",
      operation: "error",
      errors: expect.arrayContaining([
        expect.objectContaining({ code: "ambiguous_workout_lookup" }),
      ]),
    })
  })

  it("surfaces invalid persisted scheduled-time values as row errors", () => {
    const plan = buildHeatScheduleApplyPlan(
      [
        heatRow(2, 1, "9:00 AM", {
          scheduledTime: 0 as unknown as string,
        }),
      ],
      context,
    )

    expect(plan.summary.errorRowCount).toBe(1)
    expect(plan.rows[0]?.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid_scheduled_time" }),
      ]),
    )
  })

  it("turns a no-op heat update into a skipped publication-conflict audit row", () => {
    const plan = buildHeatScheduleApplyPlan([heatRow(2, 1, "9:00 AM")], context)

    expect(plan.summary.updatedCount).toBe(1)

    const row = plan.rows[0]
    expect(row).toBeDefined()
    if (!row) throw new Error("Expected heat update row")

    markHeatUpdateSkippedForPublicationConflict(row)

    const summary = summarizeApplyRows(plan.rows)

    expect(row).toMatchObject({
      action: "skip",
      operation: "skip",
      warnings: expect.arrayContaining([
        expect.objectContaining({ code: "published_heat_update_conflict" }),
      ]),
    })
    expect(summary.updatedCount).toBe(0)
    expect(summary.skippedCount).toBe(1)
  })

  it("recognizes an identical unpublished heat update as an idempotent success", () => {
    const plan = buildHeatScheduleApplyPlan([heatRow(2, 1, "9:00 AM")], context)
    const row = plan.rows[0]
    expect(row).toBeDefined()
    if (!row) throw new Error("Expected heat update row")

    expect(
      isImportedHeatUpdateAlreadyApplied(
        {
          trackWorkoutId: "trwk_1",
          heatNumber: 1,
          scheduledTime: new Date("2026-06-20T15:00:00.000Z"),
          venueId: "cvenue_1",
          divisionId: "div_rx",
          durationMinutes: 12,
          notes: "Imported",
          schedulePublishedAt: null,
        },
        row,
      ),
    ).toBe(true)

    expect(
      isImportedHeatUpdateAlreadyApplied(
        {
          trackWorkoutId: "trwk_1",
          heatNumber: 1,
          scheduledTime: new Date("2026-06-20T15:00:00.000Z"),
          venueId: "cvenue_1",
          divisionId: "div_rx",
          durationMinutes: 12,
          notes: "Imported",
          schedulePublishedAt: new Date("2026-06-20T15:05:00.000Z"),
        },
        row,
      ),
    ).toBe(false)

    expect(
      isImportedHeatUpdateAlreadyApplied(
        {
          trackWorkoutId: "trwk_1",
          heatNumber: 1,
          scheduledTime: new Date("2026-06-20T15:12:00.000Z"),
          venueId: "cvenue_1",
          divisionId: "div_rx",
          durationMinutes: 12,
          notes: "Imported",
          schedulePublishedAt: null,
        },
        row,
      ),
    ).toBe(false)
  })

  it("excludes published-skip and invalid-time heat rows from support targets", () => {
    const plan = buildHeatScheduleApplyPlan(
      [
        heatRow(2, 1, "9:00 AM", { venue: "Side Floor" }),
        heatRow(3, 2, "not a time", {
          workout: "Event 2",
          venue: "Side Floor",
        }),
        heatRow(4, 2, "10:00 AM"),
      ],
      {
        competitionStartDate: "2026-06-20",
        timezone: "America/Denver",
        trackWorkouts: [
          { id: "trwk_1", label: "Event 1", trackOrder: 1 },
          { id: "trwk_2", label: "Event 2", trackOrder: 2 },
        ],
        divisions: [{ id: "div_rx", label: "RX" }],
        venues: [
          { id: "cvenue_1", name: "Main Floor" },
          { id: "cvenue_2", name: "Side Floor" },
        ],
        existingHeats: [
          {
            id: "cheat_published",
            trackWorkoutId: "trwk_1",
            heatNumber: 1,
            schedulePublishedAt: new Date("2026-06-20T15:00:00.000Z"),
          },
        ],
      },
    )

    expect(plan.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rowNumber: 2,
          operation: "skip",
          warnings: expect.arrayContaining([
            expect.objectContaining({ code: "published_heat_not_updated" }),
          ]),
        }),
        expect.objectContaining({
          rowNumber: 3,
          operation: "error",
          errors: expect.arrayContaining([
            expect.objectContaining({ code: "invalid_scheduled_time" }),
          ]),
        }),
        expect.objectContaining({
          rowNumber: 4,
          operation: "create_heat",
        }),
      ]),
    )

    const supportTargets = getAppliedHeatSupportTargets(plan.rows)

    expect([...supportTargets.trackWorkoutIds]).toEqual(["trwk_1"])
    expect([...supportTargets.venueIds]).toEqual(["cvenue_1"])
  })
})

describe("import apply helpers", () => {
  it("reads mutation affected-row counts across supported driver result shapes", () => {
    expect(getMutationAffectedRows({ rowsAffected: 1 })).toBe(1)
    expect(getMutationAffectedRows([{ affectedRows: 0 }])).toBe(0)
  })

  it("selects the Crew import programming track deterministically", () => {
    expect(
      selectCrewImportProgrammingTrack(
        [
          {
            id: "ptrk_public",
            name: "Alpha",
            type: "team_owned",
            isPublic: 1,
          },
          {
            id: "ptrk_import",
            name: "Test Event - Events",
            type: "team_owned",
            isPublic: 0,
          },
        ],
        "Test Event - Events",
      )?.id,
    ).toBe("ptrk_import")

    expect(
      selectCrewImportProgrammingTrack(
        [
          {
            id: "ptrk_public",
            name: "Alpha",
            type: "team_owned",
            isPublic: 1,
          },
          {
            id: "ptrk_private",
            name: "Zulu",
            type: "team_owned",
            isPublic: 0,
          },
        ],
        "Missing - Events",
      )?.id,
    ).toBe("ptrk_private")
  })
})
