/**
 * Competition Game Day Route
 *
 * Live competition day view showing real-time heat schedule,
 * current/upcoming heats, and event progress.
 */

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { GameDayTimeline } from "@/components/gameday/gameday-timeline"
import { getCompetitionByIdFn } from "@/server-fns/competition-detail-fns"
import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"
import {
	getCompetitionVenuesFn,
	getHeatsForCompetitionFn,
} from "@/server-fns/competition-heats-fns"
import { getCompetitionWorkoutsFn } from "@/server-fns/competition-workouts-fns"
import { getCompetitionSponsorsFn } from "@/server-fns/sponsor-fns"

// Get parent route API to access competition data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute(
	"/compete/organizer/$competitionId/gameday",
)({
	component: GameDayPage,
	loader: async ({ params }) => {
		// First get competition to know the teamId
		const { competition } = await getCompetitionByIdFn({
			data: { competitionId: params.competitionId },
		})

		if (!competition) {
			throw new Error("Competition not found")
		}

		// Parallel fetch all data needed for the game day view
		const [
			venuesResult,
			eventsResult,
			heatsResult,
			divisionsResult,
			sponsorsResult,
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
			getCompetitionSponsorsFn({
				data: { competitionId: params.competitionId },
			}),
		])

		// Flatten sponsors from groups and ungrouped
		const allSponsors = [
			...sponsorsResult.groups.flatMap((g) => g.sponsors),
			...sponsorsResult.ungroupedSponsors,
		]

		return {
			venues: venuesResult.venues,
			events: eventsResult.workouts,
			heats: heatsResult.heats,
			divisions: divisionsResult.divisions,
			sponsors: allSponsors,
		}
	},
})

function GameDayPage() {
	const { venues, events, heats, divisions, sponsors } = Route.useLoaderData()

	// Get competition from parent route
	const { competition } = parentRoute.useLoaderData()

	console.log("competition", competition)
	console.log("venues", venues)
	console.log("events", events)
	console.log("heats", heats)
	console.log("divisions", divisions)
	console.log("sponsors", sponsors)

	return (
		<GameDayTimeline
			competition={competition}
			venues={venues}
			events={events}
			heats={heats}
			divisions={divisions}
			sponsors={sponsors}
		/>
	)
}
