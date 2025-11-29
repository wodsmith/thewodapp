"use client"

import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useServerAction } from "@repo/zsa-react"
import {
	updateCompetitionEventAction,
	updateCompetitionWorkoutAction,
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
import type { Movement, Tag } from "@/db/schema"
import type { CompetitionWorkout } from "@/server/competition-workouts"

const WORKOUT_SCHEMES = [
	{ value: "time", label: "For Time" },
	{ value: "time-with-cap", label: "For Time (with cap)" },
	{ value: "rounds-reps", label: "AMRAP (rounds + reps)" },
	{ value: "reps", label: "Max Reps" },
	{ value: "load", label: "Max Load" },
	{ value: "calories", label: "Max Calories" },
	{ value: "meters", label: "Max Distance (meters)" },
	{ value: "feet", label: "Max Distance (feet)" },
	{ value: "points", label: "Points" },
	{ value: "pass-fail", label: "Pass/Fail" },
	{ value: "emom", label: "EMOM" },
]

const SCORE_TYPES = [
	{ value: "min", label: "Min (lowest single set wins)" },
	{ value: "max", label: "Max (highest single set wins)" },
	{ value: "sum", label: "Sum (total across rounds)" },
	{ value: "average", label: "Average (mean across rounds)" },
]

const TIEBREAK_SCHEMES = [
	{ value: "time", label: "Time" },
	{ value: "reps", label: "Reps" },
]

const SECONDARY_SCHEMES = [
	{ value: "time", label: "For Time" },
	{ value: "rounds-reps", label: "AMRAP (rounds + reps)" },
	{ value: "reps", label: "Max Reps" },
	{ value: "load", label: "Max Load" },
	{ value: "calories", label: "Max Calories" },
	{ value: "meters", label: "Max Distance (meters)" },
	{ value: "feet", label: "Max Distance (feet)" },
	{ value: "points", label: "Points" },
	{ value: "pass-fail", label: "Pass/Fail" },
	{ value: "emom", label: "EMOM" },
]

// Get default score type based on scheme
function getDefaultScoreType(scheme: string): string | undefined {
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
		default:
			return undefined
	}
}

interface Division {
	id: string
	label: string
	position: number
	registrationCount: number
}

interface EventDetailsFormProps {
	event: CompetitionWorkout
	competitionId: string
	organizingTeamId: string
	divisions: Division[]
	movements: Movement[]
	tags: Tag[]
}

export function EventDetailsForm({
	event,
	competitionId,
	organizingTeamId,
	divisions,
	movements,
	tags: initialTags,
}: EventDetailsFormProps) {
	const router = useRouter()

	// Form state
	const [name, setName] = useState(event.workout.name)
	const [description, setDescription] = useState(event.workout.description || "")
	const [scheme, setScheme] = useState(event.workout.scheme)
	const [scoreType, setScoreType] = useState<string | null>(event.workout.scoreType)
	const [roundsToScore, setRoundsToScore] = useState<number | null>(event.workout.roundsToScore)
	const [repsPerRound, setRepsPerRound] = useState<number | null>(event.workout.repsPerRound)
	const [tiebreakScheme, setTiebreakScheme] = useState<string | null>(event.workout.tiebreakScheme)
	const [secondaryScheme, setSecondaryScheme] = useState<string | null>(event.workout.secondaryScheme)
	const [pointsMultiplier, setPointsMultiplier] = useState(
		event.pointsMultiplier || 100,
	)
	const [notes, setNotes] = useState(event.notes || "")

	// Tags and movements state
	const [tags, setTags] = useState<Tag[]>(initialTags)
	const [selectedTags, setSelectedTags] = useState<string[]>(
		event.workout.tags?.map((t) => t.id) ?? []
	)
	const [selectedMovements, setSelectedMovements] = useState<string[]>(
		event.workout.movements?.map((m) => m.id) ?? []
	)
	const [newTag, setNewTag] = useState("")

	// Auto-set scoreType when scheme changes (only if not already set or changing from default)
	useEffect(() => {
		const defaultScoreType = getDefaultScoreType(scheme)
		// Only auto-set if score type is not set
		if (!scoreType && defaultScoreType) {
			setScoreType(defaultScoreType)
		}
	}, [scheme, scoreType])

	const handleAddTag = () => {
		if (newTag && !tags.some((t) => t.name === newTag)) {
			const id = `new_tag_${crypto.randomUUID()}`
			const newTagObj = {
				id,
				name: newTag,
				createdAt: new Date(),
				updatedAt: new Date(),
				updateCounter: null,
			}
			setTags([...tags, newTagObj])
			setSelectedTags([...selectedTags, id])
			setNewTag("")
		}
	}

	const handleTagToggle = (tagId: string) => {
		if (selectedTags.includes(tagId)) {
			setSelectedTags(selectedTags.filter((id) => id !== tagId))
		} else {
			setSelectedTags([...selectedTags, tagId])
		}
	}

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

	const isSaving = isUpdatingEvent || isUpdatingWorkout

	const handleSave = async () => {
		// Update workout details
		const [eventResult, eventError] = await updateEvent({
			trackWorkoutId: event.id,
			workoutId: event.workoutId,
			organizingTeamId,
			name,
			description,
			scheme,
			scoreType,
			roundsToScore,
			repsPerRound,
			tiebreakScheme: tiebreakScheme as "time" | "reps" | null,
			secondaryScheme: secondaryScheme as "time" | "pass-fail" | "rounds-reps" | "reps" | "emom" | "load" | "calories" | "meters" | "feet" | "points" | null,
			tagIds: selectedTags,
			movementIds: selectedMovements,
		})

		if (eventError) {
			toast.error(eventError.message || "Failed to update event")
			return
		}

		// Update track workout details (points multiplier, notes)
		const [workoutResult, workoutError] = await updateWorkout({
			trackWorkoutId: event.id,
			organizingTeamId,
			pointsMultiplier,
			notes: notes || null,
		})

		if (workoutError) {
			toast.error(workoutError.message || "Failed to update event settings")
			return
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
						<Select value={scheme} onValueChange={setScheme}>
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
								onValueChange={(v) => setScoreType(v === "none" ? null : v)}
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
								onValueChange={(v) => setTiebreakScheme(v === "none" ? null : v)}
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
								onValueChange={(v) => setSecondaryScheme(v === "none" ? null : v)}
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

			{/* Tags and Movements */}
			<Card>
				<CardHeader>
					<CardTitle>Tags & Movements</CardTitle>
					<CardDescription>
						Categorize this event and track which movements are used
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Tags */}
					<div className="space-y-2">
						<Label>Tags</Label>
						<div className="flex gap-2">
							<Input
								type="text"
								className="flex-1"
								placeholder="Add a tag"
								value={newTag}
								onChange={(e) => setNewTag(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault()
										handleAddTag()
									}
								}}
							/>
							<Button type="button" size="icon" onClick={handleAddTag}>
								<Plus className="h-4 w-4" />
							</Button>
						</div>
						<div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
							{tags.map((tag) => {
								const isSelected = selectedTags.includes(tag.id)
								return (
									<Badge
										key={tag.id}
										variant={isSelected ? "default" : "outline"}
										className="cursor-pointer"
										onClick={() => handleTagToggle(tag.id)}
									>
										{tag.name}
										{isSelected && " ✓"}
									</Badge>
								)
							})}
						</div>
					</div>

					{/* Movements */}
					<div className="space-y-2">
						<Label>Movements</Label>
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

			{/* Division-Specific Descriptions (placeholder for now) */}
			{divisions.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>Division Variations</CardTitle>
						<CardDescription>
							Customize the workout description for each division
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground">
							Division-specific descriptions coming soon. This will allow you to
							specify different weights, movements, or scaling for each division
							(e.g., RX vs Scaled).
						</p>
						<div className="mt-4 space-y-2">
							{divisions.map((division) => (
								<div
									key={division.id}
									className="p-3 border rounded-lg bg-muted/50"
								>
									<span className="font-medium">{division.label}</span>
									<span className="text-sm text-muted-foreground ml-2">
										- Uses default description
									</span>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}

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
