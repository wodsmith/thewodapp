/**
 * Competition Schedule Page
 *
 * Shared page body for the organizer and cohost schedule routes. Renders the
 * venues summary and heat schedule manager via `SchedulePageClient`. The
 * cohost route injects cohost-permissioned heat schedule overrides and a
 * cohost route prefix for navigation links.
 */

import type { ComponentProps } from "react"
import { SchedulePageClient } from "@/components/organizer/schedule/schedule-page-client"

type SchedulePageClientProps = ComponentProps<typeof SchedulePageClient>

interface SchedulePageProps {
  competitionId: string
  organizingTeamId: string
  competitionStartDate: SchedulePageClientProps["competitionStartDate"]
  venues: SchedulePageClientProps["initialVenues"]
  events: SchedulePageClientProps["events"]
  heats: SchedulePageClientProps["initialHeats"]
  divisions: SchedulePageClientProps["divisions"]
  registrations: SchedulePageClientProps["registrations"]
  /** Cohost routes inject cohost-permissioned heat mutations. */
  heatScheduleOverrides?: SchedulePageClientProps["heatScheduleOverrides"]
  /** Cohost routes point navigation links at the cohost tree. */
  routePrefix?: SchedulePageClientProps["routePrefix"]
}

export function SchedulePage({
  competitionId,
  organizingTeamId,
  competitionStartDate,
  venues,
  events,
  heats,
  divisions,
  registrations,
  heatScheduleOverrides,
  routePrefix,
}: SchedulePageProps) {
  return (
    <SchedulePageClient
      competitionId={competitionId}
      organizingTeamId={organizingTeamId}
      competitionStartDate={competitionStartDate}
      initialVenues={venues}
      events={events}
      initialHeats={heats}
      divisions={divisions}
      registrations={registrations}
      heatScheduleOverrides={heatScheduleOverrides}
      routePrefix={routePrefix}
    />
  )
}
