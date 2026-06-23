// @lat: [[crew#Organizer Home Next Action]]
export type CrewOrganizerNextAction =
  | { key: "finish_setup"; ctaTo: "/setup" }
  | { key: "import_volunteers"; ctaTo: "/imports?tab=volunteers" }
  | { key: "import_heat_schedule"; ctaTo: "/imports?tab=heat_schedule" }
  | { key: "build_staffing_plan"; ctaTo: "/staffing" }
  | { key: "create_assignments"; ctaTo: "/assignments" }
  | { key: "send_confirmations"; ctaTo: "/messages" }
  | { key: "run_day_of"; ctaTo: "/day-of" }
  | { key: "print_packet"; ctaTo: "/exports" }

export interface CrewOrganizerNextActionInput {
  setup: {
    completed: number
    total: number
  }
  imports: {
    appliedVolunteerImportCount: number
    appliedHeatScheduleImportCount: number
  }
  roster: {
    total: number
    assignable: number
  }
  heatSchedule: {
    heatCount: number
    scheduledHeatCount: number
  }
  shifts: {
    totalShifts: number
    assignedSlots: number
    capacity: number
  }
  confirmations: {
    pending: number
    missing: number
    sent: number
    confirmed: number
    declined: number
    changeRequested: number
    noShow: number
    replaced: number
  }
  dayOfState: {
    hasActiveDayOfData: boolean
    isComplete: boolean
  }
}

export function deriveCrewOrganizerNextAction({
  setup,
  imports,
  roster,
  heatSchedule,
  shifts,
  confirmations,
  dayOfState,
}: CrewOrganizerNextActionInput): CrewOrganizerNextAction {
  if (setup.completed < setup.total) {
    return { key: "finish_setup", ctaTo: "/setup" }
  }

  if (
    imports.appliedVolunteerImportCount === 0 &&
    roster.total === 0 &&
    roster.assignable === 0
  ) {
    return { key: "import_volunteers", ctaTo: "/imports?tab=volunteers" }
  }

  if (
    imports.appliedHeatScheduleImportCount === 0 &&
    heatSchedule.heatCount === 0 &&
    heatSchedule.scheduledHeatCount === 0
  ) {
    return {
      key: "import_heat_schedule",
      ctaTo: "/imports?tab=heat_schedule",
    }
  }

  if (shifts.totalShifts === 0 || shifts.capacity === 0) {
    return { key: "build_staffing_plan", ctaTo: "/staffing" }
  }

  if (shifts.assignedSlots === 0) {
    return { key: "create_assignments", ctaTo: "/assignments" }
  }

  if (confirmations.missing > 0 || confirmations.pending > 0) {
    return { key: "send_confirmations", ctaTo: "/messages" }
  }

  if (!dayOfState.hasActiveDayOfData || !dayOfState.isComplete) {
    return { key: "run_day_of", ctaTo: "/day-of" }
  }

  return { key: "print_packet", ctaTo: "/exports" }
}
