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
} from "../_actions/programming-actions"
import { scheduleWorkoutAction } from "../_actions/scheduling-actions"

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
	const [tracks, setTracks] = useState<ProgrammingTrack[]>([])
	const [trackWorkouts, setTrackWorkouts] = useState<TrackWorkout[]>([])
	const [classTimes, setClassTimes] = useState("")
	const [teamNotes, setTeamNotes] = useState("")
	const [scalingGuidance, setScalingGuidance] = useState("")

	const { execute: getTeamTracks, isPending: isLoadingTracks } =
		useServerAction(getTeamTracksAction)
	const { execute: getWorkoutsForTrack, isPending: isLoadingWorkouts } =
		useServerAction(getWorkoutsForTrackAction)
	const { execute: scheduleWorkout, isPending: isScheduling } = useServerAction(
		scheduleWorkoutAction,
	)

	// Load team tracks when modal opens
	useEffect(() => {
		if (isOpen && teamId) {
			loadTeamTracks()
		}
	}, [isOpen, teamId])

	// Load workouts when track is selected
	useEffect(() => {
		if (selectedTrack) {
			loadTrackWorkouts(selectedTrack.id)
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

	const handleScheduleWorkout = async () => {
		if (!selectedWorkout || !selectedDate) {
			toast.error("Please select a workout and date")
			return
		}

		const [result] = await scheduleWorkout({
			teamId,
			trackWorkoutId: selectedWorkout.id,
			scheduledDate: selectedDate.toISOString(),
			teamSpecificNotes: teamNotes || undefined,
			scalingGuidanceForDay: scalingGuidance || undefined,
			classTimes: classTimes || undefined,
		})

		if (result?.success) {
			console.log(
				`INFO: [WorkoutScheduling] Workflow completed: selected workout '${
					selectedWorkout.workoutId
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
		setTrackWorkouts([])
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
								{tracks.map((track) => (
									<Card
										key={track.id}
										className={`cursor-pointer transition-colors ${
											selectedTrack?.id === track.id
												? "border-primary bg-primary/10"
												: "hover:bg-muted/50"
										}`}
										onClick={() => setSelectedTrack(track)}
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
						) : isLoadingWorkouts ? (
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
										onClick={() => setSelectedWorkout(trackWorkout)}
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
				{selectedWorkout && (
					<div className="space-y-4 border-t pt-4">
						<h3 className="text-lg font-semibold">Scheduling Details</h3>

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
								<Label htmlFor="teamNotes">Team Notes (optional)</Label>
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
						disabled={!selectedWorkout || isScheduling}
					>
						{isScheduling ? "Scheduling..." : "Schedule Workout"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}
