import { useMatches } from "@tanstack/react-router"
import type { AgentImportRouteKind } from "@/db/schemas/agent-imports"

export interface PageIntent {
  routeKind: AgentImportRouteKind
  eventId?: string
}

/**
 * Derive the file-drop intent from the active organizer route.
 *
 * MVP only enables the drop on the Volunteers and Judges pages (the volunteer
 * write path). Events / event detail are detected but return `null` until the
 * event write path lands — see plan.md Phase 9.
 */
export function usePageIntent(): PageIntent | null {
  const matches = useMatches()
  const last = matches[matches.length - 1]
  const routeId = (last?.routeId as string | undefined) ?? ""
  const params = (last?.params as { eventId?: string } | undefined) ?? {}

  if (routeId.includes("/volunteers/judges")) {
    return { routeKind: "judges" }
  }
  if (routeId.includes("/volunteers")) {
    return { routeKind: "volunteers" }
  }
  // Detected but not yet drop-enabled (review/apply for events is a follow-up).
  if (routeId.includes("/events/$eventId")) {
    return params.eventId
      ? null // { routeKind: "event_detail", eventId: params.eventId }
      : null
  }
  return null
}

/** Human label for the drop overlay / drawer header. */
export function routeKindLabel(routeKind: AgentImportRouteKind): string {
  switch (routeKind) {
    case "judges":
      return "Judges"
    case "volunteers":
      return "Volunteers"
    case "events":
      return "Events"
    case "event_detail":
      return "this event"
  }
}
