"use client"

import { useServerAction } from "@repo/zsa-react"
import { ArrowLeft, Plus, Shuffle, X } from "lucide-react"
import Link from "next/link"
import type React from "react"
import { useEffect, useRef, useState } from "react"
import { getScalingGroupWithLevelsAction } from "@/actions/scaling-actions"
import { getDefaultScoreType } from "@/lib/scoring"
import type { WorkoutScheme, ScoreType } from "@/lib/scoring"
import { MovementsList } from "@/components/movements-list"
import { WorkoutScalingDescriptionsEditor } from "@/components/scaling/workout-scaling-descriptions-editor"
import { Badge } from "@/components/ui/badge"
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

interface ScalingGroupWithTeam {
	id: string
	title: string
	description: string | null
	teamId: string | null
	teamName: string
	isSystem: number
	isDefault: number
}

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
		remixTeamId?: string
	}) => Promise<void>
	userTeams?: Array<{ id: string; name: string }>
	scalingGroups?: ScalingGroupWithTeam[]
}>
type TagWithoutSaved = Omit<Tag, "createdAt" | "updatedAt" | "updateCounter">
export default function EditWorkoutClient({
	workout,
	movements,
	tags: initialTags,
	workoutId,
	isRemixMode = false,
	updateWorkoutAction,
	userTeams = [],
	scalingGroups = [],
}: Props) {
	const [name, setName] = useState(workout?.name || "")
	const [description, setDescription] = useState(workout?.description || "")
	const [scheme, setScheme] = useState<WorkoutUpdate["scheme"]>(workout?.scheme)
	const [scoreType, setScoreType] = useState<ScoreType | undefined>(
		workout?.scoreType ?? undefined,
	)
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
	const [roundsToScore, setRoundsToScore] = useState<number | null>(
		workout?.roundsToScore ?? null,
	)
	const [selectedTeamId, setSelectedTeamId] = useState<string>(
		userTeams.length > 0 ? userTeams[0]?.id || "" : "",
	)
	const [selectedScalingGroupId, setSelectedScalingGroupId] = useState<string>(
		workout?.scalingGroupId || "",
	)
	const [selectedGroupLevels, setSelectedGroupLevels] = useState<
		Array<{
			id: string
			label: string
			position: number
		}>
	>([])
	const [formError, setFormError] = useState<string | null>(null)

	// Track if scheme was changed by user (not initial load)
	const initialSchemeRef = useRef(workout?.scheme)
	const hasSchemeChangedRef = useRef(false)

	const { execute: fetchScalingLevels } = useServerAction(
		getScalingGroupWithLevelsAction,
		{
			onError: (error) => {
				console.error("Error fetching scaling levels:", error)
			},
		},
	)

	// Watch for scheme changes and set default score type
	// Only update scoreType when user explicitly changes scheme, not on initial load
	useEffect(() => {
		if (scheme) {
			// Check if this is a user-initiated change (not initial load)
			if (scheme !== initialSchemeRef.current || hasSchemeChangedRef.current) {
				hasSchemeChangedRef.current = true
				const defaultScoreType = getDefaultScoreType(scheme as WorkoutScheme)
				setScoreType(defaultScoreType)
			}
		}
	}, [scheme])

	// Watch for scaling group selection changes and fetch levels
	useEffect(() => {
		if (
			selectedScalingGroupId &&
			selectedScalingGroupId !== "" &&
			selectedScalingGroupId !== "none"
		) {
			// Find the selected group's team ID
			const selectedGroup = scalingGroups.find(
				(g) => g.id === selectedScalingGroupId,
			)
			if (selectedGroup) {
				fetchScalingLevels({
					groupId: selectedScalingGroupId,
					teamId: selectedGroup.teamId || userTeams[0]?.id || "",
				}).then((result) => {
					if (result?.[0]?.success && result[0].data?.levels) {
						setSelectedGroupLevels(
							result[0].data.levels.map((level) => ({
								id: level.id,
								label: level.label,
								position: level.position,
							})),
						)
					}
				})
			}
		} else {
			setSelectedGroupLevels([])
		}
	}, [selectedScalingGroupId, fetchScalingLevels, scalingGroups, userTeams])

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
		setFormError(null)

		// Client-side validation
		if (scheme && !scoreType) {
			setFormError("Score Type is required when a scheme is selected")
			return
		}

		try {
			await updateWorkoutAction({
				id: workoutId,
				remixTeamId: isRemixMode ? selectedTeamId : undefined,
				workout: {
					name,
					description,
					scheme,
					scoreType: scoreType ?? null,
					scope,
					repsPerRound: repsPerRound === undefined ? null : repsPerRound,
					roundsToScore: roundsToScore,
					scalingGroupId:
						selectedScalingGroupId && selectedScalingGroupId !== "none"
							? selectedScalingGroupId
							: null,
				},
				tagIds: selectedTags,
				movementIds: selectedMovements,
			})
		} catch (error) {
			if (error instanceof Error) {
				setFormError(error.message)
			} else {
				setFormError("An unexpected error occurred. Please try again.")
			}
		}
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
						{/* Team Selector for Remix Mode */}
						{isRemixMode && userTeams.length > 0 && (
							<div>
								<Label htmlFor="remix-team">Create Remix Under Team</Label>
								<Select
									value={selectedTeamId}
									onValueChange={setSelectedTeamId}
								>
									<SelectTrigger id="remix-team">
										<SelectValue placeholder="Select a team" />
									</SelectTrigger>
									<SelectContent>
										{userTeams.map((team) => (
											<SelectItem key={team.id} value={team.id}>
												{team.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<p className="text-sm text-muted-foreground mt-1">
									This determines who can access and edit the remixed workout
								</p>
							</div>
						)}

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

						{scheme && (
							<div>
								<Label htmlFor="workout-score-type">Score Type</Label>
								<Select
									value={scoreType ?? ""}
									onValueChange={(value) => setScoreType(value as ScoreType)}
								>
									<SelectTrigger id="workout-score-type">
										<SelectValue placeholder="Select score type" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="min">
											Min (lowest single set wins)
										</SelectItem>
										<SelectItem value="max">
											Max (highest single set wins)
										</SelectItem>
										<SelectItem value="sum">
											Sum (total across rounds)
										</SelectItem>
										<SelectItem value="average">
											Average (mean across rounds)
										</SelectItem>
										<SelectItem value="first">
											First (first attempt only)
										</SelectItem>
										<SelectItem value="last">
											Last (final attempt only)
										</SelectItem>
									</SelectContent>
								</Select>
							</div>
						)}

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
							<Label htmlFor="workout-scaling-group">
								Scaling Group (Optional)
							</Label>
							<Select
								value={selectedScalingGroupId}
								onValueChange={setSelectedScalingGroupId}
							>
								<SelectTrigger id="workout-scaling-group">
									<SelectValue placeholder="Select a scaling group" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">None (Use default)</SelectItem>
									{scalingGroups.length === 0 ? (
										<SelectItem value="no-groups" disabled>
											No scaling groups available
										</SelectItem>
									) : (
										scalingGroups.map((group) => (
											<SelectItem key={group.id} value={group.id}>
												{group.title}
												{userTeams.length > 1 && group.teamName && (
													<span className="text-muted-foreground ml-2">
														({group.teamName})
													</span>
												)}
												{group.isDefault === 1 && (
													<span className="text-muted-foreground ml-2">
														(Team Default)
													</span>
												)}
											</SelectItem>
										))
									)}
								</SelectContent>
							</Select>
							{selectedScalingGroupId && selectedScalingGroupId !== "none" && (
								<div className="mt-2 space-y-2">
									<p className="text-sm text-muted-foreground">
										This scaling group will be used for this workout instead of
										the track or team default.
									</p>
									{selectedGroupLevels.length > 0 && (
										<div className="space-y-1">
											<p className="text-sm font-medium">Scaling Levels:</p>
											<div className="flex flex-wrap gap-2">
												{selectedGroupLevels.map((level) => (
													<Badge key={level.id} variant="secondary">
														{level.label}
													</Badge>
												))}
											</div>
										</div>
									)}
								</div>
							)}
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
								value={roundsToScore === null ? "" : roundsToScore}
								onChange={(e) =>
									setRoundsToScore(
										e.target.value === ""
											? null
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
									<div key={tag.id} className="inline-flex items-center gap-1">
										<Button
											type="button"
											variant={
												selectedTags.includes(tag.id) ? "default" : "outline"
											}
											onClick={() => handleTagToggle(tag.id)}
										>
											{tag.name}
										</Button>
										{selectedTags.includes(tag.id) && (
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="h-8 w-8 p-0 text-red-500"
												onClick={() => handleRemoveTag(tag.id)}
											>
												<X className="h-4 w-4" />
											</Button>
										)}
									</div>
								))}
							</div>
						</div>
					</div>

					<MovementsList
						movements={movements}
						selectedMovements={selectedMovements}
						onMovementToggle={handleMovementToggle}
						mode="selectable"
						variant="compact"
						enableCreateMovement={true}
					/>
				</div>

				{/* Scaling Descriptions Editor */}
				{selectedScalingGroupId && selectedScalingGroupId !== "none" && (
					<div className="mt-6 border-t-2 border-primary pt-6">
						<WorkoutScalingDescriptionsEditor
							workoutId={workoutId}
							scalingGroupId={selectedScalingGroupId}
							teamId={userTeams.length > 0 ? userTeams[0]?.id : undefined}
						/>
					</div>
				)}

				{formError && (
					<div className="mt-6 border-2 border-red-500 bg-red-50 p-4 text-red-700 dark:bg-red-950 dark:text-red-300">
						{formError}
					</div>
				)}

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
