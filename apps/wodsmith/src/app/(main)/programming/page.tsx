import "server-only"
import { getSessionFromCookie } from "@/utils/auth"
import { getPublicTracksWithTeamSubscriptions } from "@/server/programming-multi-team"
import { ProgrammingTracksClient } from "@/components/programming/programming-tracks-client"

export default async function ProgrammingPage() {
	const session = await getSessionFromCookie()
	const userTeamIds = session?.teams?.map((team) => team.id) || []
	const defaultTeam = session?.teams?.[0]

	// Get all public tracks with subscription info for all user's teams
	const allTracks = await getPublicTracksWithTeamSubscriptions(userTeamIds)

	return (
		<div className="container mx-auto py-8">
			<ProgrammingTracksClient
				allTracks={allTracks}
				teamId={defaultTeam?.id || ""}
				teamName={defaultTeam?.name || ""}
			/>
		</div>
	)
}
