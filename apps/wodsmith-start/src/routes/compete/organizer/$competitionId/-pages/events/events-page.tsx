/**
 * Competition Events Page
 *
 * Shared page body for the organizer and cohost events list routes. The
 * organizer route passes series event template mapping status; the cohost
 * route injects cohost-permissioned mutation overrides and points event
 * links at the cohost event detail route.
 */

import type { ComponentProps } from "react"
import { OrganizerEventManager } from "@/components/events/organizer-event-manager"
import type { getCompetitionEventSeriesMappingStatusFn } from "@/server-fns/series-event-template-fns"

type EventManagerProps = ComponentProps<typeof OrganizerEventManager>

type SeriesMappingStatus = Awaited<
  ReturnType<typeof getCompetitionEventSeriesMappingStatusFn>
>

interface EventsPageProps {
  competitionId: string
  organizingTeamId: string
  events: EventManagerProps["events"]
  movements: EventManagerProps["movements"]
  divisions: EventManagerProps["divisions"]
  divisionDescriptionsByWorkout: EventManagerProps["divisionDescriptionsByWorkout"]
  sponsors: EventManagerProps["sponsors"]
  /** Organizer-only; cohosts cannot read series event template mappings. */
  seriesMappingStatus?: SeriesMappingStatus
  /** Cohost routes inject cohost-permissioned mutations. */
  overrides?: EventManagerProps["overrides"]
  /** Cohost routes point event links at the cohost event detail route. */
  eventDetailRoute?: EventManagerProps["eventDetailRoute"]
}

export function EventsPage({
  competitionId,
  organizingTeamId,
  events,
  movements,
  divisions,
  divisionDescriptionsByWorkout,
  sponsors,
  seriesMappingStatus,
  overrides,
  eventDetailRoute,
}: EventsPageProps) {
  // Build a lookup map from competition event ID -> template event name
  const seriesEventMap = new Map<string, string>()
  if (seriesMappingStatus?.hasTemplate) {
    for (const mapping of seriesMappingStatus.mappings) {
      seriesEventMap.set(mapping.competitionEventId, mapping.templateEventName)
    }
  }

  return (
    <OrganizerEventManager
      competitionId={competitionId}
      organizingTeamId={organizingTeamId}
      events={events}
      movements={movements}
      divisions={divisions}
      divisionDescriptionsByWorkout={divisionDescriptionsByWorkout}
      sponsors={sponsors}
      seriesName={
        seriesMappingStatus?.hasTemplate ? seriesMappingStatus.seriesName : null
      }
      seriesEventMap={seriesEventMap}
      overrides={overrides}
      eventDetailRoute={eventDetailRoute}
    />
  )
}
