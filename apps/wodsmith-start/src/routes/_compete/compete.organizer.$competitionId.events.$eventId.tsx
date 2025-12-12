import { createFileRoute, notFound } from "@tanstack/react-router"
import { Button } from "~/components/ui/button"
import { getCompetitionFn, getCompetitionWorkoutsFn } from "~/server-functions/competitions"
import { getSessionFromCookie } from "~/utils/auth.server"

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

		// TODO: Get divisions, movements, and sponsors in parallel

		return {
			competition,
			event,
			divisions: [],
			movements: [],
			sponsors: [],
		}
	},
	component: EventDetailsComponent,
})

function EventDetailsComponent() {
	const { competition, event } = Route.useLoaderData()

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col gap-6">
				<div>
					<div className="flex items-center justify-between mt-4">
						<div>
							<h1 className="text-3xl font-bold">Edit Event</h1>
							<p className="text-muted-foreground mt-1">
								Event - {event.name}
							</p>
						</div>
						<Button type="submit">Save Changes</Button>
					</div>
				</div>

				{/* TODO: Render EventDetailsForm component */}
			</div>
		</div>
	)
}
