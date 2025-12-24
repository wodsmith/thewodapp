/**
 * Competition Events Route
 *
 * Organizer page for managing competition events (workouts).
 * Fetches events, divisions, movements, and sponsors in parallel.
 * Uses parent route loader data for competition data.
 */

import {createFileRoute, getRouteApi} from '@tanstack/react-router'
import {
  getCompetitionWorkoutsFn,
  getWorkoutDivisionDescriptionsFn,
} from '@/server-fns/competition-workouts-fns'
import {getCompetitionDivisionsWithCountsFn} from '@/server-fns/competition-divisions-fns'
import {getCompetitionByIdFn} from '@/server-fns/competition-detail-fns'
import {getAllMovementsFn} from '@/server-fns/movement-fns'
import {getCompetitionSponsorsFn} from '@/server-fns/sponsor-fns'
import {OrganizerEventManager} from '@/components/events/organizer-event-manager'
import {OrganizerBreadcrumb} from '@/components/organizer-breadcrumb'
import {CompetitionHeader} from '@/components/competition-header'

// Get parent route API to access its loader data
const parentRoute = getRouteApi('/compete/organizer/$competitionId')

export const Route = createFileRoute(
  '/compete/organizer/$competitionId/events/',
)({
  component: EventsPage,
  loader: async ({params}) => {
    // First get competition to know the teamId
    const {competition} = await getCompetitionByIdFn({
      data: {competitionId: params.competitionId},
    })

    if (!competition) {
      throw new Error('Competition not found')
    }

    // Parallel fetch events, divisions, movements, and sponsors
    const [eventsResult, divisionsResult, movementsResult, sponsorsResult] =
      await Promise.all([
        getCompetitionWorkoutsFn({
          data: {
            competitionId: params.competitionId,
            teamId: competition.organizingTeamId,
          },
        }),
        getCompetitionDivisionsWithCountsFn({
          data: {
            competitionId: params.competitionId,
            teamId: competition.organizingTeamId,
          },
        }),
        getAllMovementsFn(),
        getCompetitionSponsorsFn({
          data: {competitionId: params.competitionId},
        }),
      ])

    // Flatten sponsors from groups and ungrouped
    const allSponsors = [
      ...sponsorsResult.groups.flatMap((g) => g.sponsors),
      ...sponsorsResult.ungroupedSponsors,
    ]

    // Fetch division descriptions for all events
    const divisionIds = divisionsResult.divisions.map((d) => d.id)
    const divisionDescriptionsByWorkout: Record<
      string,
      Array<{
        divisionId: string
        divisionLabel: string
        description: string | null
      }>
    > = {}

    if (divisionIds.length > 0 && eventsResult.workouts.length > 0) {
      // Fetch descriptions for each workout in parallel
      const descriptionPromises = eventsResult.workouts.map(async (event) => {
        const result = await getWorkoutDivisionDescriptionsFn({
          data: {
            workoutId: event.workoutId,
            divisionIds,
          },
        })
        return {workoutId: event.workoutId, descriptions: result.descriptions}
      })

      const results = await Promise.all(descriptionPromises)
      for (const {workoutId, descriptions} of results) {
        divisionDescriptionsByWorkout[workoutId] = descriptions
      }
    }

    return {
      events: eventsResult.workouts,
      divisions: divisionsResult.divisions,
      movements: movementsResult.movements,
      sponsors: allSponsors,
      divisionDescriptionsByWorkout,
    }
  },
})

function EventsPage() {
  const {
    events,
    divisions,
    movements,
    sponsors,
    divisionDescriptionsByWorkout,
  } = Route.useLoaderData()
  // Get competition from parent layout loader data
  const {competition} = parentRoute.useLoaderData()

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Breadcrumb */}
      <OrganizerBreadcrumb
        segments={[
          {
            label: competition.name,
            href: `/compete/organizer/${competition.id}`,
          },
          {label: 'Events'},
        ]}
      />

      {/* Competition Header */}
      <CompetitionHeader
        competition={{
          id: competition.id,
          name: competition.name,
          slug: competition.slug,
          description: competition.description,
          startDate: competition.startDate,
          endDate: competition.endDate,
          registrationOpensAt: competition.registrationOpensAt,
          registrationClosesAt: competition.registrationClosesAt,
          visibility: competition.visibility,
          status: competition.status,
        }}
      />

      {/* Events Manager */}
      <OrganizerEventManager
        competitionId={competition.id}
        organizingTeamId={competition.organizingTeamId}
        events={events}
        movements={movements}
        divisions={divisions}
        divisionDescriptionsByWorkout={divisionDescriptionsByWorkout}
        sponsors={sponsors}
      />
    </div>
  )
}
