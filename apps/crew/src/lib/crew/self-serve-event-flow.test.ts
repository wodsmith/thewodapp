// @lat: [[crew#Guided Setup State]]
// @lat: [[crew#Volunteer Self Service]]
// @lat: [[crew#Event Day Export Packet]]
// @lat: [[crew#Copy Prior Event Setup]]
// @lat: [[crew#Department Leads]]
import { describe, expect, it } from "vitest"
import {
  CREW_ASSIGNMENT_CONFIRMATION_STATUS,
  CREW_ASSIGNMENT_CONFIRMATION_TYPE,
} from "../../db/schemas/crew-imports"
import { VOLUNTEER_ROLE_TYPES } from "../../db/schemas/volunteers"
import type { CrewSetupState } from "../crew-event-setup"
import {
  buildCrewAssignmentEmailIdempotencyKey,
  resolveCrewAssignmentConfirmationResponse,
} from "./assignment-confirmations"
import {
  buildCrewCopyPriorEventPreview,
  type CrewCopyPriorEventPlanInput,
  serializeCrewCopyPriorEventSettings,
} from "./copy-prior-event"
import {
  assertCrewDepartmentLeadCanManageShift,
  filterCrewDepartmentLeadRoster,
  filterCrewDepartmentLeadShifts,
  normalizeCrewDepartmentLeadScope,
} from "./department-leads"
import { buildCrewPilotExports } from "./exports/pilot-exports"
import type { CrewGuidedSetupFacts } from "./guided-setup"
import { buildCrewGuidedSetupState } from "./guided-setup"
import {
  buildCrewImportMappingPresetWrite,
  selectCrewImportMappingSuggestion,
} from "./imports/mapping-memory"
import type { CrewReadinessChecklist } from "./readiness"
import {
  buildCrewTemplateApplyPlan,
  buildCrewTemplatePreview,
} from "./templates/preview"
import type { CrewRoleShiftTemplate } from "./templates/types"
import {
  buildCrewVolunteerSelfServiceIcs,
  buildCrewVolunteerSelfServiceSchedule,
  resolveCrewVolunteerSelfServiceContactUpdate,
} from "./volunteer-self-service"

describe("Crew self-serve event flow", () => {
  it("keeps organizer setup, imports, volunteer response, and exports aligned", () => {
    const event = {
      id: "comp_self_serve",
      name: "Self Serve Classic",
      startDate: "2026-08-14",
      endDate: "2026-08-14",
      timezone: "America/Denver",
    }

    const templatePreview = buildCrewTemplatePreview(selfServeTemplate, {
      eventId: event.id,
      startDate: event.startDate,
      endDate: event.endDate,
      timezone: event.timezone,
      existingAssumptions: "",
      existingShifts: [],
    })
    const templatePlan = buildCrewTemplateApplyPlan(templatePreview, {
      fillEmptyAssumptions: true,
    })

    expect(templatePlan.mode).toBe("append_missing")
    expect(templatePlan.shiftsToCreate.map((shift) => shift.name)).toEqual([
      "Volunteer check-in",
      "Lane judges",
    ])
    expect(templatePlan.assumptionsToWrite).toBe(
      "One check-in owner and one judge per lane.",
    )

    const headers = ["Full Name", "Email", "Roles", "Availability"]
    const mappingWrite = buildCrewImportMappingPresetWrite({
      teamId: "team_self_serve",
      competitionId: event.id,
      sourcePlatform: "Competition Corner",
      kind: "volunteers",
      headers,
      columnMapping: {
        name: "Full Name",
        email: "Email",
        role: "Roles",
        availability: "Availability",
      },
    })
    expect(mappingWrite).toMatchObject({
      sourcePlatform: "competition corner",
      metadata: { fieldCount: 4, headerCount: 4 },
    })

    const suggestion = selectCrewImportMappingSuggestion({
      teamId: "team_self_serve",
      sourcePlatform: "competition corner",
      kind: "volunteers",
      headers,
      candidates: [
        {
          id: "preset_volunteers",
          teamId: "team_self_serve",
          kind: "volunteers",
          sourcePlatform: "Competition Corner",
          name: "Competition Corner volunteers",
          headerFingerprint: mappingWrite?.headerFingerprint ?? "",
          headers,
          columnMapping: mappingWrite?.columnMapping ?? {},
          parserVersion: mappingWrite?.parserVersion ?? null,
          lastUsedAt: "2026-07-15T12:00:00.000Z",
          createdAt: "2026-07-01T12:00:00.000Z",
          updatedAt: "2026-07-15T12:00:00.000Z",
        },
      ],
    })
    expect(suggestion).toMatchObject({
      presetId: "preset_volunteers",
      matchedFieldCount: 4,
      sourcePlatform: "competition corner",
    })

    const copyPriorPreview = buildCrewCopyPriorEventPreview(copyPriorEventInput)
    expect(copyPriorPreview.canApply).toBe(true)
    expect(copyPriorPreview.plan.dateShiftDays).toBe(61)
    expect(copyPriorPreview.plan.venuesToCreate).toMatchObject([
      { sourceVenueId: "venue_source", name: "Competition floor" },
    ])
    expect(copyPriorPreview.plan.heatsToCreate).toHaveLength(1)
    expect(
      copyPriorPreview.plan.heatsToCreate[0]?.scheduledTime?.toISOString(),
    ).toBe("2026-08-14T15:00:00.000Z")
    expect(copyPriorPreview.plan.shiftsToCreate).toMatchObject([
      {
        sourceShiftId: "shift_source_checkin",
        name: "Volunteer check-in",
      },
    ])
    expect(copyPriorPreview.plan.assumptionsToWrite).toBe(
      "Copy one floor and one judge block.",
    )
    expect(
      copyPriorPreview.summary.find(
        (item) => item.category === "volunteer_identity",
      ),
    ).toMatchObject({ status: "deny", count: 2 })
    expect(
      copyPriorPreview.summary.find(
        (item) => item.category === "judge_assignments",
      ),
    ).toMatchObject({ status: "deny", count: 1 })

    const copiedSettings = serializeCrewCopyPriorEventSettings(
      JSON.stringify({
        guidedSetup: { steps: { roles: { note: "keep guided" } } },
        setup: { assumptions: "" },
      }),
      {
        sourceEventId: copyPriorEventInput.sourceEvent.id,
        sourceEventName: copyPriorEventInput.sourceEvent.name,
        appliedAt: "2026-08-01T18:00:00.000Z",
        mode: copyPriorPreview.plan.mode,
        assumptionsToWrite: copyPriorPreview.plan.assumptionsToWrite,
        counts: {
          venues: copyPriorPreview.plan.venuesToCreate.length,
          tracks: copyPriorPreview.plan.tracksToCreate.length,
          trackWorkouts: copyPriorPreview.plan.trackWorkoutsToCreate.length,
          heats: copyPriorPreview.plan.heatsToCreate.length,
          shifts: copyPriorPreview.plan.shiftsToCreate.length,
        },
      },
    )
    expect(JSON.parse(copiedSettings)).toMatchObject({
      guidedSetup: { steps: { roles: { note: "keep guided" } } },
      setup: {
        assumptions: "Copy one floor and one judge block.",
        checklist: { staffingPlanDrafted: true },
      },
      copyPriorEvent: {
        sourceEventId: "comp_prior_self_serve",
        sourceEventName: "Prior Self Serve Classic",
      },
    })

    const responseAt = new Date("2026-08-01T18:00:00.000Z")
    const response = resolveCrewAssignmentConfirmationResponse(
      {
        status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
        expiresAt: "2026-08-13T18:00:00.000Z",
      },
      "confirm",
      "",
      responseAt,
    )
    expect(response).toMatchObject({
      ok: true,
      outcome: "updated",
      status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CONFIRMED,
      responseNote: null,
      respondedAt: responseAt,
    })
    expect(
      resolveCrewAssignmentConfirmationResponse(
        {
          status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CONFIRMED,
          expiresAt: "2026-08-13T18:00:00.000Z",
        },
        "confirm",
        "",
        new Date("2026-08-01T18:05:00.000Z"),
      ),
    ).toMatchObject({
      ok: true,
      outcome: "idempotent",
      status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CONFIRMED,
    })
    expect(buildCrewAssignmentEmailIdempotencyKey("conf_checkin", 0)).toBe(
      "crew-confirmation-conf_checkin-0",
    )

    const contactUpdate = resolveCrewVolunteerSelfServiceContactUpdate(
      JSON.stringify({
        signupEmail: "old@example.com",
        signupName: "Old Name",
        availability: { friday: ["morning"] },
      }),
      {
        email: " CASEY@EXAMPLE.COM ",
        name: "Casey Check",
        phone: " 555-0101 ",
        availability: { friday: ["morning"], saturday: ["afternoon"] },
        availabilityNotes: "Can judge after check-in.",
        credentials: "L1",
      },
    )
    expect(contactUpdate.changed).toBe(true)
    expect(contactUpdate.metadata).toMatchObject({
      signupEmail: "casey@example.com",
      signupName: "Casey Check",
      signupPhone: "555-0101",
      availabilityNotes: "Can judge after check-in.",
      credentials: "L1",
    })

    const volunteerSchedule = buildCrewVolunteerSelfServiceSchedule({
      assigneeId: "member_casey",
      tokenAssignmentId: "assign_checkin",
      assignments: [
        {
          id: "assign_judge",
          assigneeId: "member_jules",
          shiftId: "shift_judges",
          name: "Lane judges",
          roleType: VOLUNTEER_ROLE_TYPES.JUDGE,
          roleLabel: "Judge",
          startTime: "2026-08-14T15:00:00.000Z",
          endTime: "2026-08-14T18:00:00.000Z",
          location: "Competition floor",
          notes: null,
          confirmation: null,
        },
        {
          id: "assign_checkin",
          assigneeId: "member_casey",
          shiftId: "shift_checkin",
          name: "Volunteer check-in",
          roleType: VOLUNTEER_ROLE_TYPES.CHECK_IN,
          roleLabel: "Check-In",
          startTime: "2026-08-14T14:00:00.000Z",
          endTime: "2026-08-14T16:00:00.000Z",
          location: "Front desk",
          notes: "Use the east entrance.",
          confirmation: {
            id: "conf_checkin",
            status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CONFIRMED,
            sentAt: "2026-07-31T18:00:00.000Z",
            respondedAt: responseAt,
            expiresAt: "2026-08-13T18:00:00.000Z",
            responseNote: null,
          },
        },
      ],
    })
    expect(
      volunteerSchedule.map((assignment) => [
        assignment.name,
        assignment.isTokenAssignment,
      ]),
    ).toEqual([["Volunteer check-in", true]])
    expect(
      buildCrewVolunteerSelfServiceIcs({
        eventName: event.name,
        assignments: volunteerSchedule,
        generatedAt: responseAt,
      }),
    ).toContain("SUMMARY:Self Serve Classic: Volunteer check-in")

    const departmentLeadScope = normalizeCrewDepartmentLeadScope({
      id: "cdlead_judges_floor",
      roleType: VOLUNTEER_ROLE_TYPES.JUDGE,
      startsAt: "2026-08-14T14:00:00.000Z",
      endsAt: "2026-08-14T18:00:00.000Z",
      scope: { floors: ["Competition floor"] },
    })
    const departmentLeadAccess = {
      kind: "department_lead" as const,
      scopes: [departmentLeadScope],
    }
    const leadVisibleShifts = filterCrewDepartmentLeadShifts(
      [
        {
          id: "shift_judges",
          roleType: VOLUNTEER_ROLE_TYPES.JUDGE,
          location: "Competition floor",
          startTime: "2026-08-14T15:00:00.000Z",
          endTime: "2026-08-14T18:00:00.000Z",
          assignments: [{ membershipId: "member_casey" }],
        },
        {
          id: "shift_checkin",
          roleType: VOLUNTEER_ROLE_TYPES.CHECK_IN,
          location: "Front desk",
          startTime: "2026-08-14T14:00:00.000Z",
          endTime: "2026-08-14T16:00:00.000Z",
          assignments: [{ membershipId: "member_checkin_hidden" }],
        },
      ],
      departmentLeadAccess,
    )
    expect(leadVisibleShifts.map((shift) => shift.id)).toEqual(["shift_judges"])
    expect(
      filterCrewDepartmentLeadRoster(
        [
          {
            membershipId: "member_jules",
            roleTypes: [VOLUNTEER_ROLE_TYPES.JUDGE],
          },
          {
            membershipId: "member_casey",
            roleTypes: [VOLUNTEER_ROLE_TYPES.CHECK_IN],
          },
          {
            membershipId: "member_checkin_hidden",
            roleTypes: [VOLUNTEER_ROLE_TYPES.CHECK_IN],
          },
        ],
        departmentLeadAccess,
        leadVisibleShifts,
      ).map((volunteer) => volunteer.membershipId),
    ).toEqual(["member_jules", "member_casey"])
    expect(() =>
      assertCrewDepartmentLeadCanManageShift(departmentLeadAccess, {
        id: "shift_checkin",
        roleType: VOLUNTEER_ROLE_TYPES.CHECK_IN,
        location: "Front desk",
        startTime: "2026-08-14T14:00:00.000Z",
        endTime: "2026-08-14T16:00:00.000Z",
      }),
    ).toThrow("Department lead scope")

    const exports = buildCrewPilotExports({
      event,
      generatedAt: "2026-08-14T12:00:00.000Z",
      venues: [{ id: "venue_floor", name: "Competition floor", laneCount: 2 }],
      workouts: [{ id: "tw_fran", name: "Fran", sortOrder: 1 }],
      heats: [
        {
          id: "heat_1",
          trackWorkoutId: "tw_fran",
          heatNumber: 1,
          venueId: "venue_floor",
          scheduledTime: "2026-08-14T15:00:00.000Z",
          durationMinutes: 12,
        },
      ],
      heatLaneAssignments: [
        { heatId: "heat_1", laneNumber: 1 },
        { heatId: "heat_1", laneNumber: 2 },
      ],
      judgeAssignments: [
        {
          id: "judge_lane_1",
          membershipId: "member_jules",
          volunteerName: "Jules Judge",
          email: "jules@example.com",
          heatId: "heat_1",
          laneNumber: 1,
          position: VOLUNTEER_ROLE_TYPES.JUDGE,
          confirmation: {
            type: CREW_ASSIGNMENT_CONFIRMATION_TYPE.JUDGE_HEAT,
            status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CONFIRMED,
            sentAt: "2026-07-31T18:00:00.000Z",
            respondedAt: responseAt,
          },
        },
      ],
      shifts: [
        {
          id: "shift_checkin",
          name: "Volunteer check-in",
          roleType: VOLUNTEER_ROLE_TYPES.CHECK_IN,
          startTime: "2026-08-14T14:00:00.000Z",
          endTime: "2026-08-14T16:00:00.000Z",
          capacity: 1,
          location: "Front desk",
          assignments: [
            {
              id: "assign_checkin",
              membershipId: "member_casey",
              volunteerName: "Casey Check",
              email: "casey@example.com",
              confirmation: {
                type: CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
                status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CONFIRMED,
                sentAt: "2026-07-31T18:00:00.000Z",
                respondedAt: responseAt,
              },
            },
          ],
        },
      ],
    })

    expect(exports.summary).toMatchObject({
      masterScheduleRows: 2,
      judgeEventSections: 1,
      judgeHeatSheets: 1,
      shiftSheets: 1,
    })
    expect(exports.judgeEventSections[0]?.heats[0]?.rows).toMatchObject([
      {
        laneNumber: 1,
        judgeName: "Jules Judge",
        confirmationStatus: "confirmed",
      },
      { laneNumber: 2, judgeName: "OPEN", confirmationStatus: "missing" },
    ])

    const guidedSetup = buildCrewGuidedSetupState({
      event,
      setup: {
        ...readySetup,
        assumptions: templatePlan.assumptionsToWrite ?? "",
      },
      facts: readyFacts,
      readiness: readyReadiness,
      persisted: { activeStep: null, steps: {} },
    })
    expect(guidedSetup.summary).toMatchObject({
      total: 8,
      complete: 8,
      highestStatus: "complete",
      progressPercent: 100,
    })
    expect(guidedSetup.activeStep).toBe("event_basics")
  })
})

const selfServeTemplate: CrewRoleShiftTemplate = {
  id: "local-one-day",
  name: "Local one-day",
  description: "One-day self-serve starter template.",
  source: "built_in",
  roles: [
    {
      roleType: VOLUNTEER_ROLE_TYPES.CHECK_IN,
      targetCount: 1,
      notes: "Own volunteer arrivals.",
    },
    {
      roleType: VOLUNTEER_ROLE_TYPES.JUDGE,
      targetCount: 2,
      notes: "One judge per lane.",
    },
  ],
  shifts: [
    {
      key: "checkin",
      name: "Volunteer check-in",
      roleType: VOLUNTEER_ROLE_TYPES.CHECK_IN,
      dayOffset: 0,
      startTime: "08:00",
      endTime: "10:00",
      capacity: 1,
      location: "Front desk",
      notes: "Use the east entrance.",
    },
    {
      key: "judges",
      name: "Lane judges",
      roleType: VOLUNTEER_ROLE_TYPES.JUDGE,
      dayOffset: 0,
      startTime: "09:00",
      endTime: "12:00",
      capacity: 2,
      location: "Competition floor",
    },
  ],
  staffingAssumptions: "One check-in owner and one judge per lane.",
}

const copyPriorEventInput: CrewCopyPriorEventPlanInput = {
  mode: "empty_target_only",
  sourceEvent: {
    id: "comp_prior_self_serve",
    name: "Prior Self Serve Classic",
    organizingTeamId: "team_self_serve",
    startDate: "2026-06-14",
    endDate: "2026-06-14",
    timezone: "America/Denver",
    settingsText: JSON.stringify({
      setup: { assumptions: "Copy one floor and one judge block." },
    }),
  },
  targetEvent: {
    id: "comp_self_serve",
    name: "Self Serve Classic",
    organizingTeamId: "team_self_serve",
    startDate: "2026-08-14",
    endDate: "2026-08-14",
    timezone: "America/Denver",
    settingsText: JSON.stringify({
      setup: { assumptions: "" },
    }),
  },
  source: {
    venues: [
      {
        id: "venue_source",
        name: "Competition floor",
        laneCount: 2,
        transitionMinutes: 4,
        sortOrder: 1,
      },
    ],
    tracks: [
      {
        id: "track_source",
        name: "Competition events",
        description: "Copied event structure",
        type: "team_owned",
        scalingGroupId: "sgrp_self_serve",
        isPublic: 0,
      },
    ],
    trackWorkouts: [
      {
        id: "trwk_source",
        trackId: "track_source",
        workoutId: "workout_fran",
        workoutName: "Fran",
        workoutDescription: "21-15-9",
        workoutScope: "private",
        workoutScheme: "time",
        workoutScoreType: "min",
        workoutRepsPerRound: null,
        workoutRoundsToScore: null,
        workoutTiebreakScheme: null,
        workoutTimeCap: 600,
        workoutScalingGroupId: "sgrp_self_serve",
        parentEventId: null,
        trackOrder: 1,
        notes: "Copied event shell only.",
        pointsMultiplier: 100,
        defaultHeatsCount: 1,
        defaultLaneShiftPattern: "same_lane",
        minHeatBuffer: 2,
      },
    ],
    heats: [
      {
        id: "heat_source",
        trackWorkoutId: "trwk_source",
        venueId: "venue_source",
        heatNumber: 1,
        scheduledTime: "2026-06-14T15:00:00.000Z",
        durationMinutes: 12,
        notes: "Shifted to target event date.",
      },
    ],
    shifts: [
      {
        id: "shift_source_checkin",
        name: "Volunteer check-in",
        roleType: VOLUNTEER_ROLE_TYPES.CHECK_IN,
        startTime: "2026-06-14T14:00:00.000Z",
        endTime: "2026-06-14T16:00:00.000Z",
        location: "Front desk",
        capacity: 1,
        notes: "Keep the station, not historical volunteers.",
      },
    ],
    deniedCounts: {
      volunteerIdentities: 2,
      judgeAssignments: 1,
      imports: 1,
      payments: 0,
      messages: 0,
    },
  },
  targetExistingCounts: {
    venues: 0,
    tracks: 0,
    heats: 0,
    shifts: 0,
  },
}

const readySetup: CrewSetupState = {
  desiredGoLiveDate: "2026-08-01",
  sourceContactName: "Taylor",
  sourceContactEmail: "taylor@example.com",
  volunteerTarget: "8",
  staffingLead: "Sam",
  checklist: {
    eventBasicsConfirmed: true,
    sourceAccessConfirmed: true,
    volunteerNeedsDrafted: true,
    staffingPlanDrafted: true,
    operatorHandoffReady: true,
  },
  internalNotes: "",
  assumptions: "",
}

const readyFacts: CrewGuidedSetupFacts = {
  setup: {
    completed: 5,
    total: 5,
  },
  venues: {
    venueCount: 1,
    totalLaneCount: 2,
  },
  schedule: {
    workoutCount: 1,
    publishedWorkoutCount: 1,
    heatCount: 1,
    scheduledHeatCount: 1,
    publishedHeatCount: 1,
  },
  imports: {
    volunteerImportCount: 1,
    appliedVolunteerImportCount: 1,
    heatScheduleImportCount: 1,
    appliedHeatScheduleImportCount: 1,
  },
  roster: {
    total: 2,
    pending: 0,
    accepted: 0,
    active: 2,
    inactive: 0,
    expired: 0,
    assignable: 2,
  },
  shifts: {
    totalShifts: 2,
    assignedSlots: 2,
    capacity: 3,
    openSlots: 1,
    confirmationSummary: {
      pending: 0,
      confirmed: 2,
      declined: 0,
      changeRequested: 0,
      noShow: 0,
      cancelled: 0,
    },
    confirmationOperationalSummary: {
      missing: 0,
      pending: 0,
      sent: 0,
      confirmed: 2,
      declined: 0,
      changeRequested: 0,
      noShow: 0,
      replaced: 0,
      total: 2,
      responseNeeded: 0,
      organizerActionNeeded: 0,
    },
  },
  judge: {
    rotationCount: 1,
    assignmentCount: 1,
    activeVersionCount: 1,
  },
}

const readyReadiness: CrewReadinessChecklist = {
  items: [],
  summary: {
    total: 7,
    ready: 7,
    needsAttention: 0,
    blocked: 0,
    progressPercent: 100,
    highestStatus: "ready",
  },
}
