import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { ScalingMismatchIndicator } from "@/components/scaling/scaling-mismatch-indicator"
import {
	type ProgrammingTrack,
	STANDALONE_TRACK_ID,
	type StandaloneWorkout,
	type TrackWorkout,
} from "./types"

interface WorkoutSelectionProps {
	selectedTrack: ProgrammingTrack | null
	trackWorkouts: TrackWorkout[]
	standaloneWorkouts: StandaloneWorkout[]
	selectedWorkout: TrackWorkout | null
	selectedStandaloneWorkout: StandaloneWorkout | null
	onWorkoutSelect: (workout: TrackWorkout) => void
	onStandaloneWorkoutSelect: (workout: StandaloneWorkout) => void
	isLoadingWorkouts: boolean
	isLoadingStandaloneWorkouts: boolean
}

export function WorkoutSelection({
	selectedTrack,
	trackWorkouts,
	standaloneWorkouts,
	selectedWorkout,
	selectedStandaloneWorkout,
	onWorkoutSelect,
	onStandaloneWorkoutSelect,
	isLoadingWorkouts,
	isLoadingStandaloneWorkouts,
}: WorkoutSelectionProps) {
	const handleWorkoutSelect = (workout: TrackWorkout) => {
		if (process.env.LOG_LEVEL === "debug") {
			console.log(
				`DEBUG: [WorkoutSelection] Workout selected: ${workout.id} (type: track)`,
			)
		}
		onWorkoutSelect(workout)
	}

	const handleStandaloneWorkoutSelect = (workout: StandaloneWorkout) => {
		if (process.env.LOG_LEVEL === "debug") {
			console.log(
				`DEBUG: [WorkoutSelection] Workout selected: ${workout.id} (type: standalone)`,
			)
		}
		onStandaloneWorkoutSelect(workout)
	}

	return (
		<section className="space-y-4 max-w-sm">
			<h3 className="text-lg font-semibold">Select Workout</h3>
			{!selectedTrack ? (
				<div className="text-center text-muted-foreground">
					Select a track to view workouts
				</div>
			) : selectedTrack.id === STANDALONE_TRACK_ID ? (
				// Show standalone workouts
				isLoadingStandaloneWorkouts ? (
					<div className="text-center text-muted-foreground">
						Loading workouts...
					</div>
				) : (
					<div className="space-y-2 min-w-[360px]">
						{standaloneWorkouts.map((workout) => (
							<Card
								key={workout.id}
								data-testid="workout-card"
								className={`cursor-pointer transition-colors p-4 ${
									selectedStandaloneWorkout?.id === workout.id
										? "border-primary bg-primary/10"
										: "hover:bg-muted/50"
								}`}
								onClick={() => handleStandaloneWorkoutSelect(workout)}
							>
								<CardHeader className="pb-2">
									<CardTitle className="text-sm">{workout.name}</CardTitle>
									<CardDescription className="text-xs">
										{workout.scheme}
									</CardDescription>
									{workout.description && (
										<CardDescription className="text-xs">
											{workout.description}
										</CardDescription>
									)}
								</CardHeader>
							</Card>
						))}
						{standaloneWorkouts.length === 0 && (
							<div className="text-center text-muted-foreground">
								No standalone workouts available. All workouts are assigned to
								programming tracks.
							</div>
						)}
					</div>
				)
			) : // Show track workouts
			isLoadingWorkouts ? (
				<div className="text-center text-muted-foreground">
					Loading workouts...
				</div>
			) : (
				<div className="space-y-2">
					{trackWorkouts.map((trackWorkout) => (
						<Card
							key={trackWorkout.id}
							data-testid="workout-card"
							className={`cursor-pointer transition-colors ${
								selectedWorkout?.id === trackWorkout.id
									? "border-primary bg-primary/10"
									: "hover:bg-muted/50"
							}`}
							onClick={() => handleWorkoutSelect(trackWorkout)}
						>
							<CardHeader className="pb-2">
								<div className="flex items-start justify-between gap-2">
									<div className="flex-1 min-w-0">
										<CardTitle className="text-sm">
											{trackWorkout.workout?.name}
										</CardTitle>
										{trackWorkout.workout && (
											<CardDescription className="text-xs">
												{trackWorkout.workout.name} (
												{trackWorkout.workout.scheme})
											</CardDescription>
										)}
										{trackWorkout.workout?.description && (
											<CardDescription className="text-xs line-clamp-3">
												{trackWorkout.workout.description}
											</CardDescription>
										)}
										{trackWorkout.notes && (
											<CardDescription className="text-xs line-clamp-3">
												{trackWorkout.notes}
											</CardDescription>
										)}
									</div>
									{trackWorkout.workout && selectedTrack && (
										<ScalingMismatchIndicator
											workout={{
												id: trackWorkout.workout.id,
												name: trackWorkout.workout.name,
												scalingGroupId:
													trackWorkout.workout.scalingGroupId ?? null,
											}}
											track={{
												id: selectedTrack.id,
												name: selectedTrack.name,
												scalingGroupId: selectedTrack.scalingGroupId ?? null,
											}}
											variant="badge"
										/>
									)}
								</div>
							</CardHeader>
						</Card>
					))}
				</div>
			)}
		</section>
	)
}
