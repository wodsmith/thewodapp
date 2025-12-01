"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Search } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { useServerAction } from "@repo/zsa-react"
import { submitLogFormAction } from "@/actions/log-actions"
import {
	type LogFormSchema,
	logFormSchema,
} from "@/app/(main)/log/new/_components/log.schema"
import { WorkoutScalingTabs } from "@/components/scaling/workout-scaling-tabs"
import { ScalingSelector } from "@/components/scaling-selector"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import type { WorkoutWithTagsAndMovements } from "@/types"
import { getLocalDateKey } from "@/utils/date-utils"

export default function LogFormClient({
	workouts,
	userId,
	teamId,
	selectedWorkoutId,
	redirectUrl,
	scheduledInstanceId,
	programmingTrackId,
	trackScalingGroupId,
}: {
	workouts: (WorkoutWithTagsAndMovements & {
		resultsToday?: Array<{
			id: string
			userId: string
			date: Date
			workoutId: string | null
			type: "wod" | "strength" | "monostructural"
			notes: string | null
			scale: string | null
			wodScore: string | null
			setCount: number | null
			distance: number | null
			time: number | null
		}>
	})[]
	userId: string
	teamId: string
	selectedWorkoutId?: string
	redirectUrl?: string
	scheduledInstanceId?: string
	programmingTrackId?: string
	trackScalingGroupId?: string | null
}) {
	// Log the incoming workouts data on client side
	console.log("[LogFormClient] Component mounted with:", {
		totalWorkouts: workouts.length,
		selectedWorkoutId,
		firstWorkout: workouts[0]
			? {
					id: workouts[0].id,
					name: workouts[0].name,
					hasScalingLevels: !!workouts[0].scalingLevels,
					scalingLevelsCount: workouts[0].scalingLevels?.length || 0,
				}
			: null,
	})

	if (selectedWorkoutId) {
		const targetWorkout = workouts.find((w) => w.id === selectedWorkoutId)
		console.log("[LogFormClient] Target workout on mount:", {
			found: !!targetWorkout,
			id: targetWorkout?.id,
			name: targetWorkout?.name,
			scalingGroupId: targetWorkout?.scalingGroupId,
			scalingLevels: targetWorkout?.scalingLevels,
			scalingDescriptions: targetWorkout?.scalingDescriptions,
		})
	}
	const router = useRouter()
	const pathname = usePathname()
	const [searchQuery, setSearchQuery] = useState("")
	const prevSelectedWorkoutIdRef = useRef<string | null | undefined>(undefined)

	const form = useForm<LogFormSchema>({
		resolver: zodResolver(logFormSchema),
		defaultValues: {
			selectedWorkoutId: selectedWorkoutId || "",
			date: getLocalDateKey(new Date()),
			scale: "rx", // Legacy, kept for backward compatibility
			scalingLevelId: undefined,
			asRx: true,
			scores: [],
			timeCapped: [],
			notes: "",
		},
	})

	const selectedWorkout = useWatch({
		control: form.control,
		name: "selectedWorkoutId",
	})

	const { execute: submitLogForm } = useServerAction(submitLogFormAction, {
		onError: (error) => {
			console.error("[LogFormClient] Server action error:", error)
			console.error("[LogFormClient] Error details:", {
				err: error.err,
				message: error.err?.message,
				code: error.err?.code,
			})
			toast.error(error.err?.message || "An error occurred")
		},
		onSuccess: (result) => {
			console.log("[LogFormClient] Server action success:", result)
			toast.success("Result logged successfully")
			router.push((redirectUrl || "/log") as Parameters<typeof router.push>[0])
		},
	})

	const filteredWorkouts = workouts
		.filter((workout) =>
			workout.name.toLowerCase().includes(searchQuery.toLowerCase()),
		)
		.sort((a, b) => {
			if (a.id === selectedWorkout) return -1
			if (b.id === selectedWorkout) return 1
			if (a.createdAt && b.createdAt) {
				const dateA = new Date(a.createdAt)
				const dateB = new Date(b.createdAt)
				return dateB.getTime() - dateA.getTime()
			}
			if (a.createdAt) return -1
			if (b.createdAt) return 1
			return a.name.localeCompare(b.name)
		})

	const getSelectedWorkout = () => {
		const workout = workouts.find((w) => w.id === selectedWorkout)
		return workout
	}

	// Effect to synchronize selectedWorkout with URL param
	useEffect(() => {
		const currentPropId = selectedWorkoutId || ""
		if (selectedWorkout !== currentPropId) {
			form.setValue("selectedWorkoutId", currentPropId)
		}
	}, [selectedWorkoutId, selectedWorkout, form])

	// Update scores when selected workout changes
	useEffect(() => {
		if (!selectedWorkout) {
			const currentScores = form.getValues("scores")
			if (currentScores && currentScores.length !== 0) {
				form.setValue("scores", [])
			}
			if (prevSelectedWorkoutIdRef.current !== null) {
				prevSelectedWorkoutIdRef.current = null
			}
			return
		}

		const currentWorkoutData = workouts.find((w) => w.id === selectedWorkout)
		const numRoundsForInputs = currentWorkoutData?.roundsToScore || 1
		const hasRepsPerRound = !!currentWorkoutData?.repsPerRound
		const expectedPartsPerScore = hasRepsPerRound ? 2 : 1

		const workoutIdContextChanged =
			prevSelectedWorkoutIdRef.current !== selectedWorkout
		const currentScores = form.getValues("scores")
		const scoresNeedRestructure =
			!currentScores ||
			currentScores.length !== numRoundsForInputs ||
			currentScores.some(
				(parts: string[]) => parts.length !== expectedPartsPerScore,
			)

		if (workoutIdContextChanged || scoresNeedRestructure) {
			const newInitialScores = Array(numRoundsForInputs)
				.fill(null)
				.map(() => Array(expectedPartsPerScore).fill(""))
			form.setValue("scores", newInitialScores)
			// Initialize timeCapped array for time-with-cap workouts
			const newTimeCapped = Array(numRoundsForInputs).fill(false)
			form.setValue("timeCapped", newTimeCapped)
			prevSelectedWorkoutIdRef.current = selectedWorkout
		}
	}, [selectedWorkout, workouts, form])

	const handleScoreChange = (
		roundIndex: number,
		partIndex: number,
		value: string,
	) => {
		const currentScores = form.getValues("scores") || []
		const newScores = currentScores.map((parts: string[], rIndex: number) => {
			if (rIndex === roundIndex) {
				const newParts = [...parts]
				newParts[partIndex] = value
				return newParts
			}
			return parts
		})
		form.setValue("scores", newScores)
	}

	const handleTimeCappedChange = (roundIndex: number, value: boolean) => {
		const currentTimeCapped = form.getValues("timeCapped") || []
		const newTimeCapped = [...currentTimeCapped]
		newTimeCapped[roundIndex] = value
		form.setValue("timeCapped", newTimeCapped)

		// Clear the score when toggling time cap status
		const currentScores = form.getValues("scores") || []
		const newScores = currentScores.map((parts: string[], rIndex: number) => {
			if (rIndex === roundIndex) {
				return [""] // Reset to empty string
			}
			return parts
		})
		form.setValue("scores", newScores)
	}

	const handleWorkoutSelection = (workoutId: string) => {
		form.setValue("selectedWorkoutId", workoutId)
		const params = new URLSearchParams()
		params.set("workoutId", workoutId)
		router.push(
			`${pathname}?${params.toString()}` as Parameters<typeof router.push>[0],
		)
	}

	const onSubmit = async (data: LogFormSchema) => {
		if (!data.selectedWorkoutId) {
			toast.error("Please select a workout first.")
			return
		}

		// Convert form data to FormData for the server action
		const formData = new FormData()
		formData.set("selectedWorkoutId", data.selectedWorkoutId)
		formData.set("date", data.date)
		// Include both legacy and new scaling fields
		if (data.scalingLevelId) {
			formData.set("scalingLevelId", data.scalingLevelId)
			formData.set("asRx", String(data.asRx || false))
			// Set legacy scale based on asRx for backward compatibility
			formData.set("scale", data.asRx ? "rx" : "scaled")
		} else if (data.scale) {
			formData.set("scale", data.scale)
		}
		formData.set("notes", data.notes || "")

		// Add scores to formData
		if (data.scores) {
			data.scores.forEach((scoreParts: string[], roundIndex: number) => {
				scoreParts.forEach((partValue: string, partIndex: number) => {
					formData.append(
						`scores[${roundIndex}][${partIndex}]`,
						partValue || "",
					)
				})
			})
		}

		// Add timeCapped data to formData
		if (data.timeCapped) {
			data.timeCapped.forEach((isTimeCapped: boolean, roundIndex: number) => {
				formData.append(`timeCapped[${roundIndex}]`, String(isTimeCapped))
			})
		}

		// Add scheduledInstanceId and programmingTrackId if they exist
		if (scheduledInstanceId) {
			formData.set("scheduledInstanceId", scheduledInstanceId)
		}
		if (programmingTrackId) {
			formData.set("programmingTrackId", programmingTrackId)
		}

		console.log("[LogFormClient] Submitting form with data:", {
			userId,
			workoutsCount: workouts.length,
			formDataEntries: Array.from(formData.entries()),
			selectedWorkout: workouts.find((w) => w.id === data.selectedWorkoutId),
		})

		await submitLogForm({
			userId,
			workouts,
			formData,
		})
	}

	return (
		<div className="container mx-auto max-w-6xl sm:p-4">
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)}>
					<div className="mb-6 flex items-center justify-between px-4">
						<div className="flex items-center gap-2">
							<Button asChild variant="outline" size="icon">
								<Link
									href={
										(redirectUrl || "/log") as Parameters<typeof router.push>[0]
									}
								>
									<ArrowLeft className="h-4 w-4" />
								</Link>
							</Button>
							<h1 className="text-2xl font-bold">LOG RESULT</h1>
						</div>
					</div>

					<Card>
						<CardContent className="sm:p-6">
							<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
								{/* Workout Selection */}
								<div className="space-y-4">
									{selectedWorkout && getSelectedWorkout() ? (
										// When a specific workout is selected, show its details
										<div className="space-y-4">
											<h2 className="text-lg font-semibold mt-2">
												SELECTED WORKOUT
											</h2>
											<Card>
												<CardContent className="p-6">
													<div className="space-y-4">
														<div>
															<h3 className="text-xl font-bold mb-2">
																{getSelectedWorkout()?.name}
															</h3>
															<WorkoutScalingTabs
																workoutDescription={
																	getSelectedWorkout()?.description || ""
																}
																scalingLevels={
																	getSelectedWorkout()?.scalingLevels
																}
																scalingDescriptions={
																	getSelectedWorkout()?.scalingDescriptions
																}
															/>
														</div>
														<Button
															variant="outline"
															size="sm"
															type="button"
															onClick={() => {
																// Clear selection to show list
																form.setValue("selectedWorkoutId", "")
																router.push(
																	`${pathname}` as Parameters<
																		typeof router.push
																	>[0],
																)
															}}
														>
															Choose Different Workout
														</Button>
													</div>
												</CardContent>
											</Card>
										</div>
									) : (
										// Show workout list when no specific workout is selected
										<>
											<div>
												<h2 className="text-lg font-semibold mb-4">
													SELECT WORKOUT
												</h2>
												<div className="relative">
													<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
													<Input
														type="text"
														placeholder="Search workouts..."
														className="pl-10"
														value={searchQuery}
														onChange={(e) => setSearchQuery(e.target.value)}
													/>
												</div>
											</div>

											<FormField
												control={form.control}
												name="selectedWorkoutId"
												render={({ field }) => (
													<FormItem>
														<FormControl>
															<Card className="h-[400px]">
																<CardContent className="p-0 h-full overflow-y-auto">
																	{filteredWorkouts.length > 0 ? (
																		<div className="divide-y">
																			{filteredWorkouts.map((workout) => (
																				<Button
																					key={workout.id}
																					type="button"
																					onClick={() => {
																						handleWorkoutSelection(workout.id)
																						field.onChange(workout.id)
																					}}
																					variant={
																						selectedWorkout === workout.id
																							? "default"
																							: "ghost"
																					}
																					className="w-full justify-between p-4 h-auto"
																				>
																					<h3 className="font-semibold">
																						{workout.name}
																					</h3>
																					{selectedWorkout === workout.id && (
																						<Badge variant="secondary">✓</Badge>
																					)}
																				</Button>
																			))}
																		</div>
																	) : (
																		<div className="flex h-full items-center justify-center">
																			<p className="text-muted-foreground">
																				No workouts found
																			</p>
																		</div>
																	)}
																</CardContent>
															</Card>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
										</>
									)}
								</div>

								{/* Result Logging */}
								<div>
									{selectedWorkout ? (
										<div className="space-y-6">
											<h2 className="text-lg font-semibold">
												LOG RESULT FOR {getSelectedWorkout()?.name}
											</h2>

											<div className="space-y-4">
												{/* Date */}
												<FormField
													control={form.control}
													name="date"
													render={({ field }) => (
														<FormItem>
															<FormLabel>Date</FormLabel>
															<FormControl>
																<Input type="date" {...field} />
															</FormControl>
															<FormMessage />
														</FormItem>
													)}
												/>

												{/* Scaling Level */}
												<ScalingSelector
													workoutId={selectedWorkout}
													workoutScalingGroupId={
														getSelectedWorkout()?.scalingGroupId
													}
													programmingTrackId={programmingTrackId}
													trackScalingGroupId={trackScalingGroupId}
													teamId={teamId}
													value={form.watch("scalingLevelId")}
													initialAsRx={form.watch("asRx")}
													onChange={(scalingLevelId, asRx) => {
														form.setValue("scalingLevelId", scalingLevelId)
														form.setValue("asRx", asRx)
													}}
													required
												/>

												{/* Score */}
												<div className="space-y-2">
													<Label>Score</Label>
													{(() => {
														const currentWorkoutDetails = getSelectedWorkout()
														const isPassFail =
															currentWorkoutDetails?.scheme === "pass-fail"
														const totalRounds =
															currentWorkoutDetails?.roundsToScore || 1

														if (isPassFail) {
															// Pass-fail: single input for rounds passed
															return (
																<div className="space-y-2">
																	<Input
																		type="number"
																		placeholder={`Rounds passed (max ${totalRounds})`}
																		value={form.watch("scores")?.[0]?.[0] || ""}
																		onChange={(e) => {
																			const value = e.target.value
																			const numValue = parseInt(value, 10)

																			// Validate that input doesn't exceed total rounds
																			if (
																				value !== "" &&
																				(Number.isNaN(numValue) ||
																					numValue > totalRounds ||
																					numValue < 0)
																			) {
																				return // Don't update if invalid
																			}

																			handleScoreChange(0, 0, value)
																		}}
																		min="0"
																		max={totalRounds}
																	/>
																	<p className="text-sm text-muted-foreground">
																		Enter the number of rounds you passed out of{" "}
																		{totalRounds} total rounds
																	</p>
																</div>
															)
														}

														// Regular scoring for non-pass-fail workouts
														return (
															<div className="space-y-3">
																{form
																	.watch("scores")
																	?.map(
																		(
																			scoreParts: string[],
																			roundIndex: number,
																		) => {
																			const hasRepsPerRound =
																				!!currentWorkoutDetails?.repsPerRound
																			const repsPerRoundValue =
																				currentWorkoutDetails?.repsPerRound
																			const isTimeWithCap =
																				currentWorkoutDetails?.scheme ===
																				"time-with-cap"
																			const timeCappedArray =
																				form.watch("timeCapped") || []
																			const isTimeCapped =
																				timeCappedArray[roundIndex] || false

																			return (
																				<div
																					key={`score-${selectedWorkout || "default"}-${roundIndex}`}
																					className="space-y-2"
																				>
																					{currentWorkoutDetails?.roundsToScore &&
																						currentWorkoutDetails.roundsToScore >
																							1 && (
																							<Label className="text-sm text-muted-foreground">
																								Round {roundIndex + 1} Score
																							</Label>
																						)}

																					{/* Time Cap Checkbox for time-with-cap workouts */}
																					{isTimeWithCap && (
																						<div className="flex items-center space-x-2">
																							<Checkbox
																								id={`timeCapped-${roundIndex}`}
																								checked={isTimeCapped}
																								onCheckedChange={(checked) =>
																									handleTimeCappedChange(
																										roundIndex,
																										!!checked,
																									)
																								}
																							/>
																							<Label
																								htmlFor={`timeCapped-${roundIndex}`}
																								className="text-sm font-normal"
																							>
																								Time capped
																							</Label>
																						</div>
																					)}

																					{hasRepsPerRound ? (
																						<div className="flex items-center gap-2">
																							<Input
																								type="number"
																								placeholder="Rounds"
																								value={scoreParts[0] || ""}
																								onChange={(e) =>
																									handleScoreChange(
																										roundIndex,
																										0,
																										e.target.value,
																									)
																								}
																								min="0"
																							/>
																							<span className="text-muted-foreground">
																								+
																							</span>
																							<Input
																								type="number"
																								placeholder={
																									repsPerRoundValue
																										? `Reps (max ${repsPerRoundValue - 1})`
																										: "Reps"
																								}
																								value={scoreParts[1] || ""}
																								onChange={(e) =>
																									handleScoreChange(
																										roundIndex,
																										1,
																										e.target.value,
																									)
																								}
																								min="0"
																								max={
																									repsPerRoundValue
																										? repsPerRoundValue - 1
																										: undefined
																								}
																							/>
																						</div>
																					) : (
																						<Input
																							type={
																								currentWorkoutDetails?.scheme ===
																									"time" ||
																								(isTimeWithCap && !isTimeCapped)
																									? "text"
																									: "number"
																							}
																							placeholder={
																								currentWorkoutDetails?.scheme ===
																									"time" ||
																								(isTimeWithCap && !isTimeCapped)
																									? "e.g. 3:21"
																									: isTimeWithCap &&
																											isTimeCapped
																										? "Reps completed"
																										: "Reps/Load"
																							}
																							value={scoreParts[0] || ""}
																							onChange={(e) =>
																								handleScoreChange(
																									roundIndex,
																									0,
																									e.target.value,
																								)
																							}
																							min={
																								currentWorkoutDetails?.scheme !==
																									"time" &&
																								!(
																									isTimeWithCap && !isTimeCapped
																								)
																									? "0"
																									: undefined
																							}
																						/>
																					)}
																				</div>
																			)
																		},
																	)}
															</div>
														)
													})()}
												</div>

												{/* Notes */}
												<FormField
													control={form.control}
													name="notes"
													render={({ field }) => (
														<FormItem>
															<FormLabel>Notes</FormLabel>
															<FormControl>
																<Textarea
																	rows={4}
																	placeholder="How did it feel? Any modifications?"
																	{...field}
																/>
															</FormControl>
															<FormMessage />
														</FormItem>
													)}
												/>
											</div>
										</div>
									) : (
										<Card className="h-full">
											<CardContent className="flex h-full min-h-[400px] items-center justify-center">
												<p className="text-center text-muted-foreground">
													Select a workout from the list to log a result
												</p>
											</CardContent>
										</Card>
									)}
								</div>
							</div>

							<Separator className="my-6" />

							<div className="flex justify-end gap-4">
								<Button asChild variant="outline">
									<Link
										href={
											(redirectUrl || "/log") as Parameters<
												typeof router.push
											>[0]
										}
									>
										Cancel
									</Link>
								</Button>
								<Button
									type="submit"
									disabled={!selectedWorkout || form.formState.isSubmitting}
								>
									{form.formState.isSubmitting ? "Saving..." : "Save Result"}
								</Button>
							</div>
						</CardContent>
					</Card>
				</form>
			</Form>
		</div>
	)
}
