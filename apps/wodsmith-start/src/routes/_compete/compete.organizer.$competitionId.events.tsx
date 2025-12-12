import { createFileRoute, notFound } from "@tanstack/react-router"
import { getCompetitionFn, getCompetitionWorkoutsFn } from "~/server-functions/competitions"
import { getSessionFromCookie } from "~/utils/auth.server"

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

		// TODO: Parallel fetch events, divisions, movements, and sponsors
		const eventsResult = await getCompetitionWorkoutsFn({
			data: { competitionId: competition.id },
		})

		return {
			competition,
			events: eventsResult.success ? eventsResult.data : [],
			divisionsData: { divisions: [] },
			movements: [],
			sponsors: { groups: [], ungroupedSponsors: [] },
		}
	},
	component: EventsManagementComponent,
})

function EventsManagementComponent() {
	const { competition, events } = Route.useLoaderData()

	return (
		<div className="container mx-auto px-4 py-8">
			<h1 className="text-3xl font-bold mb-4">Events - {competition.name}</h1>
			<p className="text-muted-foreground mb-6">
				Manage {events.length} event{events.length !== 1 ? "s" : ""} in this competition
			</p>

			{/* TODO: Render OrganizerEventManager component */}
		</div>
	)
}
