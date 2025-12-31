import { zodResolver } from "@hookform/resolvers/zod"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ArrowLeft } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { AffiliateCombobox } from "@/components/registration/affiliate-combobox"
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
import {
	athleteProfileExtendedSchema,
	getAthleteEditDataFn,
	updateAthleteExtendedProfileFn,
	type AthleteProfileFormValues,
} from "@/server-fns/athlete-profile-fns"

// ============================================================================
// Helper Functions
// ============================================================================

type AthleteProfileData = AthleteProfileFormValues & {
	gender?: "male" | "female"
	dateOfBirth?: string
	affiliateName?: string
}

function parseAthleteProfile(json: string | null): AthleteProfileData | null {
	if (!json) return null
	try {
		return JSON.parse(json) as AthleteProfileData
	} catch {
		return null
	}
}

function cmToFeetInches(cm: number): string {
	const totalInches = Math.round(cm / 2.54)
	const feet = Math.floor(totalInches / 12)
	const inches = totalInches % 12
	return `${feet}'${inches}"`
}

function feetInchesToCm(feet: number, inches: number): number {
	const totalInches = feet * 12 + inches
	return Math.round(totalInches * 2.54)
}

function kgToLbs(kg: number): number {
	return Math.round(kg * 2.205)
}

function lbsToKg(lbs: number): number {
	return Math.round(lbs / 2.205)
}

// ============================================================================
// Route Definition
// ============================================================================

export const Route = createFileRoute("/compete/athlete/edit/")({
	component: AthleteEditPage,
	loader: async () => {
		return await getAthleteEditDataFn()
	},
})

// ============================================================================
// Component
// ============================================================================

function AthleteEditPage() {
	const { user } = Route.useLoaderData()
	const navigate = useNavigate()
	const [isPending, setIsPending] = useState(false)
	const [localFeet, setLocalFeet] = useState<string>("")
	const [localInches, setLocalInches] = useState<string>("")
	const [localWeight, setLocalWeight] = useState<string>("")

	// Use useServerFn for client-side calls
	const updateProfile = useServerFn(updateAthleteExtendedProfileFn)

	// Parse athlete profile JSON and merge with direct column fields
	const parsed = parseAthleteProfile(user.athleteProfile)
	const athleteProfile: AthleteProfileData = {
		...parsed,
		preferredUnits: parsed?.preferredUnits ?? "imperial",
		gender: user.gender ?? undefined,
		dateOfBirth: user.dateOfBirth
			? new Date(user.dateOfBirth).toISOString().split("T")[0]
			: undefined,
		affiliateName: user.affiliateName ?? undefined,
	}

	const form = useForm<AthleteProfileFormValues>({
		resolver: zodResolver(athleteProfileExtendedSchema),
		defaultValues: {
			preferredUnits: "imperial",
			...athleteProfile,
		},
	})

	const preferredUnits = form.watch("preferredUnits")

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

	// Reset form only once on initial mount - athleteProfile comes from loader data
	const initialData = JSON.stringify(athleteProfile)
	useEffect(() => {
		const data = JSON.parse(initialData) as AthleteProfileData | null
		if (data) {
			form.reset({
				...data,
				preferredUnits: data.preferredUnits || "imperial",
			})
		}
	}, [initialData, form])

	async function onSubmit(values: AthleteProfileFormValues) {
		setIsPending(true)
		toast.loading("Saving profile...")

		try {
			await updateProfile({ data: values })
			toast.dismiss()
			toast.success("Profile updated successfully")
			navigate({ to: "/compete/athlete" })
		} catch (error) {
			toast.dismiss()
			toast.error(
				error instanceof Error ? error.message : "Failed to update profile",
			)
		} finally {
			setIsPending(false)
		}
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
		<div className="mx-auto max-w-4xl space-y-8 pb-12">
			{/* Header */}
			<div className="flex items-center gap-4">
				<Button asChild variant="ghost" size="icon">
					<Link to="/compete/athlete">
						<ArrowLeft className="h-5 w-5" />
					</Link>
				</Button>
				<div>
					<h1 className="text-3xl font-bold">Edit Athlete Profile</h1>
					<p className="text-muted-foreground mt-1">
						Update your competition profile information
					</p>
				</div>
			</div>

			{/* Form */}
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
										<Select onValueChange={field.onChange} value={field.value}>
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
												value={field.value}
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

							<FormField
								control={form.control}
								name="affiliateName"
								render={({ field }) => (
									<FormItem className="mt-6">
										<FormLabel>Default Affiliate</FormLabel>
										<FormControl>
											<AffiliateCombobox
												value={field.value ?? ""}
												onChange={field.onChange}
												placeholder="Select your gym or affiliate..."
											/>
										</FormControl>
										<FormDescription>
											Your default gym/affiliate for competition registrations
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
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

					{/* Notable Metcons */}
					<Card>
						<CardHeader>
							<CardTitle>Notable Metcons</CardTitle>
							<CardDescription>
								Record your personal bests for benchmark workouts
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							{/* Fran */}
							<div className="grid gap-4 sm:grid-cols-2">
								<FormField
									control={form.control}
									name="conditioning.fran.time"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Fran</FormLabel>
											<FormControl>
												<Input placeholder="3:45" {...field} />
											</FormControl>
											<FormDescription>Format: MM:SS</FormDescription>
											<FormMessage />
										</FormItem>
									)}
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
									render={({ field }) => (
										<FormItem>
											<FormLabel>Grace</FormLabel>
											<FormControl>
												<Input placeholder="2:30" {...field} />
											</FormControl>
											<FormDescription>Format: MM:SS</FormDescription>
											<FormMessage />
										</FormItem>
									)}
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
									render={({ field }) => (
										<FormItem>
											<FormLabel>Helen</FormLabel>
											<FormControl>
												<Input placeholder="8:30" {...field} />
											</FormControl>
											<FormDescription>Format: MM:SS</FormDescription>
											<FormMessage />
										</FormItem>
									)}
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
									render={({ field }) => (
										<FormItem>
											<FormLabel>Diane</FormLabel>
											<FormControl>
												<Input placeholder="5:00" {...field} />
											</FormControl>
											<FormDescription>Format: MM:SS</FormDescription>
											<FormMessage />
										</FormItem>
									)}
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
									render={({ field }) => (
										<FormItem>
											<FormLabel>Murph</FormLabel>
											<FormControl>
												<Input placeholder="45:00" {...field} />
											</FormControl>
											<FormDescription>
												Format: MM:SS or HH:MM:SS
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
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

					{/* Conditioning Metcons */}
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
							).map((lift) => (
								<div key={lift} className="grid gap-4 sm:grid-cols-3">
									<FormField
										control={form.control}
										name={`strength.${lift}.weight`}
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
										name={`strength.${lift}.unit`}
										render={({ field }) => (
											<FormItem>
												<FormLabel>Unit</FormLabel>
												<Select
													onValueChange={field.onChange}
													value={field.value || "lbs"}
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
										name={`strength.${lift}.date`}
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
							))}
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

					{/* Form Actions */}
					<div className="flex justify-end gap-4">
						<Button
							type="button"
							variant="outline"
							onClick={() => navigate({ to: "/compete/athlete" })}
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
		</div>
	)
}
