"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft } from "lucide-react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import {
	type LogFormSchema,
	logFormSchema,
} from "@/app/(main)/log/new/_components/log.schema"
import { WorkoutScalingTabs } from "@/components/scaling/workout-scaling-tabs"
import { ScalingSelector } from "@/components/scaling-selector"
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
import { formatSecondsToTime } from "@/lib/utils"
import type { ResultSet, Workout } from "@/types"
import { getLocalDateKey } from "@/utils/date-utils"

interface EditResultClientProps {
	result: {
		id: string
		userId: string
		date: Date | null
		workoutId: string | null
		type: "wod" | "strength" | "monostructural" | null
		notes: string | null
		scale: "rx" | "scaled" | "rx+" | null
		scalingLevelId?: string | null
		asRx?: boolean | null
		wodScore: string | null
		scheduledWorkoutInstanceId: string | null
		programmingTrackId: string | null
		workoutScheme: string | null
		workoutRepsPerRound: number | null
		workoutRoundsToScore: number | null
	}
	workout: Workout & {
		scalingLevels?: Array<{
			id: string
			label: string
			position: number
		}>
		scalingDescriptions?: Array<{
			scalingLevelId: string
			description: string | null
		}>
	}
	sets: ResultSet[]
	userId: string
	teamId: string
	redirectUrl: string
	updateResultAction: (data: {
		resultId: string
		userId: string
		workouts: Workout[]
		formData: FormData
	}) => Promise<{ error?: string } | undefined>
}

export default function EditResultClient({
	result,
	workout,
	sets,
	userId,
	teamId,
	redirectUrl,
	updateResultAction,
}: EditResultClientProps) {
	const router = useRouter()
	const prevSelectedWorkoutIdRef = useRef<string | null | undefined>(undefined)

	// Parse existing scores from sets
	const parseExistingScores = (): string[][] => {
		const numRounds = workout.roundsToScore || 1
		const hasRepsPerRound = !!workout.repsPerRound
		const expectedPartsPerScore = hasRepsPerRound ? 2 : 1

		const scores: string[][] = Array(numRounds)
			.fill(null)
			.map(() => Array(expectedPartsPerScore).fill(""))

		// Parse the wodScore for display
		if (result.wodScore) {
			if (hasRepsPerRound) {
				// Parse rounds + reps format like "3 + 15"
				const parts = result.wodScore.split(",").map((s) => s.trim())
				for (let i = 0; i < Math.min(parts.length, numRounds); i++) {
					const match = parts[i]?.match(/(\d+)\s*\+\s*(\d+)/)
					const score = scores[i]
					if (score && match?.[1] && match?.[2]) {
						score[0] = match[1]
						score[1] = match[2]
					}
				}
			} else if (
				workout.scheme === "time" ||
				workout.scheme === "time-with-cap"
			) {
				// Parse time format
				const times = result.wodScore.split(",").map((s) => s.trim())
				for (let i = 0; i < Math.min(times.length, numRounds); i++) {
					const time = times[i]
					const score = scores[i]
					if (time && score) {
						score[0] = time
					}
				}
			} else {
				// Parse regular scores
				const values = result.wodScore.split(",").map((s) => s.trim())
				for (let i = 0; i < Math.min(values.length, numRounds); i++) {
					const value = values[i]
					const score = scores[i]
					if (value && score) {
						score[0] = value
					}
				}
			}
		}

		// Also check sets data for more accurate values
		sets.forEach((set, index) => {
			if (index < numRounds && scores[index]) {
				if (hasRepsPerRound && set.reps !== null && workout.repsPerRound) {
					const rounds = Math.floor(set.reps / workout.repsPerRound)
					const reps = set.reps % workout.repsPerRound
					scores[index][0] = rounds.toString()
					scores[index][1] = reps.toString()
				} else if (set.time !== null) {
					scores[index][0] = formatSecondsToTime(set.time)
				} else if (set.score !== null) {
					scores[index][0] = set.score.toString()
				} else if (
					workout.scheme === "time-with-cap" &&
					set.reps !== null &&
					set.time === null
				) {
					// Time capped - show reps
					scores[index][0] = set.reps.toString()
				}
			}
		})

		return scores
	}

	// Parse existing time capped status from sets
	const parseExistingTimeCapped = (): boolean[] => {
		const numRounds = workout.roundsToScore || 1
		const timeCapped: boolean[] = Array(numRounds).fill(false)

		if (workout.scheme === "time-with-cap") {
			sets.forEach((set, index) => {
				if (index < numRounds) {
					// If set has reps but no time, it was time capped
					timeCapped[index] = set.reps !== null && set.time === null
				}
			})
		}

		return timeCapped
	}

	const form = useForm<LogFormSchema>({
		resolver: zodResolver(logFormSchema),
		defaultValues: {
			selectedWorkoutId: workout.id,
			date: result.date
				? getLocalDateKey(result.date)
				: getLocalDateKey(new Date()),
			scale: result.scale || "rx",
			scalingLevelId: result.scalingLevelId || undefined,
			asRx: result.asRx || false,
			scores: parseExistingScores(),
			timeCapped: parseExistingTimeCapped(),
			notes: result.notes || "",
		},
	})

	const selectedWorkout = useWatch({
		control: form.control,
		name: "selectedWorkoutId",
	})
	const scores = useWatch({ control: form.control, name: "scores" })

	const handleFormSubmit = async (data: LogFormSchema) => {
		const formData = new FormData()
		formData.append("selectedWorkoutId", data.selectedWorkoutId)
		formData.append("date", data.date)
		// Include both legacy and new scaling fields
		if (data.scalingLevelId) {
			formData.append("scalingLevelId", data.scalingLevelId)
			formData.append("asRx", String(data.asRx || false))
			// Set legacy scale based on asRx for backward compatibility
			formData.append("scale", data.asRx ? "rx" : "scaled")
		} else if (data.scale) {
			formData.append("scale", data.scale || "")
		}
		formData.append("notes", data.notes || "")
		formData.append("redirectUrl", redirectUrl)

		// Add the IDs if they exist
		if (result.scheduledWorkoutInstanceId) {
			formData.append("scheduledInstanceId", result.scheduledWorkoutInstanceId)
		}
		if (result.programmingTrackId) {
			formData.append("programmingTrackId", result.programmingTrackId)
		}

		// Append scores
		data.scores?.forEach((parts, roundIndex) => {
			parts.forEach((part, partIndex) => {
				formData.append(`scores[${roundIndex}][${partIndex}]`, part)
			})
		})

		// Add timeCapped data to formData
		if (data.timeCapped) {
			data.timeCapped.forEach((isTimeCapped, roundIndex) => {
				formData.append(`timeCapped[${roundIndex}]`, String(isTimeCapped))
			})
		}

		// Call server action - it will handle redirect or return error
		const response = await updateResultAction({
			resultId: result.id,
			userId,
			workouts: [workout],
			formData,
		})

		// Only show error if there was an actual error (not a redirect)
		if (response?.error) {
			toast.error(response.error)
		} else {
			// Success - will redirect (Next.js handles this internally)
			toast.success("Result updated successfully")
		}
	}

	// Update scores when needed (similar to log form)
	useEffect(() => {
		if (!selectedWorkout) {
			if (scores && scores.length !== 0) {
				form.setValue("scores", [])
			}
			if (prevSelectedWorkoutIdRef.current !== null) {
				prevSelectedWorkoutIdRef.current = null
			}
			return
		}

		const numRoundsForInputs = workout.roundsToScore || 1
		const hasRepsPerRound = !!workout.repsPerRound
		const expectedPartsPerScore = hasRepsPerRound ? 2 : 1

		const workoutIdContextChanged =
			prevSelectedWorkoutIdRef.current !== selectedWorkout
		const scoresNeedRestructure =
			!scores ||
			scores.length !== numRoundsForInputs ||
			scores.some((parts) => parts.length !== expectedPartsPerScore)

		if (workoutIdContextChanged || scoresNeedRestructure) {
			// Don't reset scores if we're just loading the form initially
			if (prevSelectedWorkoutIdRef.current === undefined) {
				prevSelectedWorkoutIdRef.current = selectedWorkout
				return
			}
			const newInitialScores = Array(numRoundsForInputs)
				.fill(null)
				.map(() => Array(expectedPartsPerScore).fill(""))
			form.setValue("scores", newInitialScores)
			prevSelectedWorkoutIdRef.current = selectedWorkout
		}
	}, [selectedWorkout, workout, scores, form])

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

	const handleTimeCappedChange = (roundIndex: number, value: boolean) => {
		const currentTimeCapped = form.getValues("timeCapped") || []
		const newTimeCapped = [...currentTimeCapped]
		newTimeCapped[roundIndex] = value
		form.setValue("timeCapped", newTimeCapped)

		// Clear the score when toggling time cap status
		const currentScores = form.getValues("scores") || []
		const newScores = currentScores.map((parts, rIndex) => {
			if (rIndex === roundIndex) {
				return [""] // Reset to empty string
			}
			return parts
		})
		form.setValue("scores", newScores)
	}

	const renderScoreInputs = () => {
		const currentScores = form.getValues("scores") || []
		const hasRepsPerRound = !!workout.repsPerRound
		const timeCappedArray = form.getValues("timeCapped") || []

		if (workout.scheme === "time" || workout.scheme === "time-with-cap") {
			return currentScores.map((parts, index) => {
				const isTimeWithCap = workout.scheme === "time-with-cap"
				const isTimeCapped = timeCappedArray[index] || false

				return (
					<div
						key={`score-time-round-${index}-${workout.id}`}
						className="space-y-2"
					>
						{currentScores.length > 1 && (
							<Label className="text-sm text-muted-foreground">
								Round {index + 1} Score
							</Label>
						)}

						{/* Time Cap Checkbox for time-with-cap workouts */}
						{isTimeWithCap && (
							<div className="flex items-center space-x-2">
								<Checkbox
									id={`timeCapped-${index}`}
									checked={isTimeCapped}
									onCheckedChange={(checked) =>
										handleTimeCappedChange(index, !!checked)
									}
								/>
								<Label
									htmlFor={`timeCapped-${index}`}
									className="text-sm font-normal"
								>
									Time capped
								</Label>
							</div>
						)}

						<FormField
							control={form.control}
							name={`scores.${index}.0`}
							render={({ field }) => (
								<FormItem className="flex-1">
									<FormLabel>
										{isTimeWithCap && isTimeCapped
											? currentScores.length > 1
												? ""
												: "Reps"
											: currentScores.length > 1
												? ""
												: "Time"}
									</FormLabel>
									<FormControl>
										<Input
											{...field}
											type={isTimeWithCap && isTimeCapped ? "number" : "text"}
											placeholder={
												isTimeWithCap && isTimeCapped
													? "Reps completed"
													: "MM:SS or seconds"
											}
											value={parts[0] || ""}
											onChange={(e) =>
												handleScoreChange(index, 0, e.target.value)
											}
											min={isTimeWithCap && isTimeCapped ? "0" : undefined}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
				)
			})
		}

		if (hasRepsPerRound) {
			return currentScores.map((parts, index) => {
				return (
					<div
						key={`score-reps-round-${index}-${workout.id}`}
						className="space-y-2"
					>
						<h4 className="text-sm font-semibold">
							{currentScores.length > 1 ? `Round ${index + 1}` : "Score"}
						</h4>
						<div className="flex gap-2 items-end">
							<FormField
								control={form.control}
								name={`scores.${index}.0`}
								render={({ field }) => (
									<FormItem className="flex-1">
										<FormLabel>Rounds</FormLabel>
										<FormControl>
											<Input
												{...field}
												type="number"
												min="0"
												placeholder="0"
												value={parts[0] || ""}
												onChange={(e) =>
													handleScoreChange(index, 0, e.target.value)
												}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<span className="pb-2 text-lg font-bold">+</span>
							<FormField
								control={form.control}
								name={`scores.${index}.1`}
								render={({ field }) => (
									<FormItem className="flex-1">
										<FormLabel>Reps (out of {workout.repsPerRound})</FormLabel>
										<FormControl>
											<Input
												{...field}
												type="number"
												min="0"
												max={workout.repsPerRound?.toString()}
												placeholder="0"
												value={parts[1] || ""}
												onChange={(e) =>
													handleScoreChange(index, 1, e.target.value)
												}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
					</div>
				)
			})
		}

		// Default score input
		return currentScores.map((parts, index) => {
			return (
				<div
					key={`score-default-round-${index}-${workout.id}`}
					className="flex items-end gap-2"
				>
					<FormField
						control={form.control}
						name={`scores.${index}.0`}
						render={({ field }) => (
							<FormItem className="flex-1">
								<FormLabel>
									{currentScores.length > 1
										? `Round ${index + 1} Score`
										: "Score"}
								</FormLabel>
								<FormControl>
									<Input
										{...field}
										type="number"
										min="0"
										placeholder="0"
										value={parts[0] || ""}
										onChange={(e) =>
											handleScoreChange(index, 0, e.target.value)
										}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>
			)
		})
	}

	return (
		<div className="container mx-auto px-4 py-8 max-w-2xl">
			<div className="mb-6">
				<Button
					variant="ghost"
					size="sm"
					onClick={() => router.push(redirectUrl as Route)}
				>
					<ArrowLeft className="h-4 w-4 mr-2" />
					Back
				</Button>
			</div>

			<h1 className="text-3xl font-bold mb-8">Edit Result</h1>

			<Form {...form}>
				<form
					onSubmit={form.handleSubmit(handleFormSubmit)}
					className="space-y-6"
				>
					<Card>
						<CardContent className="pt-6">
							<div className="space-y-4">
								<div>
									<h3 className="text-lg font-semibold mb-2">Workout</h3>
									<p className="text-lg">{workout.name}</p>

									{/* Show scaling tabs if available, otherwise show description */}
									{workout.scalingLevels && workout.scalingLevels.length > 0 ? (
										<WorkoutScalingTabs
											workoutDescription={workout.description || ""}
											scalingLevels={workout.scalingLevels}
											scalingDescriptions={workout.scalingDescriptions}
											className="mt-2"
										/>
									) : (
										workout.description && (
											<p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
												{workout.description}
											</p>
										)
									)}

									{workout.scheme && (
										<div className="mt-2">
											<span className="inline-block bg-primary text-primary-foreground px-2 py-1 rounded text-sm font-medium">
												{workout.scheme.toUpperCase()}
											</span>
										</div>
									)}
								</div>

								<Separator />

								<FormField
									control={form.control}
									name="date"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Date</FormLabel>
											<FormControl>
												<Input {...field} type="date" />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								{/* Scaling Level */}
								<ScalingSelector
									workoutId={workout.id}
									workoutScalingGroupId={workout.scalingGroupId}
									programmingTrackId={result.programmingTrackId}
									trackScalingGroupId={null}
									teamId={teamId}
									value={form.watch("scalingLevelId")}
									initialAsRx={form.watch("asRx")}
									onChange={(scalingLevelId, asRx) => {
										form.setValue("scalingLevelId", scalingLevelId)
										form.setValue("asRx", asRx)
									}}
									required
								/>

								<div className="space-y-4">
									<Label>Score</Label>
									{renderScoreInputs()}
								</div>

								<FormField
									control={form.control}
									name="notes"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Notes (optional)</FormLabel>
											<FormControl>
												<Textarea
													{...field}
													placeholder="Add any notes about your workout..."
													rows={4}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>
						</CardContent>
					</Card>

					<div className="flex gap-4">
						<Button type="submit" className="flex-1">
							Update Result
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={() => router.push(redirectUrl as Route)}
						>
							Cancel
						</Button>
					</div>
				</form>
			</Form>
		</div>
	)
}
