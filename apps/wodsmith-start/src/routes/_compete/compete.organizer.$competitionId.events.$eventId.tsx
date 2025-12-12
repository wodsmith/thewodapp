import { createFileRoute, notFound } from "@tanstack/react-router"
import { getSessionFromCookie } from "~/utils/auth.server"
import {
	getCompetitionFn,
	getCompetitionWorkoutsFn,
} from "~/server-functions/competitions"
import { getDivisionsFn } from "~/server-functions/divisions"
import { getMovementsFn } from "~/server-functions/movements"
import { getSponsorsFn } from "~/server-functions/sponsors"
import { EventDetailsForm } from "~/components/compete/organizer/event-details-form"

export const Route = createFileRoute(
	"/_compete/compete/organizer/$competitionId/events/$eventId",
)({
	beforeLoad: async () => {
		const session = await getSessionFromCookie()
		if (!session) {
			throw new Error("Unauthorized")
		}
	},
	loader: async ({ params }) => {
		const competitionResult = await getCompetitionFn({
			data: { idOrSlug: params.competitionId },
		})

		if (!competitionResult.success || !competitionResult.data) {
			throw notFound()
		}

		const competition = competitionResult.data

		// Get events
		const eventsResult = await getCompetitionWorkoutsFn({
			data: { competitionId: competition.id },
		})

		const events = eventsResult.success ? eventsResult.data : []
		const event = events.find((e: any) => e.id === params.eventId)

		if (!event) {
			throw notFound()
		}

		// Fetch divisions, movements, and sponsors in parallel
		const [divisionsResult, movementsResult, sponsorsResult] = await Promise.all([
			getDivisionsFn({
				data: { competitionId: competition.id },
			}),
			getMovementsFn({
				data: { teamId: competition.organizingTeamId },
			}),
			getSponsorsFn({
				data: { competitionId: competition.id },
			}),
		])

		return {
			competition,
			event,
			divisions: divisionsResult.success ? divisionsResult.data : [],
			movements: movementsResult.success ? movementsResult.data : [],
			sponsors: sponsorsResult.success ? sponsorsResult.data : [],
			divisionDescriptions: [], // TODO: Fetch division descriptions for specific event
		}
	},
	component: EventDetailsComponent,
})

function EventDetailsComponent() {
	const {
		competition,
		event,
		divisions,
		movements,
		sponsors,
		divisionDescriptions,
	} = Route.useLoaderData()

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col gap-6">
				<div>
					<h1 className="text-3xl font-bold">Edit Event</h1>
					<p className="text-muted-foreground mt-1">Event - {event.workout.name}</p>
				</div>

				<EventDetailsForm
					event={event}
					competitionId={competition.id}
					organizingTeamId={competition.organizingTeamId}
					divisions={divisions}
					divisionDescriptions={divisionDescriptions}
					movements={movements}
					sponsors={sponsors}
				/>
			</div>
		</div>
	)
}
