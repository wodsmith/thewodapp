import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { SeriesLeaderboardPageContent } from "@/components/series-leaderboard-page-content"
import { getCompetitionGroupByIdFn } from "@/server-fns/competition-fns"
import { getOrganizerTeamsFn } from "@/server-fns/team-fns"

const searchSchema = z.object({
	division: z.string().optional(),
})

export const Route = createFileRoute(
	"/compete/organizer/_dashboard/series/$groupId/leaderboard",
)({
	validateSearch: searchSchema,
	loader: async ({ params, context }) => {
		const { groupId } = params
		const { teams: organizingTeams } = await getOrganizerTeamsFn()
		const isSiteAdmin = context.session?.user?.role === "admin"

		const groupResult = await getCompetitionGroupByIdFn({
			data: { groupId },
		})
		if (!groupResult.group) return { teamId: null }

		const groupTeamId = groupResult.group.organizingTeamId
		if (
			!isSiteAdmin &&
			!organizingTeams.some((t: { id: string }) => t.id === groupTeamId)
		) {
			return { teamId: null }
		}

		return { teamId: groupTeamId }
	},
	component: OrganizerSeriesLeaderboardPage,
})

function OrganizerSeriesLeaderboardPage() {
	const { groupId } = Route.useParams()
	const { teamId } = Route.useLoaderData()
	return (
		<div className="container mx-auto px-4 py-8">
			<SeriesLeaderboardPageContent
				groupId={groupId}
				teamId={teamId ?? undefined}
			/>
		</div>
	)
}
