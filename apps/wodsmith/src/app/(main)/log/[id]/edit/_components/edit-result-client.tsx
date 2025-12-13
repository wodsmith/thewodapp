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
import { useLogScoreState } from "@/app/(main)/log/_components/use-log-score-state"
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
import { decodeScore } from "@/lib/scoring"
import { formatSecondsToTime } from "@/lib/utils"
import type { ResultSet, Workout } from "@/types"
import { getLocalDateKey } from "@/utils/date-utils"

interface EditResultClientProps {
	result: {
		id: string
		userId: string
		date: Date | null
		workoutId: string | null
		notes: string | null
		scalingLevelId: string | null
		asRx: boolean
		scoreValue: number | null
		scheme: string
		scoreType: string
		status: string | null
		scheduledWorkoutInstanceId: string | null
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

// Helper component for time-based score inputs with validation
function ScoreInputWithValidation({
	roundIndex,
	parts,
	workout,
	isTimeWithCap,
	isTimeCapped,
	scoreScheme,
	currentScores,
	onScoreChange,
	onTimeCappedChange,
	form,
}: {
	roundIndex: number
	parts: string[]
	workout: Workout
	isTimeWithCap: boolean
	isTimeCapped: boolean
	scoreScheme: string
	currentScores: string[][]
	onScoreChange: (roundIndex: number, partIndex: number, value: string) => void
	onTimeCappedChange: (roundIndex: number, value: boolean) => void
	form: ReturnType<typeof useForm<LogFormSchema>>
}) {
	const { parseResult, handleInputChange } = useLogScoreState({
		workoutScheme: scoreScheme as any,
		timeCap: workout.timeCap || undefined,
		initialValue: parts[0] || "",
	})

	const handleChange = (value: string) => {
		onScoreChange(roundIndex, 0, value)
		handleInputChange(value)
	}

	return (
		<div className="space-y-2">
			{currentScores.length > 1 && (
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
							onTimeCappedChange(roundIndex, !!checked)
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

			<FormField
				control={form.control}
				name={`scores.${roundIndex}.0`}
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
										? "Reps completed or DNS/DNF/CAP"
										: "MM:SS, seconds, or DNS/DNF/CAP"
								}
								value={parts[0] || ""}
								onChange={(e) => handleChange(e.target.value)}
								min={isTimeWithCap && isTimeCapped ? "0" : undefined}
							/>
						</FormControl>
						{parseResult && !parseResult.isValid && parseResult.error && (
							<p className="text-sm text-destructive">{parseResult.error}</p>
						)}
						{parseResult?.isValid && parseResult.formatted && (
							<p className="text-sm text-muted-foreground">
								Preview: {parseResult.formatted}
							</p>
						)}
						<FormMessage />
					</FormItem>
				)}
			/>
		</div>
	)
}

// Helper component for default score inputs with validation
function ScoreInputDefault({
	roundIndex,
	parts,
	workout,
	currentScores,
	onScoreChange,
	form,
}: {
	roundIndex: number
	parts: string[]
	workout: Workout
	currentScores: string[][]
	onScoreChange: (roundIndex: number, partIndex: number, value: string) => void
	form: ReturnType<typeof useForm<LogFormSchema>>
}) {
	const { parseResult, handleInputChange } = useLogScoreState({
		workoutScheme: (workout.scheme as any) || "reps",
		initialValue: parts[0] || "",
	})

	const handleChange = (value: string) => {
		onScoreChange(roundIndex, 0, value)
		handleInputChange(value)
	}

	return (
		<div className="flex flex-col gap-2">
			<FormField
				control={form.control}
				name={`scores.${roundIndex}.0`}
				render={({ field }) => (
					<FormItem className="flex-1">
						<FormLabel>
							{currentScores.length > 1
								? `Round ${roundIndex + 1} Score`
								: "Score"}
						</FormLabel>
						<FormControl>
							<Input
								{...field}
								type="text"
								placeholder="Enter score or DNS/DNF"
								value={parts[0] || ""}
								onChange={(e) => handleChange(e.target.value)}
							/>
						</FormControl>
						{parseResult && !parseResult.isValid && parseResult.error && (
							<p className="text-sm text-destructive">{parseResult.error}</p>
						)}
						{parseResult?.isValid && parseResult.formatted && (
							<p className="text-sm text-muted-foreground">
								Preview: {parseResult.formatted}
							</p>
						)}
						<FormMessage />
					</FormItem>
				)}
			/>
		</div>
	)
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

	// Parse existing scores from score_rounds using the scoring library
	// score_rounds uses: value (encoded score), secondaryValue (reps if capped), status
	const parseExistingScores = (): string[][] => {
		const numRounds = workout.roundsToScore || 1
		const hasRepsPerRound = !!workout.repsPerRound
		const expectedPartsPerScore = hasRepsPerRound ? 2 : 1

		const scores: string[][] = Array(numRounds)
			.fill(null)
			.map(() => Array(expectedPartsPerScore).fill(""))

		// Sort sets by roundNumber to ensure correct order
		const sortedSets = [...sets].sort((a, b) => a.roundNumber - b.roundNumber)

		sortedSets.forEach((round, index) => {
			if (index < numRounds && scores[index]) {
				const isTimeCapped = round.status === "cap"

				if (isTimeCapped && round.secondaryValue !== null) {
					// Time capped - show reps completed from secondaryValue
					scores[index][0] = round.secondaryValue.toString()
				} else if (round.value !== null && workout.scheme) {
					// Decode the encoded value using the scoring library
					const decoded = decodeScore(round.value, workout.scheme)

					if (hasRepsPerRound && workout.repsPerRound) {
						// For rounds+reps with repsPerRound, extract rounds and reps from decoded
						// The value is encoded as rounds*100000+reps
						const totalReps = round.value
						const rounds = Math.floor(totalReps / workout.repsPerRound)
						const reps = totalReps % workout.repsPerRound
						scores[index][0] = rounds.toString()
						scores[index][1] = reps.toString()
					} else {
						scores[index][0] = decoded
					}
				}
			}
		})

		return scores
	}

	// Parse existing time capped status from score_rounds
	const parseExistingTimeCapped = (): boolean[] => {
		const numRounds = workout.roundsToScore || 1
		const timeCapped: boolean[] = Array(numRounds).fill(false)

		if (workout.scheme === "time-with-cap") {
			// Sort sets by roundNumber to ensure correct order
			const sortedSets = [...sets].sort((a, b) => a.roundNumber - b.roundNumber)

			sortedSets.forEach((round, index) => {
				if (index < numRounds) {
					// Check if status is "cap" to determine if time capped
					timeCapped[index] = round.status === "cap"
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
			scale: result.asRx ? "rx" : "scaled", // Map asRx to legacy scale for form
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

		// Append scores
		data.scores?.forEach((parts: string[], roundIndex: number) => {
			parts.forEach((part: string, partIndex: number) => {
				formData.append(`scores[${roundIndex}][${partIndex}]`, part)
			})
		})

		// Add timeCapped data to formData
		if (data.timeCapped) {
			data.timeCapped.forEach((isTimeCapped: boolean, roundIndex: number) => {
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
			scores.some((parts: string[]) => parts.length !== expectedPartsPerScore)

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

	const renderScoreInputs = () => {
		const currentScores = form.getValues("scores") || []
		const hasRepsPerRound = !!workout.repsPerRound
		const timeCappedArray = form.getValues("timeCapped") || []

		if (workout.scheme === "time" || workout.scheme === "time-with-cap") {
			return currentScores.map((parts: string[], index: number) => {
				const isTimeWithCap = workout.scheme === "time-with-cap"
				const isTimeCapped = timeCappedArray[index] || false

				// Use the scoring hook for validation and preview
				const scoreScheme = isTimeWithCap && isTimeCapped ? "reps" : workout.scheme
				
				return (
					<ScoreInputWithValidation
						key={`score-time-round-${index}-${workout.id}`}
						roundIndex={index}
						parts={parts}
						workout={workout}
						isTimeWithCap={isTimeWithCap}
						isTimeCapped={isTimeCapped}
						scoreScheme={scoreScheme}
						currentScores={currentScores}
						onScoreChange={handleScoreChange}
						onTimeCappedChange={handleTimeCappedChange}
						form={form}
					/>
				)
			})
		}

		if (hasRepsPerRound) {
			return currentScores.map((parts: string[], index: number) => {
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

		// Default score input with validation
		return currentScores.map((parts: string[], index: number) => {
			return (
				<ScoreInputDefault
					key={`score-default-round-${index}-${workout.id}`}
					roundIndex={index}
					parts={parts}
					workout={workout}
					currentScores={currentScores}
					onScoreChange={handleScoreChange}
					form={form}
				/>
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
									programmingTrackId={null}
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
