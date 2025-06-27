"use client"

import { Plus, X } from "lucide-react"
import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
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
import type { Prettify } from "@/lib/utils"
import type {
	Movement,
	Tag,
	Workout,
	WorkoutUpdate,
	WorkoutWithTagsAndMovements,
} from "@/types"

type Props = Prettify<{
	workout: WorkoutWithTagsAndMovements
	movements: Movement[]
	tags: Tag[]
	workoutId: string
	updateWorkoutAction: (data: {
		id: string
		workout: WorkoutUpdate
		tagIds: string[]
		movementIds: string[]
	}) => Promise<void>
	onCancel: () => void
}>
type TagWithoutSaved = Omit<Tag, "createdAt" | "updatedAt" | "updateCounter">
export default function EditWorkoutClientCompact({
	workout,
	movements,
	tags: initialTags,
	workoutId,
	updateWorkoutAction,
	onCancel,
}: Props) {
	const [name, setName] = useState(workout?.name || "")
	const [description, setDescription] = useState(workout?.description || "")
	const [scheme, setScheme] = useState<WorkoutUpdate["scheme"]>(workout?.scheme)
	const [scope, setScope] = useState(workout?.scope || "private")
	const [tags, setTags] = useState<TagWithoutSaved[]>(initialTags)
	const [selectedMovements, setSelectedMovements] = useState<string[]>(
		(workout?.movements || []).map((m) => m.id),
	)
	const [selectedTags, setSelectedTags] = useState<string[]>(
		(workout?.tags || []).map((t) => (typeof t === "string" ? t : t.id)),
	)
	const [newTag, setNewTag] = useState("")
	const [repsPerRound, setRepsPerRound] = useState<number | undefined>(
		workout?.repsPerRound === null ? undefined : workout?.repsPerRound,
	)
	const [roundsToScore, setRoundsToScore] = useState<number | undefined>(
		workout?.roundsToScore === null ? 1 : workout?.roundsToScore || 1,
	)

	const handleAddTag = () => {
		if (newTag && !tags.some((t) => t.name === newTag)) {
			const id = crypto.randomUUID()
			setTags([...tags, { id, name: newTag }])
			setSelectedTags([...selectedTags, id])
			setNewTag("")
		}
	}

	const handleRemoveTag = (tagId: string) => {
		setSelectedTags(selectedTags.filter((id) => id !== tagId))
	}

	const handleMovementToggle = (movementId: string) => {
		if (selectedMovements.includes(movementId)) {
			setSelectedMovements(selectedMovements.filter((id) => id !== movementId))
		} else {
			setSelectedMovements([...selectedMovements, movementId])
		}
	}

	const handleTagToggle = (tagId: string) => {
		if (selectedTags.includes(tagId)) {
			setSelectedTags(selectedTags.filter((id) => id !== tagId))
		} else {
			setSelectedTags([...selectedTags, tagId])
		}
	}

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		await updateWorkoutAction({
			id: workoutId,
			workout: {
				name,
				description,
				scheme,
				scope,
				repsPerRound: repsPerRound === undefined ? null : repsPerRound,
				roundsToScore: roundsToScore === undefined ? null : roundsToScore,
			},
			tagIds: selectedTags,
			movementIds: selectedMovements,
		})
	}

	return (
		<div>
			<h2 className="mb-2 text-base font-bold">Edit Workout</h2>
			<form
				className="border-2 border-black p-4 dark:border-white"
				onSubmit={handleSubmit}
			>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div className="space-y-4">
						<div>
							<Label htmlFor="workout-name-compact">Workout Name</Label>
							<Input
								id="workout-name-compact"
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
							/>
						</div>

						<div>
							<Label htmlFor="workout-description-compact">Description</Label>
							<Textarea
								id="workout-description-compact"
								rows={3}
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								required
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<Label htmlFor="workout-scheme-compact">Scheme</Label>
								<Select
									value={scheme}
									onValueChange={(value) =>
										setScheme(value as WorkoutUpdate["scheme"])
									}
								>
									<SelectTrigger id="workout-scheme-compact">
										<SelectValue placeholder="Select a scheme" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="time">For Time</SelectItem>
										<SelectItem value="time-with-cap">
											For Time (with cap)
										</SelectItem>
										<SelectItem value="rounds-reps">
											AMRAP (Rounds + Reps)
										</SelectItem>
										<SelectItem value="reps">Max Reps</SelectItem>
										<SelectItem value="emom">EMOM</SelectItem>
										<SelectItem value="load">Max Load</SelectItem>
										<SelectItem value="calories">Calories</SelectItem>
										<SelectItem value="meters">Meters</SelectItem>
										<SelectItem value="pass-fail">Pass/Fail</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label htmlFor="workout-scope-compact">Scope</Label>
								<Select
									value={scope}
									onValueChange={(value) => setScope(value as Workout["scope"])}
								>
									<SelectTrigger id="workout-scope-compact">
										<SelectValue placeholder="Select a scope" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="private">Private</SelectItem>
										<SelectItem value="public">Public</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<Label htmlFor="reps-per-round-compact">Reps Per Round</Label>
								<Input
									id="reps-per-round-compact"
									type="number"
									value={repsPerRound === undefined ? "" : repsPerRound}
									onChange={(e) =>
										setRepsPerRound(
											e.target.value === ""
												? undefined
												: Number.parseInt(e.target.value),
										)
									}
								/>
							</div>
							<div>
								<Label htmlFor="rounds-to-score-compact">Rounds to Score</Label>
								<Input
									id="rounds-to-score-compact"
									type="number"
									value={roundsToScore === undefined ? "" : roundsToScore}
									onChange={(e) =>
										setRoundsToScore(
											e.target.value === ""
												? undefined
												: Number.parseInt(e.target.value),
										)
									}
								/>
							</div>
						</div>

						<div>
							<Label htmlFor="add-tag-input-compact">Tags</Label>
							<div className="mb-2 flex gap-2">
								<Input
									id="add-tag-input-compact"
									type="text"
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
								<Button type="button" onClick={handleAddTag} size="icon">
									<Plus className="h-5 w-5" />
								</Button>
							</div>

							<div className="mt-2 flex flex-wrap gap-2">
								{tags.map((tag) => (
									<Button
										type="button"
										key={tag.id}
										variant={
											selectedTags.includes(tag.id) ? "default" : "outline"
										}
										onClick={() => handleTagToggle(tag.id)}
									>
										{tag.name}
										{selectedTags.includes(tag.id) && (
											<button
												type="button"
												className="ml-2 text-red-500"
												onClick={(e) => {
													e.stopPropagation()
													handleRemoveTag(tag.id)
												}}
											>
												<X className="h-4 w-4" />
											</button>
										)}
									</Button>
								))}
							</div>
						</div>
					</div>

					<div>
						<Label htmlFor="movements-list-compact">Movements</Label>
						<div
							id="movements-list-compact"
							className="h-[200px] overflow-y-auto border-2 border-black p-2 dark:border-white"
						>
							<div className="space-y-2">
								{movements.map((movement) => (
									<Button
										type="button"
										key={movement.id}
										variant={
											selectedMovements.includes(movement.id)
												? "default"
												: "outline"
										}
										className="w-full justify-between"
										onClick={() => handleMovementToggle(movement.id)}
									>
										<span className="font-bold">{movement.name}</span>
										<span className="text-xs uppercase">{movement.type}</span>
									</Button>
								))}
							</div>
						</div>
					</div>
				</div>

				<div className="mt-4 flex justify-end gap-4">
					<Button type="button" variant="outline" onClick={onCancel}>
						Cancel
					</Button>
					<Button type="submit">Save Changes</Button>
				</div>
			</form>
		</div>
	)
}
