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
  | "/events/$eventId/volunteers"
  | "/events/$eventId/shifts"
  | "/events/$eventId/judges"
  | "/events/$eventId/heats"
  | "/events/$eventId/messages"
  | "/events/$eventId/day-of"
  | "/events/$eventId/exports"

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
    key: "heats",
    label: "Heats",
    to: "/events/$eventId/heats",
    persona: ["wodsmith_operator", "organizer_admin", "department_lead"],
  },
  {
    key: "staffing",
    label: "Staffing Plan",
    to: "/events/$eventId/staffing",
    persona: ["wodsmith_operator", "organizer_admin", "department_lead"],
  },
  {
    key: "volunteers",
    label: "Volunteers",
    to: "/events/$eventId/volunteers",
    persona: ["wodsmith_operator", "organizer_admin", "department_lead"],
  },
  {
    key: "shifts",
    label: "Volunteer Shifts",
    to: "/events/$eventId/shifts",
    persona: ["wodsmith_operator", "organizer_admin", "department_lead"],
  },
  {
    key: "judges",
    label: "Judge Assignments",
    to: "/events/$eventId/judges",
    persona: ["wodsmith_operator", "organizer_admin", "department_lead"],
  },
  {
    key: "confirmations",
    label: "Confirmations",
    to: "/events/$eventId/messages",
    persona: ["wodsmith_operator", "organizer_admin", "department_lead"],
  },
  {
    key: "event-day",
    label: "Event Day",
    to: "/events/$eventId/day-of",
    persona: ["wodsmith_operator", "organizer_admin", "department_lead"],
  },
  {
    key: "print-packet",
    label: "Print Packet",
    to: "/events/$eventId/exports",
    persona: ["wodsmith_operator", "organizer_admin", "department_lead"],
  },
] as const satisfies readonly CrewNavItem[]

export function getCrewEventNavItems({
  viewerRole,
}: CrewEventNavigationInput): readonly CrewNavItem[] {
  return CREW_EVENT_NAV_ITEMS.filter((item) =>
    canViewCrewNavItem(item, viewerRole),
  )
}

export function canViewCrewNavItem(
  item: CrewNavItem,
  viewerRole: CrewViewerRole,
) {
  if (!item.persona.includes(viewerRole)) return false
  if (viewerRole === "wodsmith_operator" && !item.hiddenWhenEmpty) return true

  return true
}
