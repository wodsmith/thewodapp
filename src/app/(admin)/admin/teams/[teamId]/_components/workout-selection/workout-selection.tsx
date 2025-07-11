import { Badge } from "@/components/ui/badge"
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
							<button
								type="button"
								key={workout.id}
								data-testid="workout-card"
								className={`cursor-pointer bg-surface rounded-none border-4 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary p-2 ${
									selectedStandaloneWorkout?.id === workout.id
										? "border-primary"
										: "border-transparent hover:border-primary"
								}`}
								onClick={() => handleStandaloneWorkoutSelect(workout)}
							>
								<div className="flex items-center justify-between gap-4">
									<div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-grow items-center">
										{/* Column 1: Name and Scheme */}
										<div className="md:col-span-1">
											<div className="flex flex-row gap-2 items-center">
												<Badge
													variant="outline"
													className="text-xs font-mono font-bold"
												>
													Standalone
												</Badge>
												<h3 className="text-lg font-mono tracking-tight font-bold dark:text-white text-black">
													{workout.name}
												</h3>
												<p className="text-sm text-muted-foreground font-mono">
													{workout.scheme}
												</p>
											</div>
										</div>

										{/* Column 2: Description */}
										<div className="md:col-span-1">
											{workout.description && (
												<p className="text-sm text-muted-foreground font-mono line-clamp-2">
													{workout.description}
												</p>
											)}
										</div>

										{/* Column 3: Empty for consistency */}
										<div className="md:col-span-1" />
									</div>
								</div>
							</button>
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
						<button
							type="button"
							key={trackWorkout.id}
							data-testid="workout-card"
							className={`cursor-pointer bg-surface rounded-none border-4 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary p-2 ${
								selectedWorkout?.id === trackWorkout.id
									? "border-primary"
									: "border-transparent hover:border-primary"
							}`}
							onClick={() => handleWorkoutSelect(trackWorkout)}
						>
							<div className="flex items-center justify-between gap-4">
								<div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-grow items-center">
									{/* Column 1: Day, Name and Scheme */}
									<div className="md:col-span-1">
										<div className="flex flex-row gap-2 items-center">
											<div className="flex items-center gap-3 mb-1 opacity-70">
												<div className="text-primary px-2 py-1 text-xs font-mono font-bold">
													{trackWorkout.dayNumber}
													{trackWorkout.weekNumber &&
														` - W${trackWorkout.weekNumber}`}
												</div>
											</div>
											{trackWorkout.workout && (
												<>
													<h3 className="text-lg font-mono tracking-tight font-bold dark:text-white text-black">
														{trackWorkout.workout.name}
													</h3>
													<p className="text-sm text-muted-foreground font-mono">
														{trackWorkout.workout.scheme}
													</p>
												</>
											)}
										</div>
									</div>

									{/* Column 2: Notes */}
									<div className="md:col-span-1">
										{trackWorkout.notes && (
											<p className="text-sm text-muted-foreground font-mono line-clamp-2">
												{trackWorkout.notes}
											</p>
										)}
									</div>

									{/* Column 3: Empty for consistency */}
									<div className="md:col-span-1" />
								</div>
							</div>
						</button>
					))}
				</div>
			)}
		</section>
	)
}
