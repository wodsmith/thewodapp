/**
 * Organizer Video Submissions List Route
 *
 * Lists all video submissions for an online competition event.
 * Allows organizers to review submissions, filter by division/status, and navigate to individual submissions.
 */

import { useState } from "react"
import {
	createFileRoute,
	getRouteApi,
	Link,
	useNavigate,
} from "@tanstack/react-router"
import {
	Calendar,
	CheckCircle2,
	Clock,
	ExternalLink,
	Play,
	X,
} from "lucide-react"
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
import { Progress } from "@/components/ui/progress"
import { getCompetitionByIdFn } from "@/server-fns/competition-detail-fns"
import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"
import { getCompetitionEventFn } from "@/server-fns/competition-workouts-fns"
import { getOrganizerSubmissionsFn } from "@/server-fns/video-submission-fns"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")

// Search schema for URL state
const submissionsSearchSchema = z.object({
	division: z.string().optional(),
	status: z.enum(["all", "pending", "reviewed"]).optional(),
	sort: z.enum(["newest", "oldest", "athlete", "division", "score"]).optional(),
})

export const Route = createFileRoute(
	"/compete/organizer/$competitionId/events/$eventId/submissions",
)({
	component: SubmissionsPage,
	validateSearch: submissionsSearchSchema,
	loaderDeps: ({ search }) => ({
		division: search?.division,
		status: search?.status,
	}),
	loader: async ({ params, deps }) => {
		// First get competition to know the teamId
		const { competition } = await getCompetitionByIdFn({
			data: { competitionId: params.competitionId },
		})

		if (!competition) {
			throw new Error("Competition not found")
		}

		// Only allow for online competitions
		if (competition.competitionType !== "online") {
			throw new Error(
				"Video submissions are only available for online competitions",
			)
		}

		// Parallel fetch event details, divisions, and submissions
		const [eventResult, divisionsResult, submissionsResult] = await Promise.all(
			[
				getCompetitionEventFn({
					data: {
						trackWorkoutId: params.eventId,
						teamId: competition.organizingTeamId,
					},
				}),
				getCompetitionDivisionsWithCountsFn({
					data: {
						competitionId: params.competitionId,
						teamId: competition.organizingTeamId,
					},
				}),
				getOrganizerSubmissionsFn({
					data: {
						trackWorkoutId: params.eventId,
						competitionId: params.competitionId,
						divisionFilter: deps?.division,
						statusFilter: deps?.status,
					},
				}),
			],
		)

		if (!eventResult.event) {
			throw new Error("Event not found")
		}

		return {
			event: eventResult.event,
			divisions: divisionsResult.divisions,
			submissions: submissionsResult.submissions,
			totals: submissionsResult.totals,
			currentDivisionFilter: deps?.division,
			currentStatusFilter: deps?.status || "all",
		}
	},
})

function SubmissionsPage() {
	const {
		event,
		divisions,
		submissions,
		totals,
		currentDivisionFilter,
		currentStatusFilter,
	} = Route.useLoaderData()
	const { competition } = parentRoute.useLoaderData()
	const navigate = useNavigate()
	const search = Route.useSearch()

	// Local state for sorting (client-side)
	const [sortBy, setSortBy] = useState<string>(search.sort || "newest")

	const handleDivisionChange = (value: string) => {
		navigate({
			to: "/compete/organizer/$competitionId/events/$eventId/submissions",
			params: {
				competitionId: competition.id,
				eventId: event.id,
			},
			search: (prev) => ({
				...prev,
				division: value === "all" ? undefined : value,
			}),
			resetScroll: false,
		})
	}

	const handleStatusChange = (value: string) => {
		navigate({
			to: "/compete/organizer/$competitionId/events/$eventId/submissions",
			params: {
				competitionId: competition.id,
				eventId: event.id,
			},
			search: (prev) => ({
				...prev,
				status: value === "all" ? undefined : (value as "pending" | "reviewed"),
			}),
			resetScroll: false,
		})
	}

	const clearFilters = () => {
		navigate({
			to: "/compete/organizer/$competitionId/events/$eventId/submissions",
			params: {
				competitionId: competition.id,
				eventId: event.id,
			},
			search: {},
			resetScroll: false,
		})
	}

	// Sort submissions client-side
	const sortedSubmissions = [...submissions].sort((a, b) => {
		switch (sortBy) {
			case "newest":
				return (
					new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
				)
			case "oldest":
				return (
					new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
				)
			case "athlete": {
				const nameA = `${a.athlete.firstName || ""} ${a.athlete.lastName || ""}`
					.trim()
					.toLowerCase()
				const nameB = `${b.athlete.firstName || ""} ${b.athlete.lastName || ""}`
					.trim()
					.toLowerCase()
				return nameA.localeCompare(nameB)
			}
			case "division": {
				const divA = a.division?.label || ""
				const divB = b.division?.label || ""
				return divA.localeCompare(divB)
			}
			case "score": {
				// Sort by score value, nulls last
				if (a.score?.value === null && b.score?.value === null) return 0
				if (a.score?.value === null) return 1
				if (b.score?.value === null) return -1
				return (a.score?.value || 0) - (b.score?.value || 0)
			}
			default:
				return 0
		}
	})

	const formatDate = (date: Date | string) => {
		return new Date(date).toLocaleDateString(undefined, {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		})
	}

	const getInitials = (firstName: string | null, lastName: string | null) => {
		const first = firstName?.[0] || ""
		const last = lastName?.[0] || ""
		return (first + last).toUpperCase() || "?"
	}

	const progressPercentage =
		totals.total > 0 ? Math.round((totals.reviewed / totals.total) * 100) : 0

	const hasActiveFilters =
		currentDivisionFilter ||
		(currentStatusFilter && currentStatusFilter !== "all")

	return (
		<div className="flex flex-col gap-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Video Submissions</h1>
					<p className="text-muted-foreground">
						Event #{event.trackOrder} - {event.workout.name}
					</p>
				</div>
				<Link
					to="/compete/organizer/$competitionId/events/$eventId"
					params={{
						competitionId: competition.id,
						eventId: event.id,
					}}
				>
					<Button variant="outline" size="sm">
						Back to Event
					</Button>
				</Link>
			</div>

			{/* Progress Card */}
			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-lg">Review Progress</CardTitle>
					<CardDescription>
						{totals.reviewed} of {totals.total} submissions reviewed
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex items-center gap-4">
						<Progress value={progressPercentage} className="flex-1" />
						<span className="text-sm font-medium">{progressPercentage}%</span>
					</div>
					<div className="mt-3 flex gap-4 text-sm">
						<div className="flex items-center gap-2">
							<div className="h-3 w-3 rounded-full bg-green-500" />
							<span>Reviewed: {totals.reviewed}</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="h-3 w-3 rounded-full bg-yellow-500" />
							<span>Pending: {totals.pending}</span>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Filters */}
			<div className="flex flex-col gap-3">
				<div className="flex flex-wrap items-center gap-3">
					{/* Division filter */}
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
									{division.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					{/* Status filter */}
					<Select
						value={currentStatusFilter || "all"}
						onValueChange={handleStatusChange}
					>
						<SelectTrigger className="w-[180px]">
							<SelectValue placeholder="All Status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Status</SelectItem>
							<SelectItem value="pending">Pending Review</SelectItem>
							<SelectItem value="reviewed">Reviewed</SelectItem>
						</SelectContent>
					</Select>

					{/* Sort */}
					<Select value={sortBy} onValueChange={setSortBy}>
						<SelectTrigger className="w-[180px]">
							<SelectValue placeholder="Sort by" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="newest">Newest First</SelectItem>
							<SelectItem value="oldest">Oldest First</SelectItem>
							<SelectItem value="athlete">Athlete Name</SelectItem>
							<SelectItem value="division">Division</SelectItem>
							<SelectItem value="score">Score</SelectItem>
						</SelectContent>
					</Select>

					{/* Clear filters */}
					{hasActiveFilters && (
						<Button
							variant="ghost"
							size="sm"
							onClick={clearFilters}
							className="gap-1"
						>
							<X className="h-4 w-4" />
							Clear Filters
						</Button>
					)}
				</div>

				{/* Active filter pills */}
				{hasActiveFilters && (
					<div className="flex flex-wrap items-center gap-2">
						{currentDivisionFilter && (
							<Badge
								variant="secondary"
								className="pl-2 pr-1 py-1 flex items-center gap-1"
							>
								<span className="text-xs text-muted-foreground">Division:</span>
								<span>
									{divisions.find((d) => d.id === currentDivisionFilter)
										?.label || currentDivisionFilter}
								</span>
								<button
									type="button"
									onClick={() => handleDivisionChange("all")}
									className="ml-1 hover:bg-muted rounded-full p-0.5"
								>
									<X className="h-3 w-3" />
								</button>
							</Badge>
						)}
						{currentStatusFilter && currentStatusFilter !== "all" && (
							<Badge
								variant="secondary"
								className="pl-2 pr-1 py-1 flex items-center gap-1"
							>
								<span className="text-xs text-muted-foreground">Status:</span>
								<span className="capitalize">{currentStatusFilter}</span>
								<button
									type="button"
									onClick={() => handleStatusChange("all")}
									className="ml-1 hover:bg-muted rounded-full p-0.5"
								>
									<X className="h-3 w-3" />
								</button>
							</Badge>
						)}
					</div>
				)}
			</div>

			{/* Submissions Table */}
			{sortedSubmissions.length === 0 ? (
				<Card>
					<CardHeader>
						<CardTitle>No Submissions</CardTitle>
						<CardDescription>
							{hasActiveFilters
								? "No submissions match the current filters."
								: "No video submissions have been received for this event yet."}
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
									<TableHead>Claimed Score</TableHead>
									<TableHead>
										<span className="flex items-center gap-1">
											<Calendar className="h-3.5 w-3.5" />
											Submitted
										</span>
									</TableHead>
									<TableHead>Video</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className="w-[100px]">Action</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{sortedSubmissions.map((submission, index) => (
									<TableRow
										key={submission.id}
										className="cursor-pointer hover:bg-muted/50"
									>
										<TableCell className="font-mono text-sm text-muted-foreground">
											{index + 1}
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-3">
												<Avatar className="h-8 w-8">
													<AvatarImage
														src={submission.athlete.avatar ?? undefined}
														alt={`${submission.athlete.firstName ?? ""} ${submission.athlete.lastName ?? ""}`}
													/>
													<AvatarFallback className="text-xs">
														{getInitials(
															submission.athlete.firstName,
															submission.athlete.lastName,
														)}
													</AvatarFallback>
												</Avatar>
												<div className="flex flex-col">
													<span className="font-medium">
														{submission.athlete.firstName ?? ""}{" "}
														{submission.athlete.lastName ?? ""}
													</span>
													{submission.teamName && (
														<span className="text-xs text-muted-foreground">
															{submission.teamName}
														</span>
													)}
												</div>
											</div>
										</TableCell>
										<TableCell>
											{submission.division ? (
												<Badge variant="outline">
													{submission.division.label}
												</Badge>
											) : (
												<span className="text-muted-foreground">—</span>
											)}
										</TableCell>
										<TableCell>
											{submission.score?.displayScore ? (
												<span className="font-mono">
													{submission.score.displayScore}
													{submission.score.status === "cap" && (
														<span className="ml-1 text-xs text-muted-foreground">
															(cap)
														</span>
													)}
												</span>
											) : (
												<span className="text-muted-foreground">—</span>
											)}
										</TableCell>
										<TableCell className="text-muted-foreground text-sm">
											{formatDate(submission.submittedAt)}
										</TableCell>
										<TableCell>
											<a
												href={submission.videoUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
												onClick={(e) => e.stopPropagation()}
											>
												<Play className="h-3.5 w-3.5" />
												Watch
												<ExternalLink className="h-3 w-3" />
											</a>
										</TableCell>
										<TableCell>
											{submission.reviewStatus === "reviewed" ? (
												<Badge variant="default" className="gap-1 bg-green-600">
													<CheckCircle2 className="h-3 w-3" />
													Reviewed
												</Badge>
											) : (
												<Badge variant="secondary" className="gap-1">
													<Clock className="h-3 w-3" />
													Pending
												</Badge>
											)}
										</TableCell>
										<TableCell>
											<Link
												to="/compete/organizer/$competitionId/events/$eventId/submissions/$submissionId"
												params={{
													competitionId: competition.id,
													eventId: event.id,
													submissionId: submission.id,
												}}
												onClick={(e) => e.stopPropagation()}
											>
												<Button variant="outline" size="sm">
													Review
												</Button>
											</Link>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}
		</div>
	)
}
