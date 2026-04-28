import { describe, expect, it } from "vitest"
import {
  buildHeatScheduleCsvRows,
  groupHeatsByEvent,
  HEAT_SCHEDULE_CSV_HEADERS,
} from "@/lib/heat-schedule-export"
import type { HeatWithAssignments } from "@/server-fns/competition-heats-fns"
import type { CompetitionWorkout } from "@/server-fns/competition-workouts-fns"

// @lat: [[organizer-dashboard#Heat Scheduling#Heat schedule export]]

const baseWorkoutFields = {
  description: null,
  scheme: "time" as const,
  scoreType: "time" as const,
  roundsToScore: null,
  repsPerRound: null,
  tiebreakScheme: null,
  timeCap: null,
}

function makeEvent(
  overrides: Partial<CompetitionWorkout> & {
    id: string
    workoutName: string
    trackOrder: number
    parentEventId?: string | null
  },
): CompetitionWorkout {
  return {
    id: overrides.id,
    trackId: "track-1",
    workoutId: `w-${overrides.id}`,
    trackOrder: overrides.trackOrder,
    parentEventId: overrides.parentEventId ?? null,
    notes: null,
    pointsMultiplier: 100,
    heatStatus: "draft",
    eventStatus: "draft",
    sponsorId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    workout: {
      id: `w-${overrides.id}`,
      name: overrides.workoutName,
      ...baseWorkoutFields,
    },
  }
}

function makeHeat(overrides: {
  id: string
  trackWorkoutId: string
  heatNumber: number
  scheduledTime?: Date | null
  publishedAt?: Date | null
  venueName?: string | null
  divisionLabel?: string | null
  assignments?: Array<{
    laneNumber: number
    firstName: string
    lastName: string
    teamName?: string | null
    divisionLabel?: string | null
    affiliate?: string | null
  }>
}): HeatWithAssignments {
  return {
    id: overrides.id,
    competitionId: "comp-1",
    trackWorkoutId: overrides.trackWorkoutId,
    venueId: overrides.venueName ? "v-1" : null,
    heatNumber: overrides.heatNumber,
    scheduledTime: overrides.scheduledTime ?? null,
    durationMinutes: 10,
    divisionId: overrides.divisionLabel ? "d-h" : null,
    notes: null,
    schedulePublishedAt: overrides.publishedAt ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
    updateCounter: null,
    venue: overrides.venueName
      ? {
          id: "v-1",
          competitionId: "comp-1",
          name: overrides.venueName,
          laneCount: 4,
          transitionMinutes: 3,
          sortOrder: 0,
          addressId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          updateCounter: null,
        }
      : null,
    division: overrides.divisionLabel
      ? { id: "d-h", label: overrides.divisionLabel }
      : null,
    assignments: (overrides.assignments ?? []).map((a, i) => ({
      id: `a-${overrides.id}-${i}`,
      laneNumber: a.laneNumber,
      registration: {
        id: `r-${overrides.id}-${i}`,
        teamName: a.teamName ?? null,
        user: {
          id: `u-${i}`,
          firstName: a.firstName,
          lastName: a.lastName,
        },
        division: a.divisionLabel
          ? { id: "d-a", label: a.divisionLabel }
          : null,
        affiliate: a.affiliate ?? null,
      },
    })),
  }
}

describe("groupHeatsByEvent", () => {
  it("groups standalone events as single-member groups in trackOrder", () => {
    const events = [
      makeEvent({ id: "e2", workoutName: "Event B", trackOrder: 2 }),
      makeEvent({ id: "e1", workoutName: "Event A", trackOrder: 1 }),
    ]
    const heats = [
      makeHeat({ id: "h1", trackWorkoutId: "e1", heatNumber: 1 }),
      makeHeat({ id: "h2", trackWorkoutId: "e2", heatNumber: 1 }),
    ]
    const groups = groupHeatsByEvent(heats, events)
    expect(groups).toHaveLength(2)
    expect(groups[0].label).toBe("Event A")
    expect(groups[0].events).toHaveLength(1)
    expect(groups[1].label).toBe("Event B")
  })

  it("collapses sub-events of a parent into a single group with parent label", () => {
    const events = [
      makeEvent({ id: "p", workoutName: "Parent WOD", trackOrder: 1 }),
      makeEvent({
        id: "s1",
        workoutName: "Sub A",
        trackOrder: 2,
        parentEventId: "p",
      }),
      makeEvent({
        id: "s2",
        workoutName: "Sub B",
        trackOrder: 3,
        parentEventId: "p",
      }),
    ]
    const heats = [
      makeHeat({ id: "h-s1", trackWorkoutId: "s1", heatNumber: 1 }),
      makeHeat({ id: "h-s2", trackWorkoutId: "s2", heatNumber: 1 }),
    ]
    const groups = groupHeatsByEvent(heats, events)
    // Parent itself has no heats so it's omitted; sub-events form one group
    // labeled with the parent's name.
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe("Parent WOD")
    expect(groups[0].events.map((e) => e.name)).toEqual(["Sub A", "Sub B"])
    expect(groups[0].events.every((e) => e.parentEventName === "Parent WOD")).toBe(true)
  })

  it("sorts heats within an event by heatNumber", () => {
    const events = [makeEvent({ id: "e", workoutName: "E", trackOrder: 1 })]
    const heats = [
      makeHeat({ id: "h3", trackWorkoutId: "e", heatNumber: 3 }),
      makeHeat({ id: "h1", trackWorkoutId: "e", heatNumber: 1 }),
      makeHeat({ id: "h2", trackWorkoutId: "e", heatNumber: 2 }),
    ]
    const groups = groupHeatsByEvent(heats, events)
    expect(groups[0].events[0].heats.map((h) => h.heatNumber)).toEqual([
      1, 2, 3,
    ])
  })

  it("sorts assignments within a heat by laneNumber", () => {
    const events = [makeEvent({ id: "e", workoutName: "E", trackOrder: 1 })]
    const heats = [
      makeHeat({
        id: "h1",
        trackWorkoutId: "e",
        heatNumber: 1,
        assignments: [
          { laneNumber: 3, firstName: "C", lastName: "Three" },
          { laneNumber: 1, firstName: "A", lastName: "One" },
          { laneNumber: 2, firstName: "B", lastName: "Two" },
        ],
      }),
    ]
    const groups = groupHeatsByEvent(heats, events)
    expect(
      groups[0].events[0].heats[0].assignments.map((a) => a.laneNumber),
    ).toEqual([1, 2, 3])
  })
})

describe("buildHeatScheduleCsvRows", () => {
  it("emits one row per assignment with parent group + event columns", () => {
    const events = [
      makeEvent({ id: "p", workoutName: "Parent", trackOrder: 1 }),
      makeEvent({
        id: "s1",
        workoutName: "Sub A",
        trackOrder: 2,
        parentEventId: "p",
      }),
    ]
    const heats = [
      makeHeat({
        id: "h1",
        trackWorkoutId: "s1",
        heatNumber: 1,
        publishedAt: new Date("2025-01-01"),
        venueName: "Main Floor",
        divisionLabel: "Rx",
        assignments: [
          {
            laneNumber: 1,
            firstName: "Alice",
            lastName: "A",
            divisionLabel: "Rx Women",
            affiliate: "Affil",
          },
        ],
      }),
    ]
    const groups = groupHeatsByEvent(heats, events)
    const rows = buildHeatScheduleCsvRows(groups)
    expect(rows).toHaveLength(1)
    const [row] = rows
    // Header order is fixed; spot-check the meaningful columns.
    expect(row[0]).toBe("Parent") // Parent Event
    expect(row[1]).toBe("Sub A") // Event
    expect(row[2]).toBe("1") // Heat #
    expect(row[5]).toBe("Main Floor") // Venue
    expect(row[6]).toBe("Rx") // Heat Division
    expect(row[7]).toBe("1") // Lane
    expect(row[8]).toBe("Alice A") // Athlete / Team
    expect(row[9]).toBe("Rx Women") // Athlete Division
    expect(row[10]).toBe("Affil") // Affiliate
    expect(row[11]).toBe("Yes") // Published
  })

  it("emits a single placeholder row for empty heats and flags drafts", () => {
    const events = [makeEvent({ id: "e", workoutName: "E", trackOrder: 1 })]
    const heats = [
      makeHeat({
        id: "h1",
        trackWorkoutId: "e",
        heatNumber: 1,
        publishedAt: null,
        assignments: [],
      }),
    ]
    const groups = groupHeatsByEvent(heats, events)
    const rows = buildHeatScheduleCsvRows(groups)
    expect(rows).toHaveLength(1)
    expect(rows[0][7]).toBe("") // Lane blank
    expect(rows[0][8]).toBe("") // Athlete blank
    expect(rows[0][11]).toBe("No") // unpublished
  })

  it("prefers team name over athlete name when present", () => {
    const events = [makeEvent({ id: "e", workoutName: "E", trackOrder: 1 })]
    const heats = [
      makeHeat({
        id: "h1",
        trackWorkoutId: "e",
        heatNumber: 1,
        assignments: [
          {
            laneNumber: 1,
            firstName: "Alice",
            lastName: "A",
            teamName: "Team Awesome",
          },
        ],
      }),
    ]
    const rows = buildHeatScheduleCsvRows(groupHeatsByEvent(heats, events))
    expect(rows[0][8]).toBe("Team Awesome")
  })

  it("uses the headers constant length to anchor the row schema", () => {
    expect(HEAT_SCHEDULE_CSV_HEADERS).toHaveLength(13)
  })
})
