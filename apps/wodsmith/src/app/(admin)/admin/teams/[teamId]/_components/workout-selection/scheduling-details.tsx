import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { ProgrammingTrack, StandaloneWorkout, TrackWorkout } from "./types"

interface SchedulingDetailsProps {
	selectedWorkout: TrackWorkout | null
	selectedStandaloneWorkout: StandaloneWorkout | null
	selectedTrack: ProgrammingTrack | null
	classTimes: string
	teamNotes: string
	scalingGuidance: string
	onClassTimesChange: (value: string) => void
	onTeamNotesChange: (value: string) => void
	onScalingGuidanceChange: (value: string) => void
	onSchedule: () => void
	onCancel: () => void
	isScheduling: boolean
	isSchedulingStandalone: boolean
}

export function SchedulingDetails({
	selectedWorkout,
	selectedStandaloneWorkout,
	selectedTrack,
	classTimes,
	teamNotes,
	scalingGuidance,
	onClassTimesChange,
	onTeamNotesChange,
	onScalingGuidanceChange,
	onSchedule,
	onCancel,
	isScheduling,
	isSchedulingStandalone,
}: SchedulingDetailsProps) {
	const handleSchedule = () => {
		if (process.env.LOG_LEVEL === "debug") {
			console.log(
				`DEBUG: [SchedulingDetails] Form submitted with classTimes: '${classTimes}', teamNotes length: ${teamNotes.length}, scalingGuidance length: ${scalingGuidance.length}`,
			)
		}
		onSchedule()
	}

	// Only render if a workout is selected
	if (!selectedWorkout && !selectedStandaloneWorkout) {
		return null
	}

	return (
		<section
			className="flex-1 space-y-4 pl-6 border-l"
			data-testid="scheduling-details"
		>
			<h3 className="text-lg font-semibold">Scheduling Details</h3>

			{/* Show selected workout info */}
			<div
				className="bg-muted/50 p-3 rounded-lg"
				data-testid="selected-workout-info"
			>
				<h4 className="font-medium text-sm mb-1">Selected Workout:</h4>
				{selectedWorkout ? (
					<p className="text-sm text-muted-foreground">
						{selectedWorkout.workout?.name} from {selectedTrack?.name}
						{selectedWorkout.dayNumber > 0 &&
							` (Day ${selectedWorkout.dayNumber})`}
					</p>
				) : selectedStandaloneWorkout ? (
					<p className="text-sm text-muted-foreground">
						{selectedStandaloneWorkout.name} (Standalone workout)
					</p>
				) : null}
			</div>

			<div className="grid grid-cols-1 gap-4" data-testid="scheduling-form">
				<div className="space-y-2">
					<Label htmlFor="classTimes">Class Times (optional)</Label>
					<Input
						id="classTimes"
						placeholder="e.g., 6:00 AM, 12:00 PM, 6:00 PM"
						value={classTimes}
						onChange={(e) => onClassTimesChange(e.target.value)}
						data-testid="class-times-input"
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="teamNotes">Staff Notes (optional)</Label>
					<Textarea
						id="teamNotes"
						placeholder="Any team-specific notes..."
						value={teamNotes}
						onChange={(e) => onTeamNotesChange(e.target.value)}
						rows={2}
						data-testid="team-notes-input"
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="scalingGuidance">Scaling Guidance (optional)</Label>
					<Textarea
						id="scalingGuidance"
						placeholder="Scaling options and modifications..."
						value={scalingGuidance}
						onChange={(e) => onScalingGuidanceChange(e.target.value)}
						rows={3}
						data-testid="scaling-guidance-input"
					/>
				</div>
			</div>

			<div className="flex justify-end space-x-2 border-t pt-4 mt-6 pb-4">
				<Button
					variant="outline"
					onClick={onCancel}
					data-testid="cancel-button"
				>
					Cancel
				</Button>
				<Button
					onClick={handleSchedule}
					disabled={
						(!selectedWorkout && !selectedStandaloneWorkout) ||
						isScheduling ||
						isSchedulingStandalone
					}
					data-testid="schedule-button"
				>
					{isScheduling || isSchedulingStandalone
						? "Scheduling..."
						: "Schedule Workout"}
				</Button>
			</div>
		</section>
	)
}
