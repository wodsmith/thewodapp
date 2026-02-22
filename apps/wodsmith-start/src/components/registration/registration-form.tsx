import { useNavigate } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { CheckCircle2, Loader2, User, Users } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { trackEvent } from "@/lib/posthog"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

interface Teammate {
	email: string
	firstName: string
	lastName: string
	affiliateName: string
}

interface TeamEntry {
	divisionId: string
	teamName: string
	teammates: Teammate[]
}

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
	userFirstName?: string | null
	userLastName?: string | null
	userEmail?: string | null
	registeredDivisionIds?: string[]
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
	userFirstName,
	userLastName,
	userEmail,
	registeredDivisionIds = [],
}: Props) {
	const navigate = useNavigate()
	const [isSubmitting, setIsSubmitting] = useState(false)

	// Multi-select state
	const [selectedDivisionIds, setSelectedDivisionIds] = useState<string[]>([])
	const [affiliateName, setAffiliateName] = useState(
		defaultAffiliateName ?? "",
	)

	// Team details per division (for team divisions)
	const [teamEntries, setTeamEntries] = useState<Map<string, TeamEntry>>(
		new Map(),
	)

	// Registration question answers
	const [answers, setAnswers] = useState<
		Array<{ questionId: string; answer: string }>
	>(questions.map((q) => ({ questionId: q.id, answer: "" })))

	// Track which waivers have been agreed to
	const [agreedWaivers, setAgreedWaivers] = useState<Set<string>>(new Set())

	// Use useServerFn for TanStack Start pattern
	const signWaiver = useServerFn(signWaiverFn)

	// Check if all required waivers are agreed to
	const requiredWaivers = waivers.filter((w) => w.required)
	const allRequiredWaiversAgreed = requiredWaivers.every((w) =>
		agreedWaivers.has(w.id),
	)

	const registeredDivisionIdSet = new Set(registeredDivisionIds)

	// Track registration started on mount
	useEffect(() => {
		trackEvent("competition_registration_started", {
			competition_id: competition.id,
			competition_name: competition.name,
			competition_slug: competition.slug,
		})
	}, [competition.id, competition.name, competition.slug])

	// Show toast if returning from canceled payment
	useEffect(() => {
		if (paymentCanceled) {
			toast.error("Payment was canceled. Please try again when you're ready.")
		}
	}, [paymentCanceled])

	// Helper to get division info
	const getDivision = (divisionId: string) =>
		scalingGroup.scalingLevels.find((l) => l.id === divisionId)

	const getPublicDivision = (divisionId: string) =>
		publicDivisions.find((d) => d.id === divisionId)

	// Handle division checkbox toggle
	const handleDivisionToggle = (divisionId: string, checked: boolean) => {
		if (checked) {
			setSelectedDivisionIds((prev) => [...prev, divisionId])
			const division = getDivision(divisionId)
			if (division && division.teamSize > 1) {
				// Initialize team entry for team division
				const teammatesNeeded = division.teamSize - 1
				setTeamEntries((prev) => {
					const next = new Map(prev)
					next.set(divisionId, {
						divisionId,
						teamName: "",
						teammates: Array.from({ length: teammatesNeeded }, () => ({
							email: "",
							firstName: "",
							lastName: "",
							affiliateName: "",
						})),
					})
					return next
				})
			}
		} else {
			setSelectedDivisionIds((prev) => prev.filter((id) => id !== divisionId))
			setTeamEntries((prev) => {
				const next = new Map(prev)
				next.delete(divisionId)
				return next
			})
		}
	}

	// Update team entry field
	const updateTeamEntry = (
		divisionId: string,
		field: "teamName",
		value: string,
	) => {
		setTeamEntries((prev) => {
			const next = new Map(prev)
			const entry = next.get(divisionId)
			if (entry) {
				next.set(divisionId, { ...entry, [field]: value })
			}
			return next
		})
	}

	const updateTeammate = (
		divisionId: string,
		index: number,
		field: keyof Teammate,
		value: string,
	) => {
		setTeamEntries((prev) => {
			const next = new Map(prev)
			const entry = next.get(divisionId)
			if (entry) {
				const teammates = [...entry.teammates]
				teammates[index] = { ...teammates[index], [field]: value }
				next.set(divisionId, { ...entry, teammates })
			}
			return next
		})
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

	const updateAnswer = (questionId: string, value: string) => {
		setAnswers((prev) =>
			prev.map((a) => (a.questionId === questionId ? { ...a, answer: value } : a)),
		)
	}

	// Build items for multi-division submission
	const buildRegistrationItems = () => {
		return selectedDivisionIds.map((divisionId) => {
			const division = getDivision(divisionId)
			const isTeam = (division?.teamSize ?? 1) > 1
			const teamEntry = teamEntries.get(divisionId)

			return {
				divisionId,
				teamName: isTeam ? teamEntry?.teamName : undefined,
				teammates: isTeam ? teamEntry?.teammates : undefined,
			}
		})
	}

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault()

		if (selectedDivisionIds.length === 0) {
			toast.error("Please select at least one division")
			return
		}

		if (!affiliateName.trim()) {
			toast.error("Please select your affiliate or Independent")
			return
		}

		// Validate team fields for each team division
		for (const divisionId of selectedDivisionIds) {
			const division = getDivision(divisionId)
			if (!division || division.teamSize <= 1) continue

			const teamEntry = teamEntries.get(divisionId)
			if (!teamEntry?.teamName?.trim()) {
				toast.error(
					`Team name is required for ${division.label}`,
				)
				return
			}

			const teammatesNeeded = division.teamSize - 1
			if (
				!teamEntry.teammates ||
				teamEntry.teammates.length !== teammatesNeeded
			) {
				toast.error(
					`Please add ${teammatesNeeded} teammate(s) for ${division.label}`,
				)
				return
			}

			for (const teammate of teamEntry.teammates) {
				if (!teammate.email?.trim()) {
					toast.error(
						`All teammate emails are required for ${division.label}`,
					)
					return
				}
			}
		}

		// Validate required registration questions
		if (questions.length > 0) {
			for (const question of questions) {
				if (question.required) {
					const answer = answers.find((a) => a.questionId === question.id)
					if (!answer?.answer?.trim()) {
						toast.error(
							`Please answer the required question: ${question.label}`,
						)
						return
					}
				}
			}
		}

		// Check waivers
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
						registrationId: undefined,
						ipAddress: undefined,
					},
				})

				if (!result.success) {
					toast.error("Failed to sign waiver")
					setIsSubmitting(false)
					return
				}
			}

			// Build registration items
			const items = buildRegistrationItems()

			// Submit registration
			const result = await initiateRegistrationPaymentFn({
				data: {
					competitionId: competition.id,
					items,
					affiliateName: affiliateName || undefined,
					answers,
				},
			})

			// FREE registration - redirect to registered page
			if (result.isFree) {
				trackEvent("competition_registration_completed", {
					competition_id: competition.id,
					competition_name: competition.name,
					competition_slug: competition.slug,
					division_count: items.length,
				})
				toast.success("Successfully registered!")
				navigate({
					to: `/compete/${competition.slug}/registered`,
					search: { registration_id: result.registrationId ?? undefined },
				})
				return
			}

			// PAID registration - redirect to Stripe Checkout
			if (result.checkoutUrl) {
				trackEvent("competition_registration_payment_started", {
					competition_id: competition.id,
					competition_name: competition.name,
					competition_slug: competition.slug,
					division_count: items.length,
				})
				window.location.href = result.checkoutUrl
				return
			}

			throw new Error("Failed to create checkout session")
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Registration failed"

			trackEvent("competition_registration_failed", {
				competition_id: competition.id,
				competition_name: competition.name,
				competition_slug: competition.slug,
				error_type: "unknown",
			})

			toast.error(errorMessage)
			setIsSubmitting(false)
		}
	}

	const formatDate = (date: string | Date | number | null): string => {
		if (!date) return "TBA"

		if (typeof date === "string") {
			const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
			if (match) {
				const [, yearStr, monthStr, dayStr] = match
				const year = Number(yearStr)
				const monthNum = Number(monthStr)
				const day = Number(dayStr)
				const d = new Date(Date.UTC(year, monthNum - 1, day))
				const weekdays = [
					"Sunday", "Monday", "Tuesday", "Wednesday",
					"Thursday", "Friday", "Saturday",
				]
				const months = [
					"January", "February", "March", "April",
					"May", "June", "July", "August",
					"September", "October", "November", "December",
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
	const hasSelectedDivisions = selectedDivisionIds.length > 0

	// Determine if submit should be disabled
	const submitDisabled =
		isSubmitting ||
		!registrationOpen ||
		!hasSelectedDivisions ||
		!affiliateName.trim() ||
		(waivers.length > 0 && !allRequiredWaiversAgreed)

	// Get selected team divisions (for rendering team fields)
	const selectedTeamDivisions = selectedDivisionIds
		.map((id) => getDivision(id))
		.filter(
			(d): d is ScalingLevel => d !== undefined && d.teamSize > 1,
		)

	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<h1 className="text-3xl font-bold">Register for Competition</h1>
				<p className="text-muted-foreground">{competition.name}</p>
			</div>

			{registeredDivisionIds.length > 0 && (
				<Card className="border-blue-500/20 bg-blue-500/5">
					<CardContent className="pt-6">
						<div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
							<CheckCircle2 className="h-4 w-4" />
							<span className="text-sm font-medium">
								You're already registered for{" "}
								{registeredDivisionIds.length === 1
									? "1 division"
									: `${registeredDivisionIds.length} divisions`}
								. Select additional divisions below.
							</span>
						</div>
					</CardContent>
				</Card>
			)}

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

			<form onSubmit={onSubmit} className="space-y-6">
				{/* Division Selection - Multi-select with checkboxes */}
				<Card>
					<CardHeader>
						<CardTitle>Select Division{selectedDivisionIds.length > 1 ? "s" : ""}</CardTitle>
						<CardDescription>
							Choose one or more divisions to register for
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							{scalingGroup.scalingLevels.map((level) => {
								const divisionInfo = getPublicDivision(level.id)
								const isFull = divisionInfo?.isFull ?? false
								const spotsAvailable = divisionInfo?.spotsAvailable
								const maxSpots = divisionInfo?.maxSpots
								const isAlreadyRegistered = registeredDivisionIdSet.has(
									level.id,
								)
								const isSelected = selectedDivisionIds.includes(level.id)
								const isDisabled =
									isFull ||
									isAlreadyRegistered ||
									isSubmitting ||
									!registrationOpen

								return (
									<div
										key={level.id}
										className={cn(
											"flex items-center gap-3 rounded-lg border p-3 transition-colors",
											isSelected && "border-primary bg-primary/5",
											isAlreadyRegistered && "opacity-60 bg-green-500/5 border-green-500/20",
											isFull && !isAlreadyRegistered && "opacity-50",
										)}
									>
										<Checkbox
											id={`division-${level.id}`}
											checked={isSelected}
											onCheckedChange={(checked) =>
												handleDivisionToggle(level.id, checked === true)
											}
											disabled={isDisabled}
										/>
										<label
											htmlFor={`division-${level.id}`}
											className={cn(
												"flex-1 flex items-center justify-between cursor-pointer",
												isDisabled && "cursor-not-allowed",
											)}
										>
											<span
												className={cn(
													"font-medium",
													isFull &&
														!isAlreadyRegistered &&
														"line-through text-muted-foreground",
												)}
											>
												{level.label}
											</span>
											<div className="flex items-center gap-1.5">
												{(level.teamSize ?? 1) > 1 ? (
													<Badge variant="secondary" className="text-xs">
														<Users className="w-3 h-3 mr-1" />
														{level.teamSize}
													</Badge>
												) : (
													<Badge variant="outline" className="text-xs">
														<User className="w-3 h-3 mr-1" />
														Indy
													</Badge>
												)}
												{isAlreadyRegistered ? (
													<Badge
														variant="outline"
														className="text-xs text-green-600 border-green-500/30"
													>
														<CheckCircle2 className="w-3 h-3 mr-1" />
														Registered
													</Badge>
												) : isFull ? (
													<Badge variant="destructive" className="text-xs">
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
										</label>
									</div>
								)
							})}
						</div>
						{!hasSelectedDivisions && (
							<p className="text-sm text-muted-foreground mt-3">
								Select at least one division to continue
							</p>
						)}
					</CardContent>
				</Card>

				{/* Affiliate Selection Card */}
				<Card>
					<CardHeader>
						<CardTitle>Your Affiliate</CardTitle>
						<CardDescription>
							Select your gym or affiliate. Choose "Independent" if you don't
							train at a gym.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							<Label>Affiliate *</Label>
							<AffiliateCombobox
								value={affiliateName}
								onChange={setAffiliateName}
								placeholder="Search or select affiliate..."
								disabled={isSubmitting || !registrationOpen}
							/>
							<p className="text-xs text-muted-foreground">
								Your gym or affiliate name will be displayed on leaderboards
							</p>
						</div>
					</CardContent>
				</Card>

				{/* Registration Questions Card */}
				{questions.length > 0 && (
					<Card>
						<CardHeader>
							<CardTitle>Registration Questions</CardTitle>
						</CardHeader>
						<CardContent className="space-y-6">
							{questions.map((question) => {
								const answer = answers.find(
									(a) => a.questionId === question.id,
								)
								return (
									<div key={question.id} className="space-y-2">
										<Label>
											{question.label}
											{question.required && (
												<span className="text-destructive"> *</span>
											)}
										</Label>
										{question.type === "select" ? (
											<Select
												onValueChange={(val) =>
													updateAnswer(question.id, val)
												}
												defaultValue={answer?.answer}
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
												value={answer?.answer ?? ""}
												onChange={(e) =>
													updateAnswer(question.id, e.target.value)
												}
												disabled={isSubmitting || !registrationOpen}
											/>
										) : (
											<Input
												value={answer?.answer ?? ""}
												onChange={(e) =>
													updateAnswer(question.id, e.target.value)
												}
												disabled={isSubmitting || !registrationOpen}
											/>
										)}
										{question.helpText && (
											<p className="text-xs text-muted-foreground">
												{question.helpText}
											</p>
										)}
									</div>
								)
							})}
						</CardContent>
					</Card>
				)}

				{/* Registration Fee Card */}
				{hasSelectedDivisions && (
					<Card>
						<CardHeader>
							<CardTitle>Registration Fee{selectedDivisionIds.length > 1 ? "s" : ""}</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							{selectedDivisionIds.map((divisionId) => {
								const division = getDivision(divisionId)
								return (
									<div key={divisionId}>
										{selectedDivisionIds.length > 1 && (
											<p className="text-sm font-medium mb-1">
												{division?.label ?? "Division"}
											</p>
										)}
										<FeeBreakdown
											competitionId={competition.id}
											divisionId={divisionId}
										/>
									</div>
								)
							})}
						</CardContent>
					</Card>
				)}

				{/* Team Registration Fields - one section per team division */}
				{selectedTeamDivisions.map((division) => {
					const teamEntry = teamEntries.get(division.id)
					if (!teamEntry) return null

					return (
						<Card key={division.id}>
							<CardHeader>
								<CardTitle>
									Team Details
									{selectedTeamDivisions.length > 1 && (
										<span className="text-muted-foreground font-normal">
											{" "}
											- {division.label}
										</span>
									)}
								</CardTitle>
								<CardDescription>
									Enter your team name and invite your teammates for{" "}
									{division.label} ({division.teamSize} athletes)
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6">
								<div className="space-y-2">
									<Label>Team Name *</Label>
									<Input
										placeholder="Enter your team name"
										value={teamEntry.teamName}
										onChange={(e) =>
											updateTeamEntry(
												division.id,
												"teamName",
												e.target.value,
											)
										}
										disabled={isSubmitting || !registrationOpen}
									/>
									<p className="text-xs text-muted-foreground">
										This will be displayed on leaderboards
									</p>
								</div>

								{/* Teammates */}
								<div className="space-y-4">
									<div className="flex items-center justify-between">
										<h4 className="text-sm font-medium">Teammates</h4>
										<Badge variant="outline">
											{teamEntry.teammates.length + 1} of {division.teamSize}{" "}
											added
										</Badge>
									</div>

									{/* Current user as Teammate 1 (read-only) */}
									<Card className="p-4 bg-muted/50">
										<div className="space-y-4">
											<div className="flex items-center gap-2">
												<User className="w-4 h-4 text-muted-foreground" />
												<span className="font-medium">Teammate 1 (You)</span>
											</div>
											<div className="grid grid-cols-2 gap-4">
												<div>
													<Label className="text-sm font-medium">
														First Name
													</Label>
													<Input
														value={userFirstName || ""}
														disabled
														className="mt-1.5"
													/>
												</div>
												<div>
													<Label className="text-sm font-medium">
														Last Name
													</Label>
													<Input
														value={userLastName || ""}
														disabled
														className="mt-1.5"
													/>
												</div>
											</div>
											<div>
												<Label className="text-sm font-medium">Email</Label>
												<Input
													value={userEmail || ""}
													disabled
													className="mt-1.5"
												/>
											</div>
											<p className="text-xs text-muted-foreground">
												Update your profile to change this information.
											</p>
										</div>
									</Card>

									{teamEntry.teammates.map((teammate, index) => (
										<Card key={`${division.id}-teammate-${index}`} className="p-4">
											<div className="space-y-4">
												<div className="flex items-center gap-2">
													<Users className="w-4 h-4 text-muted-foreground" />
													<span className="font-medium">
														Teammate {index + 2}
													</span>
												</div>

												<div className="space-y-2">
													<Label>Email *</Label>
													<Input
														type="email"
														placeholder="teammate@email.com"
														value={teammate.email}
														onChange={(e) =>
															updateTeammate(
																division.id,
																index,
																"email",
																e.target.value,
															)
														}
														disabled={isSubmitting || !registrationOpen}
													/>
												</div>

												<div className="grid grid-cols-2 gap-4">
													<div className="space-y-2">
														<Label>First Name</Label>
														<Input
															placeholder="First name"
															value={teammate.firstName}
															onChange={(e) =>
																updateTeammate(
																	division.id,
																	index,
																	"firstName",
																	e.target.value,
																)
															}
															disabled={isSubmitting || !registrationOpen}
														/>
													</div>
													<div className="space-y-2">
														<Label>Last Name</Label>
														<Input
															placeholder="Last name"
															value={teammate.lastName}
															onChange={(e) =>
																updateTeammate(
																	division.id,
																	index,
																	"lastName",
																	e.target.value,
																)
															}
															disabled={isSubmitting || !registrationOpen}
														/>
													</div>
												</div>

												<div className="space-y-2">
													<Label>Affiliate (Optional)</Label>
													<AffiliateCombobox
														value={teammate.affiliateName}
														onChange={(val) =>
															updateTeammate(
																division.id,
																index,
																"affiliateName",
																val,
															)
														}
														placeholder="Search or enter affiliate..."
														disabled={isSubmitting || !registrationOpen}
													/>
												</div>
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
					)
				})}

				{/* Waivers Section */}
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

									<div className="border rounded-lg p-4 max-h-64 overflow-y-auto bg-muted/10">
										<WaiverViewer
											content={waiver.content}
											className="prose prose-sm max-w-none dark:prose-invert"
										/>
									</div>

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
						) : !hasSelectedDivisions ? (
							"Select a Division"
						) : waivers.length > 0 && !allRequiredWaiversAgreed ? (
							"Agree to Waivers to Continue"
						) : selectedDivisionIds.length > 1 ? (
							`Register for ${selectedDivisionIds.length} Divisions`
						) : selectedTeamDivisions.length > 0 ? (
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
		</div>
	)
}
