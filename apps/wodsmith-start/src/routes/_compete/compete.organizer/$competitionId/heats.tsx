import { createFileRoute, notFound } from '@tanstack/react-router'
import { getCompetitionFn, getCompetitionWorkoutsFn } from '~/server-functions/competitions'
import { getHeatsForCompetitionFn } from '~/server-functions/competition-heats'
import { OrganizerHeatsManager } from '~/components/compete/organizer/organizer-heats-manager'
import { getSessionFromCookie } from '~/utils/auth'

export const Route = createFileRoute('/_compete/compete/organizer/$competitionId/heats')({
	beforeLoad: async () => {
		const session = await getSessionFromCookie()
		if (!session) {
			throw new Error('Unauthorized')
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

		// Parallel fetch: heats and workouts
		const [heatsResult, workoutsResult] = await Promise.all([
			getHeatsForCompetitionFn({ data: { competitionId: competition.id } }),
			getCompetitionWorkoutsFn({ data: { competitionId: competition.id } }),
		])

		return {
			competition,
			heats: heatsResult.success ? heatsResult.data : [],
			workouts: workoutsResult.success ? workoutsResult.data : [],
		}
	},
	component: OrganizerHeatsComponent,
})

function OrganizerHeatsComponent() {
	const { competition, heats, workouts } = Route.useLoaderData()

	return (
		<OrganizerHeatsManager
			competitionId={competition.id}
			heats={heats}
			workouts={workouts}
		/>
	)
}
