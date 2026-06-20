// @lat: [[crew#Guided Setup State]]
import { describe, expect, it } from "vitest"
import type { CrewSetupState } from "../crew-event-setup"
import type { CrewReadinessChecklist } from "./readiness"
import {
  buildCrewGuidedSetupState,
  parseCrewGuidedSetupSettings,
  serializeCrewGuidedSetupSettings,
  updateCrewGuidedSetupStepState,
  type CrewGuidedSetupFacts,
  type CrewGuidedSetupPersistedState,
} from "./guided-setup"

describe("Crew guided setup state", () => {
  it("derives complete self-serve steps from ready event facts", () => {
    const guidedSetup = buildCrewGuidedSetupState({
      event: readyEvent,
      setup: readySetup,
      facts: readyFacts,
      readiness: readyReadiness,
      persisted: emptyPersisted,
    })

    expect(guidedSetup.summary).toMatchObject({
      total: 8,
      complete: 8,
      blocked: 0,
      inProgress: 0,
      notStarted: 0,
      progressPercent: 100,
      highestStatus: "complete",
    })
    expect(guidedSetup.steps.map((step) => step.key)).toEqual([
      "event_basics",
      "days_floors",
      "imports",
      "roles",
      "staffing_assumptions",
      "schedule_publish",
      "reminders",
      "exports",
    ])
  })

  it("keeps source-derived blockers blocked even when an operator marks complete", () => {
    const guidedSetup = buildCrewGuidedSetupState({
      event: { startDate: "", endDate: "", timezone: null },
      setup: readySetup,
      facts: {
        ...readyFacts,
        venues: { venueCount: 0, totalLaneCount: 0 },
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
          ...readyFacts.shifts,
          assignedSlots: 0,
        },
      },
      readiness: {
        items: [],
        summary: {
          total: 7,
          ready: 2,
          needsAttention: 1,
          blocked: 4,
          progressPercent: 29,
          highestStatus: "blocked",
        },
      },
      persisted: {
        activeStep: "event_basics",
        steps: {
          event_basics: {
            status: "complete",
            note: "Confirmed elsewhere.",
            updatedAt: "2026-06-20T17:00:00.000Z",
          },
        },
      },
    })

    expect(guidedSetup.steps[0]).toMatchObject({
      key: "event_basics",
      status: "blocked",
      systemStatus: "blocked",
      operatorStatus: "complete",
      note: "Confirmed elsewhere.",
    })
    expect(guidedSetup.summary.highestStatus).toBe("blocked")
  })

  it("keeps days and floors blocked when venue rows have no lane capacity", () => {
    const guidedSetup = buildCrewGuidedSetupState({
      event: readyEvent,
      setup: readySetup,
      facts: {
        ...readyFacts,
        venues: { venueCount: 1, totalLaneCount: 0 },
      },
      readiness: readyReadiness,
      persisted: {
        activeStep: "days_floors",
        steps: {
          days_floors: {
            status: "complete",
            note: "Floor walkthrough is done.",
            updatedAt: "2026-06-20T18:00:00.000Z",
          },
        },
      },
    })

    expect(
      guidedSetup.steps.find((step) => step.key === "days_floors"),
    ).toMatchObject({
      status: "blocked",
      systemStatus: "blocked",
      operatorStatus: "complete",
      summary: "1 venue, 0 lanes",
      note: "Floor walkthrough is done.",
    })
    expect(guidedSetup.summary).toMatchObject({
      complete: 7,
      blocked: 1,
      highestStatus: "blocked",
    })
  })

  it("updates and serializes guided step progress without replacing setup settings", () => {
    const persisted = updateCrewGuidedSetupStepState(emptyPersisted, {
      stepKey: "imports",
      status: "in_progress",
      note: "Awaiting heat CSV.",
      updatedAt: "2026-06-20T17:30:00.000Z",
    })
    const settingsText = serializeCrewGuidedSetupSettings(
      JSON.stringify({
        setup: {
          staffingLead: "Sam",
          checklist: { staffingPlanDrafted: true },
        },
        arbitrary: { keep: true },
      }),
      persisted,
    )
    const parsed = JSON.parse(settingsText)

    expect(parsed.setup.staffingLead).toBe("Sam")
    expect(parsed.arbitrary.keep).toBe(true)
    expect(parsed.guidedSetup).toMatchObject({
      activeStep: "imports",
      steps: {
        imports: {
          status: "in_progress",
          note: "Awaiting heat CSV.",
          updatedAt: "2026-06-20T17:30:00.000Z",
        },
      },
    })
    expect(parseCrewGuidedSetupSettings(settingsText)).toMatchObject(persisted)
  })
})

const emptyPersisted: CrewGuidedSetupPersistedState = {
  activeStep: null,
  steps: {},
}

const readyEvent = {
  startDate: "2026-08-14",
  endDate: "2026-08-15",
  timezone: "America/Denver",
}

const readySetup: CrewSetupState = {
  desiredGoLiveDate: "2026-08-01",
  sourceContactName: "Taylor",
  sourceContactEmail: "taylor@example.com",
  volunteerTarget: "32",
  staffingLead: "Sam",
  checklist: {
    eventBasicsConfirmed: true,
    sourceAccessConfirmed: true,
    volunteerNeedsDrafted: true,
    staffingPlanDrafted: true,
    operatorHandoffReady: true,
  },
  internalNotes: "Use the east entrance.",
  assumptions: "Two floors, one floater per lane.",
}

const readyFacts: CrewGuidedSetupFacts = {
  setup: {
    completed: 5,
    total: 5,
  },
  venues: {
    venueCount: 2,
    totalLaneCount: 12,
  },
  schedule: {
    workoutCount: 4,
    publishedWorkoutCount: 4,
    heatCount: 24,
    scheduledHeatCount: 24,
    publishedHeatCount: 24,
  },
  imports: {
    volunteerImportCount: 1,
    appliedVolunteerImportCount: 1,
    heatScheduleImportCount: 1,
    appliedHeatScheduleImportCount: 1,
  },
  roster: {
    total: 18,
    pending: 2,
    accepted: 0,
    active: 16,
    inactive: 0,
    expired: 0,
    assignable: 16,
  },
  shifts: {
    totalShifts: 8,
    assignedSlots: 12,
    capacity: 12,
    openSlots: 0,
    confirmationSummary: {
      pending: 0,
      confirmed: 12,
      declined: 0,
      changeRequested: 0,
      noShow: 0,
      cancelled: 0,
    },
    confirmationOperationalSummary: {
      missing: 0,
      pending: 0,
      sent: 0,
      confirmed: 12,
      declined: 0,
      changeRequested: 0,
      noShow: 0,
      replaced: 0,
      total: 12,
      responseNeeded: 0,
      organizerActionNeeded: 0,
    },
  },
  judge: {
    rotationCount: 4,
    assignmentCount: 36,
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
