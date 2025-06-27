"use client"

import { Plus, X } from "lucide-react"
import type React from "react"
import { useState } from "react"
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
							<label
								htmlFor="workout-name-compact"
								className="mb-1 block text-sm font-bold uppercase"
							>
								Workout Name
							</label>
							<input
								id="workout-name-compact"
								type="text"
								className="input"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
							/>
						</div>

						<div>
							<label
								htmlFor="workout-description-compact"
								className="mb-1 block text-sm font-bold uppercase"
							>
								Description
							</label>
							<textarea
								id="workout-description-compact"
								className="textarea"
								rows={3}
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								required
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<label
									htmlFor="workout-scheme-compact"
									className="mb-1 block text-sm font-bold uppercase"
								>
									Scheme
								</label>
								<select
									id="workout-scheme-compact"
									className="select"
									value={scheme}
									onChange={(e) =>
										setScheme(e.target.value as WorkoutUpdate["scheme"])
									}
									required
								>
									<option value="">Select a scheme</option>
									<option value="time">For Time</option>
									<option value="time-with-cap">For Time (with cap)</option>
									<option value="rounds-reps">AMRAP (Rounds + Reps)</option>
									<option value="reps">Max Reps</option>
									<option value="emom">EMOM</option>
									<option value="load">Max Load</option>
									<option value="calories">Calories</option>
									<option value="meters">Meters</option>
									<option value="pass-fail">Pass/Fail</option>
								</select>
							</div>
							<div>
								<label
									htmlFor="workout-scope-compact"
									className="mb-1 block text-sm font-bold uppercase"
								>
									Scope
								</label>
								<select
									id="workout-scope-compact"
									className="select"
									value={scope}
									onChange={(e) => setScope(e.target.value as Workout["scope"])}
									required
								>
									<option value="private">Private</option>
									<option value="public">Public</option>
								</select>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<label
									htmlFor="reps-per-round-compact"
									className="mb-1 block text-sm font-bold uppercase"
								>
									Reps Per Round
								</label>
								<input
									id="reps-per-round-compact"
									type="number"
									className="input"
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
								<label
									htmlFor="rounds-to-score-compact"
									className="mb-1 block text-sm font-bold uppercase"
								>
									Rounds to Score
								</label>
								<input
									id="rounds-to-score-compact"
									type="number"
									className="input"
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
							<label
								htmlFor="add-tag-input-compact"
								className="mb-1 block text-sm font-bold uppercase"
							>
								Tags
							</label>
							<div className="mb-2 flex gap-2">
								<input
									id="add-tag-input-compact"
									type="text"
									className="input flex-1"
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
								<button type="button" className="btn" onClick={handleAddTag}>
									<Plus className="h-5 w-5" />
								</button>
							</div>

							<div className="mt-2 flex flex-wrap gap-2">
								{tags.map((tag) => (
									<button
										type="button"
										key={tag.id}
										className={`flex cursor-pointer items-center border-2 border-black px-1.5 py-0.5 text-left ${
											selectedTags.includes(tag.id) ? "bg-black text-white" : ""
										}`}
										onClick={() => handleTagToggle(tag.id)}
										tabIndex={0}
										onKeyDown={(e) => {
											if (e.key === "Enter" || e.key === " ")
												handleTagToggle(tag.id)
										}}
									>
										<span className="mr-2">{tag.name}</span>
										{selectedTags.includes(tag.id) && (
											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation()
													handleRemoveTag(tag.id)
												}}
												onKeyDown={(e) => {
													if (e.key === "Enter" || e.key === " ") {
														e.stopPropagation()
														handleRemoveTag(tag.id)
													}
												}}
												className="text-red-500 cursor-pointer"
											>
												<X className="h-4 w-4" />
											</button>
										)}
									</button>
								))}
							</div>
						</div>
					</div>

					<div>
						<label
							htmlFor="movements-list-compact"
							className="mb-1 block text-sm font-bold uppercase"
						>
							Movements
						</label>
						<div
							id="movements-list-compact"
							className="h-[200px] overflow-y-auto border-2 border-black p-2"
						>
							<div className="space-y-2">
								{movements.map((movement) => (
									<button
										type="button"
										key={movement.id}
										className={`w-full border-2 p-2 text-left ${
											selectedMovements.includes(movement.id)
												? "border-black bg-black text-white"
												: "border-gray-300"
										} cursor-pointer`}
										onClick={() => handleMovementToggle(movement.id)}
									>
										<div className="flex items-center justify-between">
											<span className="font-bold">{movement.name}</span>
											<span className="text-xs uppercase">{movement.type}</span>
										</div>
									</button>
								))}
							</div>
						</div>
					</div>
				</div>

				<div className="mt-4 flex justify-end gap-4">
					<button type="button" className="btn-outline" onClick={onCancel}>
						Cancel
					</button>
					<button type="submit" className="btn">
						Save Changes
					</button>
				</div>
			</form>
		</div>
	)
}
