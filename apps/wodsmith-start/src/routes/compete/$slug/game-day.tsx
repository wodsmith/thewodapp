import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { CompetitionTabs } from "@/components/competition-tabs"
import { GameDayMasterSchedule } from "@/components/game-day-master-schedule"
import { getCompetitionBySlugFn } from "@/server-fns/competition-fns"
import {
	getCompetitionVenuesFn,
	getHeatsForCompetitionFn,
} from "@/server-fns/competition-heats-fns"
import { getPublishedCompetitionWorkoutsFn } from "@/server-fns/competition-workouts-fns"

const parentRoute = getRouteApi("/compete/$slug")

export const Route = createFileRoute("/compete/$slug/game-day")({
	component: GameDayPage,
	loader: async ({ params }) => {
		// Fetch competition by slug to get the ID
		const { competition } = await getCompetitionBySlugFn({
			data: { slug: params.slug },
		})

		if (!competition) {
			return {
				heats: [],
				events: [],
				venues: [],
				timezone: "America/Denver",
			}
		}

		// Only show for in-person competitions
		if (competition.competitionType === "online") {
			return {
				heats: [],
				events: [],
				venues: [],
				timezone: competition.timezone ?? "America/Denver",
			}
		}

		// Fetch heats, events, and venues in parallel
		const [heatsResult, eventsResult, venuesResult] = await Promise.all([
			getHeatsForCompetitionFn({ data: { competitionId: competition.id } }),
			getPublishedCompetitionWorkoutsFn({
				data: { competitionId: competition.id },
			}),
			getCompetitionVenuesFn({ data: { competitionId: competition.id } }),
		])

		return {
			heats: heatsResult.heats,
			events: eventsResult.workouts,
			venues: venuesResult.venues,
			timezone: competition.timezone ?? "America/Denver",
		}
	},
})

function GameDayPage() {
	const { heats, events, venues, timezone } = Route.useLoaderData()
	const { competition } = parentRoute.useLoaderData()

	return (
		<div className="space-y-4">
			<div className="sticky top-4 z-10">
				<CompetitionTabs slug={competition.slug} />
			</div>
			<GameDayMasterSchedule
				events={events}
				heats={heats}
				venues={venues}
				timezone={timezone}
			/>
		</div>
	)
}
