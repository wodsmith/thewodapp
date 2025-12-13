import "server-only"

import { getCompetitionVenues } from "@/server/competition-heats"
import { VenueManager } from "./venue-manager"

interface VenueManagerContainerProps {
	competitionId: string
	organizingTeamId: string
}

export async function VenueManagerContainer({
	competitionId,
	organizingTeamId,
}: VenueManagerContainerProps) {
	const venues = await getCompetitionVenues(competitionId)

	return (
		<VenueManager
			competitionId={competitionId}
			organizingTeamId={organizingTeamId}
			venues={venues}
		/>
	)
}
