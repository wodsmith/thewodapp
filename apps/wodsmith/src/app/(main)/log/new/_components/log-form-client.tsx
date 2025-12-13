"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Search } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import posthog from "posthog-js"
import { useEffect, useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { useServerAction } from "@repo/zsa-react"
import { submitLogFormAction } from "@/actions/log-actions"
import {
	type LogFormSchema,
	logFormSchema,
} from "@/app/(main)/log/new/_components/log.schema"
import {
	ScoreInputFields,
	type ScoreInputFieldsHandle,
} from "@/app/(compete)/compete/organizer/[competitionId]/(with-tabs)/results/_components/score-input-row/score-input-fields"
import { WorkoutScalingTabs } from "@/components/scaling/workout-scaling-tabs"
import { ScalingSelector } from "@/components/scaling-selector"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
	const scoreInputRef = useRef<ScoreInputFieldsHandle>(null)

	const form = useForm<LogFormSchema>({
		resolver: zodResolver(logFormSchema as any),
		defaultValues: {
			selectedWorkoutId: selectedWorkoutId || "",
			date: getLocalDateKey(new Date()),
			scale: "rx", // Legacy, kept for backward compatibility
			scalingLevelId: undefined,
			asRx: true,
			score: "",
			secondaryScore: null,
			roundScores: [],
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
			posthog.capture("workout_result_logged_failed", {
				error_message: error.err?.message,
				workout_id: form.getValues("selectedWorkoutId"),
			})
		},
		onSuccess: (result) => {
			console.log("[LogFormClient] Server action success:", result)
			toast.success("Result logged successfully")
			const currentWorkout = getSelectedWorkout()
			const logResult = result?.data?.data
			const scoreId = (logResult as { scoreId?: string } | undefined)?.scoreId
			posthog.capture("workout_result_logged", {
				score_id: scoreId,
				workout_id: form.getValues("selectedWorkoutId"),
				workout_name: currentWorkout?.name,
				workout_scheme: currentWorkout?.scheme,
				has_scheduled_instance: !!scheduledInstanceId,
				has_programming_track: !!programmingTrackId,
			})
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

		const scorePayload = scoreInputRef.current?.getValue()
		if (!scorePayload) {
			toast.error("Score input is not ready. Please refresh and try again.")
			return
		}

		await submitLogForm({
			selectedWorkoutId: data.selectedWorkoutId,
			date: data.date,
			notes: data.notes || "",
			scalingLevelId: data.scalingLevelId ?? null,
			asRx: data.asRx ?? null,
			scale: data.scale,
			score: scorePayload.score,
			roundScores: scorePayload.roundScores,
			secondaryScore: scorePayload.secondaryScore,
			scheduledInstanceId: scheduledInstanceId ?? null,
			programmingTrackId: programmingTrackId ?? null,
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
													<ScoreInputFields
														key={selectedWorkout}
														ref={scoreInputRef}
														workoutScheme={
															(getSelectedWorkout()?.scheme as unknown as any) || "reps"
														}
														scoreType={getSelectedWorkout()?.scoreType as any}
														tiebreakScheme={
															(getSelectedWorkout()?.tiebreakScheme as any) || null
														}
														showTiebreak={false}
														timeCap={getSelectedWorkout()?.timeCap || undefined}
														roundsToScore={getSelectedWorkout()?.roundsToScore || 1}
														autoFocus
													/>
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
