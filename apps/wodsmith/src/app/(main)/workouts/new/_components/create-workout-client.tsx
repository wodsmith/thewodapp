"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useServerAction } from "@repo/zsa-react"
import { format } from "date-fns"
import { ArrowLeft, CalendarIcon, Plus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import posthog from "posthog-js"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { getScalingGroupWithLevelsAction } from "@/actions/scaling-actions"
import { createWorkoutAction } from "@/actions/workout-actions"
import {
	type CreateWorkoutSchema,
	createWorkoutSchema,
} from "@/app/(main)/workouts/new/_components/create-workout.schema"
import { MovementsList } from "@/components/movements-list"
import { WorkoutScalingDescriptionsForm } from "@/components/scaling/workout-scaling-descriptions-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type {
	Movement,
	ProgrammingTrack,
	Tag,
	TeamMembership,
} from "@/db/schema"
import { cn } from "@/lib/utils"

interface ScalingGroupWithTeam {
	id: string
	title: string
	description: string | null
	teamId: string | null
	teamName: string
	isSystem: number
	isDefault: number
}

interface Props {
	movements: Movement[]
	tags: Tag[]
	teamId: string
	ownedTracks: ProgrammingTrack[]
	teamsWithProgrammingPermission: (TeamMembership & {
		team: { id: string; name: string; isPersonalTeam: number } | null
	})[]
	scalingGroups?: ScalingGroupWithTeam[]
	createWorkoutAction?: typeof createWorkoutAction
}

export default function CreateWorkoutClient({
	movements,
	tags: initialTags,
	teamId,
	ownedTracks,
	teamsWithProgrammingPermission,
	scalingGroups = [],
	createWorkoutAction: createWorkoutActionProp,
}: Props) {
	const [tags, setTags] = useState<Tag[]>(initialTags)
	const [newTag, setNewTag] = useState("")
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
	const router = useRouter()

	const form = useForm<CreateWorkoutSchema>({
		resolver: zodResolver(createWorkoutSchema),
		defaultValues: {
			name: "",
			description: "",
			scheme: undefined,
			scoreType: undefined,
			scope: "private",
			roundsToScore: undefined,
			repsPerRound: undefined,
			selectedMovements: [],
			selectedTags: [],
			trackId: undefined,
			scheduledDate: undefined,
			scalingGroupId: undefined,
		},
	})

	const { execute: executeCreateWorkout } = useServerAction(
		createWorkoutActionProp || createWorkoutAction,
		{
			onError: (error) => {
				console.error("Server action error:", error)
				toast.error(
					error.err?.message || "An error occurred creating the workout",
				)
				posthog.capture("workout_created_failed", {
					error_message: error.err?.message,
				})
			},
			onSuccess: (result) => {
				console.log("[DEBUG] Create workout result:", result)
				toast.success("Workout created successfully")
				posthog.capture("workout_created", {
					workout_id: result?.data?.data?.id,
					workout_name: form.getValues("name"),
					workout_scheme: form.getValues("scheme"),
					workout_scope: form.getValues("scope"),
					has_track: !!form.getValues("trackId"),
					has_scheduled_date: !!form.getValues("scheduledDate"),
					movements_count: form.getValues("selectedMovements").length,
					tags_count: form.getValues("selectedTags").length,
				})
				if (result?.data?.data?.id) {
					router.push(`/workouts/${result.data.data.id}`)
				} else {
					console.error("[ERROR] No workout ID in result:", result)
					router.push("/workouts")
				}
			},
		},
	)

	const { execute: fetchScalingLevels } = useServerAction(
		getScalingGroupWithLevelsAction,
		{
			onError: (error) => {
				console.error("Error fetching scaling levels:", error)
			},
		},
	)

	// Watch for scheme changes and set default score type
	const selectedScheme = form.watch("scheme")

	useEffect(() => {
		if (selectedScheme) {
			// Get default score type based on scheme
			const getDefaultScoreType = (
				scheme: string,
			): "min" | "max" | "sum" | "average" | undefined => {
				switch (scheme) {
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

			const defaultScoreType = getDefaultScoreType(selectedScheme)
			// Always set to scheme default when scheme changes
			form.setValue("scoreType", defaultScoreType)
		}
	}, [selectedScheme, form])

	// Watch for scaling group selection changes
	const selectedScalingGroupId = form.watch("scalingGroupId")

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
					teamId: selectedGroup.teamId || teamId,
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
			// Use a special prefix for new tags that need to be created
			const id = `new_tag_${crypto.randomUUID()}`
			const newTagObj = {
				id,
				name: newTag,
				createdAt: new Date(), // Temporary UI object
				updatedAt: new Date(), // Temporary UI object
				updateCounter: null,
			}
			setTags([...tags, newTagObj])

			const currentSelectedTags = form.getValues("selectedTags")
			form.setValue("selectedTags", [...currentSelectedTags, id])
			setNewTag("")
		}
	}

	const handleMovementToggle = (movementId: string) => {
		const currentSelectedMovements = form.getValues("selectedMovements")
		if (currentSelectedMovements.includes(movementId)) {
			form.setValue(
				"selectedMovements",
				currentSelectedMovements.filter((id) => id !== movementId),
			)
		} else {
			form.setValue("selectedMovements", [
				...currentSelectedMovements,
				movementId,
			])
		}
	}

	const handleTagToggle = (tagId: string) => {
		const currentSelectedTags = form.getValues("selectedTags")
		if (currentSelectedTags.includes(tagId)) {
			form.setValue(
				"selectedTags",
				currentSelectedTags.filter((id) => id !== tagId),
			)
		} else {
			form.setValue("selectedTags", [...currentSelectedTags, tagId])
		}
	}

	const onSubmit = async (data: CreateWorkoutSchema) => {
		// Separate existing tags from new tags
		const existingTagIds = data.selectedTags.filter(
			(id) => !id.startsWith("new_tag_"),
		)
		const newTagNames = data.selectedTags
			.filter((id) => id.startsWith("new_tag_"))
			.map((id) => tags.find((t) => t.id === id)?.name)
			.filter((name): name is string => name !== undefined)

		await executeCreateWorkout({
			workout: {
				name: data.name,
				description: data.description,
				scheme: data.scheme,
				scoreType: data.scoreType ?? null,
				scope: data.scope,
				roundsToScore: data.roundsToScore ?? null,
				repsPerRound: data.repsPerRound ?? null,
				sugarId: null,
				tiebreakScheme: null,
				scalingGroupId:
					data.scalingGroupId && data.scalingGroupId !== "none"
						? data.scalingGroupId
						: null,
			},
			tagIds: existingTagIds,
			newTagNames,
			movementIds: data.selectedMovements,
			teamId,
			trackId: data.trackId,
			scheduledDate: data.scheduledDate,
			scalingDescriptions:
				data.scalingGroupId && data.scalingGroupId !== "none"
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
			<div className="mb-6 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Button asChild variant="outline" size="icon">
						<Link href="/workouts">
							<ArrowLeft className="h-5 w-5" />
						</Link>
					</Button>
					<h1>CREATE WORKOUT</h1>
				</div>
			</div>

			<Form {...form}>
				<form
					className="border-2 border-black p-6"
					onSubmit={form.handleSubmit(onSubmit)}
				>
					<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
						<div className="space-y-6">
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="font-bold uppercase">
											Workout Name
										</FormLabel>
										<FormControl>
											<Input
												placeholder="e.g., Fran, Cindy, Custom WOD"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="description"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="font-bold uppercase">
											Description
										</FormLabel>
										<FormControl>
											<Textarea
												rows={4}
												placeholder="Describe the workout (e.g., 21-15-9 reps for time of Thrusters and Pull-ups)"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="scheme"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="font-bold uppercase">
											Scheme
										</FormLabel>
										<Select onValueChange={field.onChange} value={field.value}>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select a scheme" />
												</SelectTrigger>
											</FormControl>
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
										<FormMessage />
									</FormItem>
								)}
							/>

							{form.watch("scheme") && (
								<FormField
									control={form.control}
									name="scoreType"
									render={({ field }) => (
										<FormItem>
											<FormLabel className="font-bold uppercase">
												Score Type
											</FormLabel>
											<Select
												onValueChange={field.onChange}
												value={field.value}
											>
												<FormControl>
													<SelectTrigger>
														<SelectValue placeholder="Select score type" />
													</SelectTrigger>
												</FormControl>
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
											<FormMessage />
										</FormItem>
									)}
								/>
							)}

							<FormField
								control={form.control}
								name="scope"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="font-bold uppercase">Scope</FormLabel>
										<Select onValueChange={field.onChange} value={field.value}>
											<FormControl>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value="private">Private</SelectItem>
												<SelectItem value="public">Public</SelectItem>
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="scalingGroupId"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="font-bold uppercase">
											Scaling Group (Optional)
										</FormLabel>
										<Select onValueChange={field.onChange} value={field.value}>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select a scaling group" />
												</SelectTrigger>
											</FormControl>
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
															{teamsWithProgrammingPermission.length > 1 &&
																group.teamName && (
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
										{field.value && field.value !== "none" && (
											<div className="mt-2 space-y-2">
												<p className="text-sm text-muted-foreground">
													This scaling group will be used for this workout
													instead of the track or team default.
												</p>
												{selectedGroupLevels.length > 0 && (
													<div className="space-y-1">
														<p className="text-sm font-medium">
															Scaling Levels:
														</p>
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
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="roundsToScore"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="font-bold uppercase">
											Rounds to Score
										</FormLabel>
										<FormControl>
											<Input
												type="number"
												placeholder="e.g., 4 (default is 1)"
												value={field.value === undefined ? "" : field.value}
												onChange={(e) =>
													field.onChange(
														e.target.value
															? Number.parseInt(e.target.value)
															: undefined,
													)
												}
												min="0"
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="repsPerRound"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="font-bold uppercase">
											Reps per Round (if applicable)
										</FormLabel>
										<FormControl>
											<Input
												type="number"
												placeholder="e.g., 10"
												value={field.value === undefined ? "" : field.value}
												onChange={(e) =>
													field.onChange(
														e.target.value
															? Number.parseInt(e.target.value)
															: undefined,
													)
												}
												min="0"
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="trackId"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="font-bold uppercase">
											Add to Programming Track (Optional)
										</FormLabel>
										<Select onValueChange={field.onChange} value={field.value}>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select a track you own" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{ownedTracks.length === 0 ? (
													<SelectItem value="no-tracks" disabled>
														No programming tracks available
													</SelectItem>
												) : (
													ownedTracks.map((track) => (
														<SelectItem key={track.id} value={track.id}>
															{track.name}
														</SelectItem>
													))
												)}
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>

							<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
								<FormField
									control={form.control}
									name="scheduledDate"
									render={({ field }) => (
										<FormItem>
											<FormLabel className="font-bold uppercase">
												Schedule Workout (Optional)
											</FormLabel>
											<Popover>
												<PopoverTrigger asChild>
													<FormControl>
														<Button
															variant="outline"
															className={cn(
																"w-full justify-start text-left font-normal",
																!field.value && "text-muted-foreground",
															)}
														>
															<CalendarIcon className="mr-2 h-4 w-4" />
															{field.value ? (
																format(field.value, "PPP")
															) : (
																<span>Pick a date</span>
															)}
														</Button>
													</FormControl>
												</PopoverTrigger>
												<PopoverContent className="w-auto p-0" align="start">
													<Calendar
														mode="single"
														selected={field.value}
														onSelect={field.onChange}
														className="border"
													/>
												</PopoverContent>
											</Popover>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							<div>
								<Label
									htmlFor="add-tag-input"
									className="mb-2 block font-bold uppercase"
								>
									Tags
								</Label>
								<div className="mb-2 flex gap-2">
									<Input
										id="add-tag-input"
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
									<Button type="button" onClick={handleAddTag}>
										<Plus className="h-5 w-5" />
									</Button>
								</div>

								<div className="mt-2 flex flex-wrap gap-2">
									{tags.map((tag) => {
										const selectedTags = form.watch("selectedTags")
										const isSelected = selectedTags.includes(tag.id)
										return (
											<button
												type="button"
												key={tag.id}
												onClick={() => handleTagToggle(tag.id)}
												onKeyDown={(e) => {
													if (e.key === "Enter" || e.key === " ") {
														e.preventDefault()
														handleTagToggle(tag.id)
													}
												}}
												aria-pressed={isSelected}
												className={`flex cursor-pointer items-center border-2 border-black px-2 py-1 ${
													isSelected ? "bg-black text-white" : ""
												}`}
											>
												<span className="mr-2">{tag.name}</span>
												{isSelected && <span className="text-xs">✓</span>}
											</button>
										)
									})}
								</div>
							</div>
						</div>

						<MovementsList
							movements={movements}
							selectedMovements={form.watch("selectedMovements")}
							onMovementToggle={handleMovementToggle}
							mode="selectable"
							variant="default"
						/>
					</div>

					{/* Scaling Descriptions */}
					{form.watch("scalingGroupId") &&
						form.watch("scalingGroupId") !== "none" && (
							<div className="col-span-full mt-6 border-t-2 border-primary pt-6">
								<WorkoutScalingDescriptionsForm
									scalingGroupId={form.watch("scalingGroupId") || null}
									teamId={teamId}
									value={scalingDescriptions}
									onChange={setScalingDescriptions}
								/>
							</div>
						)}

					<div className="mt-6 flex justify-end gap-4">
						<Button asChild variant="outline">
							<Link href="/workouts">Cancel</Link>
						</Button>
						<Button type="submit" disabled={form.formState.isSubmitting}>
							{form.formState.isSubmitting ? "Creating..." : "Create Workout"}
						</Button>
					</div>
				</form>
			</Form>
		</div>
	)
}
