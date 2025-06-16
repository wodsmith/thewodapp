"use client"

import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useServerAction } from "zsa-react"
import {
	getTeamTracksAction,
	getWorkoutsForTrackAction,
	getWorkoutsNotInTracksAction,
} from "../_actions/programming-actions"
import {
	scheduleStandaloneWorkoutAction,
	scheduleWorkoutAction,
} from "../_actions/scheduling-actions"

interface WorkoutSelectionModalProps {
	isOpen: boolean
	onClose: () => void
	selectedDate: Date | null
	teamId: string
	onWorkoutScheduled: () => void
}

interface ProgrammingTrack {
	id: string
	name: string
	description: string | null
	type: string
}

interface TrackWorkout {
	id: string
	dayNumber: number
	weekNumber: number | null
	notes: string | null
	workoutId: string
	workout?: {
		id: string
		name: string
		description: string
		scheme: string
	}
}

interface StandaloneWorkout {
	id: string
	name: string
	description: string
	scheme: string
}

// Special track ID for standalone workouts
const STANDALONE_TRACK_ID = "standalone"

export function WorkoutSelectionModal({
	isOpen,
	onClose,
	selectedDate,
	teamId,
	onWorkoutScheduled,
}: WorkoutSelectionModalProps) {
	const [selectedTrack, setSelectedTrack] = useState<ProgrammingTrack | null>(
		null,
	)
	const [selectedWorkout, setSelectedWorkout] = useState<TrackWorkout | null>(
		null,
	)
	const [selectedStandaloneWorkout, setSelectedStandaloneWorkout] =
		useState<StandaloneWorkout | null>(null)
	const [tracks, setTracks] = useState<ProgrammingTrack[]>([])
	const [trackWorkouts, setTrackWorkouts] = useState<TrackWorkout[]>([])
	const [standaloneWorkouts, setStandaloneWorkouts] = useState<
		StandaloneWorkout[]
	>([])
	const [classTimes, setClassTimes] = useState("")
	const [teamNotes, setTeamNotes] = useState("")
	const [scalingGuidance, setScalingGuidance] = useState("")

	const { execute: getTeamTracks, isPending: isLoadingTracks } =
		useServerAction(getTeamTracksAction)
	const { execute: getWorkoutsForTrack, isPending: isLoadingWorkouts } =
		useServerAction(getWorkoutsForTrackAction)
	const {
		execute: getWorkoutsNotInTracks,
		isPending: isLoadingStandaloneWorkouts,
	} = useServerAction(getWorkoutsNotInTracksAction)
	const { execute: scheduleWorkout, isPending: isScheduling } = useServerAction(
		scheduleWorkoutAction,
	)
	const {
		execute: scheduleStandaloneWorkout,
		isPending: isSchedulingStandalone,
	} = useServerAction(scheduleStandaloneWorkoutAction)

	// Load team tracks when modal opens
	useEffect(() => {
		if (isOpen && teamId) {
			loadTeamTracks()
		}
	}, [isOpen, teamId])

	// Load workouts when track is selected
	useEffect(() => {
		if (selectedTrack) {
			if (selectedTrack.id === STANDALONE_TRACK_ID) {
				loadStandaloneWorkouts()
			} else {
				loadTrackWorkouts(selectedTrack.id)
			}
		}
	}, [selectedTrack])

	const loadTeamTracks = async () => {
		const [result] = await getTeamTracks({ teamId })
		if (result?.success && result.data) {
			setTracks(result.data)
		} else {
			toast.error("Failed to load team tracks")
		}
	}

	const loadTrackWorkouts = async (trackId: string) => {
		const [result] = await getWorkoutsForTrack({ trackId })
		if (result?.success && result.data) {
			setTrackWorkouts(result.data)
		} else {
			toast.error("Failed to load track workouts")
		}
	}

	const loadStandaloneWorkouts = async () => {
		const [result] = await getWorkoutsNotInTracks({ teamId })
		if (result?.success && result.data) {
			setStandaloneWorkouts(result.data)
		} else {
			toast.error("Failed to load standalone workouts")
		}
	}

	const handleScheduleWorkout = async () => {
		// Check if either a track workout or standalone workout is selected
		if (!selectedWorkout && !selectedStandaloneWorkout) {
			toast.error("Please select a workout")
			return
		}

		if (!selectedDate) {
			toast.error("Please select a date")
			return
		}

		// Handle standalone workouts
		if (selectedStandaloneWorkout) {
			const [result] = await scheduleStandaloneWorkout({
				teamId,
				workoutId: selectedStandaloneWorkout.id,
				scheduledDate: selectedDate.toISOString(),
				teamSpecificNotes: teamNotes || undefined,
				scalingGuidanceForDay: scalingGuidance || undefined,
				classTimes: classTimes || undefined,
			})

			if (result?.success) {
				console.log(
					`INFO: [WorkoutScheduling] Workflow completed: selected standalone workout '${
						selectedStandaloneWorkout.id
					}' scheduled for '${selectedDate.toISOString().split("T")[0]}' with ${
						classTimes ? "1" : "0"
					} class time`,
				)
				toast.success("Standalone workout scheduled successfully!")
				onWorkoutScheduled()
				handleClose()
			} else {
				toast.error("Failed to schedule standalone workout")
			}
			return
		}

		// Original logic for track workouts
		const [result] = await scheduleWorkout({
			teamId,
			trackWorkoutId: selectedWorkout?.id,
			scheduledDate: selectedDate.toISOString(),
			teamSpecificNotes: teamNotes || undefined,
			scalingGuidanceForDay: scalingGuidance || undefined,
			classTimes: classTimes || undefined,
		})

		if (result?.success) {
			console.log(
				`INFO: [WorkoutScheduling] Workflow completed: selected workout '${
					selectedWorkout?.workoutId
				}' from track '${selectedTrack?.id}' scheduled for '${
					selectedDate.toISOString().split("T")[0]
				}' with ${classTimes ? "1" : "0"} class time`,
			)
			toast.success("Workout scheduled successfully!")
			onWorkoutScheduled()
			handleClose()
		} else {
			toast.error("Failed to schedule workout")
		}
	}

	const handleClose = () => {
		setSelectedTrack(null)
		setSelectedWorkout(null)
		setSelectedStandaloneWorkout(null)
		setTrackWorkouts([])
		setStandaloneWorkouts([])
		setClassTimes("")
		setTeamNotes("")
		setScalingGuidance("")
		onClose()
	}

	return (
		<Dialog open={isOpen} onOpenChange={handleClose}>
			<DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Schedule Workout</DialogTitle>
					<DialogDescription>
						Select a workout from your team's programming tracks for{" "}
						{selectedDate?.toDateString()}
					</DialogDescription>
				</DialogHeader>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					{/* Track Selection */}
					<div className="space-y-4">
						<h3 className="text-lg font-semibold">Select Programming Track</h3>
						{isLoadingTracks ? (
							<div className="text-center text-muted-foreground">
								Loading tracks...
							</div>
						) : (
							<div className="space-y-2">
								{/* Standalone Workouts Option */}
								<Card
									className={`cursor-pointer transition-colors ${
										selectedTrack?.id === STANDALONE_TRACK_ID
											? "border-primary bg-primary/10"
											: "hover:bg-muted/50"
									}`}
									onClick={() => {
										setSelectedTrack({
											id: STANDALONE_TRACK_ID,
											name: "All Available Workouts",
											description:
												"Workouts not assigned to any programming track",
											type: "standalone",
										})
										// Clear track workout selection when switching to standalone
										setSelectedWorkout(null)
									}}
								>
									<CardHeader className="pb-2">
										<CardTitle className="text-sm">
											All Available Workouts
										</CardTitle>
										<CardDescription className="text-xs">
											Workouts not assigned to any programming track
										</CardDescription>
									</CardHeader>
								</Card>

								{/* Programming Tracks */}
								{tracks.map((track) => (
									<Card
										key={track.id}
										className={`cursor-pointer transition-colors ${
											selectedTrack?.id === track.id
												? "border-primary bg-primary/10"
												: "hover:bg-muted/50"
										}`}
										onClick={() => {
											setSelectedTrack(track)
											// Clear standalone workout selection when switching to track
											setSelectedStandaloneWorkout(null)
										}}
									>
										<CardHeader className="pb-2">
											<CardTitle className="text-sm">{track.name}</CardTitle>
											{track.description && (
												<CardDescription className="text-xs">
													{track.description}
												</CardDescription>
											)}
										</CardHeader>
									</Card>
								))}
							</div>
						)}
					</div>

					{/* Workout Selection */}
					<div className="space-y-4">
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
								<div className="space-y-2">
									{standaloneWorkouts.map((workout) => (
										<Card
											key={workout.id}
											className={`cursor-pointer transition-colors ${
												selectedStandaloneWorkout?.id === workout.id
													? "border-primary bg-primary/10"
													: "hover:bg-muted/50"
											}`}
											onClick={() => {
												setSelectedStandaloneWorkout(workout)
												// Clear track workout selection when switching to standalone
												setSelectedWorkout(null)
											}}
										>
											<CardHeader className="pb-2">
												<CardTitle className="text-sm">
													{workout.name}
												</CardTitle>
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
											No standalone workouts available. All workouts are
											assigned to programming tracks.
										</div>
									)}
								</div>
							)
						) : // Show track workouts (existing logic)
						isLoadingWorkouts ? (
							<div className="text-center text-muted-foreground">
								Loading workouts...
							</div>
						) : (
							<div className="space-y-2">
								{trackWorkouts.map((trackWorkout) => (
									<Card
										key={trackWorkout.id}
										className={`cursor-pointer transition-colors ${
											selectedWorkout?.id === trackWorkout.id
												? "border-primary bg-primary/10"
												: "hover:bg-muted/50"
										}`}
										onClick={() => {
											setSelectedWorkout(trackWorkout)
											// Clear standalone workout selection when switching to track workout
											setSelectedStandaloneWorkout(null)
										}}
									>
										<CardHeader className="pb-2">
											<CardTitle className="text-sm">
												Day {trackWorkout.dayNumber}
												{trackWorkout.weekNumber &&
													` - Week ${trackWorkout.weekNumber}`}
											</CardTitle>
											{trackWorkout.workout && (
												<CardDescription className="text-xs">
													{trackWorkout.workout.name} (
													{trackWorkout.workout.scheme})
												</CardDescription>
											)}
											{trackWorkout.notes && (
												<CardDescription className="text-xs">
													{trackWorkout.notes}
												</CardDescription>
											)}
										</CardHeader>
									</Card>
								))}
							</div>
						)}
					</div>
				</div>

				{/* Scheduling Details */}
				{(selectedWorkout || selectedStandaloneWorkout) && (
					<div className="space-y-4 border-t pt-4">
						<h3 className="text-lg font-semibold">Scheduling Details</h3>

						{/* Show selected workout info */}
						<div className="bg-muted/50 p-3 rounded-lg">
							<h4 className="font-medium text-sm mb-1">Selected Workout:</h4>
							{selectedWorkout ? (
								<p className="text-sm text-muted-foreground">
									{selectedWorkout.workout?.name} from {selectedTrack?.name}
									{selectedWorkout.dayNumber &&
										` (Day ${selectedWorkout.dayNumber})`}
								</p>
							) : selectedStandaloneWorkout ? (
								<p className="text-sm text-muted-foreground">
									{selectedStandaloneWorkout.name} (Standalone workout)
								</p>
							) : null}
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="classTimes">Class Times (optional)</Label>
								<Input
									id="classTimes"
									placeholder="e.g., 6:00 AM, 12:00 PM, 6:00 PM"
									value={classTimes}
									onChange={(e) => setClassTimes(e.target.value)}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="teamNotes">Staff Notes (optional)</Label>
								<Textarea
									id="teamNotes"
									placeholder="Any team-specific notes..."
									value={teamNotes}
									onChange={(e) => setTeamNotes(e.target.value)}
									rows={2}
								/>
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor="scalingGuidance">
								Scaling Guidance (optional)
							</Label>
							<Textarea
								id="scalingGuidance"
								placeholder="Scaling options and modifications..."
								value={scalingGuidance}
								onChange={(e) => setScalingGuidance(e.target.value)}
								rows={3}
							/>
						</div>
					</div>
				)}

				<div className="flex justify-end space-x-2 border-t pt-4">
					<Button variant="outline" onClick={handleClose}>
						Cancel
					</Button>
					<Button
						onClick={handleScheduleWorkout}
						disabled={
							(!selectedWorkout && !selectedStandaloneWorkout) ||
							isScheduling ||
							isSchedulingStandalone
						}
					>
						{isScheduling || isSchedulingStandalone
							? "Scheduling..."
							: "Schedule Workout"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}
