import { createFileRoute, notFound } from "@tanstack/react-router"
import {
	Calendar,
	Clock,
	Dumbbell,
	ExternalLink,
	Hash,
	Link,
	MapPin,
	Target,
	Timer,
	Trophy,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { getPublicCompetitionDivisionsFn } from "@/server-fns/competition-divisions-fns"
import { getCompetitionBySlugFn } from "@/server-fns/competition-fns"
import {
	getPublicEventDetailsFn,
	getWorkoutDivisionDescriptionsFn,
} from "@/server-fns/competition-workouts-fns"

export const Route = createFileRoute("/compete/$slug/events/$eventId")({
	component: EventDetailsPage,
	loader: async ({ params }) => {
		const { slug, eventId } = params

		// Fetch competition by slug first
		const { competition } = await getCompetitionBySlugFn({
			data: { slug },
		})

		if (!competition) {
			throw notFound()
		}

		// Fetch event details in parallel with divisions
		const [eventResult, divisionsResult] = await Promise.all([
			getPublicEventDetailsFn({ data: { eventId } }),
			getPublicCompetitionDivisionsFn({
				data: { competitionId: competition.id },
			}),
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
			heatTimes: eventResult.heatTimes,
			totalEvents: eventResult.totalEvents,
			divisionDescriptions,
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

function formatHeatTime(date: Date, timezone?: string): string {
	return new Intl.DateTimeFormat("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		timeZone: timezone,
	}).format(new Date(date))
}

function formatEventDate(
	startDate: Date | null,
	endDate: Date | null,
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

function getResourceIcon(url: string | null) {
	if (!url) return <Link className="h-4 w-4" />
	return <Link className="h-4 w-4" />
}

function EventDetailsPage() {
	const {
		competition,
		event,
		resources,
		heatTimes,
		totalEvents,
		divisionDescriptions,
	} = Route.useLoaderData()

	const workout = event.workout
	const formattedTimeCap = workout.timeCap ? formatTime(workout.timeCap) : null
	const schemeLabel = getSchemeLabel(workout.scheme, workout.timeCap)

	// Get RX description (position 0 is typically the hardest/RX)
	const sortedDivisions = [...divisionDescriptions].sort(
		(a, b) => a.position - b.position,
	)
	const rxDivision = sortedDivisions.find((d) => d.position === 0)
	const displayDescription =
		rxDivision?.description || workout.description || null

	// Only show divisions that have descriptions
	const divisionsWithDescriptions = sortedDivisions.filter((d) => d.description)

	const hasMovementsOrTags =
		(workout.movements && workout.movements.length > 0) ||
		(workout.tags && workout.tags.length > 0)

	const eventDate = formatEventDate(competition.startDate, competition.endDate)

	return (
		<div className="space-y-6">
			{/* Event Title with Context */}
			<div className="space-y-2">
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
				<h1 className="text-3xl font-bold tracking-tight">{workout.name}</h1>

				{/* Workout Type Badges */}
				<div className="flex flex-wrap gap-2 pt-2">
					<div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-secondary text-secondary-foreground">
						<Target className="h-4 w-4" />
						{schemeLabel}
					</div>
					{formattedTimeCap && (
						<div
							className={cn(
								"inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border",
								workout.scheme === "time-with-cap"
									? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900"
									: "bg-secondary text-secondary-foreground border-transparent",
							)}
						>
							<Timer className="h-4 w-4" />
							{formattedTimeCap} Cap
						</div>
					)}
					{workout.scoreType && (
						<div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-secondary text-secondary-foreground">
							<Trophy className="h-4 w-4" />
							{workout.scoreType}
						</div>
					)}
					{workout.roundsToScore && workout.roundsToScore > 1 && (
						<div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-secondary text-secondary-foreground">
							<Hash className="h-4 w-4" />
							{workout.roundsToScore} Rounds
						</div>
					)}
				</div>
			</div>

			<div className="grid gap-8 lg:grid-cols-3">
				{/* Main Content - Event Details */}
				<div className="lg:col-span-2 space-y-6">
					{/* Event Description */}
					<div className="font-mono text-sm whitespace-pre-wrap leading-relaxed">
						{displayDescription || "Details coming soon."}
					</div>

					{/* Movements and Tags */}
					{hasMovementsOrTags && (
						<Card>
							<CardContent className="pt-6">
								<div className="grid gap-6 md:grid-cols-2">
									{workout.movements && workout.movements.length > 0 && (
										<div>
											<h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
												<Dumbbell className="h-3.5 w-3.5" />
												Movements
											</h4>
											<ul className="space-y-1.5">
												{workout.movements.map(
													(m: { id: string; name: string }) => (
														<li
															key={m.id}
															className="text-sm font-medium text-foreground/90"
														>
															{m.name}
														</li>
													),
												)}
											</ul>
										</div>
									)}

									{workout.tags && workout.tags.length > 0 && (
										<div>
											<h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
												Tags
											</h4>
											<div className="flex flex-wrap gap-1.5">
												{workout.tags.map(
													(tag: { id: string; name: string }) => (
														<Badge
															key={tag.id}
															variant="secondary"
															className="text-xs font-normal"
														>
															{tag.name}
														</Badge>
													),
												)}
											</div>
										</div>
									)}
								</div>
							</CardContent>
						</Card>
					)}

					{/* Division Variations */}
					{divisionsWithDescriptions.length > 1 && (
						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="text-lg">Division Variations</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								{divisionsWithDescriptions.map((div) => (
									<div key={div.divisionId}>
										<h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
											{div.divisionLabel}
											{div.position === 0 && (
												<Badge variant="secondary" className="text-xs">
													RX
												</Badge>
											)}
										</h4>
										<div className="bg-muted/40 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap border">
											{div.description}
										</div>
									</div>
								))}
							</CardContent>
						</Card>
					)}
				</div>

				{/* Sidebar */}
				<div className="space-y-6">
					{/* Event Resources Card */}
					{resources.length > 0 && (
						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="text-lg">Event Resources</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								{resources.map(
									(resource: {
										id: string
										title: string
										description: string | null
										url: string | null
									}) => (
										<a
											key={resource.id}
											href={resource.url ?? "#"}
											target="_blank"
											rel="noopener noreferrer"
											className={cn(
												"flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors group",
												!resource.url && "pointer-events-none",
											)}
										>
											<div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary shrink-0">
												{getResourceIcon(resource.url)}
											</div>
											<div className="flex-1 min-w-0">
												<p className="font-medium text-sm group-hover:text-primary transition-colors">
													{resource.title}
												</p>
												{resource.description && (
													<p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
														{resource.description}
													</p>
												)}
											</div>
											{resource.url && (
												<ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
											)}
										</a>
									),
								)}
							</CardContent>
						</Card>
					)}

					{/* Event Meta Card */}
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-lg">Event Meta</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
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
							{competition.location && (
								<div className="flex items-start gap-3">
									<MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
									<div>
										<p className="text-xs text-muted-foreground uppercase tracking-wider">
											Location
										</p>
										<p className="font-medium text-sm">
											{competition.location}
										</p>
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
												First Heat
											</p>
											<p className="font-medium text-sm">
												{formatHeatTime(
													heatTimes.firstHeatTime,
													competition.timezone,
												)}
											</p>
										</div>
									</div>
									{heatTimes.firstHeatTime.getTime() !==
										heatTimes.lastHeatTime.getTime() && (
										<div className="flex items-start gap-3">
											<Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
											<div>
												<p className="text-xs text-muted-foreground uppercase tracking-wider">
													Last Heat
												</p>
												<p className="font-medium text-sm">
													{formatHeatTime(
														heatTimes.lastHeatTime,
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
				</div>
			</div>
		</div>
	)
}
