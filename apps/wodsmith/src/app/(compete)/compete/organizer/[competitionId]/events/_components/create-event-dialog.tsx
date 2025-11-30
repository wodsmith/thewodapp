"use client"

import { Plus } from "lucide-react"
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
import type { Movement, Tag } from "@/db/schema"
import type {
	WorkoutScheme,
	ScoreType,
	TiebreakScheme,
	SecondaryScheme,
} from "@/db/schemas/workouts"
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

interface CreateEventDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onCreateEvent: (data: {
		name: string
		scheme: WorkoutScheme
		scoreType?: ScoreType
		description?: string
		roundsToScore?: number
		repsPerRound?: number
		tiebreakScheme?: TiebreakScheme
		secondaryScheme?: SecondaryScheme
		tagIds?: string[]
		tagNames?: string[]
		movementIds?: string[]
	}) => Promise<void>
	isCreating?: boolean
	movements: Movement[]
	tags: Tag[]
}

export function CreateEventDialog({
	open,
	onOpenChange,
	onCreateEvent,
	isCreating,
	movements,
	tags: initialTags,
}: CreateEventDialogProps) {
	const [name, setName] = useState("")
	const [scheme, setScheme] = useState<WorkoutScheme>("time")
	const [scoreType, setScoreType] = useState<ScoreType>("min")
	const [description, setDescription] = useState("")
	const [roundsToScore, setRoundsToScore] = useState<number | undefined>(undefined)
	const [repsPerRound, setRepsPerRound] = useState<number | undefined>(undefined)
	const [tiebreakScheme, setTiebreakScheme] = useState<TiebreakScheme | undefined>(undefined)
	const [secondaryScheme, setSecondaryScheme] = useState<SecondaryScheme | undefined>(undefined)
	const [selectedTags, setSelectedTags] = useState<string[]>([])
	const [selectedMovements, setSelectedMovements] = useState<string[]>([])
	const [newTag, setNewTag] = useState("")
	const [tags, setTags] = useState<Tag[]>(initialTags)
	const [showAdvanced, setShowAdvanced] = useState(false)

	// Auto-set scoreType when scheme changes
	useEffect(() => {
		const defaultScoreType = getDefaultScoreType(scheme)
		setScoreType(defaultScoreType)
	}, [scheme])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!name.trim() || !scheme) return

		// Separate new tags (with temp IDs) from existing tags
		const existingTagIds = selectedTags.filter((id) => !id.startsWith("new_tag_"))
		const newTagIds = selectedTags.filter((id) => id.startsWith("new_tag_"))
		const newTagNames = newTagIds
			.map((id) => tags.find((t) => t.id === id)?.name)
			.filter((name): name is string => !!name)

		await onCreateEvent({
			name: name.trim(),
			scheme,
			scoreType,
			description: description.trim() || undefined,
			roundsToScore,
			repsPerRound,
			tiebreakScheme,
			secondaryScheme,
			tagIds: existingTagIds.length > 0 ? existingTagIds : undefined,
			tagNames: newTagNames.length > 0 ? newTagNames : undefined,
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
		setRepsPerRound(undefined)
		setTiebreakScheme(undefined)
		setSecondaryScheme(undefined)
		setSelectedTags([])
		setSelectedMovements([])
		setNewTag("")
		setShowAdvanced(false)
	}

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
							Create a new workout event for this competition. You can add more details like division-specific descriptions after creating.
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
								<Select value={scoreType} onValueChange={(v) => setScoreType(v as ScoreType)}>
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
											e.target.value ? Number.parseInt(e.target.value) : undefined
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
											e.target.value ? Number.parseInt(e.target.value) : undefined
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
									onValueChange={(v) => setTiebreakScheme(v === "none" ? undefined : v as TiebreakScheme)}
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
									onValueChange={(v) => setSecondaryScheme(v === "none" ? undefined : v as SecondaryScheme)}
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


						{/* Tags and Movements - Collapsible */}
						<Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
							<CollapsibleTrigger asChild>
								<Button type="button" variant="ghost" className="w-full justify-between">
									<span>Tags & Movements</span>
									<span className="text-muted-foreground text-sm">
										{selectedTags.length > 0 || selectedMovements.length > 0
											? `(${selectedTags.length} tags, ${selectedMovements.length} movements)`
											: "(optional)"}
									</span>
								</Button>
							</CollapsibleTrigger>
							<CollapsibleContent className="space-y-4 pt-2">
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
									<div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
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
