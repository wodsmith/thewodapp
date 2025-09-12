"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Search } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { useServerAction } from "zsa-react"
import { submitLogFormAction } from "@/actions/log-actions"
import {
	type LogFormSchema,
	logFormSchema,
} from "@/app/(main)/log/new/_components/log.schema"
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
import type { Workout } from "@/types"

export default function LogFormClient({
	workouts,
	userId,
	selectedWorkoutId,
	redirectUrl,
	scheduledInstanceId,
	programmingTrackId,
}: {
	workouts: Workout[]
	userId: string
	selectedWorkoutId?: string
	redirectUrl?: string
	scheduledInstanceId?: string
	programmingTrackId?: string
}) {
	const router = useRouter()
	const pathname = usePathname()
	const [searchQuery, setSearchQuery] = useState("")
	const prevSelectedWorkoutIdRef = useRef<string | null | undefined>(undefined)

	const form = useForm<LogFormSchema>({
		resolver: zodResolver(logFormSchema),
		defaultValues: {
			selectedWorkoutId: selectedWorkoutId || "",
			date: new Date().toISOString().split("T")[0],
			scale: "rx",
			scores: [],
			notes: "",
		},
	})

	const selectedWorkout = useWatch({
		control: form.control,
		name: "selectedWorkoutId",
	})

	const { execute: submitLogForm } = useServerAction(submitLogFormAction, {
		onError: (error) => {
			console.error("Server action error:", error)
			toast.error(error.err?.message || "An error occurred")
		},
		onSuccess: () => {
			toast.success("Result logged successfully")
			router.push((redirectUrl || "/log") as Parameters<typeof router.push>[0])
		},
	})

	const filteredWorkouts = workouts
		.filter((workout: Workout) =>
			workout.name.toLowerCase().includes(searchQuery.toLowerCase()),
		)
		.sort((a, b) => {
			if (a.id === selectedWorkout) return -1
			if (b.id === selectedWorkout) return 1
			if (a.createdAt && b.createdAt) {
				return b.createdAt.getTime() - a.createdAt.getTime()
			}
			if (a.createdAt) return -1
			if (b.createdAt) return 1
			return a.name.localeCompare(b.name)
		})

	const getSelectedWorkout = () => {
		return workouts.find((w: Workout) => w.id === selectedWorkout)
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
			currentScores.some((parts) => parts.length !== expectedPartsPerScore)

		if (workoutIdContextChanged || scoresNeedRestructure) {
			const newInitialScores = Array(numRoundsForInputs)
				.fill(null)
				.map(() => Array(expectedPartsPerScore).fill(""))
			form.setValue("scores", newInitialScores)
			prevSelectedWorkoutIdRef.current = selectedWorkout
		}
	}, [selectedWorkout, workouts, form])

	const handleScoreChange = (
		roundIndex: number,
		partIndex: number,
		value: string,
	) => {
		const currentScores = form.getValues("scores") || []
		const newScores = currentScores.map((parts, rIndex) => {
			if (rIndex === roundIndex) {
				const newParts = [...parts]
				newParts[partIndex] = value
				return newParts
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
		formData.set("scale", data.scale)
		formData.set("notes", data.notes || "")

		// Add scores to formData
		if (data.scores) {
			data.scores.forEach((scoreParts, roundIndex) => {
				scoreParts.forEach((partValue, partIndex) => {
					formData.append(
						`scores[${roundIndex}][${partIndex}]`,
						partValue || "",
					)
				})
			})
		}

		// Add scheduledInstanceId and programmingTrackId if they exist
		if (scheduledInstanceId) {
			formData.set("scheduledInstanceId", scheduledInstanceId)
		}
		if (programmingTrackId) {
			formData.set("programmingTrackId", programmingTrackId)
		}

		await submitLogForm({
			userId,
			workouts,
			formData,
		})
	}

	return (
		<div className="container mx-auto max-w-6xl p-4">
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)}>
					<div className="mb-6 flex items-center justify-between">
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
						<CardContent className="p-6">
							<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
								{/* Workout Selection */}
								<div className="space-y-4">
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
																	{filteredWorkouts.map((workout: Workout) => (
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

												{/* Scale */}
												<FormField
													control={form.control}
													name="scale"
													render={({ field }) => (
														<FormItem>
															<FormLabel>Scale</FormLabel>
															<FormControl>
																<div className="flex gap-4">
																	<Label className="flex items-center gap-2 cursor-pointer">
																		<Checkbox
																			checked={field.value === "rx"}
																			onCheckedChange={() =>
																				field.onChange("rx")
																			}
																		/>
																		<span className="text-sm">RX</span>
																	</Label>
																	<Label className="flex items-center gap-2 cursor-pointer">
																		<Checkbox
																			checked={field.value === "rx+"}
																			onCheckedChange={() =>
																				field.onChange("rx+")
																			}
																		/>
																		<span className="text-sm">RX+</span>
																	</Label>
																	<Label className="flex items-center gap-2 cursor-pointer">
																		<Checkbox
																			checked={field.value === "scaled"}
																			onCheckedChange={() =>
																				field.onChange("scaled")
																			}
																		/>
																		<span className="text-sm">Scaled</span>
																	</Label>
																</div>
															</FormControl>
															<FormMessage />
														</FormItem>
													)}
												/>

												{/* Score */}
												<div className="space-y-2">
													<Label>Score</Label>
													<div className="space-y-3">
														{form
															.watch("scores")
															?.map((scoreParts, roundIndex) => {
																const currentWorkoutDetails =
																	getSelectedWorkout()
																const hasRepsPerRound =
																	!!currentWorkoutDetails?.repsPerRound
																const repsPerRoundValue =
																	currentWorkoutDetails?.repsPerRound

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
																					placeholder={`Reps (max ${
																						repsPerRoundValue
																							? repsPerRoundValue - 1
																							: "N/A"
																					})`}
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
																					"time"
																						? "text"
																						: "number"
																				}
																				placeholder={
																					currentWorkoutDetails?.scheme ===
																					"time"
																						? "e.g. 3:21"
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
																					"time"
																						? "0"
																						: undefined
																				}
																			/>
																		)}
																	</div>
																)
															})}
													</div>
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
									<Link href="/log">Cancel</Link>
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
