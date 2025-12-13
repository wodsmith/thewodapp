import "server-only"

import { getCompetitionDivisionsWithCounts } from "@/server/competition-divisions"
import {
	getCompetitionVenues,
	getHeatsForCompetition,
} from "@/server/competition-heats"
import { getCompetitionWorkouts } from "@/server/competition-workouts"
import { getCompetitionRegistrations } from "@/server/competitions"
import { HeatScheduleManager } from "./heat-schedule-manager"

interface HeatScheduleContainerProps {
	competitionId: string
	organizingTeamId: string
	competitionStartDate: Date | null
}

export async function HeatScheduleContainer({
	competitionId,
	organizingTeamId,
	competitionStartDate,
}: HeatScheduleContainerProps) {
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
		<HeatScheduleManager
			competitionId={competitionId}
			organizingTeamId={organizingTeamId}
			competitionStartDate={competitionStartDate}
			events={events}
			venues={venues}
			heats={heats}
			divisions={divisions}
			registrations={registrations}
		/>
	)
}
