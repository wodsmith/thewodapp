// @lat: [[crew#Pilot Readiness Checklist]]
import { describe, expect, it } from "vitest"
import { buildCrewReadinessChecklist } from "./readiness"
import type { CrewReadinessInput } from "./readiness"

describe("Crew readiness checklist", () => {
  it("marks a fully prepared pilot event ready except the manual judge checkpoint", () => {
    const checklist = buildCrewReadinessChecklist({
      ...readyInput,
      judge: {
        rotationCount: 0,
        assignmentCount: 0,
        activeVersionCount: 0,
      },
    })

    expect(checklist.summary).toMatchObject({
      total: 7,
      ready: 6,
      needsAttention: 1,
      blocked: 0,
      highestStatus: "needs_attention",
    })
    expect(
      checklist.items.find((item) => item.category === "judge_publishing"),
    ).toMatchObject({
      status: "needs_attention",
      summary: "Judge rotation publishing is not ready in Crew yet.",
    })
  })

  it("blocks readiness when core event, venue, heat, roster, or shift data is missing", () => {
    const checklist = buildCrewReadinessChecklist({
      ...readyInput,
      event: { startDate: "", endDate: "", timezone: null },
      venues: { venueCount: 0, totalLaneCount: 0 },
      schedule: {
        workoutCount: 1,
        publishedWorkoutCount: 1,
        heatCount: 0,
        scheduledHeatCount: 0,
        publishedHeatCount: 0,
      },
      roster: {
        total: 0,
        pending: 0,
        accepted: 0,
        active: 0,
        inactive: 0,
        expired: 0,
        assignable: 0,
      },
      shifts: {
        ...readyInput.shifts,
        totalShifts: 0,
        assignedSlots: 0,
        capacity: 0,
        openSlots: 0,
      },
    })

    expect(checklist.summary.blocked).toBe(5)
    expect(checklist.summary.highestStatus).toBe("blocked")
    expect(
      checklist.items
        .filter((item) => item.status === "blocked")
        .map((item) => item.category),
    ).toEqual([
      "event_basics",
      "venues_lanes",
      "workouts_heats",
      "volunteers",
      "shifts_assignments",
    ])
  })

  it("surfaces no-response, decline, and change-request confirmation counts", () => {
    const checklist = buildCrewReadinessChecklist({
      ...readyInput,
      shifts: {
        ...readyInput.shifts,
        confirmationSummary: {
          pending: 2,
          confirmed: 3,
          declined: 1,
          changeRequested: 1,
          noShow: 0,
          cancelled: 0,
        },
        confirmationOperationalSummary: {
          missing: 0,
          pending: 2,
          sent: 0,
          confirmed: 3,
          declined: 1,
          changeRequested: 1,
          noShow: 0,
          replaced: 0,
          total: 7,
          responseNeeded: 2,
          organizerActionNeeded: 4,
        },
      },
    })

    expect(
      checklist.items.find(
        (item) => item.category === "assignment_confirmations",
      ),
    ).toMatchObject({
      status: "needs_attention",
      summary: "3/7 assignments confirmed",
      details: [
        "2 not sent.",
        "0 sent.",
        "1 declined.",
        "1 change requested.",
        "0 no-show.",
        "0 replaced.",
      ],
    })
  })

  it("keeps workout and heat readiness attention-worthy until workouts are published", () => {
    const checklist = buildCrewReadinessChecklist({
      ...readyInput,
      schedule: {
        ...readyInput.schedule,
        publishedWorkoutCount: 3,
      },
    })

    expect(
      checklist.items.find((item) => item.category === "workouts_heats"),
    ).toMatchObject({
      status: "needs_attention",
      summary: "3/4 workouts published, 20 heats",
    })
  })
})

const readyInput: CrewReadinessInput = {
  event: {
    startDate: "2026-07-10",
    endDate: "2026-07-11",
    timezone: "America/Denver",
  },
  setup: {
    completed: 5,
    total: 5,
  },
  venues: {
    venueCount: 2,
    totalLaneCount: 14,
  },
  schedule: {
    workoutCount: 4,
    publishedWorkoutCount: 4,
    heatCount: 20,
    scheduledHeatCount: 20,
    publishedHeatCount: 20,
  },
  imports: {
    volunteerImportCount: 1,
    appliedVolunteerImportCount: 1,
    heatScheduleImportCount: 1,
    appliedHeatScheduleImportCount: 1,
  },
  roster: {
    total: 16,
    pending: 2,
    accepted: 0,
    active: 14,
    inactive: 0,
    expired: 0,
    assignable: 14,
  },
  shifts: {
    totalShifts: 5,
    assignedSlots: 7,
    capacity: 7,
    openSlots: 0,
    confirmationSummary: {
      pending: 0,
      confirmed: 7,
      declined: 0,
      changeRequested: 0,
      noShow: 0,
      cancelled: 0,
    },
    confirmationOperationalSummary: {
      missing: 0,
      pending: 0,
      sent: 0,
      confirmed: 7,
      declined: 0,
      changeRequested: 0,
      noShow: 0,
      replaced: 0,
      total: 7,
      responseNeeded: 0,
      organizerActionNeeded: 0,
    },
  },
  judge: {
    rotationCount: 4,
    assignmentCount: 28,
    activeVersionCount: 1,
  },
}
