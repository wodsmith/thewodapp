import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"
import {
	getCompetitionRegistrationsFn,
	getCompetitionVenuesFn,
	getHeatsForCompetitionFn,
} from "@/server-fns/competition-heats-fns"
import { getCompetitionWorkoutsFn } from "@/server-fns/competition-workouts-fns"
import { HeatScheduleManager } from "./heat-schedule-manager"

interface HeatScheduleContainerProps {
	competitionId: string
	organizingTeamId: string
	competitionStartDate: string | null // YYYY-MM-DD format
}

export async function HeatScheduleContainer({
	competitionId,
	organizingTeamId,
	competitionStartDate,
}: HeatScheduleContainerProps) {
	// Fetch all data in parallel
	const [
		venuesResult,
		eventsResult,
		heatsResult,
		divisionsResult,
		registrationsResult,
	] = await Promise.all([
		getCompetitionVenuesFn({ data: { competitionId } }),
		getCompetitionWorkoutsFn({
			data: { competitionId, teamId: organizingTeamId },
		}),
		getHeatsForCompetitionFn({ data: { competitionId } }),
		getCompetitionDivisionsWithCountsFn({
			data: { competitionId, teamId: organizingTeamId },
		}),
		getCompetitionRegistrationsFn({ data: { competitionId } }),
	])

	const venues = venuesResult.venues
	const events = eventsResult.workouts
	const heats = heatsResult.heats
	const { divisions } = divisionsResult
	const registrations = registrationsResult.registrations

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
