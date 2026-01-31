"use client"

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { useNavigate, useRouter } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { MovementsList } from "@/components/movements-list"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Movement, Sponsor } from "@/db/schema"
import type { ScoreType, WorkoutScheme } from "@/db/schemas/workouts"
import {
	SCORE_TYPE_VALUES,
	TIEBREAK_SCHEME_VALUES,
	WORKOUT_SCHEME_VALUES,
} from "@/db/schemas/workouts"
import { saveCompetitionEventFn } from "@/server-fns/competition-workouts-fns"

// Form ID for external submit buttons
export const EVENT_DETAILS_FORM_ID = "event-details-form"

// Constants for workout schemes and score types
const WORKOUT_SCHEMES = [
	{ value: "time", label: "For Time" },
	{ value: "time-with-cap", label: "For Time (with cap)" },
	{ value: "rounds-reps", label: "AMRAP (rounds + reps)" },
	{ value: "reps", label: "Max Reps" },
	{ value: "load", label: "Max Load" },
	{ value: "calories", label: "Max Calories" },
	{ value: "meters", label: "Max Distance (meters)" },
	{ value: "feet", label: "Max Distance (feet)" },
	{ value: "points", label: "Points" },
	{ value: "pass-fail", label: "Pass/Fail" },
	{ value: "emom", label: "EMOM" },
] as const

const SCORE_TYPES = [
	{ value: "min", label: "Min (lowest single set wins)" },
	{ value: "max", label: "Max (highest single set wins)" },
	{ value: "sum", label: "Sum (total across rounds)" },
	{ value: "average", label: "Average (mean across rounds)" },
] as const

const TIEBREAK_SCHEMES = [
	{ value: "time", label: "Time" },
	{ value: "reps", label: "Reps" },
] as const

// Time-based schemes for conditional rendering
const TIME_BASED_SCHEMES: WorkoutScheme[] = ["time", "time-with-cap"]

function isTimeBasedScheme(scheme: WorkoutScheme): boolean {
	return TIME_BASED_SCHEMES.includes(scheme)
}

// Get default score type based on scheme
function getDefaultScoreType(scheme: WorkoutScheme): ScoreType {
	switch (scheme) {
		case "time":
		case "time-with-cap":
			return "min" // Lower time is better
		case "rounds-reps":
		case "reps":
		case "calories":
		case "meters":
		case "feet":
		case "load":
		case "emom":
		case "pass-fail":
		case "points":
			return "max" // Higher is better
	}
}

// Form schema
const competitionEventSchema = z.object({
	name: z.string().min(1, "Name is required"),
	description: z.string(),
	scheme: z.enum(WORKOUT_SCHEME_VALUES, "Scheme is required"),
	scoreType: z.enum(SCORE_TYPE_VALUES).nullable(),
	roundsToScore: z.number().min(1).nullable(),
	tiebreakScheme: z.enum(TIEBREAK_SCHEME_VALUES).nullable(),
	timeCap: z.number().min(1).nullable(), // Time cap in seconds
	selectedMovements: z.array(z.string()),
	pointsMultiplier: z.number().min(1).max(1000),
	notes: z.string(),
	divisionDescs: z.record(z.string(), z.string()),
	sponsorId: z.string().nullable(), // "Presented by" sponsor
})

type CompetitionEventSchema = z.infer<typeof competitionEventSchema>

interface Division {
	id: string
	label: string
	position: number
	registrationCount: number
}

interface DivisionDescriptionData {
	divisionId: string
	divisionLabel: string
	description: string | null
}

interface CompetitionWorkout {
	id: string
	trackId: string
	workoutId: string
	trackOrder: number
	notes: string | null
	pointsMultiplier: number | null
	sponsorId: string | null
	workout: {
		id: string
		name: string
		description: string | null
		scheme: WorkoutScheme
		scoreType: ScoreType | null
		roundsToScore: number | null
		tiebreakScheme: string | null
		timeCap: number | null
		// Simplified movement type from server function
		movements?: Array<{ id: string; name: string; type: string }>
	}
}

interface EventDetailsFormProps {
	event: CompetitionWorkout
	competitionId: string
	organizingTeamId: string
	divisions: Division[]
	divisionDescriptions: DivisionDescriptionData[]
	movements: Movement[]
	sponsors: Sponsor[]
}

export function EventDetailsForm({
	event,
	competitionId,
	organizingTeamId,
	divisions,
	divisionDescriptions,
	movements,
	sponsors,
}: EventDetailsFormProps) {
	const router = useRouter()
	const navigate = useNavigate()

	// Build initial division descriptions
	const initialDivisionDescs: Record<string, string> = {}
	for (const dd of divisionDescriptions) {
		initialDivisionDescs[dd.divisionId] = dd.description || ""
	}

	// Initialize form with React Hook Form
	const form = useForm<CompetitionEventSchema>({
		resolver: standardSchemaResolver(competitionEventSchema),
		mode: "onChange",
		defaultValues: {
			name: event.workout.name,
			description: event.workout.description || "",
			scheme: event.workout.scheme,
			scoreType: event.workout.scoreType,
			roundsToScore: event.workout.roundsToScore,
			tiebreakScheme: event.workout.tiebreakScheme as any,
			timeCap: event.workout.timeCap,
			pointsMultiplier: event.pointsMultiplier || 100,
			notes: event.notes || "",
			selectedMovements: event.workout.movements?.map((m) => m.id) ?? [],
			divisionDescs: initialDivisionDescs,
			sponsorId: event.sponsorId,
		},
	})

	const { watch, setValue } = form
	const scheme = watch("scheme")
	const scoreType = watch("scoreType")
	const selectedMovements = watch("selectedMovements")

	// Auto-set scoreType when scheme changes (only if not already set)
	useEffect(() => {
		const defaultScoreType = getDefaultScoreType(scheme)
		if (!scoreType && defaultScoreType) {
			setValue("scoreType", defaultScoreType)
		}
	}, [scheme, scoreType, setValue])

	const handleMovementToggle = (movementId: string) => {
		if (selectedMovements.includes(movementId)) {
			setValue(
				"selectedMovements",
				selectedMovements.filter((id) => id !== movementId),
			)
		} else {
			setValue("selectedMovements", [...selectedMovements, movementId])
		}
	}

	const [isSaving, setIsSaving] = useState(false)

	const onSubmit = async (data: CompetitionEventSchema) => {
		setIsSaving(true)
		try {
			// Build division descriptions array
			const divisionDescriptions = divisions.map((division) => ({
				divisionId: division.id,
				description: data.divisionDescs[division.id]?.trim() || null,
			}))

			// Call server function
			await saveCompetitionEventFn({
				data: {
					trackWorkoutId: event.id,
					workoutId: event.workoutId,
					teamId: organizingTeamId,
					name: data.name,
					description: data.description,
					scheme: data.scheme,
					scoreType: data.scoreType,
					roundsToScore: data.roundsToScore,
					tiebreakScheme: data.tiebreakScheme,
					timeCap: data.timeCap,
					movementIds: data.selectedMovements,
					pointsMultiplier: data.pointsMultiplier,
					notes: data.notes || null,
					divisionDescriptions:
						divisionDescriptions.length > 0 ? divisionDescriptions : undefined,
					sponsorId: data.sponsorId,
				},
			})

			toast.success("Event updated")

			// Invalidate router cache and wait for it to complete before navigating
			// This ensures the events list will fetch fresh data
			await router.invalidate()

			// Navigate back to events list
			navigate({
				to: "/compete/organizer/$competitionId/events",
				params: { competitionId },
			})
		} catch (error) {
			console.error("Failed to save event:", error)
			toast.error(
				error instanceof Error ? error.message : "Failed to save event",
			)
		} finally {
			setIsSaving(false)
		}
	}

	return (
		<Form {...form}>
			<form
				id={EVENT_DETAILS_FORM_ID}
				onSubmit={form.handleSubmit(onSubmit)}
				className="space-y-6"
			>
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					{/* Left Column */}
					<div className="space-y-6">
						{/* Basic Details */}
						<Card>
							<CardHeader>
								<CardTitle>Event Details</CardTitle>
								<CardDescription>
									Basic information about this event
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<FormField
									control={form.control}
									name="name"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Event Name</FormLabel>
											<FormControl>
												<Input placeholder="e.g., Event 1 - Fran" {...field} />
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
											<FormLabel>Scheme</FormLabel>
											<Select
												value={field.value}
												onValueChange={field.onChange}
											>
												<FormControl>
													<SelectTrigger>
														<SelectValue placeholder="Select scheme" />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													{WORKOUT_SCHEMES.map((s) => (
														<SelectItem key={s.value} value={s.value}>
															{s.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>

								{scheme && (
									<FormField
										control={form.control}
										name="scoreType"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Score Type</FormLabel>
												<Select
													value={field.value ?? "none"}
													onValueChange={(v) =>
														field.onChange(v === "none" ? null : v)
													}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select score type" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														<SelectItem value="none">None</SelectItem>
														{SCORE_TYPES.map((s) => (
															<SelectItem key={s.value} value={s.value}>
																{s.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>
								)}

								{scheme === "rounds-reps" && (
									<FormField
										control={form.control}
										name="roundsToScore"
										render={({ field }) => (
											<FormItem>
												<FormLabel>
													Rounds to Score{" "}
													<span className="text-muted-foreground">
														(optional)
													</span>
												</FormLabel>
												<FormControl>
													<Input
														type="number"
														placeholder="e.g., 4"
														value={field.value ?? ""}
														onChange={(e) =>
															field.onChange(
																e.target.value
																	? Number.parseInt(e.target.value)
																	: null,
															)
														}
														min="1"
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								)}

								{(isTimeBasedScheme(scheme) || scheme === "rounds-reps") && (
									<div className="grid grid-cols-2 gap-4">
										<FormField
											control={form.control}
											name="tiebreakScheme"
											render={({ field }) => (
												<FormItem>
													<FormLabel>
														Tiebreak Scheme{" "}
														<span className="text-muted-foreground">
															(optional)
														</span>
													</FormLabel>
													<Select
														value={field.value ?? "none"}
														onValueChange={(v) =>
															field.onChange(v === "none" ? null : v)
														}
													>
														<FormControl>
															<SelectTrigger>
																<SelectValue placeholder="None" />
															</SelectTrigger>
														</FormControl>
														<SelectContent>
															<SelectItem value="none">None</SelectItem>
															{TIEBREAK_SCHEMES.map((s) => (
																<SelectItem key={s.value} value={s.value}>
																	{s.label}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
													<FormMessage />
												</FormItem>
											)}
										/>
										{scheme === "time-with-cap" && (
											<FormField
												control={form.control}
												name="timeCap"
												render={({ field }) => (
													<FormItem>
														<FormLabel>Time Cap (minutes)</FormLabel>
														<FormControl>
															<Input
																type="number"
																placeholder="e.g., 12"
																value={field.value ? field.value / 60 : ""}
																onChange={(e) =>
																	field.onChange(
																		e.target.value
																			? Math.round(
																					Number.parseFloat(e.target.value) *
																						60,
																				)
																			: null,
																	)
																}
																min="1"
																step="0.5"
															/>
														</FormControl>
														<FormDescription>
															Enter time cap in minutes (e.g., 12 for 12:00)
														</FormDescription>
														<FormMessage />
													</FormItem>
												)}
											/>
										)}
									</div>
								)}

								<FormField
									control={form.control}
									name="description"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Description</FormLabel>
											<FormControl>
												<Textarea
													placeholder="21-15-9 Thrusters, Pull-ups..."
													rows={6}
													{...field}
												/>
											</FormControl>
											<FormDescription>
												This is the default description shown to all athletes.
												You can add division-specific variations below.
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
							</CardContent>
						</Card>

						{/* Movements */}
						<Card>
							<CardHeader>
								<CardTitle>Movements</CardTitle>
								<CardDescription>
									Track which movements are used in this event
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-2">
									{selectedMovements.length > 0 && (
										<div className="flex flex-wrap gap-2 p-2 border rounded-md bg-muted/50">
											{movements
												.filter((m) => selectedMovements.includes(m.id))
												.map((movement) => (
													<Badge
														key={movement.id}
														variant="default"
														className="cursor-pointer"
														onClick={() => handleMovementToggle(movement.id)}
													>
														{movement.name} ✓
													</Badge>
												))}
										</div>
									)}
									<MovementsList
										movements={movements}
										selectedMovements={selectedMovements}
										onMovementToggle={handleMovementToggle}
										showLabel={false}
										containerHeight="max-h-[250px]"
									/>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Right Column */}
					<div className="space-y-6">
						{/* Competition Settings */}
						<Card>
							<CardHeader>
								<CardTitle>Competition Settings</CardTitle>
								<CardDescription>
									Settings specific to this competition event
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<FormField
									control={form.control}
									name="pointsMultiplier"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Points Multiplier</FormLabel>
											<div className="flex items-center gap-2">
												<FormControl>
													<Input
														type="number"
														min={1}
														max={1000}
														className="w-24"
														{...field}
														onChange={(e) =>
															field.onChange(Number(e.target.value))
														}
													/>
												</FormControl>
												<span className="text-sm text-muted-foreground">
													% (100 = normal, 200 = 2x points)
												</span>
											</div>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="sponsorId"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Presented by</FormLabel>
											<Select
												value={field.value ?? "none"}
												onValueChange={(v) =>
													field.onChange(v === "none" ? null : v)
												}
											>
												<FormControl>
													<SelectTrigger>
														<SelectValue placeholder="Select a sponsor" />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													<SelectItem value="none">No sponsor</SelectItem>
													{sponsors.map((sponsor) => (
														<SelectItem key={sponsor.id} value={sponsor.id}>
															{sponsor.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<FormDescription>
												Assign a sponsor to this event for &quot;Presented
												by&quot; branding
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="notes"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Organizer Notes</FormLabel>
											<FormControl>
												<Textarea
													placeholder="Internal notes (not shown to athletes)..."
													rows={3}
													{...field}
												/>
											</FormControl>
											<FormDescription>
												These notes are only visible to competition organizers.
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
							</CardContent>
						</Card>

						{/* Division-Specific Descriptions */}
						<Card>
							<CardHeader>
								<CardTitle>Division Variations</CardTitle>
								<CardDescription>
									{divisions.length > 0
										? "Customize the workout description for each division. Leave empty to use the default description above."
										: "Create divisions for this competition to add division-specific workout variations."}
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								{divisions.length > 0 ? (
									divisions
										.sort((a, b) => a.position - b.position)
										.map((division) => (
											<FormField
												key={division.id}
												control={form.control}
												name={`divisionDescs.${division.id}`}
												render={({ field }) => (
													<FormItem>
														<div className="flex items-center justify-between">
															<FormLabel>
																{division.label}
																{division.registrationCount > 0 && (
																	<span className="text-muted-foreground ml-2 font-normal">
																		({division.registrationCount} athlete
																		{division.registrationCount !== 1
																			? "s"
																			: ""}
																		)
																	</span>
																)}
															</FormLabel>
															<span className="text-xs text-muted-foreground">
																{field.value?.trim()
																	? "Custom"
																	: "Using default"}
															</span>
														</div>
														<FormControl>
															<Textarea
																placeholder={`Custom description for ${division.label}... (leave empty to use default)`}
																rows={4}
																{...field}
																value={field.value || ""}
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
										))
								) : (
									<div className="text-center py-6">
										<p className="text-muted-foreground mb-4">
											No divisions have been created for this competition yet.
										</p>
										<Button
											type="button"
											variant="outline"
											onClick={() =>
												navigate({
													to: "/compete/organizer/$competitionId/divisions",
													params: { competitionId },
												})
											}
										>
											Create Divisions
										</Button>
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</div>

				{/* Actions */}
				<div className="flex items-center justify-end gap-4">
					<Button
						type="button"
						variant="outline"
						onClick={() =>
							navigate({
								to: "/compete/organizer/$competitionId/events",
								params: { competitionId },
							})
						}
					>
						Cancel
					</Button>
					<Button type="submit" disabled={isSaving || !form.formState.isValid}>
						{isSaving ? "Saving..." : "Save Changes"}
					</Button>
				</div>
			</form>
		</Form>
	)
}
