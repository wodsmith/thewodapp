import { Dumbbell } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { Competition, CompetitionGroup, Sponsor, Team } from "@/db/schema"
import {
	getPublishedCompetitionWorkouts,
	getWorkoutDivisionDescriptions,
} from "@/server/competition-workouts"
import { getCompetitionSponsors } from "@/server/sponsors"
import { WorkoutCard } from "./workout-card"

interface WorkoutsContentProps {
	competition: Competition & {
		organizingTeam: Team | null
		group: CompetitionGroup | null
	}
	divisions: Array<{ id: string }> | null
}

export async function WorkoutsContent({
	competition,
	divisions,
}: WorkoutsContentProps) {
	// Fetch events and sponsors in parallel
	const [events, sponsorsResult] = await Promise.all([
		getPublishedCompetitionWorkouts(competition.id),
		getCompetitionSponsors(competition.id),
	])

	// Build sponsor lookup map
	const sponsorMap = new Map<string, Sponsor>()
	for (const group of sponsorsResult.groups) {
		for (const sponsor of group.sponsors) {
			sponsorMap.set(sponsor.id, sponsor)
		}
	}
	for (const sponsor of sponsorsResult.ungroupedSponsors) {
		sponsorMap.set(sponsor.id, sponsor)
	}

	// Fetch division descriptions for all workouts in parallel
	const divisionIds = divisions?.map((d) => d.id) ?? []
	const divisionDescriptionsMap = new Map<
		string,
		Awaited<ReturnType<typeof getWorkoutDivisionDescriptions>>
	>()

	if (divisionIds.length > 0 && events.length > 0) {
		const descriptionsPromises = events.map(async (event) => {
			const descriptions = await getWorkoutDivisionDescriptions(
				event.workoutId,
				divisionIds,
				competition.organizingTeamId,
			)
			return { workoutId: event.workoutId, descriptions }
		})

		const results = await Promise.all(descriptionsPromises)
		for (const { workoutId, descriptions } of results) {
			divisionDescriptionsMap.set(workoutId, descriptions)
		}
	}

	if (events.length === 0) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="max-w-4xl">
					<h2 className="text-2xl font-bold mb-6">Workouts</h2>

					<Alert variant="default" className="border-dashed">
						<Dumbbell className="h-4 w-4" />
						<AlertTitle>Workouts not yet released</AlertTitle>
						<AlertDescription>
							Competition workouts will be announced closer to the event. Check
							back soon or follow the event organizer for updates.
						</AlertDescription>
					</Alert>
				</div>
			</div>
		)
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="max-w-4xl">
				<h2 className="text-2xl font-bold mb-6">
					Workouts
					<span className="text-muted-foreground font-normal text-lg ml-2">
						({events.length} event{events.length !== 1 ? "s" : ""})
					</span>
				</h2>

				<div className="space-y-4">
					{events.map((event) => {
						const sponsor = event.sponsorId
							? sponsorMap.get(event.sponsorId)
							: undefined
						return (
							<WorkoutCard
								key={event.id}
								trackOrder={event.trackOrder}
								name={event.workout.name}
								scheme={event.workout.scheme}
								description={event.workout.description}
								scoreType={event.workout.scoreType}
								roundsToScore={event.workout.roundsToScore}
								repsPerRound={event.workout.repsPerRound}
								pointsMultiplier={event.pointsMultiplier}
								notes={event.notes}
								movements={event.workout.movements}
								tags={event.workout.tags}
								divisionDescriptions={
									divisionDescriptionsMap.get(event.workoutId) ?? []
								}
								sponsorName={sponsor?.name}
								sponsorLogoUrl={sponsor?.logoUrl}
							/>
						)
					})}
				</div>
			</div>
		</div>
	)
}
