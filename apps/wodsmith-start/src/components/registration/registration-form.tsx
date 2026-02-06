import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { useNavigate } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Check, ChevronDown, Loader2, User, Users } from "lucide-react"
import { useEffect, useState } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { WaiverViewer } from "@/components/compete/waiver-viewer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Label } from "@/components/ui/label"
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import type {
	Competition,
	ScalingGroup,
	ScalingLevel,
	Team,
	Waiver,
} from "@/db/schema"
import type { PublicCompetitionDivision } from "@/server-fns/competition-divisions-fns"
import { initiateRegistrationPaymentFn } from "@/server-fns/registration-fns"
import type { RegistrationQuestion } from "@/server-fns/registration-questions-fns"
import { signWaiverFn } from "@/server-fns/waiver-fns"
import { cn } from "@/utils/cn"
import { getLocalDateKey, isSameDateString } from "@/utils/date-utils"
import { AffiliateCombobox } from "./affiliate-combobox"
import { FeeBreakdown } from "./fee-breakdown"

const teammateSchema = z.object({
	email: z.string().email("Valid email required"),
	firstName: z.string().max(255).optional(),
	lastName: z.string().max(255).optional(),
	affiliateName: z.string().max(255).optional(),
})

const registrationSchema = z.object({
	divisionId: z.string().min(1, "Please select a division"),
	// Affiliate is required for all registrations
	affiliateName: z
		.string()
		.min(1, "Please select your affiliate or Independent"),
	// Team fields (validated based on division.teamSize)
	teamName: z.string().max(255).optional(),
	teammates: z.array(teammateSchema).optional(),
	// Registration question answers
	answers: z
		.array(
			z.object({
				questionId: z.string(),
				answer: z.string(),
			}),
		)
		.optional(),
})

type FormValues = z.infer<typeof registrationSchema>

type Props = {
	competition: Competition & { organizingTeam: Team | null }
	scalingGroup: ScalingGroup & { scalingLevels: ScalingLevel[] }
	publicDivisions: PublicCompetitionDivision[]
	userId: string
	registrationOpen: boolean
	registrationOpensAt: string | null // YYYY-MM-DD format
	registrationClosesAt: string | null // YYYY-MM-DD format
	paymentCanceled?: boolean
	defaultAffiliateName?: string
	waivers: Waiver[]
	questions: RegistrationQuestion[]
}

export function RegistrationForm({
	competition,
	scalingGroup,
	publicDivisions,
	userId: _userId,
	registrationOpen,
	registrationOpensAt,
	registrationClosesAt,
	paymentCanceled,
	defaultAffiliateName,
	waivers,
	questions,
}: Props) {
	const navigate = useNavigate()
	const [isSubmitting, setIsSubmitting] = useState(false)

	// Track which waivers have been agreed to
	const [agreedWaivers, setAgreedWaivers] = useState<Set<string>>(new Set())

	// Use useServerFn for TanStack Start pattern
	const signWaiver = useServerFn(signWaiverFn)

	// Check if all required waivers are agreed to
	const requiredWaivers = waivers.filter((w) => w.required)
	const allRequiredWaiversAgreed = requiredWaivers.every((w) =>
		agreedWaivers.has(w.id),
	)

	// Show toast if returning from canceled payment
	useEffect(() => {
		if (paymentCanceled) {
			toast.error("Payment was canceled. Please try again when you're ready.")
		}
	}, [paymentCanceled])

	const form = useForm<FormValues>({
		resolver: standardSchemaResolver(registrationSchema),
		defaultValues: {
			divisionId: "",
			teamName: "",
			affiliateName: defaultAffiliateName ?? "",
			teammates: [],
			answers: questions.map((q) => ({ questionId: q.id, answer: "" })),
		},
	})

	const { fields, replace } = useFieldArray({
		control: form.control,
		name: "teammates",
	})

	const selectedDivisionId = form.watch("divisionId")
	const selectedDivision = scalingGroup.scalingLevels.find(
		(level) => level.id === selectedDivisionId,
	)
	const isTeamDivision = (selectedDivision?.teamSize ?? 1) > 1
	const teamSize = selectedDivision?.teamSize ?? 1
	const teammatesNeeded = teamSize - 1

	// Update teammates array when division changes
	const handleDivisionChange = (divisionId: string) => {
		form.setValue("divisionId", divisionId)
		const division = scalingGroup.scalingLevels.find((l) => l.id === divisionId)
		const newTeamSize = division?.teamSize ?? 1
		const newTeammatesNeeded = newTeamSize - 1

		if (newTeammatesNeeded > 0) {
			// Initialize teammates array with empty objects
			const currentTeammates = form.getValues("teammates") || []
			const newTeammates = Array.from(
				{ length: newTeammatesNeeded },
				(_, i) => ({
					email: currentTeammates[i]?.email ?? "",
					firstName: currentTeammates[i]?.firstName ?? "",
					lastName: currentTeammates[i]?.lastName ?? "",
					affiliateName: currentTeammates[i]?.affiliateName ?? "",
				}),
			)
			replace(newTeammates)
		} else {
			replace([])
			form.setValue("teamName", "")
		}
	}

	const handleWaiverCheckChange = (waiverId: string, checked: boolean) => {
		setAgreedWaivers((prev) => {
			const newSet = new Set(prev)
			if (checked) {
				newSet.add(waiverId)
			} else {
				newSet.delete(waiverId)
			}
			return newSet
		})
	}

	const onSubmit = async (data: FormValues) => {
		// Validate team fields for team divisions
		if (isTeamDivision) {
			if (!data.teamName?.trim()) {
				toast.error("Team name is required for team divisions")
				return
			}
			if (!data.teammates || data.teammates.length !== teammatesNeeded) {
				toast.error(`Please add ${teammatesNeeded} teammate(s)`)
				return
			}
			for (const teammate of data.teammates) {
				if (!teammate.email?.trim()) {
					toast.error("All teammate emails are required")
					return
				}
			}
		}

		// Validate required registration questions
		if (questions.length > 0 && data.answers) {
			for (const question of questions) {
				if (question.required) {
					const answer = data.answers.find((a) => a.questionId === question.id)
					if (!answer?.answer?.trim()) {
						toast.error(
							`Please answer the required question: ${question.label}`,
						)
						return
					}
				}
			}
		}

		// Check waivers are signed
		if (!allRequiredWaiversAgreed) {
			toast.error("Please agree to all required waivers before registering")
			return
		}

		setIsSubmitting(true)

		try {
			// Sign all agreed waivers first
			for (const waiverId of agreedWaivers) {
				const result = await signWaiver({
					data: {
						waiverId,
						registrationId: undefined, // Will be linked after registration
						ipAddress: undefined,
					},
				})

				if (!result.success) {
					toast.error("Failed to sign waiver")
					setIsSubmitting(false)
					return
				}
			}

			// Now proceed with registration
			const result = await initiateRegistrationPaymentFn({
				data: {
					competitionId: competition.id,
					divisionId: data.divisionId,
					teamName: isTeamDivision ? data.teamName : undefined,
					affiliateName: data.affiliateName || undefined,
					teammates: isTeamDivision ? data.teammates : undefined,
					answers: data.answers,
				},
			})

			// FREE registration - redirect to competition page
			if (result.isFree) {
				toast.success("Successfully registered!")
				navigate({ to: `/compete/${competition.slug}` })
				return
			}

			// PAID registration - redirect to Stripe Checkout
			if (result.checkoutUrl) {
				// Use window.location for external redirect
				window.location.href = result.checkoutUrl
				return
			}

			throw new Error("Failed to create checkout session")
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Registration failed"

			// Check if error is about team name being taken
			// Error message follows pattern: 'Team name "X" is already taken...'
			const teamNameErrorMatch = errorMessage.match(
				/^Team name ".+" is already taken/i,
			)

			if (teamNameErrorMatch) {
				// Set field-level error on the team name field
				form.setError("teamName", {
					type: "server",
					message: "This team name is already taken. Please choose another.",
				})
				setIsSubmitting(false)
				return
			}

			// Check if error is about a specific email being already registered/invited/own email
			// Error messages follow pattern: "email@example.com is already on a team..."
			// or "email@example.com has already been invited..."
			// or "email@example.com is your own email..."
			const emailErrorMatch = errorMessage.match(
				/^(.+@.+)\s+(is already on a team|has already been invited|is your own email)/i,
			)

			if (emailErrorMatch && data.teammates) {
				const problemEmail = emailErrorMatch[1].toLowerCase()
				const teammateIndex = data.teammates.findIndex(
					(t) => t.email.toLowerCase() === problemEmail,
				)

				if (teammateIndex !== -1) {
					// Set field-level error on the specific teammate email
					const friendlyMessage =
						emailErrorMatch[2].toLowerCase() === "is your own email"
							? "You can't add yourself as a teammate"
							: errorMessage
					form.setError(`teammates.${teammateIndex}.email`, {
						type: "server",
						message: friendlyMessage,
					})
				} else {
					// Email might be the current user's - show general toast
					toast.error(errorMessage)
				}
			} else {
				toast.error(errorMessage)
			}

			setIsSubmitting(false)
		}
	}

	const formatDate = (date: string | Date | number | null): string => {
		if (!date) return "TBA"

		// Handle YYYY-MM-DD string format
		if (typeof date === "string") {
			const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
			if (match) {
				const [, yearStr, monthStr, dayStr] = match
				const year = Number(yearStr)
				const monthNum = Number(monthStr)
				const day = Number(dayStr)
				// Create Date object in UTC to get weekday
				const d = new Date(Date.UTC(year, monthNum - 1, day))
				const weekdays = [
					"Sunday",
					"Monday",
					"Tuesday",
					"Wednesday",
					"Thursday",
					"Friday",
					"Saturday",
				]
				const months = [
					"January",
					"February",
					"March",
					"April",
					"May",
					"June",
					"July",
					"August",
					"September",
					"October",
					"November",
					"December",
				]
				return `${weekdays[d.getUTCDay()]}, ${months[monthNum - 1]} ${day}, ${year}`
			}
			return "TBA"
		}

		const d = typeof date === "number" ? new Date(date) : date
		return d.toLocaleDateString("en-US", {
			weekday: "long",
			month: "long",
			day: "numeric",
			year: "numeric",
		})
	}

	const getRegistrationMessage = () => {
		if (!registrationOpensAt || !registrationClosesAt) {
			return "Registration dates have not been set yet."
		}

		// Get today as YYYY-MM-DD for string comparison
		const now = new Date()
		const todayStr = getLocalDateKey(now)

		if (todayStr < registrationOpensAt) {
			return `Registration opens ${formatDate(registrationOpensAt)} and closes ${formatDate(registrationClosesAt)}`
		}
		if (todayStr > registrationClosesAt) {
			return `Registration was open from ${formatDate(registrationOpensAt)} to ${formatDate(registrationClosesAt)}`
		}
		return null
	}

	const registrationMessage = getRegistrationMessage()

	// Determine if submit should be disabled
	const submitDisabled =
		isSubmitting ||
		!registrationOpen ||
		(waivers.length > 0 && !allRequiredWaiversAgreed)

	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<h1 className="text-3xl font-bold">Register for Competition</h1>
				<p className="text-muted-foreground">{competition.name}</p>
			</div>

			{!registrationOpen && registrationMessage && (
				<Card className="border-yellow-500/50 bg-yellow-500/10">
					<CardContent className="pt-6">
						<p className="text-sm font-medium">{registrationMessage}</p>
					</CardContent>
				</Card>
			)}

			<Card>
				<CardHeader>
					<CardTitle>Competition Details</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					<div>
						<p className="text-muted-foreground text-sm">
							{isSameDateString(competition.startDate, competition.endDate)
								? "Competition Date"
								: "Competition Dates"}
						</p>
						<p className="font-medium">
							{isSameDateString(competition.startDate, competition.endDate)
								? formatDate(competition.startDate)
								: `${formatDate(competition.startDate)} - ${formatDate(competition.endDate)}`}
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-sm">Registration Window</p>
						<p className="font-medium">
							{formatDate(registrationOpensAt)} -{" "}
							{formatDate(registrationClosesAt)}
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-sm">Hosted By</p>
						<p className="font-medium">
							{competition.organizingTeam?.name || "TBA"}
						</p>
					</div>
				</CardContent>
			</Card>

			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Select Your Division</CardTitle>
							<CardDescription>
								Choose the division that best matches your skill level
							</CardDescription>
						</CardHeader>
						<CardContent>
							<FormField
								control={form.control}
								name="divisionId"
								render={({ field }) => {
									const selectedLevel = scalingGroup.scalingLevels.find(
										(l) => l.id === field.value,
									)
									return (
										<FormItem>
											<FormLabel>Division</FormLabel>
											<Popover>
												<PopoverTrigger asChild>
													<FormControl>
														<Button
															variant="outline"
															role="combobox"
															disabled={isSubmitting || !registrationOpen}
															className="w-full justify-between font-normal"
														>
															{selectedLevel?.label || "Select a division"}
															<ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
														</Button>
													</FormControl>
												</PopoverTrigger>
												<PopoverContent
													className="min-w-[250px] w-[--radix-popover-trigger-width] p-0"
													align="start"
												>
													<div className="max-h-[300px] overflow-y-auto p-1">
														{scalingGroup.scalingLevels.map((level) => {
															const divisionInfo = publicDivisions.find(
																(d) => d.id === level.id,
															)
															const isFull = divisionInfo?.isFull ?? false
															const spotsAvailable =
																divisionInfo?.spotsAvailable
															const maxSpots = divisionInfo?.maxSpots
															const isSelected = field.value === level.id

															return (
																<button
																	key={level.id}
																	type="button"
																	disabled={isFull}
																	onClick={() => {
																		handleDivisionChange(level.id)
																	}}
																	className={cn(
																		"relative flex w-full cursor-pointer select-none items-center justify-between gap-2 rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
																		isSelected && "bg-accent",
																		isFull &&
																			"pointer-events-none opacity-50",
																	)}
																>
																	<span
																		className={
																			isFull
																				? "line-through text-muted-foreground"
																				: ""
																		}
																	>
																		{level.label}
																	</span>
																	<div className="flex items-center gap-1">
																		{(level.teamSize ?? 1) > 1 ? (
																			<Badge
																				variant="secondary"
																				className="text-xs"
																			>
																				<Users className="w-3 h-3 mr-1" />
																				{level.teamSize}
																			</Badge>
																		) : (
																			<Badge
																				variant="outline"
																				className="text-xs"
																			>
																				<User className="w-3 h-3 mr-1" />
																				Indy
																			</Badge>
																		)}
																		{isFull ? (
																			<Badge
																				variant="destructive"
																				className="text-xs"
																			>
																				SOLD OUT
																			</Badge>
																		) : maxSpots !== null &&
																			spotsAvailable !== null &&
																			spotsAvailable !== undefined &&
																			spotsAvailable <= 5 ? (
																			<Badge
																				variant="secondary"
																				className="text-xs text-amber-600 dark:text-amber-400"
																			>
																				{spotsAvailable} left
																			</Badge>
																		) : null}
																	</div>
																</button>
															)
														})}
													</div>
												</PopoverContent>
											</Popover>
											<FormDescription>
												{isTeamDivision
													? `Team division - requires ${teamSize} athletes (you + ${teammatesNeeded} teammate${teammatesNeeded > 1 ? "s" : ""})`
													: "Individual division - compete on your own"}
											</FormDescription>
											<FormMessage />
										</FormItem>
									)
								}}
							/>
						</CardContent>
					</Card>

					{/* Affiliate Selection Card - Required for all registrations */}
					<Card>
						<CardHeader>
							<CardTitle>Your Affiliate</CardTitle>
							<CardDescription>
								Select your gym or affiliate. Choose "Independent" if you don't
								train at a gym.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<FormField
								control={form.control}
								name="affiliateName"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Affiliate *</FormLabel>
										<FormControl>
											<AffiliateCombobox
												value={field.value || ""}
												onChange={field.onChange}
												placeholder="Search or select affiliate..."
												disabled={isSubmitting || !registrationOpen}
											/>
										</FormControl>
										<FormDescription>
											Your gym or affiliate name will be displayed on
											leaderboards
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						</CardContent>
					</Card>

					{/* Registration Questions Card */}
					{questions.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle>Registration Questions</CardTitle>
							</CardHeader>
							<CardContent className="space-y-6">
								{questions.map((question, index) => (
									<FormField
										key={question.id}
										control={form.control}
										name={`answers.${index}.answer`}
										render={({ field }) => (
											<FormItem>
												<FormLabel>
													{question.label}
													{question.required && (
														<span className="text-destructive"> *</span>
													)}
												</FormLabel>
												<FormControl>
													{question.type === "select" ? (
														<Select
															onValueChange={field.onChange}
															defaultValue={field.value}
															disabled={isSubmitting || !registrationOpen}
														>
															<SelectTrigger>
																<SelectValue placeholder="Select an option" />
															</SelectTrigger>
															<SelectContent>
																{question.options?.map((opt) => (
																	<SelectItem key={opt} value={opt}>
																		{opt}
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
													) : question.type === "number" ? (
														<Input
															type="number"
															{...field}
															disabled={isSubmitting || !registrationOpen}
														/>
													) : (
														<Input
															{...field}
															disabled={isSubmitting || !registrationOpen}
														/>
													)}
												</FormControl>
												{question.helpText && (
													<FormDescription>{question.helpText}</FormDescription>
												)}
												<FormMessage />
											</FormItem>
										)}
									/>
								))}
							</CardContent>
						</Card>
					)}

					{/* Registration Fee Card */}
					<Card>
						<CardHeader>
							<CardTitle>Registration Fee</CardTitle>
						</CardHeader>
						<CardContent>
							<FeeBreakdown
								competitionId={competition.id}
								divisionId={selectedDivisionId || null}
							/>
						</CardContent>
					</Card>

					{/* Team Registration Fields */}
					{isTeamDivision && (
						<Card>
							<CardHeader>
								<CardTitle>Team Details</CardTitle>
								<CardDescription>
									Enter your team name and invite your teammates
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6">
								<FormField
									control={form.control}
									name="teamName"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Team Name</FormLabel>
											<FormControl>
												<Input
													placeholder="Enter your team name"
													{...field}
													disabled={isSubmitting || !registrationOpen}
												/>
											</FormControl>
											<FormDescription>
												This will be displayed on leaderboards
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>

								{/* Teammates */}
								<div className="space-y-4">
									<div className="flex items-center justify-between">
										<h4 className="text-sm font-medium">Teammates</h4>
										<Badge variant="outline">
											{fields.length} of {teammatesNeeded} added
										</Badge>
									</div>

									{fields.map((field, index) => (
										<Card key={field.id} className="p-4">
											<div className="space-y-4">
												<div className="flex items-center gap-2">
													<Users className="w-4 h-4 text-muted-foreground" />
													<span className="font-medium">
														Teammate {index + 1}
													</span>
												</div>

												<FormField
													control={form.control}
													name={`teammates.${index}.email`}
													render={({ field }) => (
														<FormItem>
															<FormLabel>Email *</FormLabel>
															<FormControl>
																<Input
																	type="email"
																	placeholder="teammate@email.com"
																	{...field}
																	disabled={isSubmitting || !registrationOpen}
																/>
															</FormControl>
															<FormMessage />
														</FormItem>
													)}
												/>

												<div className="grid grid-cols-2 gap-4">
													<FormField
														control={form.control}
														name={`teammates.${index}.firstName`}
														render={({ field }) => (
															<FormItem>
																<FormLabel>First Name</FormLabel>
																<FormControl>
																	<Input
																		placeholder="First name"
																		{...field}
																		disabled={isSubmitting || !registrationOpen}
																	/>
																</FormControl>
																<FormMessage />
															</FormItem>
														)}
													/>

													<FormField
														control={form.control}
														name={`teammates.${index}.lastName`}
														render={({ field }) => (
															<FormItem>
																<FormLabel>Last Name</FormLabel>
																<FormControl>
																	<Input
																		placeholder="Last name"
																		{...field}
																		disabled={isSubmitting || !registrationOpen}
																	/>
																</FormControl>
																<FormMessage />
															</FormItem>
														)}
													/>
												</div>

												<FormField
													control={form.control}
													name={`teammates.${index}.affiliateName`}
													render={({ field }) => (
														<FormItem>
															<FormLabel>Affiliate (Optional)</FormLabel>
															<FormControl>
																<AffiliateCombobox
																	value={field.value || ""}
																	onChange={field.onChange}
																	placeholder="Search or enter affiliate..."
																	disabled={isSubmitting || !registrationOpen}
																/>
															</FormControl>
															<FormMessage />
														</FormItem>
													)}
												/>
											</div>
										</Card>
									))}

									<p className="text-sm text-muted-foreground">
										Teammates will receive an email invitation to join your
										team. They must accept the invite to complete their
										registration.
									</p>
								</div>
							</CardContent>
						</Card>
					)}

					{/* Waivers Section - Inline */}
					{waivers.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle>Waivers & Agreements</CardTitle>
								<CardDescription>
									Please review and agree to the following waivers to complete
									your registration
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6">
								{waivers.map((waiver) => (
									<div key={waiver.id} className="space-y-4">
										<div className="flex items-center gap-2">
											<h4 className="font-medium">{waiver.title}</h4>
											{waiver.required && (
												<Badge variant="destructive" className="text-xs">
													Required
												</Badge>
											)}
										</div>

										{/* Waiver Content */}
										<div className="border rounded-lg p-4 max-h-64 overflow-y-auto bg-muted/10">
											<WaiverViewer
												content={waiver.content}
												className="prose prose-sm max-w-none dark:prose-invert"
											/>
										</div>

										{/* Agreement Checkbox */}
										<div className="flex items-start gap-3 p-4 bg-muted/20 rounded-lg">
											<Checkbox
												id={`waiver-${waiver.id}`}
												checked={agreedWaivers.has(waiver.id)}
												onCheckedChange={(checked) =>
													handleWaiverCheckChange(waiver.id, checked === true)
												}
												disabled={isSubmitting || !registrationOpen}
											/>
											<Label
												htmlFor={`waiver-${waiver.id}`}
												className="text-sm font-medium leading-none cursor-pointer"
											>
												I have read and agree to this waiver
												{waiver.required && (
													<span className="text-destructive ml-1">*</span>
												)}
											</Label>
										</div>
									</div>
								))}
							</CardContent>
						</Card>
					)}

					<div className="flex gap-4">
						<Button type="submit" disabled={submitDisabled} className="flex-1">
							{isSubmitting ? (
								<>
									<Loader2 className="w-4 h-4 mr-2 animate-spin" />
									Processing...
								</>
							) : !registrationOpen ? (
								"Registration Closed"
							) : waivers.length > 0 && !allRequiredWaiversAgreed ? (
								"Agree to Waivers to Continue"
							) : isTeamDivision ? (
								"Register Team"
							) : (
								"Complete Registration"
							)}
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={() => navigate({ to: `/compete/${competition.slug}` })}
							disabled={isSubmitting}
						>
							Cancel
						</Button>
					</div>
				</form>
			</Form>
		</div>
	)
}
