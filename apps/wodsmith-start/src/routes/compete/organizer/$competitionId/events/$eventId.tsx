/**
 * Competition Event Edit Route
 *
 * Organizer page for editing a single competition event.
 * Fetches event details, divisions, movements, sponsors, and judging sheets.
 */

import { useState } from "react"
import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import {
	EVENT_DETAILS_FORM_ID,
	EventDetailsForm,
} from "@/components/events/event-details-form"
import { HeatSchedulePublishingCard } from "@/components/organizer/heat-schedule-publishing-card"
import { EventJudgingSheets } from "@/components/organizer/event-judging-sheets"
import { Button } from "@/components/ui/button"
import { getCompetitionByIdFn } from "@/server-fns/competition-detail-fns"
import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"
import {
	getCompetitionEventFn,
	getWorkoutDivisionDescriptionsFn,
} from "@/server-fns/competition-workouts-fns"
import { getAllMovementsFn } from "@/server-fns/movement-fns"
import { getCompetitionSponsorsFn } from "@/server-fns/sponsor-fns"
import { getEventJudgingSheetsFn } from "@/server-fns/judging-sheet-fns"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute(
	"/compete/organizer/$competitionId/events/$eventId",
)({
	component: EventEditPage,
	loader: async ({ params }) => {
		// First get competition to know the teamId
		const { competition } = await getCompetitionByIdFn({
			data: { competitionId: params.competitionId },
		})

		if (!competition) {
			throw new Error("Competition not found")
		}

		// Parallel fetch event, divisions, movements, sponsors, and judging sheets
		const [eventResult, divisionsResult, movementsResult, sponsorsResult, judgingSheetsResult] =
			await Promise.all([
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
				getEventJudgingSheetsFn({
					data: { trackWorkoutId: params.eventId },
				}),
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

		return {
			event: eventResult.event,
			divisions: divisionsResult.divisions,
			movements: movementsResult.movements,
			sponsors: allSponsors,
			divisionDescriptions,
			judgingSheets: judgingSheetsResult.sheets,
		}
	},
})

function EventEditPage() {
	const { event, divisions, movements, sponsors, divisionDescriptions, judgingSheets: initialSheets } =
		Route.useLoaderData()
	// Get competition from parent layout loader data
	const { competition } = parentRoute.useLoaderData()

	// Local state for judging sheets to enable real-time updates
	const [judgingSheets, setJudgingSheets] = useState(initialSheets)

	return (
		<>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold">Edit Event</h1>
					<p className="text-muted-foreground mt-1">
						Event #{event.trackOrder} - {event.workout.name}
					</p>
				</div>
				<Button type="submit" form={EVENT_DETAILS_FORM_ID}>
					Save Changes
				</Button>
			</div>

			{/* Event Details Form */}
			<EventDetailsForm
				event={event}
				competitionId={competition.id}
				organizingTeamId={competition.organizingTeamId}
				divisions={divisions}
				divisionDescriptions={divisionDescriptions}
				movements={movements}
				sponsors={sponsors}
			/>

			{/* Judging Sheets */}
			<EventJudgingSheets
				competitionId={competition.id}
				trackWorkoutId={event.id}
				sheets={judgingSheets}
				onSheetsChange={setJudgingSheets}
			/>

			{/* Heat Schedule Publishing */}
			<HeatSchedulePublishingCard
				trackWorkoutId={event.id}
				eventName={event.workout.name}
				competitionId={competition.id}
				organizingTeamId={competition.organizingTeamId}
			/>
		</>
	)
}
