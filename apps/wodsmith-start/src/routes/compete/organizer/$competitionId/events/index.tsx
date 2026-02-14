/**
 * Competition Events Route
 *
 * Organizer page for managing competition events (workouts).
 * Fetches events, divisions, movements, and sponsors in parallel.
 * Uses parent route loader data for competition data.
 */

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { OrganizerEventManager } from "@/components/events/organizer-event-manager"
import { getCompetitionByIdFn } from "@/server-fns/competition-detail-fns"
import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"
import {
	getBatchWorkoutDivisionDescriptionsFn,
	getCompetitionWorkoutsFn,
} from "@/server-fns/competition-workouts-fns"
import { getAllMovementsFn } from "@/server-fns/movement-fns"
import { getCompetitionSponsorsFn } from "@/server-fns/sponsor-fns"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute(
	"/compete/organizer/$competitionId/events/",
)({
	component: EventsPage,
	loader: async ({ params }) => {
		// First get competition to know the teamId
		const { competition } = await getCompetitionByIdFn({
			data: { competitionId: params.competitionId },
		})

		if (!competition) {
			throw new Error("Competition not found")
		}

		// Parallel fetch events, divisions, movements, sponsors
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
					data: { competitionId: params.competitionId },
				}),
			])

		// Flatten sponsors from groups and ungrouped
		const allSponsors = [
			...sponsorsResult.groups.flatMap((g) => g.sponsors),
			...sponsorsResult.ungroupedSponsors,
		]

		// Batch fetch division descriptions for all events in a single call
		const divisionIds = divisionsResult.divisions.map((d) => d.id)
		let divisionDescriptionsByWorkout: Record<
			string,
			Array<{
				divisionId: string
				divisionLabel: string
				description: string | null
			}>
		> = {}

		if (divisionIds.length > 0 && eventsResult.workouts.length > 0) {
			const workoutIds = eventsResult.workouts.map((e) => e.workoutId)
			const result = await getBatchWorkoutDivisionDescriptionsFn({
				data: { workoutIds, divisionIds },
			})
			divisionDescriptionsByWorkout = result.descriptionsByWorkout
		}

		return {
			events: eventsResult.workouts,
			divisions: divisionsResult.divisions,
			movements: movementsResult.movements,
			sponsors: allSponsors,
			divisionDescriptionsByWorkout,
			competition,
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
	// Get competition from parent layout loader data (for consistency with other pages)
	const { competition } = parentRoute.useLoaderData()

	return (
		<OrganizerEventManager
			competitionId={competition.id}
			organizingTeamId={competition.organizingTeamId}
			events={events}
			movements={movements}
			divisions={divisions}
			divisionDescriptionsByWorkout={divisionDescriptionsByWorkout}
			sponsors={sponsors}
		/>
	)
}
