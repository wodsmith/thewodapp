import { createFileRoute, notFound } from "@tanstack/react-router"
import { getCompetitionFn } from "~/server-functions/competitions"
import {
	getCompetitionDivisionsWithCountsFn,
	listScalingGroupsFn,
} from "~/server-functions/competition-divisions"
import { OrganizerDivisionManager } from "~/components/compete/organizer/organizer-division-manager"
import { getSessionFromCookie } from "~/utils/auth.server"

export const Route = createFileRoute(
	"/_compete/compete/organizer/$competitionId/divisions",
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

		// Parallel fetch: divisions with counts and available scaling groups
		const [divisionsResult, scalingGroupsResult] = await Promise.all([
			getCompetitionDivisionsWithCountsFn({
				data: { competitionId: competition.id },
			}),
			listScalingGroupsFn({
				data: {
					teamId: competition.organizingTeamId,
					includeSystem: true,
				},
			}),
		])

		const divisionsData = divisionsResult.success
			? divisionsResult.data
			: { scalingGroupId: null, divisions: [] }
		const scalingGroups = scalingGroupsResult.success
			? scalingGroupsResult.data
			: []

		return {
			competition,
			...divisionsData,
			scalingGroups,
		}
	},
	component: OrganizerDivisionsComponent,
})

function OrganizerDivisionsComponent() {
	const { competition, scalingGroupId, divisions, scalingGroups } =
		Route.useLoaderData()

	return (
		<OrganizerDivisionManager
			key={scalingGroupId ?? "no-divisions"}
			teamId={competition.organizingTeamId}
			competitionId={competition.id}
			divisions={divisions}
			scalingGroupId={scalingGroupId}
			scalingGroups={scalingGroups}
		/>
	)
}
