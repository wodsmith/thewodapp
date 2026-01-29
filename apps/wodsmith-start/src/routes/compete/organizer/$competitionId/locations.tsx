/**
 * Competition Locations Route
 *
 * Organizer page for managing competition venues/locations.
 * Allows CRUD operations on venues that are used for heat scheduling.
 */

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { VenueManager } from "@/components/organizer/schedule/venue-manager"
import { getCompetitionVenuesFn } from "@/server-fns/competition-heats-fns"

// Get parent route API to access competition data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute(
	"/compete/organizer/$competitionId/locations",
)({
	component: LocationsPage,
	loader: async ({ params }) => {
		const { venues } = await getCompetitionVenuesFn({
			data: { competitionId: params.competitionId },
		})

		return { venues }
	},
})

function LocationsPage() {
	const { venues } = Route.useLoaderData()
	const { competitionId } = Route.useParams()
	const { competition } = parentRoute.useLoaderData()

	return (
		<div className="container max-w-4xl py-6 space-y-6">
			<div>
				<h1 className="text-2xl font-bold tracking-tight">
					Locations & Venues
				</h1>
				<p className="text-muted-foreground">
					Manage venues for {competition.name}. Venues are physical locations
					like "Main Floor" or "Outside Rig" where heats are scheduled.
				</p>
			</div>

			<VenueManager competitionId={competitionId} venues={venues} />
		</div>
	)
}
