/**
 * Organizer Athletes Page
 * Port from apps/wodsmith/src/app/(compete)/compete/organizer/[competitionId]/(with-sidebar)/athletes/page.tsx
 *
 * This file uses top-level imports for server-only modules.
 */

import {
	createFileRoute,
	getRouteApi,
	useNavigate,
	useRouter,
} from "@tanstack/react-router"
import { Calendar, Download, Mail, X } from "lucide-react"
import { z } from "zod"
import { RegistrationQuestionsEditor } from "@/components/competition-settings/registration-questions-editor"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import {
	getCompetitionByIdFn,
	getOrganizerRegistrationsFn,
} from "@/server-fns/competition-detail-fns"
import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"
import {
	getCompetitionQuestionsFn,
	getCompetitionRegistrationAnswersFn,
} from "@/server-fns/registration-questions-fns"
import {
	getCompetitionWaiverSignaturesFn,
	getCompetitionWaiversFn,
} from "@/server-fns/waiver-fns"

const parentRoute = getRouteApi("/compete/organizer/$competitionId")

const athletesSearchSchema = z.object({
	division: z.string().optional(),
	// questionFilters: { questionId: ["value1", "value2"] }
	questionFilters: z.record(z.string(), z.array(z.string())).optional(),
	// waiverFilters: ["waiverId:signed", "waiverId:unsigned"]
	waiverFilters: z.array(z.string()).optional(),
})

export const Route = createFileRoute(
	"/compete/organizer/$competitionId/athletes",
)({
	component: AthletesPage,
	validateSearch: athletesSearchSchema,
	loaderDeps: ({ search }) => ({
		division: search?.division,
		questionFilters: search?.questionFilters,
		waiverFilters: search?.waiverFilters,
	}),
	loader: async ({ params, deps }) => {
		const { competitionId } = params
		const divisionFilter = deps?.division

		// Get competition from parent route context to get teamId
		// We need to fetch it here since we can't access parent loader data in loader
		const { competition } = await getCompetitionByIdFn({
			data: { competitionId },
		})

		if (!competition) {
			throw new Error("Competition not found")
		}

		// Parallel fetch: registrations, divisions, questions, answers, waivers, and signatures
		const [
			registrationsResult,
			divisionsResult,
			questionsResult,
			answersResult,
			waiversResult,
			signaturesResult,
		] = await Promise.all([
			getOrganizerRegistrationsFn({
				data: { competitionId, divisionFilter },
			}),
			getCompetitionDivisionsWithCountsFn({
				data: { competitionId, teamId: competition.organizingTeamId },
			}),
			getCompetitionQuestionsFn({
				data: { competitionId },
			}),
			getCompetitionRegistrationAnswersFn({
				data: { competitionId, teamId: competition.organizingTeamId },
			}),
			getCompetitionWaiversFn({
				data: { competitionId },
			}),
			getCompetitionWaiverSignaturesFn({
				data: { competitionId, teamId: competition.organizingTeamId },
			}),
		])

		return {
			registrations: registrationsResult.registrations,
			divisions: divisionsResult.divisions,
			questions: questionsResult.questions,
			answersByRegistration: answersResult.answersByRegistration,
			waivers: waiversResult.waivers,
			signaturesByUser: signaturesResult.signatures.reduce(
				(acc, sig) => {
					const key = `${sig.userId}-${sig.waiverId}`
					acc[key] = sig.signedAt
					return acc
				},
				{} as Record<string, Date>,
			),
			currentDivisionFilter: divisionFilter,
			currentQuestionFilters: deps?.questionFilters || {},
			currentWaiverFilters: deps?.waiverFilters || [],
			teamId: competition.organizingTeamId,
		}
	},
})

function AthletesPage() {
	const { competition } = parentRoute.useLoaderData()
	const {
		registrations,
		divisions,
		questions,
		answersByRegistration,
		waivers,
		signaturesByUser,
		currentDivisionFilter,
		currentQuestionFilters,
		currentWaiverFilters,
		teamId,
	} = Route.useLoaderData()
	const navigate = useNavigate()
	const router = useRouter()

	const handleQuestionsChange = () => {
		router.invalidate()
	}

	const handleDivisionChange = (value: string) => {
		navigate({
			to: "/compete/organizer/$competitionId/athletes",
			params: { competitionId: competition.id },
			search: (prev) => ({
				...prev,
				division: value === "all" ? undefined : value,
			}),
			resetScroll: false,
		})
	}

	// Toggle a question filter value (add if not present, remove if present)
	const toggleQuestionFilter = (questionId: string, value: string) => {
		navigate({
			to: "/compete/organizer/$competitionId/athletes",
			params: { competitionId: competition.id },
			search: (prev) => {
				const newFilters = { ...prev.questionFilters }
				const currentValues = newFilters[questionId] || []

				if (currentValues.includes(value)) {
					// Remove the value
					const filtered = currentValues.filter((v) => v !== value)
					if (filtered.length === 0) {
						delete newFilters[questionId]
					} else {
						newFilters[questionId] = filtered
					}
				} else {
					// Add the value
					newFilters[questionId] = [...currentValues, value]
				}

				return {
					...prev,
					questionFilters:
						Object.keys(newFilters).length > 0 ? newFilters : undefined,
				}
			},
			resetScroll: false,
		})
	}

	// Remove a specific question filter value
	const removeQuestionFilter = (questionId: string, value: string) => {
		navigate({
			to: "/compete/organizer/$competitionId/athletes",
			params: { competitionId: competition.id },
			search: (prev) => {
				const newFilters = { ...prev.questionFilters }
				const currentValues = newFilters[questionId] || []
				const filtered = currentValues.filter((v) => v !== value)

				if (filtered.length === 0) {
					delete newFilters[questionId]
				} else {
					newFilters[questionId] = filtered
				}

				return {
					...prev,
					questionFilters:
						Object.keys(newFilters).length > 0 ? newFilters : undefined,
				}
			},
			resetScroll: false,
		})
	}

	// Toggle a waiver filter (add if not present, remove if present)
	const toggleWaiverFilter = (filterValue: string) => {
		navigate({
			to: "/compete/organizer/$competitionId/athletes",
			params: { competitionId: competition.id },
			search: (prev) => {
				const currentFilters = prev.waiverFilters || []

				if (currentFilters.includes(filterValue)) {
					const filtered = currentFilters.filter((v) => v !== filterValue)
					return {
						...prev,
						waiverFilters: filtered.length > 0 ? filtered : undefined,
					}
				} else {
					return {
						...prev,
						waiverFilters: [...currentFilters, filterValue],
					}
				}
			},
			resetScroll: false,
		})
	}

	// Remove a specific waiver filter
	const removeWaiverFilter = (filterValue: string) => {
		navigate({
			to: "/compete/organizer/$competitionId/athletes",
			params: { competitionId: competition.id },
			search: (prev) => {
				const filtered = (prev.waiverFilters || []).filter(
					(v) => v !== filterValue,
				)
				return {
					...prev,
					waiverFilters: filtered.length > 0 ? filtered : undefined,
				}
			},
			resetScroll: false,
		})
	}

	const formatDate = (date: Date | string) => {
		return new Date(date).toLocaleDateString(undefined, {
			year: "numeric",
			month: "short",
			day: "numeric",
		})
	}

	const getInitials = (firstName: string | null, lastName: string | null) => {
		const first = firstName?.[0] || ""
		const last = lastName?.[0] || ""
		return (first + last).toUpperCase() || "?"
	}

	const getAnswersForUser = (registrationId: string, userId: string) => {
		const answers = answersByRegistration[registrationId] || []
		return answers.filter((a) => a.userId === userId)
	}

	// Flatten registrations into individual athlete rows
	type AthleteRow = {
		ordinal: number
		ordinalLabel: string
		registrationId: string
		athlete: {
			id: string
			firstName: string | null
			lastName: string | null
			email: string | null
			avatar: string | null
		}
		isCaptain: boolean
		division: { label: string } | null
		teamName: string | null
		registeredAt: Date | string | null
		joinedAt: Date | null
	}

	const athleteRows: AthleteRow[] = []
	let rowIndex = 0
	registrations.forEach((registration) => {
		rowIndex++
		const isTeamDivision = (registration.division?.teamSize ?? 1) > 1

		// Type assertion for nested relations
		const athleteTeamWithMemberships = registration.athleteTeam as {
			memberships?: Array<{
				id: string
				userId: string
				joinedAt: Date | null
				user?: {
					id: string
					firstName: string | null
					lastName: string | null
					email: string | null
					avatar: string | null
				} | null
			}>
		} | null

		// Get all team members (captain first, then teammates)
		const allMembers: Array<{
			user: NonNullable<
				NonNullable<typeof athleteTeamWithMemberships>["memberships"]
			>[number]["user"]
			isCaptain: boolean
			joinedAt: Date | null
		}> = []

		// Add captain first
		if (registration.user) {
			allMembers.push({
				user: registration.user,
				isCaptain: true,
				joinedAt: null,
			})
		}

		// Add teammates
		if (isTeamDivision && athleteTeamWithMemberships?.memberships) {
			athleteTeamWithMemberships.memberships
				.filter((m) => m.userId !== registration.userId && m.user)
				.forEach((m) => {
					allMembers.push({
						user: m.user!,
						isCaptain: false,
						joinedAt: m.joinedAt,
					})
				})
		}

		// Create a row for each member
		allMembers.forEach((member, memberIndex) => {
			athleteRows.push({
				registrationId: registration.id,
				ordinal: rowIndex,
				ordinalLabel: memberIndex === 0 ? String(rowIndex) : "",
				athlete: {
					id: member.user?.id ?? "",
					firstName: member.user?.firstName ?? null,
					lastName: member.user?.lastName ?? null,
					email: member.user?.email ?? null,
					avatar: member.user?.avatar ?? null,
				},
				isCaptain: member.isCaptain,
				division: registration.division,
				teamName: isTeamDivision ? registration.teamName : null,
				registeredAt: member.isCaptain ? registration.registeredAt : null,
				joinedAt: member.joinedAt,
			})
		})
	})

	// Get waiver signed date for a user
	const getWaiverSignedDate = (
		userId: string,
		waiverId: string,
	): Date | null => {
		const key = `${userId}-${waiverId}`
		return signaturesByUser[key] || null
	}

	// Get unique answer values for each question (for filters)
	const questionFilterOptions = questions.reduce(
		(acc, question) => {
			const values = new Set<string>()
			Object.values(answersByRegistration).forEach((answers) => {
				answers.forEach((a) => {
					if (a.questionId === question.id && a.answer) {
						values.add(a.answer)
					}
				})
			})
			acc[question.id] = Array.from(values).sort()
			return acc
		},
		{} as Record<string, string[]>,
	)

	// Filter athlete rows based on question and waiver filters (all OR logic)
	const filteredAthleteRows = athleteRows.filter((row) => {
		// Apply question filters (match ANY of the selected values per question)
		for (const [questionId, filterValues] of Object.entries(
			currentQuestionFilters,
		)) {
			if (filterValues && filterValues.length > 0) {
				const answers = getAnswersForUser(row.registrationId, row.athlete.id)
				const answer = answers.find((a) => a.questionId === questionId)
				if (!answer?.answer || !filterValues.includes(answer.answer)) {
					return false
				}
			}
		}

		// Apply waiver filters (match ANY of the selected waiver conditions - OR logic)
		if (currentWaiverFilters.length > 0) {
			const matchesAnyWaiverFilter = currentWaiverFilters.some(
				(waiverFilter) => {
					const [waiverId, status] = waiverFilter.split(":")
					const signedDate = getWaiverSignedDate(row.athlete.id, waiverId)
					if (status === "signed") return !!signedDate
					if (status === "unsigned") return !signedDate
					return false
				},
			)
			if (!matchesAnyWaiverFilter) return false
		}

		return true
	})

	const handleExportCSV = () => {
		// Build CSV header
		const headers = [
			"#",
			"Athlete Name",
			"Email",
			"Division",
			"Team Name",
			"Registered",
			"Joined",
		]
		questions.forEach((q) => headers.push(q.label))
		waivers.forEach((w) => headers.push(`${w.title} (Signed)`))

		// Build CSV rows from filtered athlete rows
		const rows = filteredAthleteRows.map((row) => {
			const csvRow = [
				row.ordinalLabel,
				`${row.athlete.firstName ?? ""} ${row.athlete.lastName ?? ""}`.trim(),
				row.athlete.email ?? "",
				row.division?.label ?? "",
				row.teamName ?? "",
				row.registeredAt ? formatDate(row.registeredAt) : "",
				row.joinedAt ? formatDate(row.joinedAt) : "",
			]

			// Add answer columns for this specific athlete
			const answers = getAnswersForUser(row.registrationId, row.athlete.id)
			questions.forEach((question) => {
				const answer = answers.find((a) => a.questionId === question.id)
				csvRow.push(answer?.answer ?? "")
			})

			// Add waiver columns
			waivers.forEach((waiver) => {
				const signedDate = getWaiverSignedDate(row.athlete.id, waiver.id)
				csvRow.push(signedDate ? formatDate(signedDate) : "Not signed")
			})

			return csvRow
		})

		// Sanitize cell value to prevent CSV injection (formula characters)
		const sanitizeCell = (value: string): string => {
			const escaped = value.replace(/"/g, '""')
			// Prefix formula-triggering characters with a single quote to prevent spreadsheet injection
			return /^[=+\-@]/.test(escaped) ? `'${escaped}` : escaped
		}

		// Generate CSV content
		const csvContent = [
			headers.map((h) => `"${sanitizeCell(h)}"`).join(","),
			...rows.map((row) =>
				row.map((cell) => `"${sanitizeCell(String(cell))}"`).join(","),
			),
		].join("\n")

		// Download CSV
		const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
		const link = document.createElement("a")
		const url = URL.createObjectURL(blob)
		link.setAttribute("href", url)
		link.setAttribute(
			"download",
			`${competition.slug}-athletes-${new Date().toISOString().split("T")[0]}.csv`,
		)
		link.style.visibility = "hidden"
		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)
		URL.revokeObjectURL(url)
	}

	return (
		<div className="flex flex-col gap-6">
			{/* Registration Questions Editor */}
			<RegistrationQuestionsEditor
				competitionId={competition.id}
				teamId={teamId}
				questions={questions}
				onQuestionsChange={handleQuestionsChange}
			/>

			{/* Athletes Section */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-xl font-semibold">Registered Athletes</h2>
					<p className="text-muted-foreground text-sm">
						{registrations.length} registration
						{registrations.length !== 1 ? "s" : ""}
					</p>
				</div>
				{registrations.length > 0 && (
					<Button onClick={handleExportCSV} variant="outline" size="sm">
						<Download className="h-4 w-4 mr-2" />
						Export CSV
					</Button>
				)}
			</div>

			{registrations.length === 0 && !currentDivisionFilter ? (
				<Card>
					<CardHeader>
						<CardTitle>No Registrations</CardTitle>
						<CardDescription>
							No athletes have registered for this competition yet.
						</CardDescription>
					</CardHeader>
				</Card>
			) : (
				<div className="flex flex-col gap-4">
					{/* Filters */}
					<div className="flex flex-col gap-3">
						{/* Filter dropdowns */}
						<div className="flex flex-wrap items-center gap-3">
							{/* Division filter (single select) */}
							<Select
								value={currentDivisionFilter || "all"}
								onValueChange={handleDivisionChange}
							>
								<SelectTrigger className="w-[200px]">
									<SelectValue placeholder="All Divisions" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Divisions</SelectItem>
									{divisions.map((division) => (
										<SelectItem key={division.id} value={division.id}>
											{division.label} ({division.registrationCount})
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							{/* Question filters (multi-select via dropdown) */}
							{questions.map((question) => {
								const options = questionFilterOptions[question.id] || []
								const selectedValues = currentQuestionFilters[question.id] || []
								const availableOptions = options.filter(
									(o) => !selectedValues.includes(o),
								)
								if (options.length === 0 || availableOptions.length === 0)
									return null
								return (
									<Select
										key={question.id}
										value="__placeholder__"
										onValueChange={(value) => {
											if (value !== "__placeholder__") {
												toggleQuestionFilter(question.id, value)
											}
										}}
									>
										<SelectTrigger className="w-[180px]">
											<span className="text-muted-foreground">
												+ {question.label}
											</span>
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="__placeholder__" className="hidden">
												Select...
											</SelectItem>
											{availableOptions.map((option) => (
												<SelectItem key={option} value={option}>
													{option}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)
							})}

							{/* Waiver filter (multi-select via dropdown) */}
							{waivers.length > 0 &&
								(() => {
									const availableWaiverOptions = waivers.flatMap((waiver) => {
										const items = []
										const signedKey = `${waiver.id}:signed`
										const unsignedKey = `${waiver.id}:unsigned`
										if (!currentWaiverFilters.includes(signedKey)) {
											items.push({
												key: signedKey,
												label: `${waiver.title}: Signed`,
											})
										}
										if (!currentWaiverFilters.includes(unsignedKey)) {
											items.push({
												key: unsignedKey,
												label: `${waiver.title}: Not Signed`,
											})
										}
										return items
									})
									if (availableWaiverOptions.length === 0) return null
									return (
										<Select
											value="__placeholder__"
											onValueChange={(value) => {
												if (value !== "__placeholder__") {
													toggleWaiverFilter(value)
												}
											}}
										>
											<SelectTrigger className="w-[200px]">
												<span className="text-muted-foreground">
													+ Waiver Status
												</span>
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="__placeholder__" className="hidden">
													Select...
												</SelectItem>
												{availableWaiverOptions.map((option) => (
													<SelectItem key={option.key} value={option.key}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									)
								})()}
						</div>

						{/* Active filter pills */}
						{(Object.keys(currentQuestionFilters).length > 0 ||
							currentWaiverFilters.length > 0) && (
							<div className="flex flex-wrap items-center gap-2">
								{/* Question filter pills */}
								{Object.entries(currentQuestionFilters).flatMap(
									([questionId, values]) => {
										const question = questions.find((q) => q.id === questionId)
										if (!question || !values) return []
										return values.map((value) => (
											<Badge
												key={`${questionId}-${value}`}
												variant="secondary"
												className="pl-2 pr-1 py-1 flex items-center gap-1"
											>
												<span className="text-xs text-muted-foreground">
													{question.label}:
												</span>
												<span>{value}</span>
												<button
													type="button"
													onClick={() =>
														removeQuestionFilter(questionId, value)
													}
													className="ml-1 hover:bg-muted rounded-full p-0.5"
												>
													<X className="h-3 w-3" />
												</button>
											</Badge>
										))
									},
								)}

								{/* Waiver filter pills */}
								{currentWaiverFilters.map((filterValue) => {
									const [waiverId, status] = filterValue.split(":")
									const waiver = waivers.find((w) => w.id === waiverId)
									if (!waiver) return null
									return (
										<Badge
											key={filterValue}
											variant="secondary"
											className="pl-2 pr-1 py-1 flex items-center gap-1"
										>
											<span className="text-xs text-muted-foreground">
												{waiver.title}:
											</span>
											<span>
												{status === "signed" ? "Signed" : "Not Signed"}
											</span>
											<button
												type="button"
												onClick={() => removeWaiverFilter(filterValue)}
												className="ml-1 hover:bg-muted rounded-full p-0.5"
											>
												<X className="h-3 w-3" />
											</button>
										</Badge>
									)
								})}
							</div>
						)}
					</div>

					{registrations.length === 0 ? (
						<Card>
							<CardHeader>
								<CardTitle>No Registrations</CardTitle>
								<CardDescription>
									No athletes are registered in this division.
								</CardDescription>
							</CardHeader>
						</Card>
					) : (
						<Card>
							<CardContent className="p-0">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className="w-[50px]">#</TableHead>
											<TableHead>Athlete</TableHead>
											<TableHead>Division</TableHead>
											<TableHead>Team Name</TableHead>
											{questions.map((question) => (
												<TableHead key={question.id}>
													{question.label}
												</TableHead>
											))}
											{waivers.map((waiver) => (
												<TableHead key={waiver.id}>{waiver.title}</TableHead>
											))}
											<TableHead>
												<span className="flex items-center gap-1">
													<Calendar className="h-3.5 w-3.5" />
													Registered
												</span>
											</TableHead>
											<TableHead>
												<span className="flex items-center gap-1">
													<Calendar className="h-3.5 w-3.5" />
													Joined
												</span>
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{filteredAthleteRows.map((row) => (
											<TableRow key={`${row.registrationId}-${row.athlete.id}`}>
												<TableCell className="font-mono text-sm text-muted-foreground">
													{row.ordinalLabel}
												</TableCell>
												<TableCell>
													<div className="flex items-center gap-3">
														<Avatar className="h-8 w-8">
															<AvatarImage
																src={row.athlete.avatar ?? undefined}
																alt={`${row.athlete.firstName ?? ""} ${row.athlete.lastName ?? ""}`}
															/>
															<AvatarFallback className="text-xs">
																{getInitials(
																	row.athlete.firstName,
																	row.athlete.lastName,
																)}
															</AvatarFallback>
														</Avatar>
														<div className="flex flex-col">
															<span className="font-medium">
																{row.athlete.firstName ?? ""}{" "}
																{row.athlete.lastName ?? ""}
																{row.isCaptain && row.teamName && (
																	<span className="text-xs text-muted-foreground ml-1">
																		(captain)
																	</span>
																)}
															</span>
															<span className="text-xs text-muted-foreground flex items-center gap-1">
																<Mail className="h-3 w-3" />
																{row.athlete.email}
															</span>
														</div>
													</div>
												</TableCell>
												<TableCell>
													{row.division ? (
														<Badge variant="outline">
															{row.division.label}
														</Badge>
													) : (
														<span className="text-muted-foreground">—</span>
													)}
												</TableCell>
												<TableCell>
													{row.teamName ? (
														<span className="font-medium">{row.teamName}</span>
													) : (
														<span className="text-muted-foreground">—</span>
													)}
												</TableCell>
												{questions.map((question) => {
													const answers = getAnswersForUser(
														row.registrationId,
														row.athlete.id,
													)
													const answer = answers.find(
														(a) => a.questionId === question.id,
													)
													return (
														<TableCell key={question.id} className="text-sm">
															{answer?.answer ?? "—"}
														</TableCell>
													)
												})}
												{waivers.map((waiver) => {
													const signedDate = getWaiverSignedDate(
														row.athlete.id,
														waiver.id,
													)
													return (
														<TableCell key={waiver.id} className="text-sm">
															{signedDate ? (
																<span className="text-green-600">
																	{formatDate(signedDate)}
																</span>
															) : (
																<span className="text-muted-foreground">
																	Not signed
																</span>
															)}
														</TableCell>
													)
												})}
												<TableCell className="text-muted-foreground text-sm">
													{row.registeredAt
														? formatDate(row.registeredAt)
														: null}
												</TableCell>
												<TableCell className="text-muted-foreground text-sm">
													{row.joinedAt ? formatDate(row.joinedAt) : null}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</CardContent>
						</Card>
					)}
				</div>
			)}
		</div>
	)
}
