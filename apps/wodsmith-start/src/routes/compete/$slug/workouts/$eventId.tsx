import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import {
	Calendar,
	Clock,
	Dumbbell,
	ExternalLink,
	FileText,
	Filter,
	Link as LinkIcon,
	Target,
	Timer,
	Trophy,
} from "lucide-react"
import { z } from "zod"
import { AthleteScoreSubmission } from "@/components/compete/athlete-score-submission"
import { VideoSubmissionForm } from "@/components/compete/video-submission-form"
import { CompetitionTabs } from "@/components/competition-tabs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { getUserCompetitionRegistrationFn } from "@/server-fns/competition-detail-fns"
import { getPublicCompetitionDivisionsFn } from "@/server-fns/competition-divisions-fns"
import { getCompetitionBySlugFn } from "@/server-fns/competition-fns"
import {
	getPublicEventDetailsFn,
	getWorkoutDivisionDescriptionsFn,
} from "@/server-fns/competition-workouts-fns"
import { getEventJudgingSheetsFn } from "@/server-fns/judging-sheet-fns"
import { getVideoSubmissionFn } from "@/server-fns/video-submission-fns"
import { getSessionFromCookie } from "@/utils/auth"

const eventSearchSchema = z.object({
	division: z.string().optional(),
})

// Server function to get athlete's registered division for this competition
const getAthleteRegisteredDivisionFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z.object({ competitionId: z.string() }).parse(data),
	)
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()
		if (!session?.user?.id) {
			return { divisionId: null }
		}

		const result = await getUserCompetitionRegistrationFn({
			data: { competitionId: data.competitionId, userId: session.user.id },
		})

		return { divisionId: result.registration?.divisionId ?? null }
	})

export const Route = createFileRoute("/compete/$slug/workouts/$eventId")({
	component: EventDetailsPage,
	validateSearch: (search) => eventSearchSchema.parse(search),
	loader: async ({ params }) => {
		const { slug, eventId } = params

		// Fetch competition by slug first
		const { competition } = await getCompetitionBySlugFn({
			data: { slug },
		})

		if (!competition) {
			throw notFound()
		}

		// Fetch event details, divisions, judging sheets, athlete's division, and video submission in parallel
		const [
			eventResult,
			divisionsResult,
			judgingSheetsResult,
			athleteDivisionResult,
			videoSubmissionResult,
		] = await Promise.all([
			getPublicEventDetailsFn({
				data: { eventId, competitionId: competition.id },
			}),
			getPublicCompetitionDivisionsFn({
				data: { competitionId: competition.id },
			}),
			getEventJudgingSheetsFn({ data: { trackWorkoutId: eventId } }),
			getAthleteRegisteredDivisionFn({
				data: { competitionId: competition.id },
			}),
			// Only fetch video submission for online competitions
			competition.competitionType === "online"
				? getVideoSubmissionFn({
						data: { trackWorkoutId: eventId, competitionId: competition.id },
					})
				: Promise.resolve(null),
		])

		if (!eventResult.event) {
			throw notFound()
		}

		// Fetch division descriptions if there are divisions
		const divisions = divisionsResult.divisions ?? []
		let divisionDescriptions: Array<{
			divisionId: string
			divisionLabel: string
			description: string | null
			position: number
		}> = []

		if (divisions.length > 0) {
			const descResult = await getWorkoutDivisionDescriptionsFn({
				data: {
					workoutId: eventResult.event.workoutId,
					divisionIds: divisions.map((d) => d.id),
				},
			})
			divisionDescriptions = descResult.descriptions
		}

		return {
			competition,
			event: eventResult.event,
			resources: eventResult.resources,
			judgingSheets: judgingSheetsResult.sheets,
			heatTimes: eventResult.heatTimes,
			totalEvents: eventResult.totalEvents,
			divisionDescriptions,
			divisions,
			athleteRegisteredDivisionId: athleteDivisionResult.divisionId,
			videoSubmission: videoSubmissionResult,
		}
	},
})

function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60)
	const s = seconds % 60
	return `${m}:${s.toString().padStart(2, "0")}`
}

function getSchemeLabel(scheme: string, timeCap?: number | null): string {
	if (scheme === "time" || scheme === "time-with-cap") {
		return timeCap ? "For Time (Capped)" : "For Time"
	}
	if (scheme === "amrap") return "AMRAP"
	if (scheme === "emom") return "EMOM"
	if (scheme === "load") return "For Load"
	return scheme.replace(/-/g, " ").toUpperCase()
}

function formatHeatTime(date: Date, timezone?: string | null): string {
	return new Intl.DateTimeFormat("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		timeZone: timezone ?? undefined,
	}).format(new Date(date))
}

function formatEventDate(
	startDate: string | null,
	endDate: string | null,
): string | null {
	if (!startDate) return null

	const start = new Date(startDate)
	const formatOptions: Intl.DateTimeFormatOptions = {
		month: "short",
		day: "numeric",
		year: "numeric",
	}

	if (!endDate || start.toDateString() === new Date(endDate).toDateString()) {
		return new Intl.DateTimeFormat("en-US", formatOptions).format(start)
	}

	const end = new Date(endDate)
	const startStr = new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
	}).format(start)
	const endStr = new Intl.DateTimeFormat("en-US", formatOptions).format(end)

	return `${startStr} - ${endStr}`
}

function EventDetailsPage() {
	const {
		competition,
		event,
		resources,
		judgingSheets,
		heatTimes,
		totalEvents,
		divisionDescriptions,
		divisions,
		athleteRegisteredDivisionId,
		videoSubmission,
	} = Route.useLoaderData()
	const { slug } = Route.useParams()
	const search = Route.useSearch()
	const navigate = useNavigate({ from: Route.fullPath })

	const workout = event.workout
	const formattedTimeCap = workout.timeCap ? formatTime(workout.timeCap) : null
	const schemeLabel = getSchemeLabel(workout.scheme, workout.timeCap)

	// Sort division descriptions by position
	const sortedDivisions = [...divisionDescriptions].sort(
		(a, b) => a.position - b.position,
	)

	// Default to athlete's registered division, otherwise first division
	const defaultDivisionId =
		athleteRegisteredDivisionId ||
		(divisions && divisions.length > 0 ? divisions[0].id : undefined)
	const selectedDivisionId = search.division || defaultDivisionId

	// Get the selected division's description, fallback to workout description
	// Only use division description if it exists and is not empty
	const selectedDivision = sortedDivisions.find(
		(d) => d.divisionId === selectedDivisionId,
	)
	const divisionDescription = selectedDivision?.description?.trim()
	const displayDescription = divisionDescription || workout.description || null

	const eventDate = formatEventDate(competition.startDate, competition.endDate)

	const handleDivisionChange = (divisionId: string) => {
		navigate({
			search: (prev) => ({ ...prev, division: divisionId }),
			replace: true,
		})
	}

	return (
		<div className="grid gap-6 lg:grid-cols-[1fr_320px]">
			{/* Main Content */}
			<div className="space-y-4">
				{/* Competition Tabs */}
				<div className="sticky top-4 z-10">
					<CompetitionTabs slug={slug} />
				</div>

				{/* Glassmorphism Content Container */}
				<div className="rounded-2xl border border-black/10 bg-black/5 p-6 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
					<div className="space-y-8">
						{/* Header with Division Switcher */}
						<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
							<div className="space-y-1">
								<div className="flex items-center gap-3">
									<Badge variant="outline" className="text-xs font-medium">
										Event {event.trackOrder} of {totalEvents}
									</Badge>
									{event.sponsorName && (
										<span className="text-xs text-muted-foreground">
											Presented by{" "}
											<span className="font-medium">{event.sponsorName}</span>
										</span>
									)}
								</div>
								<h1 className="text-2xl font-bold tracking-tight">
									{workout.name}
								</h1>
							</div>

							{divisions && divisions.length > 0 && (
								<div className="flex items-center gap-2">
									<Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
									<Select
										value={selectedDivisionId}
										onValueChange={handleDivisionChange}
									>
										<SelectTrigger className="w-full sm:w-[240px] h-10 font-medium">
											<SelectValue placeholder="Select Division" />
										</SelectTrigger>
										<SelectContent>
											{divisions.map((division) => (
												<SelectItem
													key={division.id}
													value={division.id}
													className="cursor-pointer"
												>
													{division.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							)}
						</div>

						{/* Event Description */}
						<div className="font-mono text-sm whitespace-pre-wrap leading-relaxed">
							{displayDescription || "Details coming soon."}
						</div>
					</div>
				</div>
			</div>

			{/* Sidebar */}
			<aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
				{/* Video Submission Card - Only for online competitions */}
				{competition.competitionType === "online" && videoSubmission && (
					<VideoSubmissionForm
						trackWorkoutId={event.id}
						competitionId={competition.id}
						timezone={competition.timezone}
						initialData={videoSubmission}
					/>
				)}

				{/* Score Submission Card (Online Competitions Only) */}
				{competition.competitionType === "online" && (
					<AthleteScoreSubmission
						competitionId={competition.id}
						trackWorkoutId={event.id}
						competitionTimezone={competition.timezone}
					/>
				)}

				{/* Event Info Card - Metadata */}
				<Card>
					<CardContent className="pt-6 space-y-4">
						{/* Workout Type */}
						<div className="flex items-start gap-3">
							<Target className="h-4 w-4 text-muted-foreground mt-0.5" />
							<div>
								<p className="text-xs text-muted-foreground uppercase tracking-wider">
									Format
								</p>
								<p className="font-medium text-sm">{schemeLabel}</p>
							</div>
						</div>

						{/* Time Cap */}
						{formattedTimeCap && (
							<div className="flex items-start gap-3">
								<Timer className="h-4 w-4 text-muted-foreground mt-0.5" />
								<div>
									<p className="text-xs text-muted-foreground uppercase tracking-wider">
										Time Cap
									</p>
									<p className="font-medium text-sm">{formattedTimeCap}</p>
								</div>
							</div>
						)}

						{/* Movements */}
						{workout.movements && workout.movements.length > 0 && (
							<div className="flex items-start gap-3">
								<Dumbbell className="h-4 w-4 text-muted-foreground mt-0.5" />
								<div>
									<p className="text-xs text-muted-foreground uppercase tracking-wider">
										Movements
									</p>
									<p className="font-medium text-sm">
										{workout.movements
											.map((m: { id: string; name: string }) => m.name)
											.join(", ")}
									</p>
								</div>
							</div>
						)}

						{eventDate && (
							<div className="flex items-start gap-3">
								<Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
								<div>
									<p className="text-xs text-muted-foreground uppercase tracking-wider">
										Date
									</p>
									<p className="font-medium text-sm">{eventDate}</p>
								</div>
							</div>
						)}

						{event.pointsMultiplier && event.pointsMultiplier !== 100 && (
							<div className="flex items-start gap-3">
								<Trophy className="h-4 w-4 text-muted-foreground mt-0.5" />
								<div>
									<p className="text-xs text-muted-foreground uppercase tracking-wider">
										Points Multiplier
									</p>
									<p className="font-medium text-sm">
										{event.pointsMultiplier / 100}x
									</p>
								</div>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Schedule Card */}
				{heatTimes && (
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-lg">Schedule</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-3">
								<div className="flex items-start gap-3">
									<Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
									<div>
										<p className="text-xs text-muted-foreground uppercase tracking-wider">
											First Heat Starts
										</p>
										<p className="font-medium text-sm">
											{formatHeatTime(
												heatTimes.firstHeatStartTime,
												competition.timezone,
											)}
										</p>
									</div>
								</div>
								{heatTimes.firstHeatStartTime.getTime() !==
									heatTimes.lastHeatEndTime.getTime() && (
									<div className="flex items-start gap-3">
										<Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
										<div>
											<p className="text-xs text-muted-foreground uppercase tracking-wider">
												Last Heat Ends
											</p>
											<p className="font-medium text-sm">
												{formatHeatTime(
													heatTimes.lastHeatEndTime,
													competition.timezone,
												)}
											</p>
										</div>
									</div>
								)}
							</div>
							<Separator />
							<p className="text-xs text-muted-foreground">
								Timezone: {competition.timezone}
							</p>
						</CardContent>
					</Card>
				)}

				{/* Event Resources Card */}
				{resources && resources.length > 0 && (
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-lg">Event Resources</CardTitle>
						</CardHeader>
						<CardContent>
							<ul className="space-y-3">
								{resources.map((resource) => (
									<li key={resource.id}>
										{resource.url ? (
											<a
												href={resource.url}
												target="_blank"
												rel="noopener noreferrer"
												className="flex items-center gap-3 text-sm hover:text-primary transition-colors group"
											>
												<LinkIcon className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
												<span className="flex-1">{resource.title}</span>
												<ExternalLink className="h-3 w-3 text-muted-foreground" />
											</a>
										) : (
											<div className="flex items-center gap-3 text-sm">
												<FileText className="h-4 w-4 text-muted-foreground" />
												<span className="flex-1">{resource.title}</span>
											</div>
										)}
									</li>
								))}
							</ul>
						</CardContent>
					</Card>
				)}

				{/* Judge Sheets Card */}
				{judgingSheets && judgingSheets.length > 0 && (
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-lg">Judge Sheets</CardTitle>
						</CardHeader>
						<CardContent>
							<ul className="space-y-3">
								{judgingSheets.map((sheet) => (
									<li key={sheet.id}>
										<a
											href={sheet.url}
											target="_blank"
											rel="noopener noreferrer"
											className="flex items-center gap-3 text-sm hover:text-primary transition-colors group"
										>
											<FileText className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
											<span className="flex-1">{sheet.title}</span>
											<ExternalLink className="h-3 w-3 text-muted-foreground" />
										</a>
									</li>
								))}
							</ul>
						</CardContent>
					</Card>
				)}
			</aside>
		</div>
	)
}
