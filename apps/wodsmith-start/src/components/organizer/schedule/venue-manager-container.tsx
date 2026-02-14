import type { CompetitionVenue } from "@/db/schemas/competitions"
import { getCompetitionVenuesFn } from "@/server-fns/competition-heats-fns"
import { VenueManager } from "./venue-manager"

interface VenueManagerContainerProps {
	competitionId: string
	venues?: CompetitionVenue[]
}

export async function VenueManagerContainer({
	competitionId,
	venues: providedVenues,
}: VenueManagerContainerProps) {
	// Use provided venues or fetch from server
	const venues =
		providedVenues ??
		(await getCompetitionVenuesFn({ data: { competitionId } })).venues

	return <VenueManager competitionId={competitionId} venues={venues} />
}
