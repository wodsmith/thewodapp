"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft } from "lucide-react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { useMemo, useRef } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { useServerAction } from "@repo/zsa-react"
import { updateResultAction } from "@/actions/log-actions"
import {
	type LogFormSchema,
	logFormSchema,
} from "@/app/(main)/log/new/_components/log.schema"
import {
	ScoreInputFields,
	type ScoreInputFieldsHandle,
} from "@/app/(compete)/compete/organizer/[competitionId]/(with-sidebar)/results/_components/score-input-row/score-input-fields"
import { WorkoutScalingTabs } from "@/components/scaling/workout-scaling-tabs"
import { ScalingSelector } from "@/components/scaling-selector"
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
import { decodeScore, decodeToNumber } from "@/lib/scoring"
import type { WorkoutScheme } from "@/db/schema"
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
		secondaryValue?: number | null
		scheme: string
		scoreType: string
		status: string | null
		scheduledWorkoutInstanceId: string | null
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
	teamId: string
	redirectUrl: string
}

export default function EditResultClient({
	result,
	workout,
	sets,
	teamId,
	redirectUrl,
}: EditResultClientProps) {
	const router = useRouter()
	const scoreInputRef = useRef<ScoreInputFieldsHandle>(null)

	const subject = useMemo(() => {
		const scheme = workout.scheme as WorkoutScheme
		const isCap = result.status === "cap" && scheme === "time-with-cap"
		const wodScore = (() => {
			if (isCap) return "CAP"
			if (result.scoreValue === null) return ""
			return decodeScore(result.scoreValue, scheme)
		})()

		const convertedSets = sets
			.map((round) => {
				// score-input-row expects legacy-ish { score, reps } for rounds+reps and seconds for time.
				const value = (round as any).value as number | null
				const roundNumber = (round as any).roundNumber as number
				if (value === null) return null

				if (scheme === "rounds-reps") {
					const rounds = Math.floor(value / 100000)
					const reps = value % 100000
					return { setNumber: roundNumber, score: rounds, reps }
				}

				if (
					scheme === "time" ||
					scheme === "time-with-cap" ||
					scheme === "emom"
				) {
					return {
						setNumber: roundNumber,
						score: Math.round(value / 1000),
						reps: null,
					}
				}

				// score_rounds stores new-encoding values (grams for load, mm for distance).
				// score-input-row expects legacy-ish values for seeding inputs (lbs, meters/feet).
				if (scheme === "load") {
					return {
						setNumber: roundNumber,
						score: Math.round(
							decodeToNumber(value, scheme, { weightUnit: "lbs" }),
						),
						reps: null,
					}
				}

				if (scheme === "meters") {
					return {
						setNumber: roundNumber,
						score: Math.round(
							decodeToNumber(value, scheme, { distanceUnit: "m" }),
						),
						reps: null,
					}
				}

				if (scheme === "feet") {
					return {
						setNumber: roundNumber,
						score: Math.round(
							decodeToNumber(value, scheme, { distanceUnit: "ft" }),
						),
						reps: null,
					}
				}

				return { setNumber: roundNumber, score: value, reps: null }
			})
			.filter(
				(x): x is { setNumber: number; score: number; reps: number | null } =>
					x !== null,
			)

		return {
			existingResult: {
				wodScore,
				scoreStatus: (result.status as any) ?? null,
				tieBreakScore: null,
				secondaryScore: isCap ? String(result.secondaryValue ?? "") : null,
				sets: convertedSets,
			},
		}
	}, [
		result.scoreValue,
		result.secondaryValue,
		result.status,
		sets,
		workout.scheme,
	])

	const form = useForm<LogFormSchema>({
		resolver: zodResolver(logFormSchema as any),
		defaultValues: {
			selectedWorkoutId: workout.id,
			date: result.date
				? getLocalDateKey(result.date)
				: getLocalDateKey(new Date()),
			scale: result.asRx ? "rx" : "scaled",
			scalingLevelId: result.scalingLevelId || undefined,
			asRx: result.asRx || false,
			notes: result.notes || "",
		},
	})

	const { execute: updateScore } = useServerAction(updateResultAction, {
		onSuccess: () => {
			toast.success("Result updated successfully")
			router.push(redirectUrl as Route)
		},
		onError: (error) => {
			toast.error(error.err?.message || "Failed to update result")
		},
	})

	const handleFormSubmit = async (data: LogFormSchema) => {
		const scorePayload = scoreInputRef.current?.getValue()
		if (!scorePayload) {
			toast.error("Score input is not ready. Please refresh and try again.")
			return
		}

		await updateScore({
			scoreId: result.id,
			selectedWorkoutId: workout.id,
			date: data.date,
			notes: data.notes || "",
			scalingLevelId: data.scalingLevelId ?? null,
			asRx: data.asRx ?? null,
			scale: data.scale,
			score: scorePayload.score,
			roundScores: scorePayload.roundScores,
			secondaryScore: scorePayload.secondaryScore,
			scheduledInstanceId: result.scheduledWorkoutInstanceId ?? null,
			programmingTrackId: null,
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

								<div className="space-y-2">
									<Label>Score</Label>
									<ScoreInputFields
										key={workout.id}
										ref={scoreInputRef}
										workoutScheme={
											(workout.scheme as unknown as WorkoutScheme) || "reps"
										}
										scoreType={workout.scoreType as any}
										tiebreakScheme={(workout.tiebreakScheme as any) || null}
										showTiebreak={false}
										timeCap={workout.timeCap || undefined}
										roundsToScore={workout.roundsToScore || 1}
										subject={subject}
									/>
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
