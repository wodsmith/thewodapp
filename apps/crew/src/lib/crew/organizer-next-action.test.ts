import { describe, expect, it } from "vitest"
import {
  type CrewOrganizerNextActionInput,
  deriveCrewOrganizerNextAction,
} from "./organizer-next-action"

describe("deriveCrewOrganizerNextAction", () => {
  // @lat: [[crew#Organizer Home Next Action]]
  it("points a new event at setup first", () => {
    expect(
      deriveCrewOrganizerNextAction({
        ...readyInput,
        setup: { completed: 0, total: 5 },
        roster: { total: 0, assignable: 0 },
        shifts: { totalShifts: 0, assignedSlots: 0, capacity: 0 },
      }),
    ).toEqual({ key: "finish_setup", ctaTo: "/setup" })
  })

  it("asks for a staffing plan after volunteers and heat schedule exist but shifts do not", () => {
    expect(
      deriveCrewOrganizerNextAction({
        ...readyInput,
        shifts: { totalShifts: 0, assignedSlots: 0, capacity: 0 },
      }),
    ).toEqual({ key: "build_staffing_plan", ctaTo: "/staffing" })
  })

  it("keeps incomplete coverage in assignments without requiring messages", () => {
    expect(
      deriveCrewOrganizerNextAction({
        ...readyInput,
        shifts: { totalShifts: 8, assignedSlots: 32, capacity: 40 },
        confirmations: {
          ...readyInput.confirmations,
          missing: 32,
          pending: 0,
          sent: 0,
          confirmed: 0,
        },
      }),
    ).toEqual({ key: "create_assignments", ctaTo: "/shifts" })
  })

  it("exports a filled schedule without requiring confirmations or event-day tracking", () => {
    expect(
      deriveCrewOrganizerNextAction({
        ...readyInput,
        shifts: { totalShifts: 8, assignedSlots: 40, capacity: 40 },
        confirmations: {
          ...readyInput.confirmations,
          sent: 20,
          confirmed: 12,
        },
      }),
    ).toEqual({ key: "print_packet", ctaTo: "/exports" })
  })
})

const readyInput: CrewOrganizerNextActionInput = {
  setup: { completed: 5, total: 5 },
  imports: {
    appliedVolunteerImportCount: 1,
    appliedHeatScheduleImportCount: 1,
  },
  roster: { total: 24, assignable: 24 },
  heatSchedule: { heatCount: 16, scheduledHeatCount: 16 },
  shifts: { totalShifts: 6, assignedSlots: 0, capacity: 32 },
  confirmations: {
    missing: 0,
    pending: 0,
    sent: 0,
    confirmed: 0,
    declined: 0,
    changeRequested: 0,
    noShow: 0,
    replaced: 0,
  },
  dayOfState: {
    hasActiveDayOfData: false,
    isComplete: false,
  },
}
