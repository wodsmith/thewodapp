/**
 * Competition Event Layout Route
 *
 * Layout wrapper for event sub-routes (edit, submissions).
 * Renders an Outlet so child routes display correctly.
 */

import { Outlet, createFileRoute } from "@tanstack/react-router"
import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"
import { getCompetitionEventsFn } from "@/server-fns/competition-event-fns"
import {
	getCompetitionEventFn,
	getWorkoutDivisionDescriptionsFn,
} from "@/server-fns/competition-workouts-fns"
import { getEventResourcesFn } from "@/server-fns/event-resources-fns"
import { getEventJudgingSheetsFn } from "@/server-fns/judging-sheet-fns"
import { getAllMovementsFn } from "@/server-fns/movement-fns"
import { getCompetitionSponsorsFn } from "@/server-fns/sponsor-fns"

export const Route = createFileRoute(
	"/compete/organizer/$competitionId/events/$eventId",
)({
	staleTime: 10_000,
	component: EventLayout,
	loader: async ({ params, parentMatchPromise }) => {
		const parentMatch = await parentMatchPromise
		const { competition } = parentMatch.loaderData!

		const isOnline = competition.competitionType === "online"

		// Parallel fetch event, divisions, movements, sponsors, resources, judging sheets, and competition events
		const [
			eventResult,
			divisionsResult,
			movementsResult,
			sponsorsResult,
			resourcesResult,
			judgingSheetsResult,
			competitionEventsResult,
		] = await Promise.all([
			getCompetitionEventFn({
				data: {
					trackWorkoutId: params.eventId,
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
			getEventResourcesFn({
				data: {
					eventId: params.eventId,
					teamId: competition.organizingTeamId,
				},
			}),
			getEventJudgingSheetsFn({
				data: { trackWorkoutId: params.eventId },
			}),
			// Fetch competition events (submission windows) for online competitions
			isOnline
				? getCompetitionEventsFn({
						data: { competitionId: params.competitionId },
					})
				: Promise.resolve({ events: [] }),
		])

		if (!eventResult.event) {
			throw new Error("Event not found")
		}

		// Flatten sponsors from groups and ungrouped
		const allSponsors = [
			...sponsorsResult.groups.flatMap((g) => g.sponsors),
			...sponsorsResult.ungroupedSponsors,
		]

		// Fetch division descriptions for this workout
		const divisionIds = divisionsResult.divisions.map((d) => d.id)
		let divisionDescriptions: Array<{
			divisionId: string
			divisionLabel: string
			description: string | null
		}> = []

		if (divisionIds.length > 0) {
			const descriptionsResult = await getWorkoutDivisionDescriptionsFn({
				data: {
					workoutId: eventResult.event.workoutId,
					divisionIds,
				},
			})
			divisionDescriptions = descriptionsResult.descriptions
		}

		// Find this event's submission window
		const competitionEvent = competitionEventsResult.events.find(
			(ce) => ce.trackWorkoutId === params.eventId,
		)

		return {
			event: eventResult.event,
			divisions: divisionsResult.divisions,
			movements: movementsResult.movements,
			sponsors: allSponsors,
			divisionDescriptions,
			resources: resourcesResult.resources,
			judgingSheets: judgingSheetsResult.sheets,
			isOnline,
			submissionOpensAt: competitionEvent?.submissionOpensAt ?? null,
			submissionClosesAt: competitionEvent?.submissionClosesAt ?? null,
			timezone: competition.timezone || "America/Denver",
		}
	},
})

function EventLayout() {
	return <Outlet />
}
