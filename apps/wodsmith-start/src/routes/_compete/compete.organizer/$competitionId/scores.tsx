import { createFileRoute, notFound } from "@tanstack/react-router"
import {
	getCompetitionFn,
	getCompetitionWorkoutsFn,
} from "~/server-functions/competitions"
import { getCompetitionScoresFn } from "~/server-functions/competition-scores"
import { OrganizerScoresManager } from "~/components/compete/organizer/organizer-scores-manager"
import { getSessionFromCookie } from "~/utils/auth.server"

export const Route = createFileRoute(
	"/_compete/compete/organizer/$competitionId/scores",
)({
	beforeLoad: async () => {
		const session = await getSessionFromCookie()
		if (!session) {
			throw new Error("Unauthorized")
		}
	},
	loader: async ({ params }) => {
		const compResult = await getCompetitionFn({
			data: { idOrSlug: params.competitionId },
		})

		if (!compResult.success || !compResult.data) {
			throw notFound()
		}

		const competition = compResult.data

		// Parallel fetch: scores and workouts (for context)
		const [scoresResult, workoutsResult] = await Promise.all([
			getCompetitionScoresFn({ data: { competitionId: competition.id } }),
			getCompetitionWorkoutsFn({ data: { competitionId: competition.id } }),
		])

		return {
			competition,
			scores: scoresResult.success ? scoresResult.data : [],
			workouts: workoutsResult.success ? workoutsResult.data : [],
		}
	},
	component: OrganizerScoresComponent,
})

function OrganizerScoresComponent() {
	const { competition, scores, workouts } = Route.useLoaderData()

	return (
		<OrganizerScoresManager
			competitionId={competition.id}
			scores={scores}
			workouts={workouts}
		/>
	)
}
