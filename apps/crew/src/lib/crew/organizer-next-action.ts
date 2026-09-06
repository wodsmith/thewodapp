// @lat: [[crew#Organizer Home Next Action]]
export type CrewOrganizerNextAction =
  | { key: "finish_setup"; ctaTo: "/setup" }
  | { key: "import_volunteers"; ctaTo: "/volunteers" }
  | { key: "import_heat_schedule"; ctaTo: "/heats" }
  | { key: "build_staffing_plan"; ctaTo: "/staffing" }
  | { key: "create_assignments"; ctaTo: "/shifts" }
  | { key: "print_packet"; ctaTo: "/exports" }

export interface CrewOrganizerNextActionInput {
  setup: {
    completed: number
    total: number
  }
  roster: {
    total: number
    assignable: number
  }
  shifts: {
    totalShifts: number
    assignedSlots: number
    capacity: number
  }
}

export function deriveCrewOrganizerNextAction({
  setup,
  roster,
  shifts,
}: CrewOrganizerNextActionInput): CrewOrganizerNextAction {
  if (setup.completed < setup.total) {
    return { key: "finish_setup", ctaTo: "/setup" }
  }

  if (roster.total === 0 && roster.assignable === 0) {
    return { key: "import_volunteers", ctaTo: "/volunteers" }
  }

  if (shifts.totalShifts === 0 || shifts.capacity === 0) {
    return { key: "build_staffing_plan", ctaTo: "/staffing" }
  }

  if (shifts.assignedSlots < shifts.capacity) {
    return { key: "create_assignments", ctaTo: "/shifts" }
  }

  return { key: "print_packet", ctaTo: "/exports" }
}
