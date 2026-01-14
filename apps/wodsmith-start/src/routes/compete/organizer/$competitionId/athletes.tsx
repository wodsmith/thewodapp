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
} from "@tanstack/react-router"
import { Calendar, Download, Mail, Users } from "lucide-react"
import { z } from "zod"
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
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip"
import {
	getCompetitionByIdFn,
	getOrganizerRegistrationsFn,
} from "@/server-fns/competition-detail-fns"
import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"
import {
	getCompetitionQuestionsFn,
	getCompetitionRegistrationAnswersFn,
} from "@/server-fns/registration-questions-fns"

const parentRoute = getRouteApi("/compete/organizer/$competitionId")

const athletesSearchSchema = z.object({
	division: z.string().optional(),
})

export const Route = createFileRoute(
	"/compete/organizer/$competitionId/athletes",
)({
	component: AthletesPage,
	validateSearch: athletesSearchSchema,
	loaderDeps: ({ search }) => ({ division: search?.division }),
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

		// Parallel fetch: registrations, divisions, questions, and answers
		const [registrationsResult, divisionsResult, questionsResult, answersResult] = await Promise.all([
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
		])

		return {
			registrations: registrationsResult.registrations,
			divisions: divisionsResult.divisions,
			questions: questionsResult.questions,
			answersByRegistration: answersResult.answersByRegistration,
			currentDivisionFilter: divisionFilter,
		}
	},
})

function AthletesPage() {
	const { competition } = parentRoute.useLoaderData()
	const { registrations, divisions, questions, answersByRegistration, currentDivisionFilter } =
		Route.useLoaderData()
	const navigate = useNavigate()

	const handleDivisionChange = (value: string) => {
		navigate({
			to: "/compete/organizer/$competitionId/athletes",
			params: { competitionId: competition.id },
			search: value === "all" ? {} : { division: value },
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

	const getPendingCount = (pendingTeammates: string | null): number => {
		if (!pendingTeammates) return 0
		try {
			const pending = JSON.parse(pendingTeammates) as unknown[]
			return pending.length
		} catch {
			return 0
		}
	}

	const getAnswersForRegistration = (registrationId: string, captainUserId: string) => {
		const answers = answersByRegistration[registrationId] || []
		// For forTeammates questions, show captain's answer
		const captainAnswers = answers.filter(a => a.userId === captainUserId)
		return captainAnswers
	}

	const formatAnswers = (registrationId: string, captainUserId: string) => {
		const answers = getAnswersForRegistration(registrationId, captainUserId)
		if (answers.length === 0) return "—"

		return answers
			.map(answer => {
				const question = questions.find(q => q.id === answer.questionId)
				if (!question) return null
				return `${question.label}: ${answer.answer}`
			})
			.filter(Boolean)
			.join(", ")
	}

	const handleExportCSV = () => {
		// Build CSV header
		const headers = ["#", "Athlete Name", "Email", "Division", "Team", "Registered"]
		questions.forEach(q => headers.push(q.label))

		// Build CSV rows
		const rows = registrations.map((registration, index) => {
			const row = [
				String(index + 1),
				`${registration.user?.firstName ?? ""} ${registration.user?.lastName ?? ""}`.trim(),
				registration.user?.email ?? "",
				registration.division?.label ?? "Unknown",
				registration.teamName ?? "—",
				formatDate(registration.registeredAt),
			]

			// Add answer columns
			const answers = getAnswersForRegistration(registration.id, registration.userId)
			questions.forEach(question => {
				const answer = answers.find(a => a.questionId === question.id)
				row.push(answer?.answer ?? "")
			})

			return row
		})

		// Generate CSV content
		const csvContent = [
			headers.map(h => `"${h.replace(/"/g, '""')}"`).join(","),
			...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
		].join("\n")

		// Download CSV
		const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
		const link = document.createElement("a")
		const url = URL.createObjectURL(blob)
		link.setAttribute("href", url)
		link.setAttribute("download", `${competition.slug}-athletes-${new Date().toISOString().split("T")[0]}.csv`)
		link.style.visibility = "hidden"
		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)
	}

	return (
		<div className="flex flex-col gap-4">
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
					<div className="flex items-center gap-4">
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
											<TableHead>Team</TableHead>
											{questions.length > 0 && (
												<TableHead>Answers</TableHead>
											)}
											<TableHead>
												<span className="flex items-center gap-1">
													<Calendar className="h-3.5 w-3.5" />
													Registered
												</span>
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{registrations.map((registration, index) => {
											const pendingCount = getPendingCount(
												registration.pendingTeammates,
											)
											const isTeamDivision =
												(registration.division?.teamSize ?? 1) > 1

											// Get teammates (non-captain members)
											// Type assertion needed because Drizzle's relation inference doesn't fully capture nested relations
											const athleteTeamWithMemberships =
												registration.athleteTeam as {
													memberships?: Array<{
														id: string
														userId: string
														user?: {
															id: string
															firstName: string | null
															lastName: string | null
															email: string | null
															avatar: string | null
														} | null
													}>
												} | null
											const teammates =
												athleteTeamWithMemberships?.memberships?.filter(
													(m: { userId: string; user?: unknown }) =>
														m.userId !== registration.userId && m.user,
												) ?? []

											return (
												<TableRow key={registration.id}>
													<TableCell className="text-muted-foreground font-mono text-sm align-top pt-4">
														{index + 1}
													</TableCell>
													<TableCell>
														<div className="flex flex-col gap-2">
															{/* Captain */}
															<div className="flex items-center gap-3">
																<Avatar className="h-8 w-8">
																	<AvatarImage
																		src={registration.user?.avatar ?? undefined}
																		alt={`${registration.user?.firstName ?? ""} ${registration.user?.lastName ?? ""}`}
																	/>
																	<AvatarFallback className="text-xs">
																		{getInitials(
																			registration.user?.firstName ?? null,
																			registration.user?.lastName ?? null,
																		)}
																	</AvatarFallback>
																</Avatar>
																<div className="flex flex-col">
																	<span className="font-medium">
																		{registration.user?.firstName ?? ""}{" "}
																		{registration.user?.lastName ?? ""}
																		{isTeamDivision && (
																			<span className="text-xs text-muted-foreground ml-1">
																				(captain)
																			</span>
																		)}
																	</span>
																	<span className="text-xs text-muted-foreground flex items-center gap-1">
																		<Mail className="h-3 w-3" />
																		{registration.user?.email}
																	</span>
																</div>
															</div>
															{/* Teammates */}
															{teammates.length > 0 && (
																<div className="ml-11 flex flex-col gap-1">
																	{teammates.map((member) => (
																		<div
																			key={member.id}
																			className="flex items-center gap-2 text-sm text-muted-foreground"
																		>
																			<Avatar className="h-5 w-5">
																				<AvatarImage
																					src={member.user?.avatar ?? undefined}
																					alt={`${member.user?.firstName ?? ""} ${member.user?.lastName ?? ""}`}
																				/>
																				<AvatarFallback className="text-[10px]">
																					{getInitials(
																						member.user?.firstName ?? null,
																						member.user?.lastName ?? null,
																					)}
																				</AvatarFallback>
																			</Avatar>
																			<span>
																				{member.user?.firstName ?? ""}{" "}
																				{member.user?.lastName ?? ""}
																			</span>
																		</div>
																	))}
																</div>
															)}
														</div>
													</TableCell>
													<TableCell className="align-top pt-4">
														<Badge variant="outline">
															{registration.division?.label ?? "Unknown"}
														</Badge>
													</TableCell>
													<TableCell className="align-top pt-4">
														{isTeamDivision ? (
															<div className="flex flex-col gap-1">
																<span className="font-medium">
																	{registration.teamName ?? "—"}
																</span>
																{pendingCount > 0 && (
																	<span className="text-xs text-amber-600 flex items-center gap-1">
																		<Users className="h-3 w-3" />
																		{pendingCount} pending
																	</span>
																)}
															</div>
														) : (
															<span className="text-muted-foreground">—</span>
														)}
													</TableCell>
													{questions.length > 0 && (
														<TableCell className="align-top pt-4">
															<TooltipProvider>
																<Tooltip>
																	<TooltipTrigger asChild>
																		<div className="max-w-[200px] truncate text-sm">
																			{formatAnswers(registration.id, registration.userId)}
																		</div>
																	</TooltipTrigger>
																	<TooltipContent className="max-w-md">
																		<div className="flex flex-col gap-1">
																			{getAnswersForRegistration(registration.id, registration.userId).map((answer) => {
																				const question = questions.find(q => q.id === answer.questionId)
																				if (!question) return null
																				return (
																					<div key={answer.id} className="text-sm">
																						<span className="font-medium">{question.label}:</span> {answer.answer}
																					</div>
																				)
																			})}
																		</div>
																	</TooltipContent>
																</Tooltip>
															</TooltipProvider>
														</TableCell>
													)}
													<TableCell className="text-muted-foreground text-sm align-top pt-4">
														{formatDate(registration.registeredAt)}
													</TableCell>
												</TableRow>
											)
										})}
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
