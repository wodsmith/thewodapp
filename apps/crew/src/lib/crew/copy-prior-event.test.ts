// @lat: [[crew#Copy Prior Event Setup]]
import { describe, expect, it } from "vitest"
import {
  buildCrewCopyPriorEventPreview,
  filterEligibleCrewCopyPriorEvents,
  serializeCrewCopyPriorEventSettings,
  shiftDateTimeBetweenEvents,
  type CrewCopyPriorEventCandidate,
  type CrewCopyPriorEventPlanInput,
} from "./copy-prior-event"

const baseInput: CrewCopyPriorEventPlanInput = {
  mode: "empty_target_only",
  sourceEvent: {
    id: "comp_source",
    name: "Spring Throwdown",
    organizingTeamId: "team_1",
    startDate: "2026-03-14",
    endDate: "2026-03-15",
    timezone: "America/Denver",
    settingsText: JSON.stringify({
      guidedSetup: { steps: {} },
      setup: { assumptions: "One floor lead and one judge per lane." },
    }),
  },
  targetEvent: {
    id: "comp_target",
    name: "Summer Throwdown",
    organizingTeamId: "team_1",
    startDate: "2026-06-20",
    endDate: "2026-06-21",
    timezone: "America/Denver",
    settingsText: JSON.stringify({
      guidedSetup: { steps: { eventBasics: { note: "keep me" } } },
      setup: { assumptions: "" },
    }),
  },
  source: {
    venues: [
      {
        id: "venue_source",
        name: "Main floor",
        laneCount: 8,
        transitionMinutes: 4,
        sortOrder: 1,
      },
    ],
    tracks: [
      {
        id: "track_source",
        name: "Competition events",
        description: "Competition structure",
        type: "team_owned",
        scalingGroupId: "sgrp_1",
        isPublic: 0,
      },
    ],
    trackWorkouts: [
      {
        id: "trwk_source",
        trackId: "track_source",
        workoutId: "workout_source",
        workoutName: "Event 1",
        workoutDescription: "AMRAP 10",
        workoutScope: "private",
        workoutScheme: "rounds-reps",
        workoutScoreType: "max",
        workoutRepsPerRound: 20,
        workoutRoundsToScore: 1,
        workoutTiebreakScheme: null,
        workoutTimeCap: 600,
        workoutScalingGroupId: "sgrp_1",
        parentEventId: null,
        trackOrder: 1,
        notes: "Briefing at 8",
        pointsMultiplier: 100,
        defaultHeatsCount: 4,
        defaultLaneShiftPattern: "shift_right",
        minHeatBuffer: 2,
      },
    ],
    heats: [
      {
        id: "heat_source",
        trackWorkoutId: "trwk_source",
        venueId: "venue_source",
        heatNumber: 1,
        scheduledTime: new Date("2026-03-14T15:00:00.000Z"),
        durationMinutes: 15,
        notes: "Heat notes",
      },
    ],
    shifts: [
      {
        id: "shift_source",
        name: "Morning check-in",
        roleType: "check_in",
        startTime: new Date("2026-03-14T14:00:00.000Z"),
        endTime: new Date("2026-03-14T16:00:00.000Z"),
        location: "Front desk",
        capacity: 2,
        notes: "Bring labels",
      },
    ],
    deniedCounts: {
      volunteerIdentities: 12,
      judgeAssignments: 24,
      imports: 3,
      payments: 40,
      messages: 2,
    },
  },
  targetExistingCounts: {
    venues: 0,
    tracks: 0,
    heats: 0,
    shifts: 0,
  },
}

describe("copy prior event setup", () => {
  it("filters eligible prior events to the same team and earlier dates", () => {
    const target: CrewCopyPriorEventCandidate = {
      id: "comp_target",
      name: "Target",
      organizingTeamId: "team_1",
      startDate: "2026-06-20",
      endDate: "2026-06-21",
      timezone: "America/Denver",
      lifecycle: "draft",
    }
    const candidates: CrewCopyPriorEventCandidate[] = [
      { ...target, id: "comp_same" },
      {
        ...target,
        id: "comp_other_team",
        organizingTeamId: "team_2",
        startDate: "2026-04-01",
      },
      { ...target, id: "comp_future", startDate: "2026-07-01" },
      { ...target, id: "comp_archived", lifecycle: "archived" },
      { ...target, id: "comp_prior", name: "Prior", startDate: "2026-03-01" },
    ]

    expect(filterEligibleCrewCopyPriorEvents(target, candidates)).toEqual([
      {
        ...target,
        id: "comp_prior",
        name: "Prior",
        startDate: "2026-03-01",
      },
    ])
  })

  it("previews structural rows, date shifts them, and denies historical data", () => {
    const preview = buildCrewCopyPriorEventPreview(baseInput)

    expect(preview.dateShiftDays).toBe(98)
    expect(preview.canApply).toBe(true)
    expect(preview.plan.venuesToCreate).toHaveLength(1)
    expect(preview.plan.trackWorkoutsToCreate).toHaveLength(1)
    expect(preview.plan.heatsToCreate).toHaveLength(1)
    expect(preview.plan.shiftsToCreate).toHaveLength(1)
    expect(preview.plan.assumptionsToWrite).toBe(
      "One floor lead and one judge per lane.",
    )
    expect(
      preview.summary.find((item) => item.category === "volunteer_identity"),
    ).toMatchObject({ status: "deny", count: 12 })
    expect(
      preview.summary.find((item) => item.category === "judge_assignments"),
    ).toMatchObject({ status: "deny", count: 24 })
  })

  it("does not overwrite existing target structure or assumptions", () => {
    const preview = buildCrewCopyPriorEventPreview({
      ...baseInput,
      targetEvent: {
        ...baseInput.targetEvent,
        settingsText: JSON.stringify({
          setup: { assumptions: "Target assumption stays." },
        }),
      },
      targetExistingCounts: {
        venues: 1,
        tracks: 1,
        heats: 2,
        shifts: 3,
      },
    })

    expect(preview.canApply).toBe(false)
    expect(preview.plan.venuesToCreate).toEqual([])
    expect(preview.plan.trackWorkoutsToCreate).toEqual([])
    expect(preview.plan.heatsToCreate).toEqual([])
    expect(preview.plan.shiftsToCreate).toEqual([])
    expect(preview.plan.assumptionsToWrite).toBeNull()
    expect(
      preview.summary.find((item) => item.category === "heats"),
    ).toMatchObject({ status: "skip" })
  })

  it("shifts timestamps using event local calendar dates", () => {
    const shifted = shiftDateTimeBetweenEvents({
      value: new Date("2026-03-14T15:30:00.000Z"),
      sourceEvent: {
        startDate: "2026-03-14",
        timezone: "America/Denver",
      },
      targetEvent: {
        startDate: "2026-11-01",
        timezone: "America/Denver",
      },
    })

    expect(shifted?.toISOString()).toBe("2026-11-01T16:30:00.000Z")
  })

  it("preserves existing settings while recording copy metadata", () => {
    const serialized = serializeCrewCopyPriorEventSettings(
      JSON.stringify({
        guidedSetup: { steps: { roles: { note: "keep guided" } } },
        setup: { assumptions: "" },
      }),
      {
        sourceEventId: "comp_source",
        sourceEventName: "Spring Throwdown",
        appliedAt: "2026-06-20T12:00:00.000Z",
        mode: "empty_target_only",
        assumptionsToWrite: "Copied assumptions",
        counts: {
          venues: 1,
          tracks: 1,
          trackWorkouts: 2,
          heats: 6,
          shifts: 3,
        },
      },
    )

    expect(JSON.parse(serialized)).toMatchObject({
      guidedSetup: { steps: { roles: { note: "keep guided" } } },
      setup: {
        assumptions: "Copied assumptions",
        checklist: { staffingPlanDrafted: true },
      },
      copyPriorEvent: {
        sourceEventId: "comp_source",
        sourceEventName: "Spring Throwdown",
      },
    })
  })
})
