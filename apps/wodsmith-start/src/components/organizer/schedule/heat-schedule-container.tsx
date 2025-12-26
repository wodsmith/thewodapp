import 'server-only'

// TODO: Import server functions when ported
// import {getCompetitionDivisionsWithCountsFn} from '@/server-fns/competition-divisions-fns'
// import {getCompetitionVenuesFn} from '@/server-fns/competition-venue-fns'
// import {getCompetitionRegistrationsFn} from '@/server-fns/competition-registrations-fns'
import {getHeatsForCompetitionFn} from '@/server-fns/competition-heats-fns'
import {getCompetitionWorkoutsFn} from '@/server-fns/competition-workouts-fns'
import {HeatScheduleManager} from './heat-schedule-manager'
import type {CompetitionVenue} from '@/db/schemas/competitions'

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

interface HeatScheduleContainerProps {
  competitionId: string
  organizingTeamId: string
  competitionStartDate: Date | null
  // Optional preloaded data
  venues?: CompetitionVenue[]
  divisions?: Division[]
  registrations?: Registration[]
}

export async function HeatScheduleContainer({
  competitionId,
  organizingTeamId,
  competitionStartDate,
  venues: providedVenues,
  divisions: providedDivisions,
  registrations: providedRegistrations,
}: HeatScheduleContainerProps) {
  // Fetch data in parallel
  const [eventsResult, heatsResult] = await Promise.all([
    getCompetitionWorkoutsFn({
      data: {competitionId, teamId: organizingTeamId},
    }),
    getHeatsForCompetitionFn({data: {competitionId}}),
  ])

  const events = eventsResult.workouts
  const heats = heatsResult.heats

  // Use provided data or empty arrays
  // TODO: Fetch these when server functions are ported
  const venues = providedVenues ?? []
  const divisions = providedDivisions ?? []
  const registrations = providedRegistrations ?? []

  return (
    <HeatScheduleManager
      competitionId={competitionId}
      organizingTeamId={organizingTeamId}
      competitionStartDate={competitionStartDate}
      events={events}
      venues={venues}
      heats={heats}
      divisions={divisions}
      registrations={registrations}
    />
  )
}
