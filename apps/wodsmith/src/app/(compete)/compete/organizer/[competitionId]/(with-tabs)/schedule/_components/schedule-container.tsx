import "server-only"

import { getCompetitionDivisionsWithCounts } from "@/server/competition-divisions"
import {
	getCompetitionVenues,
	getHeatsForCompetition,
} from "@/server/competition-heats"
import { getCompetitionWorkouts } from "@/server/competition-workouts"
import { getCompetitionRegistrations } from "@/server/competitions"
import { SchedulePageClient } from "./schedule-page-client"

interface ScheduleContainerProps {
	competitionId: string
	organizingTeamId: string
	competitionStartDate: Date | null
}

export async function ScheduleContainer({
	competitionId,
	organizingTeamId,
	competitionStartDate,
}: ScheduleContainerProps) {
	const [venues, events, heats, divisionsData, registrations] =
		await Promise.all([
			getCompetitionVenues(competitionId),
			getCompetitionWorkouts(competitionId),
			getHeatsForCompetition(competitionId),
			getCompetitionDivisionsWithCounts({ competitionId }),
			getCompetitionRegistrations(competitionId),
		])

	const { divisions } = divisionsData

	return (
		<SchedulePageClient
			competitionId={competitionId}
			organizingTeamId={organizingTeamId}
			competitionStartDate={competitionStartDate}
			initialVenues={venues}
			events={events}
			initialHeats={heats}
			divisions={divisions}
			registrations={registrations}
		/>
	)
}
