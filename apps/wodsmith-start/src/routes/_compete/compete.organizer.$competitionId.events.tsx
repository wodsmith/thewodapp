import { createFileRoute, notFound } from "@tanstack/react-router"
import { getSessionFromCookie } from "~/utils/auth.server"
import { getCompetitionFn, getCompetitionWorkoutsFn } from "~/server-functions/competitions"
import { getDivisionsFn } from "~/server-functions/divisions"
import { getMovementsFn } from "~/server-functions/movements"
import { getSponsorsFn } from "~/server-functions/sponsors"
import { OrganizerEventManager } from "~/components/compete/organizer/organizer-event-manager"

export const Route = createFileRoute(
	"/_compete/compete/organizer/$competitionId/events",
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

		// Fetch all required data in parallel
		const [eventsResult, divisionsResult, movementsResult, sponsorsResult] =
			await Promise.all([
				getCompetitionWorkoutsFn({
					data: { competitionId: competition.id },
				}),
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
			events: eventsResult.success ? eventsResult.data : [],
			divisions: divisionsResult.success ? divisionsResult.data : [],
			movements: movementsResult.success ? movementsResult.data : [],
			sponsors: sponsorsResult.success ? sponsorsResult.data : [],
			divisionDescriptionsByWorkout: {}, // TODO: Fetch division descriptions
		}
	},
	component: EventsManagementComponent,
})

function EventsManagementComponent() {
	const {
		competition,
		events,
		divisions,
		movements,
		sponsors,
		divisionDescriptionsByWorkout,
	} = Route.useLoaderData()

	return (
		<div className="container mx-auto px-4 py-8">
			<h1 className="text-3xl font-bold mb-4">Events - {competition.name}</h1>
			<p className="text-muted-foreground mb-6">
				Manage {events.length} event{events.length !== 1 ? "s" : ""} in this
				competition
			</p>

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
