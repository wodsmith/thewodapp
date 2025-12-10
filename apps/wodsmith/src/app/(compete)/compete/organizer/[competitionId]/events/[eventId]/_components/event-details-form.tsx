"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useServerAction } from "@repo/zsa-react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { saveCompetitionEventAction } from "@/actions/competition-actions"
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
import {
	SCORE_TYPES,
	SECONDARY_SCHEMES,
	TIEBREAK_SCHEMES,
	WORKOUT_SCHEMES,
} from "@/constants"
import type { Movement, Sponsor } from "@/db/schema"
import type { ScoreType, WorkoutScheme } from "@/db/schemas/workouts"
import {
	type CompetitionEventSchema,
	competitionEventSchema,
} from "@/schemas/workout.schema"
import type { CompetitionWorkout } from "@/server/competition-workouts"
import { isTimeBasedScheme } from "@/lib/scoring"

// Form ID for external submit buttons
export const EVENT_DETAILS_FORM_ID = "event-details-form"

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

	// Build initial division descriptions
	const initialDivisionDescs: Record<string, string> = {}
	for (const dd of divisionDescriptions) {
		initialDivisionDescs[dd.divisionId] = dd.description || ""
	}

	// Initialize form with React Hook Form
	const form = useForm<CompetitionEventSchema>({
		resolver: zodResolver(competitionEventSchema),
		defaultValues: {
			name: event.workout.name,
			description: event.workout.description || "",
			scheme: event.workout.scheme,
			scoreType: event.workout.scoreType,
			roundsToScore: event.workout.roundsToScore,
			tiebreakScheme: event.workout.tiebreakScheme,
			timeCap: event.workout.timeCap,
			secondaryScheme: event.workout.secondaryScheme,
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

	const { execute: saveEvent, isPending: isSaving } = useServerAction(
		saveCompetitionEventAction,
	)

	const onSubmit = async (data: CompetitionEventSchema) => {
		// Build division descriptions array
		const divisionDescriptions = divisions.map((division) => ({
			divisionId: division.id,
			description: data.divisionDescs[division.id]?.trim() || null,
		}))

		// Single consolidated save operation
		const [_result, error] = await saveEvent({
			trackWorkoutId: event.id,
			workoutId: event.workoutId,
			organizingTeamId,
			name: data.name,
			description: data.description,
			scheme: data.scheme,
			scoreType: data.scoreType,
			roundsToScore: data.roundsToScore,
			tiebreakScheme: data.tiebreakScheme,
			timeCap: data.timeCap,
			secondaryScheme: data.secondaryScheme,
			movementIds: data.selectedMovements,
			pointsMultiplier: data.pointsMultiplier,
			notes: data.notes || null,
			divisionDescriptions:
				divisionDescriptions.length > 0 ? divisionDescriptions : undefined,
			sponsorId: data.sponsorId,
		})

		if (error) {
			toast.error(error.message || "Failed to save event")
			return
		}

		toast.success("Event updated")
		router.push(`/compete/organizer/${competitionId}/events`)
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

								{scheme === "time-with-cap" && (
									<FormField
										control={form.control}
										name="secondaryScheme"
										render={({ field }) => (
											<FormItem>
												<FormLabel>
													Cap Score Scheme{" "}
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
														{SECONDARY_SCHEMES.map((s) => (
															<SelectItem key={s.value} value={s.value}>
																{s.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<FormDescription>
													How to score athletes who hit the time cap
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>
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
									<div className="border rounded-md">
										<MovementsList
											movements={movements}
											selectedMovements={selectedMovements}
											onMovementToggle={handleMovementToggle}
											mode="selectable"
											variant="compact"
											showLabel={false}
											containerHeight="h-[250px]"
										/>
									</div>
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
												Assign a sponsor to this event for "Presented by"
												branding
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
												router.push(
													`/compete/organizer/${competitionId}/divisions`,
												)
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
							router.push(`/compete/organizer/${competitionId}/events`)
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
