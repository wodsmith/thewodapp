"use client"

import { ArrowLeft, Plus, Shuffle, X } from "lucide-react"
import Link from "next/link"
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
	isRemixMode?: boolean
	updateWorkoutAction: (data: {
		id: string
		workout: WorkoutUpdate
		tagIds: string[]
		movementIds: string[]
	}) => Promise<void>
}>
type TagWithoutSaved = Omit<Tag, "createdAt" | "updatedAt" | "updateCounter">
export default function EditWorkoutClient({
	workout,
	movements,
	tags: initialTags,
	workoutId,
	isRemixMode = false,
	updateWorkoutAction,
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
			<div className="mb-6 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Button variant="outline" size="icon" asChild>
						<Link href={`/workouts/${workoutId}`}>
							<ArrowLeft className="h-5 w-5" />
						</Link>
					</Button>
					<div>
						<h1>{isRemixMode ? "CREATE REMIX" : "EDIT WORKOUT"}</h1>
						{isRemixMode && (
							<p className="text-sm text-muted-foreground mt-1">
								You're creating a remix of this workout. Make your changes and
								save as a new workout.
							</p>
						)}
					</div>
				</div>
			</div>

			{/* Source Workout Information for Remix Mode */}
			{isRemixMode && workout?.sourceWorkout && (
				<div className="mb-6 border-2 border-orange-500 bg-orange-50 p-4 dark:border-orange-600 dark:bg-orange-950">
					<div className="flex items-center gap-2 mb-2">
						<Shuffle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
						<h3 className="font-bold text-orange-800 text-lg dark:text-orange-200">
							Creating a Remix
						</h3>
					</div>
					<p className="text-orange-700 dark:text-orange-300">
						This form is pre-populated with data from{" "}
						<Link
							href={`/workouts/${workout.sourceWorkout.id}`}
							className="font-semibold underline hover:no-underline"
							target="_blank"
							rel="noopener noreferrer"
						>
							"{workout.sourceWorkout.name}"
						</Link>
						{workout.sourceWorkout.teamName && (
							<span> by {workout.sourceWorkout.teamName}</span>
						)}
						. Make your changes and create your own version of this workout.
					</p>
				</div>
			)}

			<form
				className="border-2 border-black p-6 dark:border-white"
				onSubmit={handleSubmit}
			>
				<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
					<div className="space-y-6">
						<div>
							<Label htmlFor="workout-name">Workout Name</Label>
							<Input
								id="workout-name"
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
							/>
						</div>

						<div>
							<Label htmlFor="workout-description">Description</Label>
							<Textarea
								id="workout-description"
								rows={10}
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								required
							/>
						</div>

						<div>
							<Label htmlFor="workout-scheme">Scheme</Label>
							<Select
								value={scheme}
								onValueChange={(value) =>
									setScheme(value as WorkoutUpdate["scheme"])
								}
							>
								<SelectTrigger id="workout-scheme">
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
							<Label htmlFor="workout-scope">Scope</Label>
							<Select
								value={scope}
								onValueChange={(value) => setScope(value as Workout["scope"])}
							>
								<SelectTrigger id="workout-scope">
									<SelectValue placeholder="Select a scope" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="private">Private</SelectItem>
									<SelectItem value="public">Public</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div>
							<Label htmlFor="reps-per-round">Reps Per Round</Label>
							<Input
								id="reps-per-round"
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
							<Label htmlFor="rounds-to-score">Rounds to Score</Label>
							<Input
								id="rounds-to-score"
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

						<div>
							<Label htmlFor="add-tag-input">Tags</Label>
							<div className="mb-2 flex gap-2">
								<Input
									id="add-tag-input"
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
						<Label>Movements</Label>
						<div
							id="movements-list"
							className="h-[500px] overflow-y-auto border-2 border-black p-4 dark:border-white"
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

				<div className="mt-6 flex justify-end gap-4">
					<Button asChild variant="outline">
						<Link href={`/workouts/${workoutId}`}>Cancel</Link>
					</Button>
					<Button type="submit">
						{isRemixMode ? "Create Remix" : "Save Changes"}
					</Button>
				</div>
			</form>
		</div>
	)
}
