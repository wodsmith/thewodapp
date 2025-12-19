"use client"

import { useServerAction } from "@repo/zsa-react"
import { Plus, X } from "lucide-react"
import type React from "react"
import { useEffect, useRef, useState } from "react"
import {
	getScalingGroupWithLevelsAction,
	getWorkoutScalingDescriptionsAction,
} from "@/actions/scaling-actions"
import { MovementsList } from "@/components/movements-list"
import { WorkoutScalingDescriptionsForm } from "@/components/scaling/workout-scaling-descriptions-form"
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
	isSystem: number
	isDefault: number
	createdAt: Date
	updatedAt: Date
	updateCounter: number | null
	levels: Array<{
		id: string
		scalingGroupId: string
		label: string
		position: number
		createdAt: Date
		updatedAt: Date
		updateCounter: number | null
	}>
}

type Props = Prettify<{
	workout: WorkoutWithTagsAndMovements
	movements: Movement[]
	tags: Tag[]
	workoutId: string
	teamId?: string
	updateWorkoutAction: (data: {
		id: string
		workout: WorkoutUpdate
		tagIds: string[]
		movementIds: string[]
		scalingDescriptions?: Array<{
			scalingLevelId: string
			description: string | null
		}>
	}) => Promise<void>
	onCancel: () => void
	scalingGroups?: ScalingGroupWithTeam[]
}>
type TagWithoutSaved = Omit<Tag, "createdAt" | "updatedAt" | "updateCounter">
export default function EditWorkoutClientCompact({
	workout,
	movements,
	tags: initialTags,
	workoutId,
	teamId,
	updateWorkoutAction,
	onCancel,
	scalingGroups = [],
}: Props) {
	const [name, setName] = useState(workout?.name || "")
	const [description, setDescription] = useState(workout?.description || "")
	const [scheme, setScheme] = useState<WorkoutUpdate["scheme"]>(workout?.scheme)
	const [scoreType, setScoreType] = useState<WorkoutUpdate["scoreType"]>(
		workout?.scoreType,
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
	const [roundsToScore, setRoundsToScore] = useState<number | undefined>(
		workout?.roundsToScore === null ? 1 : workout?.roundsToScore || 1,
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
	const [scalingDescriptions, setScalingDescriptions] = useState<
		Map<string, string>
	>(new Map())

	const { execute: fetchScalingLevels } = useServerAction(
		getScalingGroupWithLevelsAction,
		{
			onError: (error) => {
				console.error("Error fetching scaling levels:", error)
			},
		},
	)

	const { execute: fetchDescriptions } = useServerAction(
		getWorkoutScalingDescriptionsAction,
		{
			onError: (error) => {
				console.error("Error fetching scaling descriptions:", error)
			},
		},
	)

	// Load existing descriptions when component mounts
	useEffect(() => {
		if (workoutId) {
			fetchDescriptions({ workoutId }).then(([result]) => {
				if (result?.success && result.data) {
					const descMap = new Map<string, string>()
					result.data.forEach(
						(desc: { scalingLevelId: string; description: string | null }) => {
							if (desc.description) {
								descMap.set(desc.scalingLevelId, desc.description)
							}
						},
					)
					setScalingDescriptions(descMap)
				}
			})
		}
	}, [workoutId, fetchDescriptions])

	// Track the previous default scoreType to detect user changes
	const prevDefaultScoreType = useRef<
		"min" | "max" | "sum" | "average" | undefined
	>(undefined)

	// Watch for scheme changes and set default score type
	useEffect(() => {
		if (scheme) {
			// Get default score type based on scheme
			const getDefaultScoreType = (
				schemeValue: string,
			): "min" | "max" | "sum" | "average" | undefined => {
				switch (schemeValue) {
					case "time":
					case "time-with-cap":
						return "min" // Lower time is better
					case "rounds-reps":
					case "reps":
					case "calories":
					case "meters":
					case "load":
					case "emom":
					case "pass-fail":
						return "max" // Higher is better
					default:
						return undefined
				}
			}

			const defaultScoreType = getDefaultScoreType(scheme)

			// Only set the default if:
			// 1. scoreType is not set (null/undefined/empty), OR
			// 2. scoreType equals the previous default (user hasn't made an explicit choice)
			if (!scoreType || scoreType === prevDefaultScoreType.current) {
				setScoreType(defaultScoreType)
			}

			// Update the ref to track this new default for future comparisons
			prevDefaultScoreType.current = defaultScoreType
		}
	}, [scheme, scoreType])

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
					teamId: selectedGroup.teamId || teamId || "",
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
	}, [selectedScalingGroupId, fetchScalingLevels, scalingGroups, teamId])

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
				scoreType: scoreType ?? null,
				scope,
				repsPerRound: repsPerRound === undefined ? null : repsPerRound,
				roundsToScore: roundsToScore === undefined ? null : roundsToScore,
				scalingGroupId:
					selectedScalingGroupId && selectedScalingGroupId !== "none"
						? selectedScalingGroupId
						: null,
			},
			tagIds: selectedTags,
			movementIds: selectedMovements,
			scalingDescriptions:
				selectedScalingGroupId && selectedScalingGroupId !== "none"
					? Array.from(scalingDescriptions.entries()).map(
							([scalingLevelId, description]) => ({
								scalingLevelId,
								description: description || null,
							}),
						)
					: undefined,
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

						{scheme && (
							<div>
								<Label htmlFor="workout-score-type-compact">Score Type</Label>
								<Select
									value={scoreType ?? ""}
									onValueChange={(value) =>
										setScoreType(value as WorkoutUpdate["scoreType"])
									}
								>
									<SelectTrigger id="workout-score-type-compact">
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
									</SelectContent>
								</Select>
							</div>
						)}

						<div>
							<Label htmlFor="workout-scaling-group-compact">
								Scaling Group (Optional)
							</Label>
							<Select
								value={selectedScalingGroupId}
								onValueChange={setSelectedScalingGroupId}
							>
								<SelectTrigger id="workout-scaling-group-compact">
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
												{group.isSystem === 1 && (
													<span className="text-muted-foreground ml-2">
														(System)
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
							{selectedScalingGroupId &&
								selectedScalingGroupId !== "none" &&
								selectedGroupLevels.length > 0 && (
									<div className="mt-2">
										<div className="flex flex-wrap gap-1">
											{selectedGroupLevels.map((level) => (
												<Badge
													key={level.id}
													variant="secondary"
													className="text-xs"
												>
													{level.label}
												</Badge>
											))}
										</div>
									</div>
								)}
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

					<MovementsList
						movements={movements}
						selectedMovements={selectedMovements}
						onMovementToggle={handleMovementToggle}
						mode="selectable"
						variant="compact"
						containerHeight="h-[200px]"
						enableCreateMovement={true}
					/>
				</div>

				{/* Scaling Descriptions */}
				{selectedScalingGroupId && selectedScalingGroupId !== "none" && (
					<div className="mt-4 border-t-2 border-primary pt-4">
						<WorkoutScalingDescriptionsForm
							scalingGroupId={selectedScalingGroupId}
							teamId={teamId}
							value={scalingDescriptions}
							onChange={setScalingDescriptions}
						/>
					</div>
				)}

				<div className="mt-4 flex justify-end gap-4">
					<Button type="button" variant="outline" onClick={onCancel}>
						Cancel
					</Button>
					<Button type="submit">
						{workout?.teamId && teamId && workout.teamId !== teamId
							? "Remix and Save"
							: "Save Changes"}
					</Button>
				</div>
			</form>
		</div>
	)
}
