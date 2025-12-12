import { createFileRoute } from "@tanstack/react-router"
import { getPublicTracksWithTeamSubscriptionsFn } from "~/server-functions/programming"
import { ProgrammingTracksClient } from "~/components/programming/programming-tracks-client"
import { getDefaultTeamContextFn } from "~/server-functions/teams-context"

export const Route = createFileRoute("/_main/programming/")({
	loader: async () => {
		const teamContext = await getDefaultTeamContextFn()
		if (!teamContext.isAuthenticated || !teamContext.teamId) {
			throw new Error("Not authenticated or no team")
		}

		const result = await getPublicTracksWithTeamSubscriptionsFn({
			data: { userTeamIds: teamContext.userTeamIds },
		})

		return {
			allTracks: result.data || [],
			teamId: teamContext.teamId,
			teamName: teamContext.teamName,
		}
	},
	component: ProgrammingIndexPage,
})

function ProgrammingIndexPage() {
	const { allTracks, teamId, teamName } = Route.useLoaderData()

	return (
		<div className="container mx-auto py-8">
			<ProgrammingTracksClient
				allTracks={allTracks}
				teamId={teamId}
				teamName={teamName}
			/>
		</div>
	)
}
