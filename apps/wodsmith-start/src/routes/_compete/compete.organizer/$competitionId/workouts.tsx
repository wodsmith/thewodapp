import { createFileRoute, notFound } from '@tanstack/react-router'
import { getCompetitionFn, getCompetitionWorkoutsFn } from '~/server-functions/competitions'
import { listScalingGroupsFn } from '~/server-functions/competition-divisions'
import { OrganizerWorkoutsManager } from '~/components/compete/organizer/organizer-workouts-manager'
import { getSessionFromCookie } from '~/utils/auth'

export const Route = createFileRoute('/_compete/compete/organizer/$competitionId/workouts')({
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

		// Parallel fetch: workouts and available scaling groups
		const [workoutsResult, scalingGroupsResult] = await Promise.all([
			getCompetitionWorkoutsFn({ data: { competitionId: competition.id } }),
			listScalingGroupsFn({
				data: {
					teamId: competition.organizingTeamId,
					includeSystem: true,
				},
			}),
		])

		return {
			competition,
			workouts: workoutsResult.success ? workoutsResult.data : [],
			scalingGroups: scalingGroupsResult.success ? scalingGroupsResult.data : [],
		}
	},
	component: OrganizerWorkoutsComponent,
})

function OrganizerWorkoutsComponent() {
	const { competition, workouts, scalingGroups } = Route.useLoaderData()

	return (
		<OrganizerWorkoutsManager
			competitionId={competition.id}
			workouts={workouts}
			scalingGroups={scalingGroups}
		/>
	)
}
