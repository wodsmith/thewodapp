"use client"

import { useEffect, useState } from "react"
import { MovementsList } from "@/components/movements-list"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { SCORE_TYPES, TIEBREAK_SCHEMES, WORKOUT_SCHEMES } from "@/constants"
import type { Movement } from "@/db/schema"
import type {
	ScoreType,
	TiebreakScheme,
	WorkoutScheme,
} from "@/db/schemas/workouts"

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

interface CreateEventDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onCreateEvent: (data: {
		name: string
		scheme: WorkoutScheme
		scoreType?: ScoreType
		description?: string
		roundsToScore?: number
		tiebreakScheme?: TiebreakScheme
		movementIds?: string[]
	}) => Promise<void>
	isCreating?: boolean
	movements: Movement[]
}

export function CreateEventDialog({
	open,
	onOpenChange,
	onCreateEvent,
	isCreating,
	movements,
}: CreateEventDialogProps) {
	const [name, setName] = useState("")
	const [scheme, setScheme] = useState<WorkoutScheme>("time")
	const [scoreType, setScoreType] = useState<ScoreType>("min")
	const [description, setDescription] = useState("")
	const [roundsToScore, setRoundsToScore] = useState<number | undefined>(
		undefined,
	)
	const [tiebreakScheme, setTiebreakScheme] = useState<
		TiebreakScheme | undefined
	>(undefined)
	const [selectedMovements, setSelectedMovements] = useState<string[]>([])
	const [showAdvanced, setShowAdvanced] = useState(false)

	// Auto-set scoreType when scheme changes
	useEffect(() => {
		const defaultScoreType = getDefaultScoreType(scheme)
		setScoreType(defaultScoreType)
	}, [scheme])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!name.trim() || !scheme) return

		await onCreateEvent({
			name: name.trim(),
			scheme,
			scoreType,
			description: description.trim() || undefined,
			roundsToScore,
			tiebreakScheme,
			movementIds: selectedMovements.length > 0 ? selectedMovements : undefined,
		})

		// Reset form
		resetForm()
	}

	const resetForm = () => {
		setName("")
		setScheme("time" as WorkoutScheme)
		setScoreType("min" as ScoreType)
		setDescription("")
		setRoundsToScore(undefined)
		setTiebreakScheme(undefined)
		setSelectedMovements([])
		setShowAdvanced(false)
	}

	const handleMovementToggle = (movementId: string) => {
		if (selectedMovements.includes(movementId)) {
			setSelectedMovements(selectedMovements.filter((id) => id !== movementId))
		} else {
			setSelectedMovements([...selectedMovements, movementId])
		}
	}

	const handleOpenChange = (newOpen: boolean) => {
		if (!newOpen) {
			// Reset form when closing
			resetForm()
		}
		onOpenChange(newOpen)
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>Create New Event</DialogTitle>
						<DialogDescription>
							Create a new workout event for this competition. You can add more
							details like division-specific descriptions after creating.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="name">Event Name</Label>
							<Input
								id="name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="e.g., Event 1 - Fran"
								autoFocus
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="scheme">Scheme</Label>
							<Select
								value={scheme}
								onValueChange={(v) => setScheme(v as WorkoutScheme)}
							>
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
									value={scoreType}
									onValueChange={(v) => setScoreType(v as ScoreType)}
								>
									<SelectTrigger id="scoreType">
										<SelectValue placeholder="Select score type" />
									</SelectTrigger>
									<SelectContent>
										{SCORE_TYPES.map((s) => (
											<SelectItem key={s.value} value={s.value}>
												{s.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						)}

						<div className="space-y-2">
							<Label htmlFor="roundsToScore">
								Rounds to Score{" "}
								<span className="text-muted-foreground">(optional)</span>
							</Label>
							<Input
								id="roundsToScore"
								type="number"
								placeholder="e.g., 4"
								value={roundsToScore ?? ""}
								onChange={(e) =>
									setRoundsToScore(
										e.target.value
											? Number.parseInt(e.target.value)
											: undefined,
									)
								}
								min="1"
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="tiebreakScheme">
								Tiebreak Scheme{" "}
								<span className="text-muted-foreground">(optional)</span>
							</Label>
							<Select
								value={tiebreakScheme ?? "none"}
								onValueChange={(v) =>
									setTiebreakScheme(
										v === "none" ? undefined : (v as TiebreakScheme),
									)
								}
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

						{/* Movements - Collapsible */}
						<Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
							<CollapsibleTrigger asChild>
								<Button
									type="button"
									variant="ghost"
									className="w-full justify-between"
								>
									<span>Movements</span>
									<span className="text-muted-foreground text-sm">
										{selectedMovements.length > 0
											? `(${selectedMovements.length} selected)`
											: "(optional)"}
									</span>
								</Button>
							</CollapsibleTrigger>
							<CollapsibleContent className="space-y-4 pt-2">
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
											containerHeight="h-[200px]"
										/>
									</div>
								</div>
							</CollapsibleContent>
						</Collapsible>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => handleOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isCreating || !name.trim()}>
							{isCreating ? "Creating..." : "Create Event"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
