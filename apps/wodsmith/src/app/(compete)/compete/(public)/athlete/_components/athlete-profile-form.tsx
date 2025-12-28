"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useServerAction } from "@repo/zsa-react"
import { useRouter } from "next/navigation"
import posthog from "posthog-js"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import type * as z from "zod"
import { updateAthleteExtendedProfileAction } from "@/app/(settings)/settings/settings.actions"
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
import { GENDER_ENUM } from "@/db/schemas/users"
import { athleteProfileExtendedSchema } from "@/schemas/settings.schema"
import {
	type AthleteProfileData,
	cmToFeetInches,
	feetInchesToCm,
	kgToLbs,
	lbsToKg,
} from "@/utils/athlete-profile"

type NotableMetconSuggestion = {
	workoutId: string
	workoutName: string
	wodScore: string | null
	asRx: boolean
	date: Date | number
}

type StrengthLiftSuggestion = {
	liftName: string
	weight: number
	date: Date | number
}

type AthleteProfileFormProps = {
	initialData: AthleteProfileData | null
	notableMetconSuggestions?: NotableMetconSuggestion[]
	strengthLiftSuggestions?: StrengthLiftSuggestion[]
}

export function AthleteProfileForm({
	initialData,
	notableMetconSuggestions = [],
	strengthLiftSuggestions: _strengthLiftSuggestions = [],
}: AthleteProfileFormProps) {
	const router = useRouter()
	const [localFeet, setLocalFeet] = useState<string>("")
	const [localInches, setLocalInches] = useState<string>("")
	const [localWeight, setLocalWeight] = useState<string>("")

	const { execute, isPending } = useServerAction(
		updateAthleteExtendedProfileAction,
		{
			onError: (error) => {
				toast.dismiss()
				toast.error(error.err?.message || "Failed to update profile")
				posthog.capture("athlete_profile_updated_failed", {
					error_message: error.err?.message,
				})
			},
			onStart: () => {
				toast.loading("Saving profile...")
			},
			onSuccess: () => {
				toast.dismiss()
				toast.success("Profile updated successfully")
				posthog.capture("athlete_profile_updated", {
					has_physical_stats: !!(
						form.getValues("heightCm") || form.getValues("weightKg")
					),
					has_conditioning_times: !!(
						form.getValues("conditioning.fran.time") ||
						form.getValues("conditioning.grace.time") ||
						form.getValues("conditioning.helen.time")
					),
					has_strength_lifts: !!(
						form.getValues("strength.backSquat.weight") ||
						form.getValues("strength.deadlift.weight") ||
						form.getValues("strength.snatch.weight")
					),
					has_social_links: !!(
						form.getValues("social.instagram") ||
						form.getValues("social.facebook")
					),
				})
				router.push("/compete/athlete")
				router.refresh()
			},
		},
	)

	const form = useForm<z.input<typeof athleteProfileExtendedSchema>, unknown, z.output<typeof athleteProfileExtendedSchema>>({
		resolver: zodResolver(athleteProfileExtendedSchema),
		defaultValues: {
			preferredUnits: "imperial",
			...initialData,
		},
	})

	const preferredUnits = form.watch("preferredUnits")

	// Note: Sponsors are now managed in the sponsors table via separate UI
	// See: getUserSponsorsAction, createSponsorAction, etc.

	// Helper to find suggestion for a metcon
	const getSuggestion = (metconName: string) => {
		return notableMetconSuggestions.find(
			(s) => s.workoutName.toLowerCase() === metconName.toLowerCase(),
		)
	}

	// Helper to use a suggested time
	const handleSuggestedTime = (
		metconName: "fran" | "grace" | "helen" | "diane" | "murph",
		time: string | null,
		date: Date | number,
	) => {
		if (!time) return

		const dateStr = (
			typeof date === "number"
				? new Date(date).toISOString().split("T")[0]
				: new Date(date).toISOString().split("T")[0]
		) as string

		// Type-safe field updates (time and date are guaranteed non-null here)
		const timeValue = time as string
		if (metconName === "fran") {
			form.setValue("conditioning.fran", { time: timeValue, date: dateStr })
		} else if (metconName === "grace") {
			form.setValue("conditioning.grace", { time: timeValue, date: dateStr })
		} else if (metconName === "helen") {
			form.setValue("conditioning.helen", { time: timeValue, date: dateStr })
		} else if (metconName === "diane") {
			form.setValue("conditioning.diane", { time: timeValue, date: dateStr })
		} else if (metconName === "murph") {
			form.setValue("conditioning.murph", { time: timeValue, date: dateStr })
		}
	}

	// Sync all notable metcons with logged best times
	const syncAllWithLoggedBest = () => {
		const metcons: Array<"fran" | "grace" | "helen" | "diane" | "murph"> = [
			"fran",
			"grace",
			"helen",
			"diane",
			"murph",
		]

		let syncedCount = 0
		for (const metconName of metcons) {
			const suggestion = getSuggestion(
				metconName.charAt(0).toUpperCase() + metconName.slice(1),
			)
			if (suggestion?.wodScore) {
				handleSuggestedTime(metconName, suggestion.wodScore, suggestion.date)
				syncedCount++
			}
		}

		if (syncedCount > 0) {
			toast.success(
				`Synced ${syncedCount} metcon times from your logged workouts`,
			)
		} else {
			toast.info("No logged metcon results found to sync")
		}
	}

	// Initialize local state from form values
	useEffect(() => {
		const heightCm = form.getValues("heightCm")
		const weightKg = form.getValues("weightKg")

		if (heightCm && preferredUnits === "imperial") {
			const formatted = cmToFeetInches(heightCm)
			const match = formatted.match(/(\d+)'(\d+)"/)
			if (match) {
				setLocalFeet(match[1] || "")
				setLocalInches(match[2] || "")
			}
		}

		if (weightKg && preferredUnits === "imperial") {
			setLocalWeight(kgToLbs(weightKg).toString())
		} else if (weightKg) {
			setLocalWeight(weightKg.toString())
		}
	}, [preferredUnits, form])

	useEffect(() => {
		if (initialData) {
			form.reset({
				...initialData,
				preferredUnits: initialData.preferredUnits || "imperial",
			})
		}
	}, [initialData, form])

	async function onSubmit(
		values: z.infer<typeof athleteProfileExtendedSchema>,
	) {
		await execute(values)
	}

	// Handle imperial height conversion
	const handleImperialHeightChange = () => {
		const feet = Number.parseInt(localFeet) || 0
		const inches = Number.parseInt(localInches) || 0
		if (feet > 0 || inches > 0) {
			const cm = feetInchesToCm(feet, inches)
			form.setValue("heightCm", cm)
		}
	}

	// Handle weight conversion
	const handleWeightChange = () => {
		const weight = Number.parseInt(localWeight) || 0
		if (weight > 0) {
			if (preferredUnits === "imperial") {
				form.setValue("weightKg", lbsToKg(weight))
			} else {
				form.setValue("weightKg", weight)
			}
		}
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
				{/* Unit Preference */}
				<Card>
					<CardHeader>
						<CardTitle>Unit Preference</CardTitle>
						<CardDescription>
							Choose your preferred unit system for displaying measurements
						</CardDescription>
					</CardHeader>
					<CardContent>
						<FormField
							control={form.control}
							name="preferredUnits"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Measurement System</FormLabel>
									<Select
										onValueChange={field.onChange}
										defaultValue={field.value}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select unit system" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											<SelectItem value="imperial">
												Imperial (lbs, ft/in)
											</SelectItem>
											<SelectItem value="metric">Metric (kg, cm)</SelectItem>
										</SelectContent>
									</Select>
									<FormDescription>
										This affects how weights and heights are displayed
										throughout your profile
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</CardContent>
				</Card>

				{/* Basic Info */}
				<Card>
					<CardHeader>
						<CardTitle>Basic Info</CardTitle>
						<CardDescription>
							Required for competition registration and division placement
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid gap-6 sm:grid-cols-2">
							<FormField
								control={form.control}
								name="gender"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Gender</FormLabel>
										<Select
											onValueChange={field.onChange}
											defaultValue={field.value}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select gender" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value={GENDER_ENUM.MALE}>Male</SelectItem>
												<SelectItem value={GENDER_ENUM.FEMALE}>
													Female
												</SelectItem>
											</SelectContent>
										</Select>
										<FormDescription>
											Used for competition division placement
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="dateOfBirth"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Date of Birth</FormLabel>
										<FormControl>
											<Input type="date" {...field} />
										</FormControl>
										<FormDescription>
											Used for age division placement
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
					</CardContent>
				</Card>

				{/* Physical Stats */}
				<Card>
					<CardHeader>
						<CardTitle>Physical Stats</CardTitle>
						<CardDescription>
							Your height and weight for competition records
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-6">
							{preferredUnits === "imperial" ? (
								<div className="grid gap-6 sm:grid-cols-3">
									<FormItem>
										<FormLabel>Height (feet)</FormLabel>
										<FormControl>
											<Input
												type="number"
												placeholder="5"
												value={localFeet}
												onChange={(e) => setLocalFeet(e.target.value)}
												onBlur={handleImperialHeightChange}
											/>
										</FormControl>
										<FormDescription>Feet</FormDescription>
									</FormItem>

									<FormItem>
										<FormLabel>Height (inches)</FormLabel>
										<FormControl>
											<Input
												type="number"
												placeholder="10"
												value={localInches}
												onChange={(e) => setLocalInches(e.target.value)}
												onBlur={handleImperialHeightChange}
											/>
										</FormControl>
										<FormDescription>Inches</FormDescription>
									</FormItem>

									<FormItem>
										<FormLabel>Weight (lbs)</FormLabel>
										<FormControl>
											<Input
												type="number"
												placeholder="165"
												value={localWeight}
												onChange={(e) => setLocalWeight(e.target.value)}
												onBlur={handleWeightChange}
											/>
										</FormControl>
										<FormDescription>Pounds</FormDescription>
									</FormItem>
								</div>
							) : (
								<div className="grid gap-6 sm:grid-cols-2">
									<FormField
										control={form.control}
										name="heightCm"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Height (cm)</FormLabel>
												<FormControl>
													<Input
														type="number"
														placeholder="175"
														{...field}
														onChange={(e) =>
															field.onChange(
																e.target.value
																	? Number(e.target.value)
																	: undefined,
															)
														}
														value={field.value || ""}
													/>
												</FormControl>
												<FormDescription>Centimeters</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormItem>
										<FormLabel>Weight (kg)</FormLabel>
										<FormControl>
											<Input
												type="number"
												placeholder="75"
												value={localWeight}
												onChange={(e) => setLocalWeight(e.target.value)}
												onBlur={handleWeightChange}
											/>
										</FormControl>
										<FormDescription>Kilograms</FormDescription>
									</FormItem>
								</div>
							)}
						</div>
					</CardContent>
				</Card>

				{/* Cover Image */}
				<Card>
					<CardHeader>
						<CardTitle>Cover Image</CardTitle>
						<CardDescription>
							Add a cover image URL for your profile (optional)
						</CardDescription>
					</CardHeader>
					<CardContent>
						<FormField
							control={form.control}
							name="coverImageUrl"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Cover Image URL</FormLabel>
									<FormControl>
										<Input
											placeholder="https://example.com/image.jpg"
											{...field}
										/>
									</FormControl>
									<FormDescription>
										Paste a URL to an image (e.g., from Imgur)
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</CardContent>
				</Card>

				{/* Conditioning Metcons */}
				<Card>
					<CardHeader>
						<div className="flex items-start justify-between">
							<div>
								<CardTitle>Notable Metcons</CardTitle>
								<CardDescription>
									Record your personal bests for benchmark workouts
								</CardDescription>
							</div>
							{notableMetconSuggestions.length > 0 && (
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={syncAllWithLoggedBest}
								>
									Sync All with Logged Best
								</Button>
							)}
						</div>
					</CardHeader>
					<CardContent className="space-y-6">
						{/* Fran */}
						<div className="grid gap-4 sm:grid-cols-2">
							<FormField
								control={form.control}
								name="conditioning.fran.time"
								render={({ field }) => {
									const suggestion = getSuggestion("Fran")
									return (
										<FormItem>
											<FormLabel>Fran</FormLabel>
											<div className="flex gap-2">
												<FormControl>
													<Input placeholder="3:45" {...field} />
												</FormControl>
												{suggestion?.wodScore && (
													<Button
														type="button"
														variant="secondary"
														size="sm"
														onClick={() =>
															handleSuggestedTime(
																"fran",
																suggestion.wodScore,
																suggestion.date,
															)
														}
														className="shrink-0"
													>
														Use Best: {suggestion.wodScore}
														{suggestion.asRx && " (Rx)"}
													</Button>
												)}
											</div>
											<FormDescription>Format: MM:SS</FormDescription>
											<FormMessage />
										</FormItem>
									)
								}}
							/>
							<FormField
								control={form.control}
								name="conditioning.fran.date"
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
						</div>

						{/* Grace */}
						<div className="grid gap-4 sm:grid-cols-2">
							<FormField
								control={form.control}
								name="conditioning.grace.time"
								render={({ field }) => {
									const suggestion = getSuggestion("Grace")
									return (
										<FormItem>
											<FormLabel>Grace</FormLabel>
											<div className="flex gap-2">
												<FormControl>
													<Input placeholder="2:30" {...field} />
												</FormControl>
												{suggestion?.wodScore && (
													<Button
														type="button"
														variant="secondary"
														size="sm"
														onClick={() =>
															handleSuggestedTime(
																"grace",
																suggestion.wodScore,
																suggestion.date,
															)
														}
														className="shrink-0"
													>
														Use Best: {suggestion.wodScore}
														{suggestion.asRx && " (Rx)"}
													</Button>
												)}
											</div>
											<FormDescription>Format: MM:SS</FormDescription>
											<FormMessage />
										</FormItem>
									)
								}}
							/>
							<FormField
								control={form.control}
								name="conditioning.grace.date"
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
						</div>

						{/* Helen */}
						<div className="grid gap-4 sm:grid-cols-2">
							<FormField
								control={form.control}
								name="conditioning.helen.time"
								render={({ field }) => {
									const suggestion = getSuggestion("Helen")
									return (
										<FormItem>
											<FormLabel>Helen</FormLabel>
											<div className="flex gap-2">
												<FormControl>
													<Input placeholder="8:30" {...field} />
												</FormControl>
												{suggestion?.wodScore && (
													<Button
														type="button"
														variant="secondary"
														size="sm"
														onClick={() =>
															handleSuggestedTime(
																"helen",
																suggestion.wodScore,
																suggestion.date,
															)
														}
														className="shrink-0"
													>
														Use Best: {suggestion.wodScore}
														{suggestion.asRx && " (Rx)"}
													</Button>
												)}
											</div>
											<FormDescription>Format: MM:SS</FormDescription>
											<FormMessage />
										</FormItem>
									)
								}}
							/>
							<FormField
								control={form.control}
								name="conditioning.helen.date"
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
						</div>

						{/* Diane */}
						<div className="grid gap-4 sm:grid-cols-2">
							<FormField
								control={form.control}
								name="conditioning.diane.time"
								render={({ field }) => {
									const suggestion = getSuggestion("Diane")
									return (
										<FormItem>
											<FormLabel>Diane</FormLabel>
											<div className="flex gap-2">
												<FormControl>
													<Input placeholder="5:00" {...field} />
												</FormControl>
												{suggestion?.wodScore && (
													<Button
														type="button"
														variant="secondary"
														size="sm"
														onClick={() =>
															handleSuggestedTime(
																"diane",
																suggestion.wodScore,
																suggestion.date,
															)
														}
														className="shrink-0"
													>
														Use Best: {suggestion.wodScore}
														{suggestion.asRx && " (Rx)"}
													</Button>
												)}
											</div>
											<FormDescription>Format: MM:SS</FormDescription>
											<FormMessage />
										</FormItem>
									)
								}}
							/>
							<FormField
								control={form.control}
								name="conditioning.diane.date"
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
						</div>

						{/* Murph */}
						<div className="grid gap-4 sm:grid-cols-2">
							<FormField
								control={form.control}
								name="conditioning.murph.time"
								render={({ field }) => {
									const suggestion = getSuggestion("Murph")
									return (
										<FormItem>
											<FormLabel>Murph</FormLabel>
											<div className="flex gap-2">
												<FormControl>
													<Input placeholder="45:00" {...field} />
												</FormControl>
												{suggestion?.wodScore && (
													<Button
														type="button"
														variant="secondary"
														size="sm"
														onClick={() =>
															handleSuggestedTime(
																"murph",
																suggestion.wodScore,
																suggestion.date,
															)
														}
														className="shrink-0"
													>
														Use Best: {suggestion.wodScore}
														{suggestion.asRx && " (Rx)"}
													</Button>
												)}
											</div>
											<FormDescription>
												Format: MM:SS or HH:MM:SS
											</FormDescription>
											<FormMessage />
										</FormItem>
									)
								}}
							/>
							<FormField
								control={form.control}
								name="conditioning.murph.date"
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
						</div>

						{/* Max Cindy Rounds */}
						<div className="grid gap-4 sm:grid-cols-2">
							<FormField
								control={form.control}
								name="conditioning.maxCindyRounds.rounds"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Cindy</FormLabel>
										<FormControl>
											<Input placeholder="25" {...field} />
										</FormControl>
										<FormDescription>Rounds in 20 minutes</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="conditioning.maxCindyRounds.date"
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
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Conditioning Metcons</CardTitle>
						<CardDescription>
							Record your personal bests for benchmark workouts
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						{/* 2K Row */}
						<div className="grid gap-4 sm:grid-cols-2">
							<FormField
								control={form.control}
								name="conditioning.row2k.time"
								render={({ field }) => (
									<FormItem>
										<FormLabel>2K Row Time</FormLabel>
										<FormControl>
											<Input placeholder="7:30" {...field} />
										</FormControl>
										<FormDescription>Format: MM:SS</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="conditioning.row2k.date"
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
						</div>

						{/* 1 Mile Run */}
						<div className="grid gap-4 sm:grid-cols-2">
							<FormField
								control={form.control}
								name="conditioning.run1Mile.time"
								render={({ field }) => (
									<FormItem>
										<FormLabel>1 Mile Run Time</FormLabel>
										<FormControl>
											<Input placeholder="6:30" {...field} />
										</FormControl>
										<FormDescription>Format: MM:SS</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="conditioning.run1Mile.date"
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
						</div>

						{/* 5K Run */}
						<div className="grid gap-4 sm:grid-cols-2">
							<FormField
								control={form.control}
								name="conditioning.run5k.time"
								render={({ field }) => (
									<FormItem>
										<FormLabel>5K Run Time</FormLabel>
										<FormControl>
											<Input placeholder="22:30" {...field} />
										</FormControl>
										<FormDescription>Format: MM:SS</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="conditioning.run5k.date"
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
						</div>

						{/* 500m Row */}
						<div className="grid gap-4 sm:grid-cols-2">
							<FormField
								control={form.control}
								name="conditioning.row500m.time"
								render={({ field }) => (
									<FormItem>
										<FormLabel>500m Row Time</FormLabel>
										<FormControl>
											<Input placeholder="1:30" {...field} />
										</FormControl>
										<FormDescription>Format: MM:SS</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="conditioning.row500m.date"
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
						</div>

						{/* Max Pull-ups */}
						<div className="grid gap-4 sm:grid-cols-2">
							<FormField
								control={form.control}
								name="conditioning.maxPullups.reps"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Max Pull-ups</FormLabel>
										<FormControl>
											<Input placeholder="50" {...field} />
										</FormControl>
										<FormDescription>Unbroken reps</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="conditioning.maxPullups.date"
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
						</div>
					</CardContent>
				</Card>

				{/* Strength Lifts */}
				<Card>
					<CardHeader>
						<CardTitle>Strength Lifts (1RM)</CardTitle>
						<CardDescription>
							Record your one-rep max personal records
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						{(
							[
								"backSquat",
								"deadlift",
								"benchPress",
								"press",
								"snatch",
								"cleanAndJerk",
							] as const
						).map((lift) => {
							const liftKey = lift
							return (
								<div key={lift} className="grid gap-4 sm:grid-cols-3">
									<FormField
										control={form.control}
										name={`strength.${liftKey}.weight`}
										render={({ field }) => (
											<FormItem>
												<FormLabel className="capitalize">
													{lift.replace(/([A-Z])/g, " $1").trim()}
												</FormLabel>
												<FormControl>
													<Input
														type="number"
														placeholder="315"
														{...field}
														onChange={(e) =>
															field.onChange(
																e.target.value
																	? Number(e.target.value)
																	: undefined,
															)
														}
														value={field.value || ""}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name={`strength.${liftKey}.unit`}
										render={({ field }) => (
											<FormItem>
												<FormLabel>Unit</FormLabel>
												<Select
													onValueChange={field.onChange}
													defaultValue={field.value || "lbs"}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Unit" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														<SelectItem value="lbs">LBS</SelectItem>
														<SelectItem value="kg">KG</SelectItem>
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name={`strength.${liftKey}.date`}
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
								</div>
							)
						})}
					</CardContent>
				</Card>

				{/* Social Networks */}
				<Card>
					<CardHeader>
						<CardTitle>Social Networks</CardTitle>
						<CardDescription>
							Connect your social media profiles
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<FormField
							control={form.control}
							name="social.instagram"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Instagram</FormLabel>
									<FormControl>
										<Input
											placeholder="https://instagram.com/yourhandle"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="social.facebook"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Facebook</FormLabel>
									<FormControl>
										<Input
											placeholder="https://facebook.com/yourpage"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="social.twitter"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Twitter/X</FormLabel>
									<FormControl>
										<Input
											placeholder="https://twitter.com/yourhandle"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="social.tiktok"
							render={({ field }) => (
								<FormItem>
									<FormLabel>TikTok</FormLabel>
									<FormControl>
										<Input
											placeholder="https://tiktok.com/@yourhandle"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</CardContent>
				</Card>

				{/* Note: Sponsors section removed - now managed via separate sponsors UI */}
				{/* TODO: Add link to sponsor management page when built */}

				{/* Form Actions */}
				<div className="flex justify-end gap-4">
					<Button
						type="button"
						variant="outline"
						onClick={() => router.push("/compete/athlete")}
						disabled={isPending}
					>
						Cancel
					</Button>
					<Button type="submit" disabled={isPending}>
						Save Profile
					</Button>
				</div>
			</form>
		</Form>
	)
}
