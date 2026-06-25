// @lat: [[organizer-dashboard#Layout and Access Control]]
import { useMatches } from "@tanstack/react-router"
import {
	AGENT_IMPORT_ROUTE_KIND,
	type AgentImportRouteKind,
} from "@/db/schemas/agent-imports"

export interface PageIntent {
	routeKind: AgentImportRouteKind
	eventId?: string
	/** Human label for the drop overlay ("Drop to import to Volunteers"). */
	label: string
}

/**
 * Derive the file-drop intent from the active organizer route. Only the routes
 * the import agent can currently fulfill (volunteers + judges) enable the drop
 * affordance; events/event-detail are a later phase, so this returns null there
 * and the shell shows no overlay.
 */
export function usePageIntent(): PageIntent | null {
	const matches = useMatches()
	const last = matches[matches.length - 1]
	if (!last) return null

	const routeId = String(last.routeId)

	if (/\/volunteers\/judges\/?$/.test(routeId)) {
		return { routeKind: AGENT_IMPORT_ROUTE_KIND.JUDGES, label: "Judges" }
	}
	if (/\/volunteers\/?$/.test(routeId)) {
		return {
			routeKind: AGENT_IMPORT_ROUTE_KIND.VOLUNTEERS,
			label: "Volunteers",
		}
	}
	return null
}
