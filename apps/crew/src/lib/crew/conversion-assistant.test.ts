// @lat: [[crew#Full WODsmith Conversion Assistant]]
import { describe, expect, it } from "vitest"
import { CREW_BILLING_STATE } from "../../db/schemas/crew-event-settings"
import type { CrewReadinessPageData } from "../../server/crew-readiness.server"
import {
  buildCrewConversionAssistantViewModel,
  type BuildCrewConversionAssistantInput,
} from "./conversion-assistant"

describe("Crew conversion assistant view model", () => {
  it("keeps conversion read-only and assumes the existing competition is reused", () => {
    const viewModel = buildCrewConversionAssistantViewModel(readyInput)

    expect(viewModel.conversion).toMatchObject({
      status: "privacy_reviewed",
      label: "Privacy reviewed",
      readOnly: true,
      duplicateCompetition: false,
    })
    expect(
      viewModel.preservation.items.find((item) => item.key === "competition"),
    ).toMatchObject({
      status: "ready",
      summary: "Reuses comp_123.",
      details: expect.arrayContaining([
        "No second competition is created by this assistant.",
      ]),
    })
  })

  it("detects missing full-WODsmith setup before athlete registration can launch", () => {
    const viewModel = buildCrewConversionAssistantViewModel({
      ...readyInput,
      event: {
        ...readyInput.event,
        status: "draft",
        registrationOpensAt: null,
        registrationClosesAt: null,
        settings: null,
        defaultRegistrationFeeCents: 0,
      },
      team: {
        ...readyInput.team,
        stripeAccountStatus: null,
      },
      counts: {
        ...readyInput.counts,
        divisionCount: 0,
        divisionFeeCount: 0,
        paidDivisionCount: 0,
        athleteWaiverCount: 0,
        activeRegistrationCount: 0,
      },
    })

    expect(viewModel.fullSetup.summary).toMatchObject({
      total: 8,
      ready: 0,
      blocked: 6,
      highestStatus: "blocked",
    })
    expect(statusesByKey(viewModel.fullSetup.items)).toMatchObject({
      divisions: "blocked",
      registration_window: "blocked",
      pricing: "blocked",
      scoring: "needs_attention",
      public_page: "blocked",
      waivers: "blocked",
      payouts: "needs_attention",
      athlete_registration: "blocked",
    })
  })

  it("marks athlete registration ready when full setup is complete without requiring registrations to already exist", () => {
    const viewModel = buildCrewConversionAssistantViewModel(readyInput)

    expect(viewModel.fullSetup.summary).toMatchObject({
      total: 8,
      ready: 8,
      blocked: 0,
      highestStatus: "ready",
    })
    expect(
      viewModel.fullSetup.items.find(
        (item) => item.key === "athlete_registration",
      ),
    ).toMatchObject({
      status: "ready",
      summary: "Registration prerequisites are ready.",
      action: {
        href: "https://wodsmith.com/compete/summer-throwdown/register",
        kind: "public_route",
      },
    })
  })

  it("reports partial division fee coverage without mirroring the division count", () => {
    const viewModel = buildCrewConversionAssistantViewModel({
      ...readyInput,
      counts: {
        ...readyInput.counts,
        divisionCount: 4,
        divisionFeeCount: 2,
        paidDivisionCount: 2,
      },
    })

    expect(
      viewModel.fullSetup.items.find((item) => item.key === "pricing"),
    ).toMatchObject({
      status: "ready",
      details: expect.arrayContaining([
        "2/4 divisions have configured paid fees.",
      ]),
    })
  })

  it("preserves Crew inventory with aggregate counts only", () => {
    const viewModel = buildCrewConversionAssistantViewModel(readyInput)
    const serialized = JSON.stringify(viewModel)

    expect(statusesByKey(viewModel.preservation.items)).toMatchObject({
      volunteers: "ready",
      shifts: "ready",
      heat_schedule: "ready",
      judge_assignments: "ready",
      confirmations: "ready",
      imports: "ready",
      credits: "ready",
    })
    expect(serialized).toContain("16 volunteers")
    expect(serialized).toContain("Full-platform credit is recorded.")
    expect(serialized).not.toContain("sam@example.com")
    expect(serialized).not.toContain("555-")
    expect(serialized).not.toContain("cs_test")
    expect(serialized).not.toContain("pi_test")
    expect(serialized).not.toContain("internal organizer note")
  })

  it("keeps safe links on existing Crew and WODsmith surfaces", () => {
    const viewModel = buildCrewConversionAssistantViewModel(readyInput)

    expect(
      viewModel.fullSetup.items.find((item) => item.key === "divisions")
        ?.action,
    ).toMatchObject({
      href: "https://wodsmith.com/compete/organizer/comp_123/divisions",
      kind: "wodsmith_route",
    })
    expect(
      viewModel.preservation.items.find((item) => item.key === "volunteers")
        ?.action,
    ).toMatchObject({
      href: "/events/comp_123/volunteers",
      kind: "crew_route",
    })
  })
})

function statusesByKey(items: Array<{ key: string; status: string }>) {
  return Object.fromEntries(items.map((item) => [item.key, item.status]))
}

const readyInput: BuildCrewConversionAssistantInput = {
  event: {
    id: "comp_123",
    name: "Summer Throwdown",
    slug: "summer-throwdown",
    crewOnly: true,
    status: "published",
    visibility: "public",
    registrationOpensAt: "2026-07-01",
    registrationClosesAt: "2026-08-01",
    defaultRegistrationFeeCents: 12000,
    settings: JSON.stringify({
      scoringConfig: { algorithm: "points", tiebreakers: [] },
    }),
  },
  team: {
    slug: "summit-gym",
    stripeAccountStatus: "VERIFIED",
  },
  counts: {
    divisionCount: 4,
    divisionFeeCount: 4,
    paidDivisionCount: 4,
    athleteWaiverCount: 1,
    activeRegistrationCount: 0,
  },
  readiness: readyReadinessFixture(),
  billing: {
    state: CREW_BILLING_STATE.PAID,
    planId: "crew_pro",
    creditCents: 0,
    fullPlatformCreditCents: 50000,
  },
  conversionStatus: "privacy_reviewed",
  links: {
    crewEvent: "/events/comp_123",
    crewSetup: "/events/comp_123/setup",
    crewImports: "/events/comp_123/imports",
    crewVolunteers: "/events/comp_123/volunteers",
    crewShifts: "/events/comp_123/shifts",
    crewJudges: "/events/comp_123/judges",
    crewBilling: "/events/comp_123/billing",
    wodsmithOverview: "https://wodsmith.com/compete/organizer/comp_123",
    wodsmithDivisions:
      "https://wodsmith.com/compete/organizer/comp_123/divisions",
    wodsmithEdit: "https://wodsmith.com/compete/organizer/comp_123/edit",
    wodsmithPricing:
      "https://wodsmith.com/compete/organizer/comp_123/pricing",
    wodsmithScoring:
      "https://wodsmith.com/compete/organizer/comp_123/scoring",
    wodsmithWaivers:
      "https://wodsmith.com/compete/organizer/comp_123/waivers",
    wodsmithRevenue:
      "https://wodsmith.com/compete/organizer/comp_123/revenue",
    wodsmithPayouts:
      "https://wodsmith.com/compete/organizer/settings/payouts/summit-gym",
    publicPage: "https://wodsmith.com/compete/summer-throwdown",
    athleteRegistration:
      "https://wodsmith.com/compete/summer-throwdown/register",
  },
}

function readyReadinessFixture(): CrewReadinessPageData {
  return {
    readiness: {
      items: [],
      summary: {
        total: 7,
        ready: 7,
        needsAttention: 0,
        blocked: 0,
        progressPercent: 100,
        highestStatus: "ready",
      },
    },
    facts: {
      setup: {
        completed: 5,
        total: 5,
        percent: 100,
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
        assignedSlots: 8,
        capacity: 8,
        openSlots: 0,
        confirmationSummary: {
          pending: 0,
          confirmed: 8,
          declined: 0,
          changeRequested: 0,
          noShow: 0,
          cancelled: 0,
        },
        confirmationOperationalSummary: {
          missing: 0,
          pending: 0,
          sent: 0,
          confirmed: 8,
          declined: 0,
          changeRequested: 0,
          noShow: 0,
          replaced: 0,
          total: 8,
          responseNeeded: 0,
          organizerActionNeeded: 0,
        },
      },
      judge: {
        rotationCount: 4,
        assignmentCount: 28,
        activeVersionCount: 1,
      },
    },
  }
}
