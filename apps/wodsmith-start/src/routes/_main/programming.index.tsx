import { createFileRoute } from '@tanstack/react-router'
import { getSessionFromCookie } from '@/utils/auth'
import { getPublicTracksWithTeamSubscriptionsFn } from '@/server-functions/programming'
import { ProgrammingTracksClient } from '~/components/programming/programming-tracks-client'

export const Route = createFileRoute('/_main/programming/')({
	loader: async () => {
		const session = await getSessionFromCookie()
		const userTeamIds = session?.teams?.map((team) => team.id) || []
		const defaultTeam = session?.teams?.[0]

		if (!session || !defaultTeam) {
			throw new Error('Not authenticated or no team')
		}

		const result = await getPublicTracksWithTeamSubscriptionsFn({
			data: { userTeamIds },
		})

		return {
			allTracks: result.data || [],
			teamId: defaultTeam.id,
			teamName: defaultTeam.name || '',
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
