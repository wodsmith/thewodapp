import { createFileRoute, notFound } from "@tanstack/react-router"
import { getCompetitionByIdFn } from "@/server-fns/competition-detail-fns"
import { getCompetitionWorkoutsFn } from "@/server-fns/competition-workouts-fns"
import { ScoringSettingsForm } from "./-components/scoring-settings-form"

export const Route = createFileRoute(
	"/compete/organizer/$competitionId/scoring",
)({
	loader: async ({ params }) => {
		const result = await getCompetitionByIdFn({
			data: { competitionId: params.competitionId },
		})

		if (!result.competition) {
			throw notFound()
		}

		// Fetch events for head-to-head tiebreaker selection
		const workoutsResult = await getCompetitionWorkoutsFn({
			data: {
				competitionId: params.competitionId,
				teamId: result.competition.organizingTeamId,
			},
		})

		const events = workoutsResult.workouts.map((w) => ({
			id: w.id,
			name: w.workout.name,
		}))

		return { competition: result.competition, events }
	},
	component: ScoringPage,
	head: ({ loaderData }) => {
		const competition = loaderData?.competition
		if (!competition) {
			return {
				meta: [{ title: "Competition Not Found" }],
			}
		}
		return {
			meta: [
				{ title: `Scoring - ${competition.name}` },
				{
					name: "description",
					content: `Configure scoring algorithm for ${competition.name}`,
				},
			],
		}
	},
})

function ScoringPage() {
	const { competition, events } = Route.useLoaderData()

	return (
		<div className="max-w-7xl space-y-8">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">
					Scoring Configuration
				</h1>
				<p className="text-muted-foreground mt-1">
					Configure how athletes are ranked on the leaderboard
				</p>
			</div>

			<ScoringSettingsForm
				competition={{
					id: competition.id,
					name: competition.name,
					settings: competition.settings,
				}}
				events={events}
			/>
		</div>
	)
}
