import { Dumbbell } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { Competition, CompetitionGroup, ScalingLevel, Team } from "@/db/schema"
import {
	getCompetitionWorkouts,
	getWorkoutDivisionDescriptions,
} from "@/server/competition-workouts"
import { WorkoutCard } from "./workout-card"

interface WorkoutsContentProps {
	competition: Competition & {
		organizingTeam: Team | null
		group: CompetitionGroup | null
	}
	divisions: ScalingLevel[] | null
}

export async function WorkoutsContent({
	competition,
	divisions,
}: WorkoutsContentProps) {
	const events = await getCompetitionWorkouts(competition.id)

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
							Competition workouts will be announced closer to the event.
							Check back soon or follow the event organizer for updates.
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
					{events.map((event) => (
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
						/>
					))}
				</div>
			</div>
		</div>
	)
}
