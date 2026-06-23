// @lat: [[crew#Event Setup Dashboard]]
export type CrewViewerRole =
  | "wodsmith_operator"
  | "organizer_admin"
  | "department_lead"
  | "volunteer_public"

// @lat: [[crew#Event Setup Dashboard]]
export type CrewEventNavRoute =
  | "/events/$eventId"
  | "/events/$eventId/staffing"
  | "/events/$eventId/setup"
  | "/events/$eventId/imports"
  | "/events/$eventId/shifts"
  | "/events/$eventId/day-of"
  | "/events/$eventId/exports"

// @lat: [[crew#Event Setup Dashboard]]
export type CrewEventRequirement =
  | "has_assignments"
  | "has_event_day_data"
  | "has_print_packet_data"

export interface CrewEventNavigationState {
  assignmentCount?: number
  shiftCount?: number
  hasEventDayData?: boolean
  hasPrintPacketData?: boolean
}

export interface CrewNavItem {
  key: string
  label: string
  to: CrewEventNavRoute
  persona: readonly CrewViewerRole[]
  requires?: readonly CrewEventRequirement[]
  hiddenWhenEmpty?: boolean
}

export interface CrewEventNavigationInput {
  viewerRole: CrewViewerRole
  state?: CrewEventNavigationState
}

export const CREW_EVENT_NAV_ITEMS = [
  {
    key: "home",
    label: "Home",
    to: "/events/$eventId",
    persona: ["wodsmith_operator", "organizer_admin", "department_lead"],
  },
  {
    key: "setup",
    label: "Setup",
    to: "/events/$eventId/setup",
    persona: ["wodsmith_operator", "organizer_admin", "department_lead"],
  },
  {
    key: "imports",
    label: "Imports",
    to: "/events/$eventId/imports",
    persona: ["wodsmith_operator", "organizer_admin"],
  },
  {
    key: "staffing",
    label: "Staffing Plan",
    to: "/events/$eventId/staffing",
    persona: ["wodsmith_operator", "organizer_admin", "department_lead"],
  },
  {
    key: "assignments",
    label: "Assignments",
    to: "/events/$eventId/shifts",
    persona: ["wodsmith_operator", "organizer_admin", "department_lead"],
  },
  {
    key: "confirmations",
    label: "Confirmations",
    to: "/events/$eventId/shifts",
    persona: ["wodsmith_operator", "organizer_admin", "department_lead"],
    requires: ["has_assignments"],
    hiddenWhenEmpty: true,
  },
  {
    key: "event-day",
    label: "Event Day",
    to: "/events/$eventId/day-of",
    persona: ["wodsmith_operator", "organizer_admin", "department_lead"],
    requires: ["has_event_day_data"],
    hiddenWhenEmpty: true,
  },
  {
    key: "print-packet",
    label: "Print Packet",
    to: "/events/$eventId/exports",
    persona: ["wodsmith_operator", "organizer_admin", "department_lead"],
    requires: ["has_print_packet_data"],
    hiddenWhenEmpty: true,
  },
] as const satisfies readonly CrewNavItem[]

export function getCrewEventNavItems({
  viewerRole,
  state = {},
}: CrewEventNavigationInput): readonly CrewNavItem[] {
  return CREW_EVENT_NAV_ITEMS.filter((item) =>
    canViewCrewNavItem(item, viewerRole, state),
  )
}

export function canViewCrewNavItem(
  item: CrewNavItem,
  viewerRole: CrewViewerRole,
  state: CrewEventNavigationState = {},
) {
  if (!item.persona.includes(viewerRole)) return false
  if (viewerRole === "wodsmith_operator") return true

  return (item.requires ?? []).every((requirement) =>
    crewEventRequirementIsMet(requirement, state),
  )
}

function crewEventRequirementIsMet(
  requirement: CrewEventRequirement,
  state: CrewEventNavigationState,
) {
  switch (requirement) {
    case "has_assignments":
      return hasAssignments(state)
    case "has_event_day_data":
      return state.hasEventDayData ?? hasAssignments(state)
    case "has_print_packet_data":
      return state.hasPrintPacketData ?? hasAssignments(state)
  }
}

function hasAssignments(state: CrewEventNavigationState) {
  return (state.assignmentCount ?? 0) > 0 || (state.shiftCount ?? 0) > 0
}
