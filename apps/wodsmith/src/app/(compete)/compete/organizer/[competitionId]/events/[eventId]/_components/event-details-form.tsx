"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useServerAction } from "@repo/zsa-react"
import {
	updateCompetitionEventAction,
	updateCompetitionWorkoutAction,
	updateDivisionDescriptionsAction,
} from "@/actions/competition-actions"
import { MovementsList } from "@/components/movements-list"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Movement } from "@/db/schema"
import type {
	WorkoutScheme,
	ScoreType,
	TiebreakScheme,
	SecondaryScheme,
} from "@/db/schemas/workouts"
import type { CompetitionWorkout } from "@/server/competition-workouts"
import { WORKOUT_SCHEMES, SCORE_TYPES, TIEBREAK_SCHEMES, SECONDARY_SCHEMES } from "@/constants"

// Get default score type based on scheme
function getDefaultScoreType(scheme: WorkoutScheme): ScoreType {
	switch (scheme) {
		case "time":
		case "time-with-cap":
			return "min" // Lower time is better
		case "rounds-reps":
		case "reps":
		case "calories":
		case "meters":
		case "feet":
		case "load":
		case "emom":
		case "pass-fail":
		case "points":
			return "max" // Higher is better
	}
}

interface Division {
	id: string
	label: string
	position: number
	registrationCount: number
}

interface DivisionDescriptionData {
	divisionId: string
	divisionLabel: string
	description: string | null
}

interface EventDetailsFormProps {
	event: CompetitionWorkout
	competitionId: string
	organizingTeamId: string
	divisions: Division[]
	divisionDescriptions: DivisionDescriptionData[]
	movements: Movement[]
}

export function EventDetailsForm({
	event,
	competitionId,
	organizingTeamId,
	divisions,
	divisionDescriptions,
	movements,
}: EventDetailsFormProps) {
	const router = useRouter()

	// Form state
	const [name, setName] = useState(event.workout.name)
	const [description, setDescription] = useState(event.workout.description || "")
	const [scheme, setScheme] = useState<WorkoutScheme>(event.workout.scheme)
	const [scoreType, setScoreType] = useState<ScoreType | null>(event.workout.scoreType)
	const [roundsToScore, setRoundsToScore] = useState<number | null>(event.workout.roundsToScore)
	const [repsPerRound, setRepsPerRound] = useState<number | null>(event.workout.repsPerRound)
	const [tiebreakScheme, setTiebreakScheme] = useState<TiebreakScheme | null>(event.workout.tiebreakScheme)
	const [secondaryScheme, setSecondaryScheme] = useState<SecondaryScheme | null>(event.workout.secondaryScheme)
	const [pointsMultiplier, setPointsMultiplier] = useState(
		event.pointsMultiplier || 100,
	)
	const [notes, setNotes] = useState(event.notes || "")

	// Division descriptions state - map of divisionId to description
	const [divisionDescs, setDivisionDescs] = useState<Record<string, string>>(() => {
		const initial: Record<string, string> = {}
		for (const dd of divisionDescriptions) {
			initial[dd.divisionId] = dd.description || ""
		}
		return initial
	})

	// Movements state
	const [selectedMovements, setSelectedMovements] = useState<string[]>(
		event.workout.movements?.map((m) => m.id) ?? []
	)

	// Auto-set scoreType when scheme changes (only if not already set or changing from default)
	useEffect(() => {
		const defaultScoreType = getDefaultScoreType(scheme)
		// Only auto-set if score type is not set
		if (!scoreType && defaultScoreType) {
			setScoreType(defaultScoreType)
		}
	}, [scheme, scoreType])

	const handleMovementToggle = (movementId: string) => {
		if (selectedMovements.includes(movementId)) {
			setSelectedMovements(selectedMovements.filter((id) => id !== movementId))
		} else {
			setSelectedMovements([...selectedMovements, movementId])
		}
	}

	const { execute: updateEvent, isPending: isUpdatingEvent } = useServerAction(
		updateCompetitionEventAction,
	)

	const { execute: updateWorkout, isPending: isUpdatingWorkout } =
		useServerAction(updateCompetitionWorkoutAction)

	const { execute: updateDivisionDescs, isPending: isUpdatingDivisionDescs } =
		useServerAction(updateDivisionDescriptionsAction)

	const isSaving = isUpdatingEvent || isUpdatingWorkout || isUpdatingDivisionDescs

	const handleSave = async () => {
		// Update workout details
		const [_eventResult, eventError] = await updateEvent({
			trackWorkoutId: event.id,
			workoutId: event.workoutId,
			organizingTeamId,
			name,
			description,
			scheme,
			scoreType,
			roundsToScore,
			repsPerRound,
			tiebreakScheme,
			secondaryScheme,
			movementIds: selectedMovements,
		})

		if (eventError) {
			toast.error(eventError.message || "Failed to update event")
			return
		}

		// Update track workout details (points multiplier, notes)
		const [_workoutResult, workoutError] = await updateWorkout({
			trackWorkoutId: event.id,
			organizingTeamId,
			pointsMultiplier,
			notes: notes || null,
		})

		if (workoutError) {
			toast.error(workoutError.message || "Failed to update event settings")
			return
		}

		// Update division descriptions if there are divisions
		if (divisions.length > 0) {
			const descriptionsToUpdate = divisions.map((division) => ({
				divisionId: division.id,
				description: divisionDescs[division.id]?.trim() || null,
			}))

			const [_descResult, descError] = await updateDivisionDescs({
				workoutId: event.workoutId,
				organizingTeamId,
				descriptions: descriptionsToUpdate,
			})

			if (descError) {
				toast.error(descError.message || "Failed to update division descriptions")
				return
			}
		}

		toast.success("Event updated")
		router.refresh()
	}

	return (
		<div className="space-y-6">
			{/* Basic Details */}
			<Card>
				<CardHeader>
					<CardTitle>Event Details</CardTitle>
					<CardDescription>
						Basic information about this event
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="name">Event Name</Label>
						<Input
							id="name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g., Event 1 - Fran"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="scheme">Scheme</Label>
						<Select value={scheme} onValueChange={(v) => setScheme(v as WorkoutScheme)}>
							<SelectTrigger id="scheme">
								<SelectValue placeholder="Select scheme" />
							</SelectTrigger>
							<SelectContent>
								{WORKOUT_SCHEMES.map((s) => (
									<SelectItem key={s.value} value={s.value}>
										{s.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{scheme && (
						<div className="space-y-2">
							<Label htmlFor="scoreType">Score Type</Label>
							<Select
								value={scoreType ?? "none"}
								onValueChange={(v) => setScoreType(v === "none" ? null : v as ScoreType)}
							>
								<SelectTrigger id="scoreType">
									<SelectValue placeholder="Select score type" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">None</SelectItem>
									{SCORE_TYPES.map((s) => (
										<SelectItem key={s.value} value={s.value}>
											{s.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}

					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="roundsToScore">
								Rounds to Score <span className="text-muted-foreground">(optional)</span>
							</Label>
							<Input
								id="roundsToScore"
								type="number"
								placeholder="e.g., 4"
								value={roundsToScore ?? ""}
								onChange={(e) =>
									setRoundsToScore(
										e.target.value ? Number.parseInt(e.target.value) : null
									)
								}
								min="1"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="repsPerRound">
								Reps per Round <span className="text-muted-foreground">(optional)</span>
							</Label>
							<Input
								id="repsPerRound"
								type="number"
								placeholder="e.g., 10"
								value={repsPerRound ?? ""}
								onChange={(e) =>
									setRepsPerRound(
										e.target.value ? Number.parseInt(e.target.value) : null
									)
								}
								min="1"
							/>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="tiebreakScheme">
								Tiebreak Scheme <span className="text-muted-foreground">(optional)</span>
							</Label>
							<Select
								value={tiebreakScheme ?? "none"}
								onValueChange={(v) => setTiebreakScheme(v === "none" ? null : v as TiebreakScheme)}
							>
								<SelectTrigger id="tiebreakScheme">
									<SelectValue placeholder="None" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">None</SelectItem>
									{TIEBREAK_SCHEMES.map((s) => (
										<SelectItem key={s.value} value={s.value}>
											{s.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="secondaryScheme">
								Secondary Scheme <span className="text-muted-foreground">(optional)</span>
							</Label>
							<Select
								value={secondaryScheme ?? "none"}
								onValueChange={(v) => setSecondaryScheme(v === "none" ? null : v as SecondaryScheme)}
							>
								<SelectTrigger id="secondaryScheme">
									<SelectValue placeholder="None" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">None</SelectItem>
									{SECONDARY_SCHEMES.map((s) => (
										<SelectItem key={s.value} value={s.value}>
											{s.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="description">Description</Label>
						<Textarea
							id="description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="21-15-9 Thrusters, Pull-ups..."
							rows={6}
						/>
						<p className="text-xs text-muted-foreground">
							This is the default description shown to all athletes. You can add
							division-specific variations below.
						</p>
					</div>
				</CardContent>
			</Card>

			{/* Movements */}
			<Card>
				<CardHeader>
					<CardTitle>Movements</CardTitle>
					<CardDescription>
						Track which movements are used in this event
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						{selectedMovements.length > 0 && (
							<div className="flex flex-wrap gap-2 p-2 border rounded-md bg-muted/50">
								{movements
									.filter((m) => selectedMovements.includes(m.id))
									.map((movement) => (
										<Badge
											key={movement.id}
											variant="default"
											className="cursor-pointer"
											onClick={() => handleMovementToggle(movement.id)}
										>
											{movement.name} ✓
										</Badge>
									))}
							</div>
						)}
						<div className="border rounded-md">
							<MovementsList
								movements={movements}
								selectedMovements={selectedMovements}
								onMovementToggle={handleMovementToggle}
								mode="selectable"
								variant="compact"
								showLabel={false}
								containerHeight="h-[250px]"
							/>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Competition Settings */}
			<Card>
				<CardHeader>
					<CardTitle>Competition Settings</CardTitle>
					<CardDescription>
						Settings specific to this competition event
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="pointsMultiplier">Points Multiplier</Label>
						<div className="flex items-center gap-2">
							<Input
								id="pointsMultiplier"
								type="number"
								min={1}
								max={1000}
								value={pointsMultiplier}
								onChange={(e) => setPointsMultiplier(Number(e.target.value))}
								className="w-24"
							/>
							<span className="text-sm text-muted-foreground">
								% (100 = normal, 200 = 2x points)
							</span>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="notes">Organizer Notes</Label>
						<Textarea
							id="notes"
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							placeholder="Internal notes (not shown to athletes)..."
							rows={3}
						/>
						<p className="text-xs text-muted-foreground">
							These notes are only visible to competition organizers.
						</p>
					</div>
				</CardContent>
			</Card>

			{/* Division-Specific Descriptions */}
			<Card>
				<CardHeader>
					<CardTitle>Division Variations</CardTitle>
					<CardDescription>
						{divisions.length > 0
							? "Customize the workout description for each division. Leave empty to use the default description above."
							: "Create divisions for this competition to add division-specific workout variations."}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{divisions.length > 0 ? (
						divisions
							.sort((a, b) => a.position - b.position)
							.map((division) => (
								<div key={division.id} className="space-y-2">
									<div className="flex items-center justify-between">
										<Label htmlFor={`division-${division.id}`}>
											{division.label}
											{division.registrationCount > 0 && (
												<span className="text-muted-foreground ml-2 font-normal">
													({division.registrationCount} athlete{division.registrationCount !== 1 ? "s" : ""})
												</span>
											)}
										</Label>
										<span className="text-xs text-muted-foreground">
											{divisionDescs[division.id]?.trim() ? "Custom" : "Using default"}
										</span>
									</div>
									<Textarea
										id={`division-${division.id}`}
										value={divisionDescs[division.id] || ""}
										onChange={(e) =>
											setDivisionDescs((prev) => ({
												...prev,
												[division.id]: e.target.value,
											}))
										}
										placeholder={`Custom description for ${division.label}... (leave empty to use default)`}
										rows={4}
									/>
								</div>
							))
					) : (
						<div className="text-center py-6">
							<p className="text-muted-foreground mb-4">
								No divisions have been created for this competition yet.
							</p>
							<Button
								variant="outline"
								onClick={() => router.push(`/compete/organizer/${competitionId}/divisions`)}
							>
								Create Divisions
							</Button>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Actions */}
			<div className="flex items-center justify-end gap-4">
				<Button
					variant="outline"
					onClick={() => router.push(`/compete/organizer/${competitionId}/events`)}
				>
					Cancel
				</Button>
				<Button onClick={handleSave} disabled={isSaving || !name.trim()}>
					{isSaving ? "Saving..." : "Save Changes"}
				</Button>
			</div>
		</div>
	)
}
