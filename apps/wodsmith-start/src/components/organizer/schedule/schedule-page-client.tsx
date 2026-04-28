"use client"

import { useState } from "react"
import type { CompetitionVenue } from "@/db/schemas/competitions"
import type { HeatWithAssignments } from "@/server-fns/competition-heats-fns"
import type { CompetitionWorkout } from "@/server-fns/competition-workouts-fns"
import { ExportHeatScheduleButton } from "./export-heat-schedule-button"
import { HeatScheduleManager } from "./heat-schedule-manager"
import { VenuesSummary } from "./venues-summary"

interface Division {
  id: string
  label: string
  position: number
  registrationCount: number
  description: string | null
  feeCents: number | null
}

interface Registration {
  id: string
  teamName: string | null
  registeredAt: Date
  user: {
    id: string
    firstName: string | null
    lastName: string | null
  }
  division: {
    id: string
    label: string
  } | null
}

interface SchedulePageClientProps {
  competitionId: string
  organizingTeamId: string
  competitionSlug: string
  competitionName: string
  competitionStartDate: string | null // YYYY-MM-DD format
  initialVenues: CompetitionVenue[]
  events: CompetitionWorkout[]
  /**
   * Full event list including sub-events, used by exports that walk
   * heats → trackWorkoutId → event regardless of UI filtering.
   */
  allEvents: CompetitionWorkout[]
  initialHeats: HeatWithAssignments[]
  divisions: Division[]
  registrations: Registration[]
  heatScheduleOverrides?: Parameters<typeof HeatScheduleManager>[0]["overrides"]
  /** Base route prefix for navigation links (defaults to "/compete/organizer") */
  routePrefix?: string
}

export function SchedulePageClient({
  competitionId,
  organizingTeamId,
  competitionSlug,
  competitionName,
  competitionStartDate,
  initialVenues,
  events,
  allEvents,
  initialHeats,
  divisions,
  registrations,
  heatScheduleOverrides,
  routePrefix,
}: SchedulePageClientProps) {
  const [heats, setHeats] = useState(initialHeats)

  return (
    <div className="space-y-8">
      {/* Venues Summary */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Venues</h2>
        <VenuesSummary competitionId={competitionId} venues={initialVenues} routePrefix={routePrefix} />
      </section>

      {/* Heat Schedule Manager */}
      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Heat Schedule</h2>
          <ExportHeatScheduleButton
            competitionSlug={competitionSlug}
            competitionName={competitionName}
            heats={heats}
            allEvents={allEvents}
          />
        </div>
        <HeatScheduleManager
          competitionId={competitionId}
          organizingTeamId={organizingTeamId}
          competitionStartDate={competitionStartDate}
          events={events}
          venues={initialVenues}
          heats={heats}
          divisions={divisions}
          registrations={registrations}
          onHeatsChange={setHeats}
          overrides={heatScheduleOverrides}
        />
      </section>
    </div>
  )
}
