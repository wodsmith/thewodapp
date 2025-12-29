/**
 * Competition Schedule Route
 *
 * Organizer page for managing competition heat schedule.
 * Fetches venues, events, heats, divisions, and registrations in parallel.
 * Uses VenueManager and HeatScheduleManager components for full CRUD functionality.
 *
 * Port from apps/wodsmith/src/app/(compete)/compete/organizer/[competitionId]/(with-sidebar)/schedule/page.tsx
 */

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { SchedulePageClient } from "@/components/organizer/schedule/schedule-page-client"
import { getCompetitionByIdFn } from "@/server-fns/competition-detail-fns"
import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"
import {
	getCompetitionRegistrationsFn,
	getCompetitionVenuesFn,
	getHeatsForCompetitionFn,
} from "@/server-fns/competition-heats-fns"
import { getCompetitionWorkoutsFn } from "@/server-fns/competition-workouts-fns"

// Get parent route API to access competition data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute(
	"/compete/organizer/$competitionId/schedule",
)({
	component: SchedulePage,
	loader: async ({ params }) => {
		// First get competition to know the teamId
		const { competition } = await getCompetitionByIdFn({
			data: { competitionId: params.competitionId },
		})

		if (!competition) {
			throw new Error("Competition not found")
		}

		// Parallel fetch all data needed for the schedule page
		const [
			venuesResult,
			eventsResult,
			heatsResult,
			divisionsResult,
			registrationsResult,
		] = await Promise.all([
			getCompetitionVenuesFn({
				data: { competitionId: params.competitionId },
			}),
			getCompetitionWorkoutsFn({
				data: {
					competitionId: params.competitionId,
					teamId: competition.organizingTeamId,
				},
			}),
			getHeatsForCompetitionFn({
				data: { competitionId: params.competitionId },
			}),
			getCompetitionDivisionsWithCountsFn({
				data: {
					competitionId: params.competitionId,
					teamId: competition.organizingTeamId,
				},
			}),
			getCompetitionRegistrationsFn({
				data: { competitionId: params.competitionId },
			}),
		])

		return {
			venues: venuesResult.venues,
			events: eventsResult.workouts,
			heats: heatsResult.heats,
			divisions: divisionsResult.divisions,
			registrations: registrationsResult.registrations,
		}
	},
})

function SchedulePage() {
	const { venues, events, heats, divisions, registrations } =
		Route.useLoaderData()
	const { competitionId } = Route.useParams()

	// Get competition from parent route for startDate and organizingTeamId
	const { competition } = parentRoute.useLoaderData()

	return (
		<SchedulePageClient
			competitionId={competitionId}
			organizingTeamId={competition.organizingTeamId}
			competitionStartDate={competition.startDate}
			initialVenues={venues}
			events={events}
			initialHeats={heats}
			divisions={divisions}
			registrations={registrations}
		/>
	)
}
