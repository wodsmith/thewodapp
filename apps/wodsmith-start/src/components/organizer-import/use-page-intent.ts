import { useMatches } from "@tanstack/react-router"
import type { AgentImportRouteKind } from "@/db/schemas/agent-imports"

export interface PageIntent {
  routeKind: AgentImportRouteKind
  eventId?: string
}

/**
 * Derive the file-drop intent from the active organizer route.
 *
 * Enabled on Volunteers and Judges (volunteer invites) and the Events list page
 * (event create). The event *detail* page is detected but deferred — single-event
 * updates need the inline-diff write path (see plan.md).
 */
export function usePageIntent(): PageIntent | null {
  const matches = useMatches()
  const last = matches[matches.length - 1]
  const routeId = (last?.routeId as string | undefined) ?? ""

  if (routeId.includes("/volunteers/judges")) {
    return { routeKind: "judges" }
  }
  if (routeId.includes("/volunteers")) {
    return { routeKind: "volunteers" }
  }
  // Event detail (single-event update) is deferred — no drop affordance yet.
  if (routeId.includes("/events/$eventId")) {
    return null
  }
  if (routeId.includes("/events")) {
    return { routeKind: "events" }
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
